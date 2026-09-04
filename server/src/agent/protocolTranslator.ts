import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import { ManagedProcessGroup, processRegistry } from './processGroup.js';
import {
  getSession,
  updateSession,
  updateSessionStatus,
  appendTurn,
  updateToolExecution,
  updateMessage,
  getDatabase,
} from '../db/index.js';
import {
  createPlanArtifact,
  handleToolArtifact,
  syncBrainDirArtifacts,
} from './artifactSync.js';
import { processSlashCommand } from './slashCommands.js';
import { getSubagentsForSession } from './subagentTracker.js';
import type {
  SSEEventType,
  SSEEventEnvelope,
  ThoughtDeltaPayload,
  ThoughtCompletePayload,
  MessageDeltaPayload,
  MessageCompletePayload,
  ToolStartPayload,
  ToolCompletePayload,
  DiffCreatedPayload,
  SlashCommandResultPayload,
  SubagentUpdatePayload,
  SubagentSession,
  ToolStatus,
  ReasoningEffort,
  MessageRole,
  AttachmentPayload,
} from '../types/contract.js';

// ============================================================================
// Real-Time SSE Broadcaster
// ============================================================================

export type SSEListener = (envelope: SSEEventEnvelope<any>, rawData: string) => void;

class SessionEventHub extends EventEmitter {
  private seqCounters = new Map<string, number>();

  public getNextSeq(sessionId: string): number {
    const next = (this.seqCounters.get(sessionId) || 0) + 1;
    this.seqCounters.set(sessionId, next);
    return next;
  }

  public broadcast<T>(sessionId: string, type: SSEEventType, payload: T): SSEEventEnvelope<T> {
    const seq = this.getNextSeq(sessionId);
    const envelope: SSEEventEnvelope<T> = {
      seq,
      session_id: sessionId,
      timestamp: Date.now(),
      type,
      payload,
    };

    const raw = `id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify(envelope)}\n\n`;
    this.emit(`event:${sessionId}`, envelope, raw);
    return envelope;
  }

  public subscribe(sessionId: string, listener: SSEListener): () => void {
    const channel = `event:${sessionId}`;
    this.on(channel, listener);
    return () => {
      this.off(channel, listener);
    };
  }
}

export const sessionEventHub = new SessionEventHub();

// ============================================================================
// Slash Command Interception
// ============================================================================

export interface SlashCommandResult {
  intercepted: boolean;
  transformedPrompt?: string;
  output?: string;
}

export async function handleSlashCommand(
  sessionId: string,
  prompt: string
): Promise<SlashCommandResult> {
  const result = await processSlashCommand(sessionId, prompt);
  return {
    intercepted: result.intercepted,
    transformedPrompt: result.transformedPrompt,
    output: result.output,
  };
}

// ============================================================================
// Agent Process Runner & Protocol Translator
// ============================================================================

export interface RunAgentTurnOptions {
  sessionId: string;
  prompt: string;
  model?: string;
  effort?: ReasoningEffort;
  attachments?: AttachmentPayload[];
}

function formatAttachmentSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function runAgentTurn(options: RunAgentTurnOptions): Promise<void> {
  let { sessionId, prompt, attachments } = options;

  // 1. Check for read-only slash command interception
  const slashResult = await handleSlashCommand(sessionId, prompt);
  if (slashResult.intercepted) {
    return;
  }
  if (slashResult.transformedPrompt) {
    prompt = slashResult.transformedPrompt;
  }

  const session = getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const requestedModel = options.model || session.model || 'gemini-3.8-flash-medium';
  let activeModel = requestedModel;
  if (activeModel === 'claude-3-7-sonnet') {
    activeModel = 'claude-sonnet-4-6';
  }

  const activeEffort = options.effort || session.effort || 'medium';

  // Normalize model when effort is specified for gemini models
  if (activeEffort) {
    if (activeModel.startsWith('gemini-3.8-flash')) {
      activeModel = `gemini-3.8-flash-${activeEffort}`;
    } else if (activeModel.startsWith('gemini-3.7-flash')) {
      activeModel = `gemini-3.7-flash-${activeEffort}`;
    } else if (activeModel.startsWith('gemini-3.6-flash')) {
      activeModel = `gemini-3.6-flash-${activeEffort}`;
    } else if (activeModel.startsWith('gemini-3.1-pro')) {
      activeModel = activeEffort === 'medium' ? 'gemini-3.1-pro-high' : `gemini-3.1-pro-${activeEffort}`;
    }
  }

  // 2. Persist User Message to DB (including attachment summary if present)
  let dbUserContent = prompt;
  if (attachments && attachments.length > 0) {
    const attachmentSummary = attachments
      .map((att) => `- 📎 **${att.name}** (${att.mimeType}, ${formatAttachmentSize(att.size)})`)
      .join('\n');
    dbUserContent = `${prompt}\n\n**Załączniki:**\n${attachmentSummary}`;
  }

  appendTurn(sessionId, {
    role: 'user',
    content: dbUserContent,
    status: 'completed',
  });

  // Prepare Assistant message placeholder in DB immediately to satisfy foreign keys
  const assistantMsgId = crypto.randomUUID();
  appendTurn(sessionId, {
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    status: 'streaming',
  });

  // Update session status to running
  updateSessionStatus(sessionId, 'running');
  sessionEventHub.broadcast(sessionId, 'session_status', { status: 'running' });

  let accumulatedResponse = '';
  let accumulatedThought = '';
  let thoughtStartMs: number | null = null;
  let thoughtDurationMs: number | null = null;
  let activeConversationId: string | null = session.agy_conversation_id || null;

  // Helper to read live reasoning from transcript.jsonl
  const pollTranscript = () => {
    if (!activeConversationId) return;
    const transcriptPath = path.join(
      process.env.HOME || '/home/adam',
      '.gemini/antigravity-cli/brain',
      activeConversationId,
      '.system_generated/logs/transcript.jsonl'
    );
    if (!fs.existsSync(transcriptPath)) return;
    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const stepObj = JSON.parse(line);
          if (stepObj.thinking && stepObj.type === 'PLANNER_RESPONSE') {
            const thoughtText = stepObj.thinking.trim();
            if (thoughtText && thoughtText !== accumulatedThought) {
              accumulatedThought = thoughtText;
              sessionEventHub.broadcast(sessionId, 'thought_delta', {
                step_index: stepObj.step_index ?? 0,
                delta: thoughtText,
              });
            }
          }
        } catch {
          // ignore malformed line
        }
      }
    } catch {
      // non-fatal
    }
  };

  // Active tool state map (step_index -> ToolState)
  interface ActiveTool {
    id: string;
    name: string;
    args: Record<string, unknown>;
    startMs: number;
    diffs: any[];
  }
  const activeTools = new Map<number, ActiveTool>();

  // Determine CLI binary location
  const agyBin = process.env.AGY_BIN || 'agy';

  const printTimeout = process.env.AGY_PRINT_TIMEOUT || '60m';
  const args = [
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--dangerously-skip-permissions',
    '--model',
    activeModel,
    '--print-timeout',
    printTimeout,
  ];

  // Only pass --effort if model does not already encode effort and is not claude/gpt
  const modelHasEffortSuffix = /-(low|medium|high)$/.test(activeModel);
  const isExcludedFromEffortFlag =
    activeModel.startsWith('claude-') ||
    activeModel.startsWith('gpt-oss-') ||
    modelHasEffortSuffix;
  if (!isExcludedFromEffortFlag && activeEffort) {
    args.push('--effort', activeEffort);
  }

  const cwd = session.workspace_path || process.env.WORKSPACE_ROOT || '/home/adam/projects/my-domain';

  // Continue existing Antigravity conversation context if available
  if (session.agy_conversation_id) {
    args.push('--conversation', session.agy_conversation_id);
  } else if (cwd) {
    args.push('--add-dir', cwd);
  }

  // 3. Spawn managed POSIX process group with resilience environment variables
  const silenceTimeout = process.env.INBOUND_SILENCE_TIMEOUT || '60m';
  const proc = new ManagedProcessGroup({
    cmd: agyBin,
    args,
    cwd,
    env: {
      ...process.env,
      INBOUND_SILENCE_TIMEOUT: silenceTimeout,
      AGY_PRINT_TIMEOUT: printTimeout,
    },
  });

  processRegistry.register(sessionId, proc);

  // 4. Send NDJSON user input turn to child stdin
  let agyContent = prompt;
  if (attachments && attachments.length > 0) {
    const attachmentLines = attachments
      .map((att) => {
        const filePath = att.filePath || att.name;
        return `- **${att.name}** (${att.mimeType}, ${formatAttachmentSize(att.size)}): \`${filePath}\``;
      })
      .join('\n');

    agyContent = `${prompt}\n\n### User Attachments\nThe user has attached the following file(s):\n${attachmentLines}\n\nPlease inspect the attached file(s) using the \`view_file\` tool (with the absolute path provided above) to examine their content or images before responding.`;
  }

  const inputMessage = JSON.stringify({
    event: 'user',
    message: {
      content: agyContent,
    },
  });

  proc.writeStdin(inputMessage + '\n');

  // 5. Line-delimited NDJSON parser on stdout
  let stdoutBuffer = '';

  const handleLine = (line: string) => {
    if (!line.trim()) return;

    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch {
      // Non-JSON output from sub-tools, log and ignore
      return;
    }

    const event = parsed.event;

    // Capture conversation ID for multi-turn continuation and transcript reading
    if (event === 'init' && parsed.conversation_id) {
      activeConversationId = parsed.conversation_id;
      updateSession(sessionId, { agy_conversation_id: parsed.conversation_id });
    }

    if (event === 'step_update' && parsed.step_update) {
      const step = parsed.step_update;
      const stepIndex = step.step_index ?? 0;
      const stepType = step.step_type;
      const state = step.state;

      // Check transcript for thinking tokens
      pollTranscript();

      // --- AGENT RESPONSE / THOUGHT ---
      if (stepType === 'agent_response') {
        if (step.usage?.thinking_tokens && !thoughtStartMs) {
          thoughtStartMs = Date.now();
        }

        // Text delta chunk
        if (step.text_delta) {
          accumulatedResponse += step.text_delta;
          const payload: MessageDeltaPayload = {
            step_index: stepIndex,
            delta: step.text_delta,
          };
          sessionEventHub.broadcast(sessionId, 'message_delta', payload);
        }

        // Response step completion
        if (state === 'DONE') {
          pollTranscript();
          if (thoughtStartMs && !thoughtDurationMs) {
            thoughtDurationMs = Math.round(
              step.duration_seconds
                ? step.duration_seconds * 1000
                : Date.now() - thoughtStartMs
            );
            const thoughtPayload: ThoughtCompletePayload = {
              step_index: stepIndex,
              thought: accumulatedThought || 'Analiza i wykonanie planu operacyjnego.',
              duration_ms: thoughtDurationMs,
            };
            sessionEventHub.broadcast(sessionId, 'thought_complete', thoughtPayload);
          }
        }
      }

      // --- TOOL EXECUTION ---
      if (stepType === 'tool') {
        const toolName = step.tool_name || step.tool_info?.name || 'unknown_tool';
        const toolArgs = step.tool_info?.parameters || {};

        if (state === 'ACTIVE') {
          const toolId = crypto.randomUUID();
          activeTools.set(stepIndex, {
            id: toolId,
            name: toolName,
            args: toolArgs,
            startMs: Date.now(),
            diffs: [],
          });

          const startPayload: ToolStartPayload = {
            tool_execution_id: toolId,
            step_index: stepIndex,
            tool_name: toolName,
            tool_args: toolArgs,
          };
          sessionEventHub.broadcast(sessionId, 'tool_start', startPayload);
        } else if (state === 'DONE') {
          let active = activeTools.get(stepIndex);
          const toolId = active?.id || crypto.randomUUID();
          const durationMs = step.duration_seconds
            ? Math.round(step.duration_seconds * 1000)
            : active
            ? Date.now() - active.startMs
            : 100;
          const output = step.tool_info?.output;

          // Check for file modification tools to synthesize FileDiff
          const diffs: any[] = [];
          if (
            ['replace_file_content', 'write_to_file', 'multi_replace_file_content'].includes(
              toolName
            )
          ) {
            const filePath =
              (toolArgs.TargetFile as string) || (toolArgs.AbsolutePath as string) || '';
            const beforeContent = (toolArgs.TargetContent as string) || null;
            const afterContent =
              (toolArgs.ReplacementContent as string) ||
              (toolArgs.CodeContent as string) ||
              null;

            const additions = afterContent ? afterContent.split('\n').length : 0;
            const deletions = beforeContent ? beforeContent.split('\n').length : 0;

            const diffId = crypto.randomUUID();
            const diffRecord = {
              id: diffId,
              tool_execution_id: toolId,
              session_id: sessionId,
              file_path: filePath,
              before_content: beforeContent,
              after_content: afterContent,
              additions,
              deletions,
              status: 'applied' as const,
              created_at: Date.now(),
            };

            diffs.push(diffRecord);

            const diffPayload: DiffCreatedPayload = {
              diff_id: diffId,
              tool_execution_id: toolId,
              file_path: filePath,
              before_content: beforeContent,
              after_content: afterContent,
              additions,
              deletions,
            };
            sessionEventHub.broadcast(sessionId, 'diff_created', diffPayload);
          }

          // Check for artifact creation from file write tools
          handleToolArtifact(sessionId, toolName, toolArgs, (art) => {
            sessionEventHub.broadcast(sessionId, 'artifact_created', art);
          });

          // Persist tool execution
          try {
            updateToolExecution(sessionId, {
              id: toolId,
              message_id: assistantMsgId,
              tool_name: toolName,
              tool_args: toolArgs,
              tool_result: typeof output === 'string' ? output : JSON.stringify(output),
              status: 'completed',
              duration_ms: durationMs,
              diffs,
            });
          } catch (dbErr) {
            console.error('[db:updateToolExecution:error]', dbErr);
          }

          const completePayload: ToolCompletePayload = {
            tool_execution_id: toolId,
            step_index: stepIndex,
            tool_name: toolName,
            output: typeof output === 'string' ? output : JSON.stringify(output),
            duration_ms: durationMs,
            status: 'completed',
          };
          sessionEventHub.broadcast(sessionId, 'tool_complete', completePayload);

          activeTools.delete(stepIndex);

          // If subagent tool was executed, immediately broadcast subagents state
          if (['invoke_subagent', 'manage_subagents'].includes(toolName)) {
            try {
              const subs = getSubagentsForSession(sessionId);
              if (subs.length > 0) {
                sessionEventHub.broadcast(sessionId, 'subagent_update', { subagents: subs });
              }
            } catch (subErr) {
              console.warn(`[subagent_update:error:${sessionId}]`, subErr);
            }
          }
        }
      }
    }

    // --- RESULT ---
    if (event === 'result' && parsed.result) {
      const res = parsed.result;
      if (res.status === 'ERROR') {
        const errMsg = res.error || 'Antigravity execution failed';
        if (errMsg.toLowerCase().includes('timeout')) {
          accumulatedResponse = `⚠️ **Przekroczono limit czasu operacji (timeout):**\n\n\`\`\`\n${errMsg}\n\`\`\`\n\n*Limit oczekiwania został skonfigurowany na 60 minut (\`AGY_PRINT_TIMEOUT=60m\`). W przypadku długich operacji wieloagentowych (swarmy subagentów, kompilacje) stan został zachowany w pamięci sesji — możesz wpisać kolejną wiadomość, a Antigravity podejmie przerwany kontekst.*`;
        } else {
          accumulatedResponse = `⚠️ **Błąd wykonania zadania:**\n\n\`\`\`\n${errMsg}\n\`\`\``;
        }
        sessionEventHub.broadcast(sessionId, 'turn_error', { message: errMsg });
      } else if (res.response) {
        accumulatedResponse = res.response;
      }

      // Close child stdin upon receiving turn result so it exits cleanly
      proc.closeStdin();

      // Final transcript poll
      pollTranscript();

      const completePayload: MessageCompletePayload = {
        message_id: assistantMsgId,
        content: accumulatedResponse,
        usage: res.usage
          ? {
              input_tokens: res.usage.input_tokens || 0,
              output_tokens: res.usage.output_tokens || 0,
              total_tokens: res.usage.total_tokens || 0,
            }
          : undefined,
      };

      sessionEventHub.broadcast(sessionId, 'message_complete', completePayload);
    }
  };

  // Periodic poll for subagents during active execution
  const subagentPollInterval = setInterval(() => {
    try {
      const subs = getSubagentsForSession(sessionId);
      if (subs.length > 0) {
        sessionEventHub.broadcast(sessionId, 'subagent_update', { subagents: subs });
      }
    } catch {
      // non-fatal
    }
  }, 3500);

  proc.child.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString('utf-8');
    let lineEnd: number;
    while ((lineEnd = stdoutBuffer.indexOf('\n')) !== -1) {
      const line = stdoutBuffer.slice(0, lineEnd);
      stdoutBuffer = stdoutBuffer.slice(lineEnd + 1);
      handleLine(line);
    }
  });

  let stderrBuffer = '';
  proc.child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf-8');
    stderrBuffer += text;
    console.error(`[agy:${sessionId}:stderr]`, text.trim());
  });

  try {
    const exitResult = await proc.exitPromise;
    clearInterval(subagentPollInterval);

    // Process remaining buffer
    if (stdoutBuffer.length > 0) {
      handleLine(stdoutBuffer);
      stdoutBuffer = '';
    }

    // Final check for thinking
    pollTranscript();

    // Final subagents broadcast
    try {
      const finalSubs = getSubagentsForSession(sessionId);
      if (finalSubs.length > 0) {
        sessionEventHub.broadcast(sessionId, 'subagent_update', { subagents: finalSubs });
      }
    } catch {}

    const finalStatus = 'idle';

    let finalContent = accumulatedResponse;
    if (!finalContent) {
      if (exitResult.code === 0) {
        finalContent = 'Zadanie zostało zakończone.';
      } else {
        const isTimeout = stderrBuffer.toLowerCase().includes('timeout');
        if (isTimeout) {
          finalContent = `⚠️ **Limit czasu oczekiwania został przekroczony (timeout):**\n\n\`\`\`\n${stderrBuffer.trim()}\n\`\`\`\n\n*Limit czasu został zwiększony do 60 minut. Wpisz polecenie, aby kontynuować.*`;
        } else {
          finalContent = `⚠️ **Błąd wykonania zadania (kod ${exitResult.code}):**\n\n\`\`\`\n${stderrBuffer.trim() || 'Nieznany błąd wykonania agy'}\n\`\`\``;
        }
        sessionEventHub.broadcast(sessionId, 'turn_error', {
          message: stderrBuffer.trim() || `Proces zakończył się kodem błędu ${exitResult.code}`,
        });
      }
      sessionEventHub.broadcast(sessionId, 'message_complete', {
        message_id: assistantMsgId,
        content: finalContent,
      });
    }

    // Update the Assistant message in SQLite
    updateMessage(assistantMsgId, {
      content: finalContent,
      thought: accumulatedThought || null,
      thought_duration_ms: thoughtDurationMs || null,
      status: exitResult.code === 0 ? 'completed' : 'failed',
    });

    // Check if the turn produced a plan or documentation artifact
    createPlanArtifact(sessionId, prompt, finalContent, (art) => {
      sessionEventHub.broadcast(sessionId, 'artifact_created', art);
    });

    if (activeConversationId) {
      syncBrainDirArtifacts(sessionId, activeConversationId, (art) => {
        sessionEventHub.broadcast(sessionId, 'artifact_created', art);
      });
    }

    updateSessionStatus(sessionId, finalStatus);
    sessionEventHub.broadcast(sessionId, 'session_status', { status: finalStatus });
  } catch (err: any) {
    clearInterval(subagentPollInterval);
    sessionEventHub.broadcast(sessionId, 'turn_error', {
      error: err.message || 'Error occurred during agent turn execution',
    });
    updateMessage(assistantMsgId, {
      content: `⚠️ Wystąpił błąd: ${err.message}`,
      status: 'failed',
    });
    updateSessionStatus(sessionId, 'failed');
    sessionEventHub.broadcast(sessionId, 'session_status', { status: 'failed' });
  }
}
