import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { saveProfile } from '../../services/auth';
import { useAuth } from '../../services/authContext';
import Animated, { FadeIn } from 'react-native-reanimated';

type Form = { name: string };

export default function ProfileSetupScreen() {
  const [loading, setLoading] = React.useState(false);
  const { refreshUser, logout } = useAuth();
  const router = useRouter();
  const { control, handleSubmit, formState: { errors }, setError } = useForm<Form>({
    defaultValues: { name: '' },
  });

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      await saveProfile(data.name.trim());
      await refreshUser();
      // The RootNavigationGuard will automatically route the user based on their status
      // (active -> drawer, pending_approval -> pending-approval screen)
    } catch (err: any) {
      setError('name', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-surface-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center px-6 pb-10">

            {/* Header */}
            <Animated.View entering={FadeIn.duration(500)} className="mb-10">
              <Text className="text-text-primary text-3xl font-bold tracking-tight">
                What's your name?
              </Text>
              <Text className="text-text-secondary text-base mt-2">
                This is how you'll appear to your team on Opehst.
              </Text>
            </Animated.View>

            {/* Form card */}
            <Animated.View entering={FadeIn.duration(600).delay(100)} className="bg-surface-card rounded-3xl p-6">
              <Text className="text-text-secondary text-xs font-semibold mb-2 uppercase tracking-widest">
                Full Name
              </Text>
              <Controller
                control={control}
                name="name"
                rules={{ required: 'Your name is required', minLength: { value: 2, message: 'Must be at least 2 characters' } }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    id="input-name"
                    className="bg-surface-background border border-surface-border text-text-primary rounded-2xl px-4 py-4 text-base mb-1"
                    placeholder="e.g. Sipho Dlamini"
                    placeholderTextColor="#a1a1aa"
                    autoCapitalize="words"
                    autoComplete="name"
                    autoFocus
                    value={value}
                    onChangeText={onChange}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit(onSubmit)}
                  />
                )}
              />
              {errors.name && (
                <Text className="text-semantic-breakdown text-xs mt-1 mb-3">
                  {errors.name.message}
                </Text>
              )}

              <View className="h-4" />

              <TouchableOpacity
                id="btn-save-profile"
                className="bg-ophest rounded-2xl items-center justify-center py-4"
                onPress={handleSubmit(onSubmit)}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text className="text-text-brand font-bold text-base">Continue</Text>
                }
              </TouchableOpacity>
            </Animated.View>

            {/* Progress dots */}
            <Animated.View entering={FadeIn.duration(700).delay(200)} className="flex-row justify-center mt-8 gap-2 mb-8">
              <View className="w-6 h-2 rounded-full bg-ophest" />
              <View className="w-2 h-2 rounded-full bg-surface-border" />
              <View className="w-2 h-2 rounded-full bg-surface-border" />
            </Animated.View>

            {/* Logout / Start Over */}
            <Animated.View entering={FadeIn.duration(700).delay(300)}>
              <TouchableOpacity
                onPress={logout}
                className="items-center py-2"
                activeOpacity={0.7}
              >
                <Text className="text-text-secondary text-xs font-semibold">
                  Wrong account? Log out
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
