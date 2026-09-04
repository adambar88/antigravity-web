import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { buildServer } from './index.js';
import { runSeed } from './db/seed.js';
import { getExpectedToken } from './security/authGuard.js';

async function runTests() {
  console.log('🧪 Starting Antigravity Web Backend Test Suite...\n');

  // Seed database
  runSeed();

  const server = await buildServer();
  const token = getExpectedToken();

  // Test 1: GET /health
  console.log('Test 1: GET /health');
  const resHealth = await server.inject({
    method: 'GET',
    url: '/health',
  });
  assert.strictEqual(resHealth.statusCode, 200);
  const healthData = JSON.parse(resHealth.payload);
  assert.strictEqual(healthData.status, 'ok');
  assert.strictEqual(healthData.wal_mode, true);
  console.log('  ✓ Health endpoint passed\n');

  // Test 2: Auth Guard - Unauthorized access
  console.log('Test 2: Auth Guard - Unauthorized access blocked');
  const resUnauth = await server.inject({
    method: 'GET',
    url: '/api/sessions',
  });
  assert.strictEqual(resUnauth.statusCode, 401);
  console.log('  ✓ Unauthorized access blocked (401)\n');

  // Test 3: POST /api/auth/login with invalid token
  console.log('Test 3: POST /api/auth/login invalid token');
  const resBadLogin = await server.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { token: 'wrong-token' },
  });
  assert.strictEqual(resBadLogin.statusCode, 401);
  console.log('  ✓ Invalid token rejected (401)\n');

  // Test 4: POST /api/auth/login with valid token
  console.log('Test 4: POST /api/auth/login valid token');
  const resLogin = await server.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { token },
  });
  assert.strictEqual(resLogin.statusCode, 200);
  const loginCookies = resLogin.cookies;
  const authCookie = loginCookies.find((c) => c.name === 'ag_auth');
  assert(authCookie, 'ag_auth cookie must be set');
  console.log('  ✓ Login successful and cookie set\n');

  const authHeaders = { authorization: `Bearer ${token}` };

  // Test 5: GET /api/auth/me
  console.log('Test 5: GET /api/auth/me');
  const resMe = await server.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: authHeaders,
  });
  assert.strictEqual(resMe.statusCode, 200);
  const meData = JSON.parse(resMe.payload);
  assert.strictEqual(meData.authenticated, true);
  assert(meData.workspace_root.length > 0);
  console.log('  ✓ Auth me verified\n');

  // Test 6: GET /api/sessions
  console.log('Test 6: GET /api/sessions');
  const resSessions = await server.inject({
    method: 'GET',
    url: '/api/sessions',
    headers: authHeaders,
  });
  assert.strictEqual(resSessions.statusCode, 200);
  const sessions = JSON.parse(resSessions.payload);
  assert(Array.isArray(sessions));
  assert(sessions.length >= 2, 'Must have at least 2 seeded sessions');
  console.log(`  ✓ Sessions retrieved: ${sessions.length} sessions\n`);

  // Test 7: POST /api/sessions
  console.log('Test 7: POST /api/sessions (create session)');
  const resCreate = await server.inject({
    method: 'POST',
    url: '/api/sessions',
    headers: authHeaders,
    payload: {
      title: 'Automated Test Session',
      model: 'gemini-3.8-flash-high',
      effort: 'high',
    },
  });
  assert.strictEqual(resCreate.statusCode, 201);
  const createdSession = JSON.parse(resCreate.payload);
  assert.strictEqual(createdSession.title, 'Automated Test Session');
  assert.strictEqual(createdSession.effort, 'high');
  console.log('  ✓ Created session with ID:', createdSession.id, '\n');

  // Test 8: GET /api/sessions/:id
  console.log('Test 8: GET /api/sessions/:id (hydrated session)');
  const resHydrated = await server.inject({
    method: 'GET',
    url: `/api/sessions/seed-session-001-auth-refactor`,
    headers: authHeaders,
  });
  assert.strictEqual(resHydrated.statusCode, 200);
  const hydrated = JSON.parse(resHydrated.payload);
  assert.strictEqual(hydrated.id, 'seed-session-001-auth-refactor');
  assert(hydrated.messages.length >= 2);
  assert(hydrated.artifacts.length >= 1);
  assert(hydrated.messages[1].tool_executions.length >= 2);
  assert(hydrated.messages[1].tool_executions[1].diffs.length >= 1);
  console.log('  ✓ Hydrated session with messages, tools, diffs, and artifacts validated\n');

  // Test 9: PATCH /api/sessions/:id
  console.log('Test 9: PATCH /api/sessions/:id');
  const resPatch = await server.inject({
    method: 'PATCH',
    url: `/api/sessions/${createdSession.id}`,
    headers: authHeaders,
    payload: {
      title: 'Updated Test Session Title',
      effort: 'low',
    },
  });
  assert.strictEqual(resPatch.statusCode, 200);
  const patched = JSON.parse(resPatch.payload);
  assert.strictEqual(patched.title, 'Updated Test Session Title');
  assert.strictEqual(patched.effort, 'low');
  console.log('  ✓ Patched session validated\n');

  // Test 10: Slash Command Interception via POST /prompt
  console.log('Test 10: Slash Command Interception (/help)');
  const resPromptSlash = await server.inject({
    method: 'POST',
    url: `/api/sessions/${createdSession.id}/prompt`,
    headers: authHeaders,
    payload: {
      prompt: '/help',
    },
  });
  assert.strictEqual(resPromptSlash.statusCode, 202);

  // Verify in DB that slash command result was handled and saved
  const resHydratedAfterSlash = await server.inject({
    method: 'GET',
    url: `/api/sessions/${createdSession.id}`,
    headers: authHeaders,
  });
  const afterSlash = JSON.parse(resHydratedAfterSlash.payload);
  const lastMsg = afterSlash.messages[afterSlash.messages.length - 1];
  assert.strictEqual(lastMsg.role, 'assistant');
  assert(lastMsg.content.includes('Available Slash Commands'));
  console.log('  ✓ Slash command intercepted and persisted without external process\n');

  // Test 10b: Attachment ingestion via POST /prompt with dataUrl & path traversal sanitization
  console.log('Test 10b: POST /api/sessions/:id/prompt with Attachment dataUrl ingestion');
  const sampleText = 'Antigravity attachment test content 12345';
  const base64Data = Buffer.from(sampleText, 'utf-8').toString('base64');
  const dataUrl = `data:text/plain;base64,${base64Data}`;

  const resPromptWithAtt = await server.inject({
    method: 'POST',
    url: `/api/sessions/${createdSession.id}/prompt`,
    headers: authHeaders,
    payload: {
      prompt: '/help',
      attachments: [
        {
          id: 'att-test-01',
          name: '../../unsafe-test-file.txt',
          mimeType: 'text/plain',
          size: sampleText.length,
          dataUrl,
        },
      ],
    },
  });
  assert.strictEqual(resPromptWithAtt.statusCode, 202);

  // Verify attachment file written to .antigravity/attachments safely without traversal
  const attachmentsDir = path.join(createdSession.workspace_path, '.antigravity', 'attachments');
  assert(fs.existsSync(attachmentsDir), '.antigravity/attachments directory must exist');
  const files = fs.readdirSync(attachmentsDir);
  const writtenFile = files.find((f) => f.includes('unsafe-test-file.txt'));
  assert(writtenFile, 'Attachment file must be saved with sanitized filename');
  assert(!writtenFile.includes('..'), 'Filename must not contain path traversal');
  const savedContent = fs.readFileSync(path.join(attachmentsDir, writtenFile), 'utf-8');
  assert.strictEqual(savedContent, sampleText);
  // Clean up test file
  fs.unlinkSync(path.join(attachmentsDir, writtenFile));
  console.log('  ✓ Attachment successfully ingested, sanitized and persisted to disk\n');

  // Test 10c: POST /api/sessions/:id/prompt with invalid attachment schema rejected
  console.log('Test 10c: POST /api/sessions/:id/prompt with invalid attachment schema');
  const resBadAtt = await server.inject({
    method: 'POST',
    url: `/api/sessions/${createdSession.id}/prompt`,
    headers: authHeaders,
    payload: {
      prompt: 'Invalid attachment',
      attachments: [
        {
          id: 'bad-att',
          // missing name, mimeType, size
        },
      ],
    },
  });
  assert.strictEqual(resBadAtt.statusCode, 400);
  console.log('  ✓ Invalid attachment schema correctly rejected (400)\n');

  // Test 10d: Fastify bodyLimit handles large payload (e.g. 2MB binary -> ~2.7MB base64)
  console.log('Test 10d: Fastify bodyLimit handles large payload without 413');
  const largeBuffer = Buffer.alloc(2 * 1024 * 1024, 'a');
  const largeDataUrl = `data:application/octet-stream;base64,${largeBuffer.toString('base64')}`;
  const resLargePrompt = await server.inject({
    method: 'POST',
    url: `/api/sessions/${createdSession.id}/prompt`,
    headers: authHeaders,
    payload: {
      prompt: '/help',
      attachments: [
        {
          id: 'large-att',
          name: 'large_image.png',
          mimeType: 'application/octet-stream',
          size: largeBuffer.length,
          dataUrl: largeDataUrl,
        },
      ],
    },
  });
  assert.strictEqual(resLargePrompt.statusCode, 202);
  // Clean up large test file
  const filesAfterLarge = fs.readdirSync(attachmentsDir);
  const largeWritten = filesAfterLarge.find((f) => f.includes('large_image.png'));
  if (largeWritten) {
    fs.unlinkSync(path.join(attachmentsDir, largeWritten));
  }
  console.log('  ✓ Large payload accepted successfully without 413\n');

  // Test 11: Workspace Security - Directory Traversal blocked
  console.log('Test 11: Workspace Security - Directory Traversal');
  const resTraversal = await server.inject({
    method: 'GET',
    url: '/api/workspace/file?path=../../../../etc/passwd',
    headers: authHeaders,
  });
  assert.strictEqual(resTraversal.statusCode, 403);
  console.log('  ✓ Path traversal attack blocked (403)\n');

  // Test 12: Workspace Security - Sensitive file (.env) blocked
  console.log('Test 12: Workspace Security - Sensitive file blocked');
  const resSensitive = await server.inject({
    method: 'GET',
    url: '/api/workspace/file?path=.env',
    headers: authHeaders,
  });
  assert.strictEqual(resSensitive.statusCode, 403);
  console.log('  ✓ Sensitive file access blocked (403)\n');

  // Test 13: Workspace Tree
  console.log('Test 13: GET /api/workspace/tree');
  const resTree = await server.inject({
    method: 'GET',
    url: '/api/workspace/tree?depth=2',
    headers: authHeaders,
  });
  assert.strictEqual(resTree.statusCode, 200);
  const treeData = JSON.parse(resTree.payload);
  assert(Array.isArray(treeData.tree));
  console.log(`  ✓ Workspace tree retrieved (${treeData.tree.length} top-level nodes)\n`);

  // Test 13b: GET /api/sessions/:id/subagents
  console.log('Test 13b: GET /api/sessions/:id/subagents');
  const resSubagents = await server.inject({
    method: 'GET',
    url: `/api/sessions/${createdSession.id}/subagents`,
    headers: authHeaders,
  });
  assert.strictEqual(resSubagents.statusCode, 200);
  const subData = JSON.parse(resSubagents.payload);
  assert(Array.isArray(subData.subagents));
  console.log(`  ✓ Subagents retrieved: ${subData.subagents.length} subagents\n`);

  // Test 14: DELETE /api/sessions/:id
  console.log('Test 14: DELETE /api/sessions/:id');
  const resDelete = await server.inject({
    method: 'DELETE',
    url: `/api/sessions/${createdSession.id}`,
    headers: authHeaders,
  });
  assert.strictEqual(resDelete.statusCode, 200);
  console.log('  ✓ Session deletion validated\n');

  await server.close();
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
