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
      setAccessToken(res.data.accessToken);
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

export const analyticsApi = {
  productivity: (params?: any) => api.get('/analytics/productivity', { params }),
  departmentPerformance: () => api.get('/analytics/department-performance'),
  employeeProductivity: (params?: any) => api.get('/analytics/employee-productivity', { params }),
  managerDashboard: (managerId: string) => api.get('/analytics/manager-dashboard', { params: { managerId } }),
};

export const reportTemplatesApi = {
  list: (params?: any) => api.get('/report-templates', { params }),
  create: (data: any) => api.post('/report-templates', data),
  update: (id: string, data: any) => api.patch(`/report-templates/${id}`, data),
  delete: (id: string) => api.delete(`/report-templates/${id}`),
};

export const scheduledReportsApi = {
  list: (params?: any) => api.get('/scheduled-reports', { params }),
  create: (data: any) => api.post('/scheduled-reports', data),
  update: (id: string, data: any) => api.patch(`/scheduled-reports/${id}`, data),
  delete: (id: string) => api.delete(`/scheduled-reports/${id}`),
  run: (id: string) => api.post(`/scheduled-reports/${id}/run`),
  results: (id: string) => api.get(`/scheduled-reports/${id}/results`),
};
