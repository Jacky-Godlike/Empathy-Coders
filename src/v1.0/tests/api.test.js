import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let server;
let baseUrl;
let tempDir;

async function request(pathname, { method = 'GET', body = null, actor = 'u-aina' } = {}) {
  const headers = { 'X-OrderPilot-User': actor };
  if (body !== null) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === null ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  return { response, data };
}

before(async () => {
  process.env.AI_PROVIDER = 'rules';
  process.env.ORDERPILOT_SEED_DIR = path.join(root, 'data', 'seed');
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'orderpilot-test-'));
  const { createApplication } = await import('../server/bootstrap.js');
  const { app } = await createApplication({
    runtimeDir: tempDir,
    seedDir: path.join(root, 'data', 'seed'),
  });
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
});

test('health endpoint reports the demo mode', async () => {
  const { response, data } = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.ai.mode, 'rules');
});

test('bootstrap returns the seeded desk and pending inbox', async () => {
  const { response, data } = await request('/api/bootstrap');
  assert.equal(response.status, 200);
  assert.equal(data.stats.pendingOrders, 6);
  assert.equal(data.stats.pendingMessages, 12);
  assert.equal(data.actor.role, 'owner');
  assert.equal(data.demo.allowRoleSwitch, true);
});

test('owner can approve a ready order and reserve stock', async () => {
  const { response, data } = await request('/api/orders/OP-1002/approve', {
    method: 'POST',
    body: {},
    actor: 'u-aina',
  });
  assert.equal(response.status, 200);
  assert.equal(data.order.status, 'approved');
  assert.equal(data.purchaseDrafts.length, 0);
  assert.ok(data.reservation.some((line) => line.sku === 'CUP-12OZ'));

  const pending = await request('/api/orders?status=pending');
  assert.equal(pending.data.total, 5);
});

test('staff cannot approve or reject an order', async () => {
  const approve = await request('/api/orders/OP-1001/approve', {
    method: 'POST',
    body: {},
    actor: 'u-daniel',
  });
  assert.equal(approve.response.status, 403);
  assert.equal(approve.data.error.code, 'FORBIDDEN');

  const reject = await request('/api/orders/OP-1001/reject', {
    method: 'POST',
    body: { reason: 'Trying to reject as staff' },
    actor: 'u-daniel',
  });
  assert.equal(reject.response.status, 403);
});

test('staff can request information and get a channel draft', async () => {
  const { response, data } = await request('/api/orders/OP-1006/request-info', {
    method: 'POST',
    body: { note: 'Need the address' },
    actor: 'u-daniel',
  });
  assert.equal(response.status, 200);
  assert.equal(data.order.status, 'needs_info');
  assert.ok(data.replyDraft.body.includes('OP-1006'));
  assert.ok(data.replyDraft.body.includes('delivery address'));
});

test('owner can reject with a reason', async () => {
  const { response, data } = await request('/api/orders/OP-1005/reject', {
    method: 'POST',
    body: { reason: 'Quote is below our unit cost' },
    actor: 'u-aina',
  });
  assert.equal(response.status, 200);
  assert.equal(data.order.status, 'rejected');
  assert.match(data.order.rejectionReason, /below our unit cost/);
});

test('orders export returns a CSV attachment', async () => {
  const { response, data } = await request('/api/orders/export?format=csv&status=all');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/csv/);
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.match(data, /Order,Status,Customer/);
});

test('orders export returns a valid XLSX attachment', async () => {
  const response = await fetch(`${baseUrl}/api/orders/export?format=xlsx&status=all`, {
    headers: { 'X-OrderPilot-User': 'u-aina' },
  });
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get('content-type'),
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.ok(buffer.length > 1000);
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
});

test('demo reset restores the seeded starting state', async () => {
  const { response, data } = await request('/api/demo/reset', {
    method: 'POST',
    body: { confirm: 'RESET' },
    actor: 'u-aina',
  });
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.stats.pendingOrders, 6);
  assert.equal(data.stats.pendingMessages, 12);
});

test('triage processes the 12 pending messages with the rules fallback', async () => {
  const { response, data } = await request('/api/triage/run', {
    method: 'POST',
    body: { mode: 'auto' },
    actor: 'u-aina',
  });
  assert.equal(response.status, 200);
  assert.equal(data.scanned, 12);
  assert.equal(data.ordersCreated, 5);
  assert.equal(data.ordersUpdated, 2);
  assert.equal(data.filtered, 5);
  assert.equal(data.errors, 0);
  assert.equal(data.modeUsed, 'rules');

  const pending = await request('/api/orders?status=pending');
  assert.equal(pending.data.total, 11);
});
