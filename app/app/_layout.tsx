import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initServices, stopServices } from '../services/initServices';
import { seedDatabase } from '../database/seed';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export default function RootLayout() {
  useEffect(() => {
    seedDatabase().then(() => {
      initServices();
    });
    return () => stopServices();
  }, []);

  return (
    <KeyboardProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="directory" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="new-item" options={{ presentation: 'modal', headerShown: true, title: 'New Item' }} />
        <Stack.Screen name="item/[id]" options={{ headerShown: false }} />
      </Stack>
    </KeyboardProvider>
  );
}

