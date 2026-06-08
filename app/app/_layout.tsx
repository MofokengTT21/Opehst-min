import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initServices, stopServices } from '../services/initServices';
import { seedDatabase } from '../database/seed';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider, useAuth } from '../services/authContext';
import { HubProvider } from '../contexts/HubContext';

function RootNavigationGuard() {
  const { session, dbUser, userStatus, isReady, syncTrigger } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = (segments[0] as string) === '(auth)';
    const inAdminGroup = (segments[0] as string) === 'admin';
    const currentRoute = segments.join('/');

    if (!session) {
      // Not logged in → phone entry
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // ── Route by onboarding status ──────────────────────────────────────────
    const needsName = !dbUser?.name;

    switch (userStatus) {
      case 'pending_admin_auth':
        // Admin needs to enter auth code first
        if (currentRoute !== '(auth)/admin-auth') {
          router.replace('/(auth)/admin-auth' as any);
        }
        break;

      case 'pending_org':
        // Regular user needs to enter invite code first
        if (currentRoute !== '(auth)/join-org') {
          router.replace('/(auth)/join-org' as any);
        }
        break;

      case 'invited_to_org':
      case 'pending_approval':
      case 'rejected':
        // Has joined an org, but needs a name before waiting
        if (needsName) {
          if (currentRoute !== '(auth)/profile-setup') router.replace('/(auth)/profile-setup' as any);
        } else {
          if (currentRoute !== '(auth)/pending-approval') router.replace('/(auth)/pending-approval' as any);
        }
        break;

      case 'active':
        // Full access, but must have a name
        if (needsName) {
          if (currentRoute !== '(auth)/profile-setup') router.replace('/(auth)/profile-setup' as any);
        } else {
          if (inAuthGroup) router.replace('/(drawer)' as any);
        }
        break;

      default:
        // Fallback — shouldn't happen but prevent loops
        if (!inAuthGroup && !inAdminGroup) router.replace('/(auth)/login');
    }
  }, [session, dbUser, userStatus, isReady, segments, syncTrigger]);

  if (!isReady) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Auth / Onboarding group */}
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      {/* Main app */}
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      {/* Admin */}
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      {/* Standalone screens */}
      <Stack.Screen name="directory" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="hubs-listing" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="new-channel" options={{ presentation: 'modal', headerShown: true, title: 'New Channel' }} />
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
      <HubProvider>
        <KeyboardProvider>
          <StatusBar style="auto" />
          <RootNavigationGuard />
        </KeyboardProvider>
      </HubProvider>
    </AuthProvider>
  );
}
