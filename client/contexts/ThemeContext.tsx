import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { lightColors, darkColors, type ColorTokens } from '@/theme/colors';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'sam_theme_mode';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: ColorTokens;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function loadSavedTheme(): ThemeMode {
  try {
    if (Platform.OS === 'web') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'system' || saved === 'light' || saved === 'dark') return saved;
    }
  } catch {}
  return 'system';
}

function saveTheme(mode: ThemeMode) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(loadSavedTheme);
  const systemColorScheme = useColorScheme();

  const resolvedTheme: ResolvedTheme =
    themeMode === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : themeMode;

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    saveTheme(mode);
  }, []);

  const colors = useMemo(() => (resolvedTheme === 'dark' ? darkColors : lightColors), [resolvedTheme]);

  const value = useMemo(
    () => ({ themeMode, resolvedTheme, colors, setThemeMode }),
    [themeMode, resolvedTheme, colors, setThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
