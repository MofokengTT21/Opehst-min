import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="pending-members" />
      <Stack.Screen name="invite-codes" />
    </Stack>
  );
}
