import { api } from './api';

export const apiEndpoints = {
  notifications: {
    list: (params?: Record<string, any>) => api.get('/notifications', { params }),
    markRead: (id: string) => api.post(`/notifications/${id}/read`),
    markAllRead: () => api.post('/notifications/read-all'),
    delete: (id: string) => api.delete(`/notifications/${id}`),
    deleteAll: () => api.delete('/notifications/all'),
    stats: () => api.get('/notifications/stats'),
  },
  files: {
    upload: (formData: FormData) =>
      api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) {
            const event = new CustomEvent('file-upload-progress', {
              detail: { loaded: e.loaded, total: e.total },
            });
            window.dispatchEvent(event);
          }
        },
      }),
    list: (params?: Record<string, any>) => api.get('/files', { params }),
    download: (id: string) => api.get(`/files/${id}/download`, { responseType: 'blob' }),
    delete: (id: string) => api.delete(`/files/${id}`),
  },
  security: {
    policy: () => api.get('/security/policy'),
    updatePolicy: (data: any) => api.put('/security/policy', data),
    auditLog: (params?: Record<string, any>) => api.get('/security/audit', { params }),
    sessions: () => api.get('/security/sessions'),
  },
};
