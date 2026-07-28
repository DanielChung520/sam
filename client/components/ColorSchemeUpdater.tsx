import { Fragment, useEffect, type ReactNode } from 'react';
import { ColorSchemeName, Platform, Appearance } from 'react-native';
import { Uniwind } from 'uniwind';
import { useTheme } from '@/contexts/ThemeContext';

const WebOnlyColorSchemeUpdater = function ({ children }: { children?: ReactNode }) {
  const { themeMode, resolvedTheme } = useTheme();

  useEffect(() => {
    Uniwind.setTheme(themeMode);
    if (Platform.OS === 'web') {
      document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
      document.documentElement.style.colorScheme = resolvedTheme;
    } else {
      Appearance.setColorScheme(resolvedTheme);
    }
  }, [themeMode, resolvedTheme]);

  // Listen for Coze workbench color scheme messages (embedded mode)
  useEffect(() => {
    function handleMessage(e: MessageEvent<{ event: string; colorScheme: ColorSchemeName } | undefined>) {
      if (e.data?.event === 'coze.workbench.colorScheme') {
        const cs = e.data.colorScheme;
        if (typeof cs === 'string' && themeMode === 'system') {
          Uniwind.setTheme(cs);
        }
      }
    }

    if (Platform.OS === 'web') {
      window.addEventListener('message', handleMessage, false);
    }

    return () => {
      if (Platform.OS === 'web') {
        window.removeEventListener('message', handleMessage, false);
      }
    };
  }, [themeMode]);

  return <Fragment>{children}</Fragment>;
};

export { WebOnlyColorSchemeUpdater };
