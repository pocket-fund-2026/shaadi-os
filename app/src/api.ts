import AsyncStorage from '@react-native-async-storage/async-storage';
// A build can list several addresses for the same server (public tunnel, Wi-Fi, USB cable), comma-separated.
// The app uses the first that answers, so it works whichever network the phone is on.
const BUILT: string = process.env.EXPO_PUBLIC_API_URL || '';
const CANDIDATES = BUILT.split(',').map((u: string) => u.trim().replace(/\/$/, '')).filter(Boolean);
export const DEFAULT_API = CANDIDATES[0] || (typeof window !== 'undefined' && window.location ? window.location.hostname === 'localhost' ? 'http://localhost:4600' : window.location.origin : 'http://46.225.26.58:4600');
let base = DEFAULT_API; let token = '';
// Keep cache writes and removals ordered so an older response cannot restore cleared data.
let cacheQueue: Promise<unknown> = Promise.resolve();
let session = 0;
let revision = 0;
const cacheChange = (change: () => Promise<unknown>) => {
  const next = cacheQueue.then(change);
  cacheQueue = next.catch(() => {});
  return next;
};
export const setBase = async (u: string) => {
  const next = u.trim().replace(/\/$/, '');
  if (base !== next) session++;
  base = next;
  await AsyncStorage.setItem('base', base);
};
export const getBase = () => base;
export const setToken = async (t: string) => {
  const previous = token;
  if (previous !== t) session++;
  token = t;
  if (previous && previous !== t) await cacheChange(async () => {
    const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith('c:') && k.includes(':' + previous + ':'));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  }).catch(() => {});
  t ? await AsyncStorage.setItem('token', t) : await AsyncStorage.removeItem('token');
};
const answers = async (u: string) => {
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 4000);
  try { return (await globalThis.fetch(u + '/health', { signal: abort.signal })).ok; } catch { return false; } finally { clearTimeout(timer); }
};
// Checks every listed address at once and keeps the earliest in the list that answers.
export const pickServer = async () => {
  if (CANDIDATES.length < 2) return base;
  const startedSession = session; const startedBase = base;
  const ok = await Promise.all(CANDIDATES.map(answers));
  if (session !== startedSession || base !== startedBase) return base;
  const i = ok.indexOf(true); if (i >= 0) base = CANDIDATES[i];
  return base;
};
export const restore = async () => {
  const savedBase = await AsyncStorage.getItem('base');
  if (BUILT) {
    // A build made for a local server must use that server even when an older install saved a
    // different address. Its old login token belongs to the old server.
    if ((await AsyncStorage.getItem('servers')) !== BUILT) {
      await AsyncStorage.multiSet([['servers', BUILT], ['base', CANDIDATES[0]]]); await AsyncStorage.removeItem('token'); token = '';
    } else token = (await AsyncStorage.getItem('token')) || '';
    base = CANDIDATES[0]; await pickServer();
  } else { base = savedBase || DEFAULT_API; token = (await AsyncStorage.getItem('token')) || ''; }
  return !!token;
};
export async function api<T = any>(path: string, method = 'GET', body?: any, retried = false): Promise<T> {
  method = method.toUpperCase();
  const requestBase = base; const requestToken = token;
  const requestSession = session; const requestRevision = revision;
  const active = () => requestSession === session && requestToken === token;
  const prefix = 'c:' + requestBase + ':' + (requestToken || 'public') + ':';
  const key = prefix + path;
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 20000);
  let r: Response;
  try {
    r = await globalThis.fetch(requestBase + '/api' + path, {
      method, signal: abort.signal,
      headers: { 'Content-Type': 'application/json', ...(requestToken ? { Authorization: 'Bearer ' + requestToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    clearTimeout(timer);
    if (!active()) throw new Error('Your session changed. Open this screen again.');
    // A lost response does not mean a write failed: replaying it can create duplicates.
    if (method !== 'GET') throw new Error('The server response was lost. Refresh to check whether your change was saved before trying again.');
    if (!retried && CANDIDATES.length > 1) {
      const before = base;
      await pickServer();
      if (!active()) throw new Error('Your session changed. Open this screen again.');
      if (base !== before) return api<T>(path, method, body, true);
    }
    await cacheQueue;
    if (active() && requestRevision === revision) {
      const cached = await AsyncStorage.getItem(key).catch(() => null);
      if (cached && active() && requestRevision === revision) {
        try { return JSON.parse(cached); } catch { await cacheChange(() => AsyncStorage.removeItem(key)).catch(() => {}); }
      }
    }
    throw new Error('Cannot reach server. Check your internet or the server address.');
  } finally { clearTimeout(timer); }
  const j = await r.json().catch(() => ({}));
  if (!active()) throw new Error('Your session changed. Open this screen again.');
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  if (method === 'GET') {
    await cacheChange(async () => {
      if (active() && requestRevision === revision) await AsyncStorage.setItem(key, JSON.stringify(j));
    }).catch(() => {});
  } else {
    // Invalidate every address for this login: failover may have cached the same data elsewhere.
    revision++;
    await cacheChange(async () => {
      const suffix = ':' + (requestToken || 'public') + ':';
      const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith('c:') && k.includes(suffix));
      if (keys.length) await AsyncStorage.multiRemove(keys);
    }).catch(() => {});
  }
  return j;
}
