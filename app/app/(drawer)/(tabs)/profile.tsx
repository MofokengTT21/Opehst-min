import { View, Text } from 'react-native';

export default function ProfileScreen() {
  return (
    <View className="flex-1 bg-surface-background items-center justify-center p-5">
      <Text className="text-text-primary text-2xl font-bold mb-2">Profile & Settings</Text>
      <Text className="text-text-secondary text-base text-center">
        Manage your account and app preferences here.
      </Text>
    </View>
  );
}
