// 主身帳號（LINE 分身）context
// 業務員可代管多個 LINE 分身（channel），這裡管理「目前操作的是哪一個」。
// activeChannel 存 localStorage，切換後所有 API 請求都帶對應 channel。

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface MyChannel {
  key: string;
  name: string;
  avatar: string;
  destination: string;
}

interface ChannelContextType {
  channels: MyChannel[];
  activeChannel: MyChannel | null;
  isLoading: boolean;
  setActiveChannelKey: (key: string) => void;
}

const ChannelContext = createContext<ChannelContextType | undefined>(undefined);

const API_BASE = '/api/v1';

export function ChannelProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [channels, setChannels] = useState<MyChannel[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(() => localStorage.getItem('sam_active_channel'));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setChannels([]);
      setActiveKey(null);
      localStorage.removeItem('sam_active_channel');
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/channels/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (cancelled) return;
        const list: MyChannel[] = Array.isArray(json?.data) ? json.data : [];
        setChannels(list);
        const current = localStorage.getItem('sam_active_channel');
        const valid = list.some((c) => c.key === current);
        if (!valid) {
          const first = list[0]?.key ?? null;
          setActiveKey(first);
          if (first) localStorage.setItem('sam_active_channel', first);
          else localStorage.removeItem('sam_active_channel');
        }
      } catch {
        if (!cancelled) setChannels([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token]);

  const setActiveChannelKey = useCallback((key: string) => {
    setActiveKey(key);
    localStorage.setItem('sam_active_channel', key);
  }, []);

  const activeChannel = channels.find((c) => c.key === activeKey) ?? channels[0] ?? null;

  return (
    <ChannelContext.Provider value={{ channels, activeChannel, isLoading, setActiveChannelKey }}>
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannel(): ChannelContextType {
  const context = useContext(ChannelContext);
  if (!context) throw new Error('useChannel must be used within ChannelProvider');
  return context;
}
