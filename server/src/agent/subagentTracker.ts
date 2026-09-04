import path from 'node:path';
import fs from 'node:fs';
import { getSession } from '../db/index.js';
import type {
  SubagentSession,
  SubagentState,
  SubagentDetailResponse,
  SubagentTranscriptTurn,
} from '../types/contract.js';

const BRAIN_BASE_DIR = path.join(
  process.env.HOME || '/home/adam',
  '.gemini',
  'antigravity-cli',
  'brain'
);

interface RawSubagentPlan {
  role: string;
  type: string;
  model?: string;
  prompt?: string;
}

/**
 * Scan parent conversation transcript and discover all spawned subagents.
 */
export function getSubagentsForSession(sessionId: string): SubagentSession[] {
  const session = getSession(sessionId);
  if (!session || !session.agy_conversation_id) {
    return [];
  }

  const parentConvId = session.agy_conversation_id;
  const parentTranscriptPath = path.join(
    BRAIN_BASE_DIR,
    parentConvId,
    '.system_generated',
    'logs',
    'transcript.jsonl'
  );

  if (!fs.existsSync(parentTranscriptPath)) {
    return [];
  }

  const subagentsMap = new Map<string, SubagentSession>();
  let pendingInvocations: RawSubagentPlan[] = [];

  try {
    const parentContent = fs.readFileSync(parentTranscriptPath, 'utf-8');
    const lines = parentContent.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      let parsed: any;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      // 1. Detect invoke_subagent tool call in PLANNER_RESPONSE
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        for (const tc of parsed.tool_calls) {
          if (tc.name === 'invoke_subagent') {
            let subs = tc.args?.Subagents;
            if (typeof subs === 'string') {
              try {
                subs = JSON.parse(subs);
              } catch {
                subs = [];
              }
            }
            if (Array.isArray(subs)) {
              pendingInvocations = subs.map((s: any) => ({
                role: s.Role || s.TypeName || 'Subagent',
                type: s.TypeName || 'subagent',
                model: s.Model,
                prompt: s.Prompt,
              }));
            }
          }
        }
      }

      // 2. Detect subagent creation confirmation in GENERIC output
      if (parsed.type === 'GENERIC' && parsed.content) {
        const content = parsed.content as string;

        if (content.includes('Created the following subagents') || content.includes('conversationId')) {
          const idMatches = [...content.matchAll(/"conversationId":\s*"([a-f0-9\-]{36})"/g)];
          idMatches.forEach((match, idx) => {
            const convId = match[1];
            const info = pendingInvocations[idx] || { role: 'Subagent', type: 'subagent' };
            const existing = subagentsMap.get(convId);

            subagentsMap.set(convId, {
              id: convId,
              parentId: parentConvId,
              role: existing?.role || info.role || 'Subagent',
              type: existing?.type || info.type || 'subagent',
              model: existing?.model || info.model || 'inherit',
              prompt: existing?.prompt || info.prompt,
              state: existing?.state || 'running',
              stepsCount: existing?.stepsCount || 0,
              transcriptUri: `file://${path.join(BRAIN_BASE_DIR, convId, '.system_generated', 'logs', 'transcript.jsonl')}`,
            });
          });

          if (idMatches.length > 0) {
            pendingInvocations = [];
          }
        }

        // Check for manage_subagents action list result JSON
        const jsonArrayMatch = content.match(/\[\s*\{.*"conversationId".*\}\s*\]/s);
        if (jsonArrayMatch) {
          try {
            const arr = JSON.parse(jsonArrayMatch[0]);
            for (const item of arr) {
              if (item.conversationId) {
                const existing = subagentsMap.get(item.conversationId);
                subagentsMap.set(item.conversationId, {
                  id: item.conversationId,
                  parentId: parentConvId,
                  role: item.role || existing?.role || 'Subagent',
                  type: item.type || existing?.type || 'subagent',
                  model: existing?.model || 'inherit',
                  prompt: existing?.prompt,
                  state: (item.state as SubagentState) || existing?.state || 'running',
                  stateDetail: item.stateDetail || existing?.stateDetail,
                  stepsCount: existing?.stepsCount || 0,
                  transcriptUri: item.transcript || existing?.transcriptUri,
                });
              }
            }
          } catch {
            // non-fatal
          }
        }
      }

      // 3. Detect incoming messages from subagents in SYSTEM_MESSAGE
      if (parsed.type === 'SYSTEM_MESSAGE' && parsed.content) {
        const senderMatch = parsed.content.match(/sender=([a-f0-9\-]{36})/);
        if (senderMatch) {
          const senderId = senderMatch[1];
          const sub = subagentsMap.get(senderId);
          if (sub) {
            sub.state = 'completed';
          }
        }
      }
    }
  } catch (err) {
    console.error(`[subagentTracker:error:parent:${parentConvId}]`, err);
  }

  // Enrich each discovered subagent with data from its own transcript
  const results: SubagentSession[] = [];

  for (const [id, sub] of subagentsMap.entries()) {
    const subTranscriptPath = path.join(
      BRAIN_BASE_DIR,
      id,
      '.system_generated',
      'logs',
      'transcript.jsonl'
    );

    if (fs.existsSync(subTranscriptPath)) {
      try {
        const subContent = fs.readFileSync(subTranscriptPath, 'utf-8');
        const subLines = subContent.split('\n').filter((l) => l.trim());
        sub.stepsCount = subLines.length;

        if (subLines.length > 0) {
          // First step parsing for prompt and createdAt
          try {
            const first = JSON.parse(subLines[0]);
            if (!sub.prompt && first.content) {
              const cleanPrompt = first.content
                .replace(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>[\s\S]*/, '$1')
                .trim();
              sub.prompt = cleanPrompt || first.content.slice(0, 250);
            }
            if (first.created_at) {
              sub.createdAt = new Date(first.created_at).getTime();
            }
          } catch {
            // ignore
          }

          // Last step parsing for lastActive, currentStep, and state
          try {
            const last = JSON.parse(subLines[subLines.length - 1]);
            if (last.created_at) {
              sub.lastActive = new Date(last.created_at).getTime();
            }

            if (last.status === 'ERROR') {
              sub.state = 'errored';
            } else if (last.type === 'PLANNER_RESPONSE' && !last.tool_calls) {
              // Subagent produced final answer or response
              if (sub.state !== 'errored') {
                sub.state = 'completed';
              }
            }

            // Extract readable summary of current action
            if (last.tool_calls && last.tool_calls.length > 0) {
              const tc = last.tool_calls[0];
              const summary =
                tc.args?.toolSummary ||
                tc.args?.toolAction ||
                tc.args?.Instruction ||
                tc.args?.Description ||
                '';
              sub.currentStep = summary
                ? `${tc.name}: ${String(summary).replace(/^"|"$/g, '')}`
                : tc.name;
            } else if (last.thinking) {
              const cleanThought = last.thinking.trim().replace(/\n+/g, ' ');
              sub.currentStep = cleanThought.length > 80 ? cleanThought.slice(0, 80) + '...' : cleanThought;
            } else if (last.content) {
              const cleanContent = last.content.trim().replace(/\n+/g, ' ');
              sub.currentStep = cleanContent.length > 80 ? cleanContent.slice(0, 80) + '...' : cleanContent;
            }
          } catch {
            // ignore
          }

          // Recent logs extraction (last 5 entries formatted)
          const recentLogs: string[] = [];
          const logSlice = subLines.slice(-6);
          for (const rawLine of logSlice) {
            try {
              const entry = JSON.parse(rawLine);
              if (entry.thinking) {
                recentLogs.push(`💭 ${entry.thinking.slice(0, 100)}...`);
              } else if (entry.tool_calls && entry.tool_calls.length > 0) {
                recentLogs.push(`⚡ ${entry.tool_calls[0].name}`);
              } else if (entry.type === 'GENERIC' && entry.content) {
                const preview = entry.content.slice(0, 80).replace(/\n/g, ' ');
                recentLogs.push(`📄 ${preview}`);
              } else if (entry.content) {
                const preview = entry.content.slice(0, 80).replace(/\n/g, ' ');
                recentLogs.push(`💬 ${preview}`);
              }
            } catch {
              // ignore
            }
          }
          sub.recentLogs = recentLogs;
        }
      } catch (err) {
        console.warn(`[subagentTracker:error:subagent:${id}]`, err);
      }
    }

    results.push(sub);
  }

  // Sort subagents by creation date or steps count
  return results.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

/**
 * Get detailed subagent information including full transcript turns.
 */
export function getSubagentDetails(
  sessionId: string,
  subagentId: string
): SubagentDetailResponse | null {
  const subagents = getSubagentsForSession(sessionId);
  const subagent = subagents.find((s) => s.id === subagentId);
  if (!subagent) {
    return null;
  }

  const subTranscriptPath = path.join(
    BRAIN_BASE_DIR,
    subagentId,
    '.system_generated',
    'logs',
    'transcript.jsonl'
  );

  const transcript: SubagentTranscriptTurn[] = [];

  if (fs.existsSync(subTranscriptPath)) {
    try {
      const content = fs.readFileSync(subTranscriptPath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          transcript.push({
            step_index: parsed.step_index ?? transcript.length,
            source: parsed.source || 'MODEL',
            type: parsed.type || 'PLANNER_RESPONSE',
            status: parsed.status || 'DONE',
            created_at: parsed.created_at || new Date().toISOString(),
            content: parsed.content,
            thinking: parsed.thinking,
            tool_calls: parsed.tool_calls,
          });
        } catch {
          // ignore malformed lines
        }
      }
    } catch (err) {
      console.error(`[subagentTracker:details:error:${subagentId}]`, err);
    }
  }

  return {
    subagent,
    transcript,
  };
}
