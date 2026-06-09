import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';

import { parseCiWebhook, verifyGithubSignature } from './github.js';

const SECRET = 'test-secret';

function sign(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
}

test('verifyGithubSignature accepts a correct signature', () => {
  const body = JSON.stringify({ hello: 'world' });
  assert.equal(verifyGithubSignature(body, sign(body), SECRET), true);
});

test('verifyGithubSignature rejects a tampered body', () => {
  const body = JSON.stringify({ hello: 'world' });
  const sig = sign(body);
  assert.equal(verifyGithubSignature(body + 'x', sig, SECRET), false);
});

test('verifyGithubSignature rejects a missing header', () => {
  assert.equal(verifyGithubSignature('{}', undefined, SECRET), false);
});

test('parseCiWebhook reads a workflow_run payload', () => {
  const event = parseCiWebhook({
    workflow_run: { head_sha: 'abc123', conclusion: 'success' },
    repository: { full_name: 'owner/repo' },
  });
  assert.deepEqual(event, { headSha: 'abc123', conclusion: 'success', repo: 'owner/repo', prUrls: [] });
});

test('parseCiWebhook reads a check_suite payload with no conclusion yet', () => {
  const event = parseCiWebhook({
    check_suite: { head_sha: 'deadbeef', conclusion: null },
    repository: { full_name: 'owner/repo' },
  });
  assert.deepEqual(event, { headSha: 'deadbeef', conclusion: null, repo: 'owner/repo', prUrls: [] });
});

test('parseCiWebhook builds PR urls from pull_requests', () => {
  const event = parseCiWebhook({
    workflow_run: {
      head_sha: 'abc123',
      conclusion: 'success',
      pull_requests: [{ number: 389 }, { number: 7 }],
    },
    repository: { full_name: 'yeheskieltame/claudelance' },
  });
  assert.deepEqual(event?.prUrls, [
    'https://github.com/yeheskieltame/claudelance/pull/389',
    'https://github.com/yeheskieltame/claudelance/pull/7',
  ]);
});

test('parseCiWebhook ignores unrelated events', () => {
  assert.equal(parseCiWebhook({ action: 'opened', pull_request: {} }), null);
  assert.equal(parseCiWebhook({ workflow_run: { conclusion: 'success' } }), null);
  assert.equal(parseCiWebhook(null), null);
});
