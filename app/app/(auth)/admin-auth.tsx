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
import { useAuth } from '../../services/authContext';
import { verifyAdminAuth, getSession } from '../../services/auth';
import Animated, { FadeIn } from 'react-native-reanimated';

type Form = { authCode: string };

export default function AdminAuthScreen() {
  const [loading, setLoading] = React.useState(false);
  const { setSession, refreshUser, logout } = useAuth();

  const { control, handleSubmit, formState: { errors }, setError } = useForm<Form>({
    defaultValues: { authCode: '' },
  });

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      await verifyAdminAuth(data.authCode);
      const session = await getSession();
      setSession(session);
      await refreshUser();
      // RootNavigationGuard routes based on status and dbUser.name
    } catch (err: any) {
      setError('authCode', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-surface-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center px-6 pb-10">

            <Animated.View entering={FadeIn.duration(350)}>
              {/* Header */}
              <View className="mb-10 mt-10">
                <View className="flex-row items-center mb-4">
                  <Text style={{ fontSize: 32, marginRight: 12 }}>👑</Text>
                  <Text className="text-ophest text-sm font-bold uppercase tracking-widest">
                    Admin Setup
                  </Text>
                </View>
                <Text className="text-text-primary text-3xl font-bold tracking-tight">
                  Enter Auth Code
                </Text>
                <Text className="text-text-secondary text-base mt-2">
                  Your workspace has been pre-configured. Enter the 6-character auth code provided by Opehst to claim admin access.
                </Text>
              </View>

              {/* Code card */}
              <View className="bg-surface-card rounded-3xl p-6">
                <Text className="text-text-secondary text-xs font-semibold mb-2 uppercase tracking-widest">
                  Auth Code
                </Text>
                <Controller
                  control={control}
                  name="authCode"
                  rules={{
                    required: 'Auth code is required',
                    minLength: { value: 6, message: 'Invalid code length' },
                  }}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="bg-surface-background border border-surface-border text-text-primary rounded-2xl px-4 py-4 text-center text-2xl tracking-[8px] font-bold uppercase mb-1"
                      placeholder="· · · · · ·"
                      placeholderTextColor="#a1a1aa"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      autoFocus
                      value={value.toUpperCase()}
                      onChangeText={(t) => onChange(t.toUpperCase())}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit(onSubmit)}
                    />
                  )}
                />
                {errors.authCode && (
                  <Text className="text-semantic-breakdown text-xs mt-1 mb-3">
                    {errors.authCode.message}
                  </Text>
                )}

                <View className="h-4" />

                <TouchableOpacity
                  className="bg-ophest rounded-2xl items-center justify-center py-4"
                  onPress={handleSubmit(onSubmit)}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text className="text-text-brand font-bold text-base">Claim Workspace</Text>
                  }
                </TouchableOpacity>
              </View>

              {/* Progress dots */}
              <View className="flex-row justify-center mt-8 gap-2 mb-8">
                <View className="w-2 h-2 rounded-full bg-ophest" style={{ opacity: 0.4 }} />
                <View className="w-6 h-2 rounded-full bg-ophest" />
                <View className="w-2 h-2 rounded-full bg-surface-border" />
              </View>

              {/* Logout / Start Over */}
              <TouchableOpacity
                onPress={logout}
                className="items-center py-2"
                activeOpacity={0.7}
              >
                <Text className="text-text-secondary text-xs font-semibold">
                  Wrong number? Log out
                </Text>
              </TouchableOpacity>
            </Animated.View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
