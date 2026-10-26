import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { createApp } from '../src/app.js';
import { initDb, getDb, closeDb } from '../src/database/db.js';
import whatsappService from '../src/services/whatsapp.service.js';

let server = null;
let baseUrl = '';

describe('REST API Endpoints', () => {
  before(async () => {
    whatsappService.setMockMode(true);
    await whatsappService.initialize();
    await initDb();

    const app = createApp();
    server = http.createServer(app);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    const db = await getDb();
    await db.run(`DELETE FROM execution_logs WHERE recipient_phone = '+919876543210'`);
    await db.run(`DELETE FROM schedules WHERE phone_number = '+919876543210'`);
    await closeDb();
  });

  it('GET /api/health should return ok status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
    assert.ok(body.timestamp);
    assert.ok(body.whatsappStatus);
  });

  it('GET /api/whatsapp/status should return connection state', async () => {
    const res = await fetch(`${baseUrl}/whatsapp/status`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.isMock, true);
  });

  it('POST /api/schedules should create and return a new schedule', async () => {
    const payload = {
      name: 'Morning Greeting',
      recipient_name: 'Alex',
      phone_number: '+919876543210',
      message: 'Good morning Alex!',
      schedule_type: 'daily',
      timezone: 'Asia/Kolkata',
      recurrence_config: { time: '09:00' }
    };

    const res = await fetch(`${baseUrl}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.name, 'Morning Greeting');
    assert.strictEqual(body.data.phone_number, '+919876543210');
    assert.ok(body.data.id);
  });

  it('GET /api/schedules should list schedules with pagination', async () => {
    const res = await fetch(`${baseUrl}/schedules?limit=10&page=1`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.schedules));
    assert.ok(body.data.total >= 1);
  });

  it('POST /api/schedules/:id/duplicate should create a paused copy', async () => {
    // First list to get an id
    const listRes = await fetch(`${baseUrl}/schedules`);
    const listData = await listRes.json();
    const original = listData.data.schedules[0];

    const res = await fetch(`${baseUrl}/schedules/${original.id}/duplicate`, {
      method: 'POST'
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'paused');
    assert.ok(body.data.name.includes('(Copy)'));
  });

  it('GET /api/dashboard/stats should return stats and counts including todaySent', async () => {
    const res = await fetch(`${baseUrl}/dashboard/stats?timezone=Asia/Kolkata`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.counts);
    assert.ok(body.data.counts.total >= 1);
    assert.strictEqual(typeof body.data.counts.todaySent, 'number');
    assert.strictEqual(body.data.counts.timezone, 'Asia/Kolkata');
  });

  it('GET and PUT /api/settings should read and update configuration', async () => {
    const getRes = await fetch(`${baseUrl}/settings`);
    assert.strictEqual(getRes.status, 200);
    const getBody = await getRes.json();
    assert.strictEqual(getBody.success, true);

    const updateRes = await fetch(`${baseUrl}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_timezone: 'Asia/Kolkata', missed_job_policy: 'skip' })
    });

    assert.strictEqual(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.strictEqual(updateBody.success, true);
    assert.strictEqual(updateBody.data.settings.default_timezone, 'Asia/Kolkata');
  });

  it('DELETE /api/history should clear execution logs and audit logs', async () => {
    const res = await fetch(`${baseUrl}/history`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'all', clearSystemLogs: true })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.deletedExecutions !== undefined);
  });

  it('DELETE /api/settings/logs should clear system audit logs', async () => {
    const res = await fetch(`${baseUrl}/settings/logs`, {
      method: 'DELETE'
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.deletedCount !== undefined);
  });
});
