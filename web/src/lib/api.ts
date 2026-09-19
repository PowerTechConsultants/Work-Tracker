import axios from 'axios';

const apiOrigin = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');

export const api = axios.create({
  baseURL: apiOrigin ? `${apiOrigin}/api/v1` : '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 30000,
});

let _accessToken: string | null = null;
let _refreshPromise: Promise<string> | null = null;
const _tokenListeners = new Set<(token: string | null) => void>();
const _retryQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

export const setAccessToken = (t: string | null) => { _accessToken = t; _tokenListeners.forEach(fn => fn(t)); };
export const getAccessToken = () => _accessToken;
export const onTokenChange = (fn: (token: string | null) => void) => { _tokenListeners.add(fn); return () => { _tokenListeners.delete(fn); }; };

export async function doRefresh(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = api
    .post<{ accessToken: string }>('/auth/refresh', {})
    .then((res) => {
      setAccessToken(res.data.accessToken);
      // Re-auth socket with fresh token to prevent "Invalid token" after refresh
      import('./socket').then((m) => m.initializeSocket(res.data.accessToken)).catch(() => {});
      return _accessToken as string;
    })
    .catch((err) => {
      setAccessToken(null);
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
      return Promise.reject(error);
    }
    const orig = error.config;
    if (error.response?.status === 401 && orig && !orig._retry) {
      if (orig.url?.includes('/auth/login') || orig.url?.includes('/auth/refresh') || orig.url?.includes('/auth/logout')) return Promise.reject(error);
      orig._retry = true;
      try {
        // If a refresh is already in progress, wait for it instead of triggering another
        if (_refreshPromise) {
          await _refreshPromise;
        } else {
          await doRefresh();
        }
        if (!_accessToken) throw new Error('No token after refresh');
        orig.headers.Authorization = `Bearer ${_accessToken}`;
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

export const analyticsApi = {
  productivity: (params?: any) => api.get('/analytics/productivity', { params }),
  departmentPerformance: () => api.get('/analytics/department-performance'),
  employeeProductivity: (params?: any) => api.get('/analytics/employee-productivity', { params }),
  managerDashboard: (managerId: string) => api.get('/analytics/manager-dashboard', { params: { managerId } }),
};

export const overtimeApi = {
  getMy: (year: number, month: number) => api.get(`/attendance/overtime/my/${year}/${month}`),
  getAll: (year: number, month: number) => api.get(`/attendance/overtime/${year}/${month}`),
};
