const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const source = ts.transpileModule(readFileSync(path.resolve(__dirname, '../src/api.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const response = (data, ok = true) => ({ ok, json: async () => data });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function fixture(run) {
  const savedFetch = globalThis.fetch;
  const entries = new Map();
  const storage = {
    getItem: async key => entries.get(key) ?? null,
    setItem: async (key, value) => { entries.set(key, value); },
    removeItem: async key => { entries.delete(key); },
    getAllKeys: async () => [...entries.keys()],
    multiRemove: async keys => keys.forEach(key => entries.delete(key)),
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'process', source)(() => storage, mod, mod.exports, {
    env: { EXPO_PUBLIC_API_URL: 'https://primary.test,https://backup.test' },
  });
  try { await run(mod.exports, entries); } finally { globalThis.fetch = savedFetch; }
}

test('lost write responses never replay a save, booking or payment', async () => fixture(async client => {
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    const calls = [];
    globalThis.fetch = async url => { calls.push(url); throw new Error('Response lost after commit'); };
    await assert.rejects(client.api('/bookings', method, { total: 100 }), /Refresh to check/);
    assert.deepEqual(calls, ['https://primary.test/api/bookings']);
  }
}));

test('reads fail over while preserving the authenticated request', async () => fixture(async client => {
  await client.setToken('couple');
  globalThis.fetch = async (url, options) => {
    if (url === 'https://backup.test/health') return response({});
    if (url === 'https://backup.test/api/tasks') {
      assert.equal(options.headers.Authorization, 'Bearer couple');
      return response([{ title: 'Book photographer' }]);
    }
    throw new Error('Offline');
  };
  assert.deepEqual(await client.api('/tasks'), [{ title: 'Book photographer' }]);
  assert.equal(client.getBase(), 'https://backup.test');
}));

test('offline reads isolate accounts and tolerate corrupt entries', async () => fixture(async (client, entries) => {
  await client.setToken('first');
  globalThis.fetch = async () => response([{ id: 1 }]);
  await client.api('/tasks');
  globalThis.fetch = async () => { throw new Error('Offline'); };
  assert.deepEqual(await client.api('/tasks'), [{ id: 1 }]);
  entries.set('c:https://primary.test:first:/tasks', '{broken');
  await assert.rejects(client.api('/tasks'), /Cannot reach server/);
  assert.equal(entries.has('c:https://primary.test:first:/tasks'), false);
  await client.setToken('second');
  await assert.rejects(client.api('/tasks'), /Cannot reach server/);
}));

test('logout rejects in-flight private responses and clears every address cache', async () => fixture(async (client, entries) => {
  await client.setToken('first');
  entries.set('c:https://backup.test:first:/tasks', '[]');
  const pending = deferred();
  globalThis.fetch = () => pending.promise;
  const read = client.api('/tasks');
  await client.setToken('');
  pending.resolve(response([{ private: true }]));
  await assert.rejects(read, /session changed/);
  assert.equal([...entries.keys()].some(key => key.startsWith('c:')), false);
}));

test('saves invalidate every address and prevent older reads recaching stale data', async () => fixture(async (client, entries) => {
  await client.setToken('first');
  entries.set('c:https://backup.test:first:/tasks', '["stale"]');
  const pending = deferred();
  globalThis.fetch = async (_url, options) => options.method === 'GET' ? pending.promise : response({ saved: true });
  const oldRead = client.api('/tasks');
  await client.api('/tasks', 'POST', { title: 'New task' });
  pending.resolve(response([{ title: 'Old task' }]));
  await oldRead;
  assert.equal([...entries.keys()].some(key => key.startsWith('c:')), false);
}));

test('HTTP errors never silently use cached data or retry another server', async () => fixture(async (client, entries) => {
  entries.set('c:https://primary.test:public:/tasks', '[]');
  let calls = 0;
  globalThis.fetch = async () => { calls++; return response({ error: 'Please sign in' }, false); };
  await assert.rejects(client.api('/tasks'), /Please sign in/);
  assert.equal(calls, 1);
}));

test('a pending server probe cannot overwrite a newly selected server', async () => fixture(async client => {
  const pending = deferred();
  globalThis.fetch = () => pending.promise;
  const probe = client.pickServer();
  await client.setBase('https://custom.test');
  pending.resolve(response({}));
  await probe;
  assert.equal(client.getBase(), 'https://custom.test');
}));
