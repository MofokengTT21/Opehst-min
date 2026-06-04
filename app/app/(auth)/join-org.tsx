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
import { joinOrg, getSession } from '../../services/auth';
import Animated, { FadeIn } from 'react-native-reanimated';

type JoinForm = { inviteCode: string };

export default function JoinOrgScreen() {
  const [loading, setLoading] = React.useState(false);
  const { setSession, refreshUser, logout } = useAuth();

  const { control, handleSubmit, formState: { errors }, setError } = useForm<JoinForm>({
    defaultValues: { inviteCode: '' },
  });

  const handleJoin = async (data: JoinForm) => {
    setLoading(true);
    try {
      await joinOrg(data.inviteCode);
      const session = await getSession();
      setSession(session);
      await refreshUser();
      // RootNavigationGuard routes based on status and dbUser.name
    } catch (err: any) {
      setError('inviteCode', { message: err.message });
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
                <Text className="text-text-primary text-3xl font-bold tracking-tight">
                  Enter invite code
                </Text>
                <Text className="text-text-secondary text-base mt-2">
                  Ask your admin for a code to join your organisation's workspace.
                </Text>
              </View>

              {/* Code card */}
              <View className="bg-surface-card rounded-3xl p-6">
                <Text className="text-text-secondary text-xs font-semibold mb-2 uppercase tracking-widest">
                  Invite Code
                </Text>
                <Controller
                  control={control}
                  name="inviteCode"
                  rules={{
                    required: 'Invite code is required',
                    minLength: { value: 4, message: 'Invalid invite code' },
                  }}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      id="input-invite-code"
                      className="bg-surface-background border border-surface-border text-text-primary rounded-2xl px-4 py-4 text-center text-xl tracking-[8px] font-bold uppercase mb-1"
                      placeholder="· · · · · ·"
                      placeholderTextColor="#a1a1aa"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      autoFocus
                      value={value.toUpperCase()}
                      onChangeText={(t) => onChange(t.toUpperCase())}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit(handleJoin)}
                    />
                  )}
                />
                {errors.inviteCode && (
                  <Text className="text-semantic-breakdown text-xs mt-1 mb-3">
                    {errors.inviteCode.message}
                  </Text>
                )}

                <View className="h-4" />

                <TouchableOpacity
                  id="btn-join-org"
                  className="bg-ophest rounded-2xl items-center justify-center py-4"
                  onPress={handleSubmit(handleJoin)}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text className="text-text-brand font-bold text-base">Request to Join</Text>
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
