import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initServices, stopServices } from '../services/initServices';
import { seedDatabase } from '../database/seed';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider, useAuth } from '../services/authContext';

function RootNavigationGuard() {
  const { session, isReady } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = (segments[0] as string) === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(drawer)');
    }
  }, [session, isReady, segments]);

  if (!isReady) return null; // Splash screen placeholder

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="directory" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="new-channel" options={{ presentation: 'modal', headerShown: true, title: 'New Channel' }} />
      <Stack.Screen name="channel/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    seedDatabase().then(initServices).catch(console.error);
    return () => stopServices();
  }, []);

  return (
    <AuthProvider>
      <KeyboardProvider>
        <StatusBar style="dark" />
        <RootNavigationGuard />
      </KeyboardProvider>
    </AuthProvider>
  );
}

