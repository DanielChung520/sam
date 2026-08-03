import { AuthProvider } from '@/contexts/AuthContext';
import { ChannelProvider } from '@/contexts/ChannelContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WebOnlyColorSchemeUpdater } from './ColorSchemeUpdater';
import { WebOnlyPrettyScrollbar } from './PrettyScrollbar'
import { HeroUINativeProvider } from '@/heroui';

function Provider({ children }: { children: ReactNode }) {
  return <ThemeProvider>
    <WebOnlyColorSchemeUpdater>
      <WebOnlyPrettyScrollbar>
        <AuthProvider>
          <ChannelProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <HeroUINativeProvider>
                {children}
              </HeroUINativeProvider>
            </GestureHandlerRootView>
          </ChannelProvider>
        </AuthProvider>
      </WebOnlyPrettyScrollbar>
    </WebOnlyColorSchemeUpdater>
  </ThemeProvider>
}

export {
  Provider,
}
