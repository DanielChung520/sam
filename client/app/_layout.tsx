import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, View, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { Provider } from '@/components/Provider';
import { useAuth } from '@/contexts/AuthContext';

import '../global.css';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
]);

function AuthGuard() {
  const { isAuthenticated } = useAuth();
  return (
    <Stack.Protected guard={isAuthenticated}>
      <Stack.Screen name="(tabs)" />
    </Stack.Protected>
  );
}

export default function RootLayout() {
  return (
    <Provider>
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          headerShown: false,
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <AuthGuard />
        <Stack.Screen name="chat-detail" options={{ headerShown: false }} />
        <Stack.Screen name="chat-detail" options={{ headerShown: false }} />
        <Stack.Screen name="friend-detail" options={{ headerShown: false }} />
        <Stack.Screen name="broadcast-create" options={{ headerShown: false }} />
        <Stack.Screen name="greeting-cards" options={{ headerShown: false }} />
        <Stack.Screen name="ai-chat" options={{ headerShown: false }} />
        <Stack.Screen name="news" options={{ headerShown: false }} />
        <Stack.Screen name="news-settings" options={{ headerShown: false }} />
        <Stack.Screen name="news-settings-time" options={{ headerShown: false }} />
        <Stack.Screen name="card-holder" options={{ headerShown: false }} />
        <Stack.Screen name="sync-friends" options={{ headerShown: false }} />
        <Stack.Screen name="add-friend" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
        <Stack.Screen name="chat-history" options={{ headerShown: false }} />
        <Stack.Screen name="broadcast-holiday" options={{ headerShown: false }} />
        <Stack.Screen name="broadcast-regular" options={{ headerShown: false }} />
        <Stack.Screen name="broadcast-announce" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
      <Toast />
    </Provider>
  );
}
