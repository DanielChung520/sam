// 業務員（客戶）認證上下文
// 登入 la.aiconn.ai：username/password → JWT（含 businessOwnerId + channelIds）
// 啟動時呼叫 /auth/me 驗證 token 有效性，無效即清除登入狀態

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export interface BusinessUser {
  id: string;
  name: string;
  email: string;
  businessOwnerId: string;
  channelIds: string[];
}

interface AuthContextType {
  user: BusinessUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const API_BASE = '/api/v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredUser(): BusinessUser | null {
  try {
    const raw = localStorage.getItem('sam_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BusinessUser | null>(readStoredUser);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sam_token'));
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(() => !!localStorage.getItem('sam_token'));

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('sam_token');
    localStorage.removeItem('sam_user');
  }, []);

  // 啟動時驗證既有 token：無效或無 user → 清除並回到登入畫面
  useEffect(() => {
    const storedToken = localStorage.getItem('sam_token');
    if (!storedToken) {
      setIsBootstrapping(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (!res.ok) throw new Error('token invalid');
        const json = await res.json();
        if (!json.user) throw new Error('no user');
        if (!cancelled) {
          setToken(storedToken);
          setUser(json.user);
          localStorage.setItem('sam_user', JSON.stringify(json.user));
        }
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/business-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? '登入失敗');
    }
    setToken(json.token);
    setUser(json.user);
    localStorage.setItem('sam_token', json.token);
    localStorage.setItem('sam_user', JSON.stringify(json.user));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token && !!user, isBootstrapping, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
