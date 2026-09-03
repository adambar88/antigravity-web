import { getDatabase, createSession, appendTurn, updateToolExecution, upsertArtifact, setSetting } from './index.js';

export function runSeed(): void {
  const db = getDatabase();
  console.log('[Seed] Starting database seeding...');

  // Set default settings
  setSetting('default_model', 'gemini-3.8-flash-medium', db);
  setSetting('default_effort', 'medium', db);
  setSetting('theme', 'dark', db);

  const session1Id = 'seed-session-001-auth-refactor';
  const session2Id = 'seed-session-002-ui-features';

  // Idempotency: remove existing seed records if present
  db.prepare('DELETE FROM sessions WHERE id IN (?, ?)').run(session1Id, session2Id);

  // 1. Session 1: Fastify Security Refactor
  const session1 = createSession({
    id: session1Id,
    title: 'Timing-Safe Authentication Guard',
    workspace_path: '/home/adam/projects/my-domain',
    model: 'gemini-3.8-flash-high',
    effort: 'high',
  }, db);

  // Message 1: User
  appendTurn(session1.id, {
    id: 'seed-msg-001-user',
    role: 'user',
    content: 'Review the authentication middleware and eliminate any timing attack vulnerabilities when validating tokens or cookies.',
    sequence_num: 0,
    status: 'completed',
  }, db);

  // Message 2: Assistant with thought, tools, and diff
  const msg2 = appendTurn(session1.id, {
    id: 'seed-msg-002-assistant',
    role: 'assistant',
    content: 'I have inspected our auth middleware and refactored the verification logic. Token comparisons now use `crypto.timingSafeEqual` with matched length buffers, eliminating timing side-channels.',
    thought: 'Analyzing token verification logic in authGuard.ts. Using standard string comparison `===` leaks character-by-character timing differences. Replacing with `crypto.timingSafeEqual` after verifying buffer lengths to prevent early termination leaks.',
    thought_duration_ms: 1820,
    sequence_num: 1,
    status: 'completed',
  }, db);

  // Tool 1: view_file
  updateToolExecution(session1.id, {
    id: 'seed-tool-001-view',
    message_id: msg2.id,
    tool_name: 'view_file',
    tool_args: { AbsolutePath: '/home/adam/projects/my-domain/antigravity-web/server/src/security/authGuard.ts' },
    tool_result: 'export function verifyToken(token: string) { return token === process.env.AUTH_TOKEN; }',
    status: 'completed',
    duration_ms: 65,
  }, db);

  // Tool 2: replace_file_content with diff
  updateToolExecution(session1.id, {
    id: 'seed-tool-002-replace',
    message_id: msg2.id,
    tool_name: 'replace_file_content',
    tool_args: {
      TargetFile: '/home/adam/projects/my-domain/antigravity-web/server/src/security/authGuard.ts',
      Instruction: 'Use crypto.timingSafeEqual for constant-time comparison',
    },
    tool_result: 'Successfully updated file contents.',
    status: 'completed',
    duration_ms: 140,
    diffs: [
      {
        id: 'seed-diff-001',
        tool_execution_id: 'seed-tool-002-replace',
        session_id: session1.id,
        file_path: 'src/security/authGuard.ts',
        before_content: 'export function verifyToken(token: string): boolean {\n  return token === expectedToken;\n}',
        after_content: 'export function verifyToken(token: string): boolean {\n  const a = Buffer.from(token);\n  const b = Buffer.from(expectedToken);\n  if (a.length !== b.length) return false;\n  return crypto.timingSafeEqual(a, b);\n}',
        additions: 5,
        deletions: 1,
        status: 'applied',
        created_at: Date.now() - 3600000,
      },
    ],
  }, db);

  // Artifact for Session 1
  upsertArtifact({
    id: 'seed-art-001-sec-spec',
    session_id: session1.id,
    identifier: 'sec-spec-timing-safe',
    title: 'Timing-Attack Resistance Spec',
    type: 'markdown',
    content: `# Security Review: Constant-Time Token Comparison\n\n### Problem\nDirect string equality \`a === b\` aborts on the first mismatched byte, allowing statistical attacks to recover secrets.\n\n### Fix\nConvert inputs to \`Buffer\` instances and invoke \`crypto.timingSafeEqual\`.`,
    created_at: Date.now() - 3500000,
    updated_at: Date.now() - 3500000,
  }, db);

  // 2. Session 2: React Dashboard SSE Enhancement
  const session2 = createSession({
    id: session2Id,
    title: 'Real-Time SSE Streaming & Resiliency',
    workspace_path: '/home/adam/projects/my-domain',
    model: 'gemini-3.8-flash-medium',
    effort: 'medium',
  }, db);

  appendTurn(session2.id, {
    id: 'seed-msg-003-user',
    role: 'user',
    content: 'Verify the SSE streaming endpoint includes `X-Accel-Buffering: no` and 15s keep-alive heartbeats to prevent proxy timeouts.',
    sequence_num: 0,
    status: 'completed',
  }, db);

  appendTurn(session2.id, {
    id: 'seed-msg-004-assistant',
    role: 'assistant',
    content: 'Configured the SSE endpoint with reverse-proxy buffering bypass headers and an unreferenced 15-second heartbeat interval.',
    thought: 'Checking Nginx and Cloudflare proxy requirements for Server-Sent Events. Needs X-Accel-Buffering: no and periodic newline heartbeats : keep-alive\\n\\n to prevent intermediate connection drops.',
    thought_duration_ms: 950,
    sequence_num: 1,
    status: 'completed',
  }, db);

  console.log('[Seed] Seeding completed successfully. 2 sessions, messages, diffs, and artifacts ready.');
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed();
}
