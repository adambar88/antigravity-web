import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Artifact, ArtifactType } from '../types/contract.js';
import { upsertArtifact, getDatabase } from '../db/index.js';

export interface PlanDetectionResult {
  isPlan: boolean;
  title: string;
  type: ArtifactType;
  identifier: string;
}

/**
 * Checks whether a user prompt and assistant response represent a structured plan.
 */
export function detectPlanStructure(userPrompt: string, assistantContent: string): PlanDetectionResult | null {
  if (!assistantContent || assistantContent.trim().length < 150) {
    return null;
  }

  const lowerPrompt = userPrompt.toLowerCase();
  const lowerContent = assistantContent.toLowerCase();

  const isPlanRequested =
    userPrompt.trim().startsWith('/plan') ||
    lowerPrompt.includes('[plan implementacji') ||
    lowerPrompt.includes('plan implementacji') ||
    lowerPrompt.includes('plan działania') ||
    lowerPrompt.includes('opracuj plan') ||
    lowerPrompt.includes('szczegółowy plan') ||
    lowerPrompt.includes('przygotuj plan');

  if (isPlanRequested) {
    if (!assistantContent || assistantContent.trim().length < 40) {
      return null;
    }
  } else {
    if (!assistantContent || assistantContent.trim().length < 150) {
      return null;
    }
    const hasPlanMarkers =
      (assistantContent.includes('Faza 1') ||
        assistantContent.includes('Etap 1') ||
        assistantContent.includes('Krok 1') ||
        assistantContent.includes('Phase 1') ||
        assistantContent.includes('## Plan') ||
        assistantContent.includes('# Plan') ||
        lowerContent.includes('plan implementacji') ||
        lowerContent.includes('harmonogram prac') ||
        lowerContent.includes('architektura i wdrożenie')) &&
      assistantContent.length > 250;

    if (!hasPlanMarkers) {
      return null;
    }
  }

  // Determine a concise, descriptive title
  let title = 'Plan implementacji';

  if (userPrompt.includes('Zadanie:')) {
    const afterTask = userPrompt.split('Zadanie:')[1].split('\n')[0].trim();
    if (afterTask.length > 0 && afterTask.length < 70) {
      title = `Plan: ${afterTask}`;
    }
  } else if (userPrompt.trim().startsWith('/plan')) {
    const task = userPrompt.trim().replace(/^\/plan\s*/i, '').trim();
    if (task.length > 0 && task.length < 70) {
      title = `Plan: ${task}`;
    }
  } else if (userPrompt.includes(':')) {
    const afterColon = userPrompt.split(':').slice(1).join(':').trim();
    if (afterColon.length > 0 && afterColon.length < 70) {
      title = `Plan: ${afterColon}`;
    }
  } else {
    // Try to find first markdown header in assistant content
    const headingMatch = assistantContent.match(/^#+\s*(.+)$/m);
    if (headingMatch && headingMatch[1].length < 70) {
      title = headingMatch[1].replace(/[*_`]/g, '').trim();
    }
  }

  const cleanSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'plan';

  const identifier = `${cleanSlug}-${Date.now().toString(36)}`;

  return {
    isPlan: true,
    title,
    type: 'plan',
    identifier,
  };
}

/**
 * Creates and stores an artifact from an assistant response containing a plan.
 */
export function createPlanArtifact(
  sessionId: string,
  userPrompt: string,
  assistantContent: string,
  onBroadcast?: (artifact: Artifact) => void
): Artifact | null {
  const detected = detectPlanStructure(userPrompt, assistantContent);
  if (!detected) return null;

  const now = Date.now();
  const artifactId = crypto.randomUUID();

  const artifact: Artifact = {
    id: artifactId,
    session_id: sessionId,
    identifier: `${detected.identifier}.md`,
    title: detected.title,
    type: detected.type,
    content: assistantContent,
    file_path: `plans/${detected.identifier}.md`,
    created_at: now,
    updated_at: now,
  };

  try {
    upsertArtifact(artifact);
    onBroadcast?.(artifact);
    return artifact;
  } catch (err) {
    console.error('[artifactSync:createPlanArtifact:error]', err);
    return null;
  }
}

/**
 * Creates an artifact from a file write tool execution if it creates markdown or documentation.
 */
export function handleToolArtifact(
  sessionId: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
  onBroadcast?: (artifact: Artifact) => void
): Artifact | null {
  if (!['write_to_file', 'create_file'].includes(toolName)) {
    return null;
  }

  const filePath = (toolArgs.TargetFile || toolArgs.AbsolutePath || toolArgs.path || '') as string;
  const content = (toolArgs.CodeContent || toolArgs.content || '') as string;

  if (!filePath || !content || typeof content !== 'string') {
    return null;
  }

  const isMd = filePath.endsWith('.md') || filePath.endsWith('.markdown');
  const isDoc = filePath.endsWith('.json') || filePath.endsWith('.mermaid') || filePath.endsWith('.txt');

  if (!isMd && !isDoc) {
    return null;
  }

  const basename = path.basename(filePath);
  const meta = toolArgs.ArtifactMetadata as any;
  const title = meta?.Summary || basename.replace(/\.(md|markdown|json|mermaid|txt)$/i, '');

  let type: ArtifactType = 'document';
  if (basename.toLowerCase().includes('plan')) {
    type = 'plan';
  } else if (filePath.endsWith('.mermaid')) {
    type = 'diagram';
  } else if (isMd) {
    type = 'markdown';
  }

  const now = Date.now();
  const artifact: Artifact = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    identifier: basename,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    type,
    content,
    file_path: filePath,
    created_at: now,
    updated_at: now,
  };

  try {
    upsertArtifact(artifact);
    onBroadcast?.(artifact);
    return artifact;
  } catch (err) {
    console.error('[artifactSync:handleToolArtifact:error]', err);
    return null;
  }
}

/**
 * Scans the brain directory of a session for any saved markdown artifacts.
 */
export function syncBrainDirArtifacts(
  sessionId: string,
  agyConversationId: string,
  onBroadcast?: (artifact: Artifact) => void
): Artifact[] {
  const artifacts: Artifact[] = [];
  const homeDir = process.env.HOME || '/home/adam';
  const brainDir = path.join(homeDir, '.gemini/antigravity-cli/brain', agyConversationId);

  if (!fs.existsSync(brainDir)) {
    return artifacts;
  }

  try {
    const entries = fs.readdirSync(brainDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.md') && !entry.name.endsWith('.markdown')) continue;
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(brainDir, entry.name);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (!content.trim()) continue;

        const stat = fs.statSync(fullPath);
        const title = entry.name
          .replace(/\.(md|markdown)$/i, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        const artifact: Artifact = {
          id: crypto.randomUUID(),
          session_id: sessionId,
          identifier: entry.name,
          title,
          type: entry.name.toLowerCase().includes('plan') ? 'plan' : 'document',
          content,
          file_path: fullPath,
          created_at: Math.round(stat.birthtimeMs || stat.mtimeMs),
          updated_at: Math.round(stat.mtimeMs),
        };

        upsertArtifact(artifact);
        onBroadcast?.(artifact);
        artifacts.push(artifact);
      } catch (readErr) {
        console.error(`[artifactSync:syncBrainDirArtifacts:readErr:${entry.name}]`, readErr);
      }
    }
  } catch (dirErr) {
    console.error('[artifactSync:syncBrainDirArtifacts:dirErr]', dirErr);
  }

  return artifacts;
}

/**
 * One-time / on-startup migration that populates missing artifacts for existing sessions
 * where the assistant generated a plan or user requested /plan.
 */
export function syncExistingHistoricalArtifacts(db = getDatabase()): void {
  try {
    const sessions = db
      .prepare(`SELECT id, title FROM sessions`)
      .all() as Array<{ id: string; title: string }>;

    for (const session of sessions) {
      const existingArtifactCount = (
        db.prepare(`SELECT COUNT(*) as count FROM artifacts WHERE session_id = ?`).get(session.id) as { count: number }
      ).count;

      if (existingArtifactCount > 0) {
        continue;
      }

      // Query assistant messages in this session
      const assistantMsgs = db
        .prepare(
          `SELECT id, content, created_at FROM messages 
           WHERE session_id = ? AND role = 'assistant' AND length(content) > 300
           ORDER BY created_at ASC`
        )
        .all(session.id) as Array<{ id: string; content: string; created_at: number }>;

      for (const msg of assistantMsgs) {
        // Find preceding user message
        const userMsg = db
          .prepare(
            `SELECT content FROM messages 
             WHERE session_id = ? AND role = 'user' AND created_at <= ?
             ORDER BY created_at DESC LIMIT 1`
          )
          .get(session.id, msg.created_at) as { content: string } | undefined;

        const userPrompt = userMsg?.content || session.title;
        const detected = detectPlanStructure(userPrompt, msg.content);

        if (detected) {
          const artifact: Artifact = {
            id: crypto.randomUUID(),
            session_id: session.id,
            identifier: `${detected.identifier}.md`,
            title: detected.title,
            type: detected.type,
            content: msg.content,
            file_path: `plans/${detected.identifier}.md`,
            created_at: msg.created_at,
            updated_at: msg.created_at,
          };

          upsertArtifact(artifact, db);
          console.log(`[artifactSync:migrated] Created plan artifact for session ${session.id}: "${detected.title}"`);
        }
      }
    }
  } catch (err) {
    console.error('[artifactSync:syncExistingHistoricalArtifacts:error]', err);
  }
}
