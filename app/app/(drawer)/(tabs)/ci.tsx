import { View, Text } from 'react-native';

export default function CIBoardScreen() {
  return (
    <View className="flex-1 bg-surface-background items-center justify-center p-5">
      <Text className="text-text-primary text-2xl font-bold mb-2">Continuous Improvement</Text>
      <Text className="text-text-secondary text-base text-center">
        Digitised SHEQ cross and performance boards will appear here.
      </Text>
    </View>
  );
}
