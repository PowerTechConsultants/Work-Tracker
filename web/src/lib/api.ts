import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 30000,
});

let _accessToken: string | null = null;
let _refreshPromise: Promise<string> | null = null;
const _tokenListeners = new Set<(token: string | null) => void>();

export const setAccessToken = (t: string | null) => { _accessToken = t; _tokenListeners.forEach(fn => fn(t)); };
export const getAccessToken = () => _accessToken;
export const onTokenChange = (fn: (token: string | null) => void) => { _tokenListeners.add(fn); return () => { _tokenListeners.delete(fn); }; };

export async function doRefresh(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = api
    .post<{ accessToken: string }>('/auth/refresh', {})
    .then((res) => {
      _accessToken = res.data.accessToken;
      return _accessToken as string;
    })
    .catch((err) => {
      _accessToken = null;
      throw err;
    })
    .finally(() => {
      _refreshPromise = null;
    });
  return _refreshPromise;
}

export function getApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: unknown }>(error)) {
    const data = error.response?.data as { error?: unknown } | undefined;
    if (typeof data?.error === 'string') return data.error;
    if (data?.error && typeof data.error === 'object' && 'message' in (data.error as object) && typeof (data.error as { message?: unknown }).message === 'string') {
      return (data.error as { message: string }).message;
    }
  }
  return fallback;
}

api.interceptors.request.use((config) => {
  if (_accessToken && config.headers) config.headers.Authorization = `Bearer ${_accessToken}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (!error.response) {
      console.error('[API] Network error:', error.message);
      // Don't retry network errors — let the caller handle
      return Promise.reject(error);
    }
    const orig = error.config;
    if (error.response?.status === 401 && orig && !orig._retry) {
      if (orig.url?.includes('/auth/login') || orig.url?.includes('/auth/refresh') || orig.url?.includes('/auth/logout')) return Promise.reject(error);
      orig._retry = true;
      try {
        const accessToken = await doRefresh();
        orig.headers.Authorization = `Bearer ${accessToken}`;
        return api(orig);
      } catch {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('session_expired', 'true');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
