import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initServices, stopServices } from '../services/initServices';
import { seedDatabase } from '../database/seed';

export default function RootLayout() {
  useEffect(() => {
    seedDatabase().then(() => {
      initServices();
    });
    return () => stopServices();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="directory" options={{ presentation: 'modal', headerShown: true, title: 'Select Item' }} />
        <Stack.Screen name="new-item" options={{ presentation: 'modal', headerShown: true, title: 'New Item' }} />
        <Stack.Screen name="compose-log" options={{ presentation: 'transparentModal', headerShown: false }} />
        <Stack.Screen name="item/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
