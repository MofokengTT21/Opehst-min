import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../services/authContext';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { logout } = useAuth();

  return (
    <View className="flex-1 bg-surface-background items-center justify-center p-5">
      <Text className="text-text-primary text-2xl font-bold mb-2">Profile & Settings</Text>
      <Text className="text-text-secondary text-base text-center mb-8">
        Manage your account and app preferences here.
      </Text>

      <TouchableOpacity 
        onPress={logout}
        activeOpacity={0.7}
        className="flex-row items-center bg-red-500/10 px-6 py-3 rounded-xl border border-red-500/20"
      >
        <Ionicons name="log-out-outline" size={20} color="#ef4444" style={{ marginRight: 8 }} />
        <Text className="text-red-500 font-semibold text-base">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
