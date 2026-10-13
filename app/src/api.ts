import AsyncStorage from '@react-native-async-storage/async-storage';
export const DEFAULT_API = process.env.EXPO_PUBLIC_API_URL || (typeof window !== 'undefined' && window.location ? window.location.hostname === 'localhost' ? 'http://localhost:4600' : window.location.origin : 'http://46.225.26.58:4600');
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
export const restore = async () => {
  const savedBase = await AsyncStorage.getItem('base');
  // A build made for a local server must use that server even when an older install
  // saved a different address. Its old login token belongs to the old server.
  base = process.env.EXPO_PUBLIC_API_URL || savedBase || DEFAULT_API;
  if (process.env.EXPO_PUBLIC_API_URL && savedBase !== base) {
    await AsyncStorage.setItem('base', base);
    await AsyncStorage.removeItem('token');
    token = '';
  } else token = (await AsyncStorage.getItem('token')) || '';
  return !!token;
};
export async function api<T = any>(path: string, method = 'GET', body?: any): Promise<T> {
  let r: Response;
  // Scope offline data to the authenticated session; never return another user's cache.
  const key = 'c:' + base + ':' + (token || 'public') + ':' + path;
  try { r = await globalThis.fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch { if (method === 'GET') { const c = await AsyncStorage.getItem(key).catch(() => null); if (c) return JSON.parse(c); } throw new Error('Cannot reach server. Check your internet or the server address.'); }
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
