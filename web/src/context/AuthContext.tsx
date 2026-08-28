'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, setAccessToken, getAccessToken, doRefresh, onTokenChange } from '../lib/api';
import { initializeSocket, disconnectSocket, joinUserRoom } from '../lib/socket';
import { queryClient } from '../lib/queryClient';

interface User {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'director' | 'hr' | 'employee';
  departmentId?: string;
  designation?: string;
  status: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  joiningDate?: string;
  twoFactorEnabled?: boolean;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, pendingAuthToken?: string, twoFactorCode?: string) => Promise<{ twoFactorRequired: boolean; pendingAuthToken?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch { return true; }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    if (PUBLIC_PATHS.includes(pathname)) { setLoading(false); return; }
    const init = async () => {
      try {
        if (!getAccessToken() || isTokenExpired(getAccessToken()!)) {
          const accessToken = await doRefresh();
          if (cancelled) return;
          setAccessToken(accessToken);
        }
        const me = await api.get('/auth/me');
        if (!cancelled) setUser((prev: any) => {
          if (prev && prev.id === me.data.id && prev.role === me.data.role && prev.status === me.data.status) return prev;
          return me.data;
        });
      } catch {
        if (!cancelled) { setAccessToken(null); setUser(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.includes(pathname);
    if (!user && !isPublic) router.push('/login');
    else if (user && isPublic) router.push('/dashboard');
  }, [user, loading, pathname, router]);

  useEffect(() => {
    if (user && getAccessToken()) {
      initializeSocket(getAccessToken()!);
      joinUserRoom(user.id);
    }
    return () => { disconnectSocket(); };
  }, [user]);

  const login = useCallback(async (email: string, password: string, pendingAuthToken?: string, twoFactorCode?: string) => {
    setLoading(true);
    try {
      if (pendingAuthToken && twoFactorCode) {
        const res = await api.post('/auth/login', { email, password, pendingAuthToken, twoFactorCode });
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
        router.push('/dashboard');
        return { twoFactorRequired: false };
      }
      const res = await api.post('/auth/login', { email, password });
      if (res.data.twoFactorRequired) {
        return { twoFactorRequired: true, pendingAuthToken: res.data.pendingAuthToken };
      }
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
      router.push('/dashboard');
      return { twoFactorRequired: false };
    } catch (err) {
      setAccessToken(null);
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    setAccessToken(null);
    setUser(null);
    disconnectSocket();
    queryClient.clear();
    router.push('/login');
  }, [router]);

  const refreshProfile = useCallback(async () => {
    try {
      if (!getAccessToken()) return;
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setAccessToken(null);
        setUser(null);
      }
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refreshProfile }), [user, loading, login, logout, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be within AuthProvider');
  return c;
};
