import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="provision" />
      <Stack.Screen name="admin-auth" />
      <Stack.Screen name="join-org" />
      <Stack.Screen name="pending-approval" />
    </Stack>
  );
}
