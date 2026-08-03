// 業務員（客戶）認證上下文
// 登入 la.aiconn.ai：username/password → JWT（含 businessOwnerId + channelIds）

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const API_BASE = '/api/v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BusinessUser | null>(() => {
    try {
      const raw = localStorage.getItem('sam_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sam_token'));

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

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('sam_token');
    localStorage.removeItem('sam_user');
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token, login, logout }}
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
