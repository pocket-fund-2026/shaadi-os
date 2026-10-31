import AsyncStorage from '@react-native-async-storage/async-storage';
// A build can list several addresses for the same server (public tunnel, Wi-Fi, USB cable), comma-separated.
// The app uses the first that answers, so it works whichever network the phone is on.
const BUILT: string = process.env.EXPO_PUBLIC_API_URL || '';
const CANDIDATES = BUILT.split(',').map((u: string) => u.trim().replace(/\/$/, '')).filter(Boolean);
export const DEFAULT_API = CANDIDATES[0] || (typeof window !== 'undefined' && window.location ? window.location.hostname === 'localhost' ? 'http://localhost:4600' : window.location.origin : 'http://46.225.26.58:4600');
let base = DEFAULT_API; let token = '';
export const setBase = async (u: string) => { base = u.replace(/\/$/, ''); await AsyncStorage.setItem('base', base); };
export const getBase = () => base;
export const setToken = async (t: string) => {
  if (token && token !== t) {
    const prefix = 'c:' + base + ':' + token + ':';
    const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(prefix));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  }
  token = t; t ? await AsyncStorage.setItem('token', t) : await AsyncStorage.removeItem('token');
};
const answers = async (u: string) => {
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 4000);
  try { return (await globalThis.fetch(u + '/health', { signal: abort.signal })).ok; } catch { return false; } finally { clearTimeout(timer); }
};
// Checks every listed address at once and keeps the earliest in the list that answers.
export const pickServer = async () => {
  if (CANDIDATES.length < 2) return base;
  const ok = await Promise.all(CANDIDATES.map(answers));
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
  let r: Response;
  // Scope offline data to the authenticated session; never return another user's cache.
  const key = 'c:' + base + ':' + (token || 'public') + ':' + path;
  // A server that accepts the connection but never answers would otherwise leave screens loading forever.
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 20000);
  try { r = await globalThis.fetch(base + '/api' + path, { method, signal: abort.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch {
    clearTimeout(timer);
    // The phone may have changed network (Wi-Fi to mobile data); try the other addresses once.
    if (!retried && CANDIDATES.length > 1) { const before = base; if ((await pickServer()) !== before) return api<T>(path, method, body, true); }
    if (method === 'GET') { const c = await AsyncStorage.getItem(key).catch(() => null); if (c) return JSON.parse(c); } throw new Error('Cannot reach server. Check your internet or the server address.'); }
  clearTimeout(timer);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  if (method === 'GET') AsyncStorage.setItem(key, JSON.stringify(j)).catch(() => {});
  else {
    // A successful write makes cached planner, guest and payment views stale.
    const prefix = 'c:' + base + ':' + (token || 'public') + ':';
    const keys = (await AsyncStorage.getAllKeys().catch(() => [] as string[])).filter(k => k.startsWith(prefix));
    if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => {});
  }
  return j;
}
