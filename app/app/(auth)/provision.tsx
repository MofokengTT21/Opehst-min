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
  Share,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { provisionOrg } from '../../services/auth';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

type Form = { orgName: string; adminPhone: string };

export default function ProvisionScreen() {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{ name: string; authCode: string } | null>(null);
  const router = useRouter();

  const { control, handleSubmit, formState: { errors }, setError } = useForm<Form>({
    defaultValues: { orgName: '', adminPhone: '' },
  });

  const successScale = useSharedValue(0);
  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successScale.value,
  }));

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      const res = await provisionOrg(data.orgName.trim(), data.adminPhone.trim());
      setResult({ name: res.tenant.name, authCode: res.authCode });
      successScale.value = withSpring(1, { stiffness: 200, damping: 20, overshootClamping: true });
    } catch (err: any) {
      setError('orgName', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;
    await Share.share({
      message: `Your Opehst workspace "${result.name}" is ready!\n\n1. Download the Opehst app\n2. Login with your phone number\n3. Use this Admin Auth Code to claim your workspace:\n\n${result.authCode}`,
      title: 'Opehst Workspace Auth Code',
    });
  };

  return (
    <View className="flex-1 bg-surface-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center px-6 pb-10 mt-10">

            {/* Back */}
            <Animated.View entering={FadeIn.duration(400)} className="mb-8">
              <TouchableOpacity
                onPress={() => router.back()}
                className="flex-row items-center mb-8"
                activeOpacity={0.7}
              >
                <Text className="text-ophest font-semibold text-base">← Back to Login</Text>
              </TouchableOpacity>

              <Text className="text-text-primary text-3xl font-bold tracking-tight">
                Provision Workspace
              </Text>
              <Text className="text-text-secondary text-base mt-2">
                Opehst Staff Tool. Create a new tenant and generate an admin auth code.
              </Text>
            </Animated.View>

            {/* Form card */}
            {!result ? (
              <Animated.View entering={FadeIn.duration(500).delay(100)} className="bg-surface-card rounded-3xl p-6">
                
                <Text className="text-text-secondary text-xs font-semibold mb-2 uppercase tracking-widest">
                  Organisation Name
                </Text>
                <Controller
                  control={control}
                  name="orgName"
                  rules={{
                    required: 'Organisation name is required',
                    minLength: { value: 2, message: 'Must be at least 2 characters' },
                  }}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="bg-surface-background border border-surface-border text-text-primary rounded-2xl px-4 py-4 text-base mb-4"
                      placeholder="e.g. Acme Engineering"
                      placeholderTextColor="#a1a1aa"
                      autoCapitalize="words"
                      value={value}
                      onChangeText={onChange}
                    />
                  )}
                />
                {errors.orgName && (
                  <Text className="text-semantic-breakdown text-xs mt-[-12px] mb-4">
                    {errors.orgName.message}
                  </Text>
                )}

                <Text className="text-text-secondary text-xs font-semibold mb-2 uppercase tracking-widest">
                  Admin Phone Number
                </Text>
                <Controller
                  control={control}
                  name="adminPhone"
                  rules={{
                    required: 'Admin phone is required',
                    pattern: { value: /^\+\d{7,15}$/, message: 'Include country code, e.g. +27...' },
                  }}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="bg-surface-background border border-surface-border text-text-primary rounded-2xl px-4 py-4 text-base mb-1"
                      placeholder="+27 82 000 0000"
                      placeholderTextColor="#a1a1aa"
                      keyboardType="phone-pad"
                      value={value}
                      onChangeText={onChange}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit(onSubmit)}
                    />
                  )}
                />
                {errors.adminPhone && (
                  <Text className="text-semantic-breakdown text-xs mt-1 mb-3">
                    {errors.adminPhone.message}
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
                    : <Text className="text-text-brand font-bold text-base">Provision & Generate Code</Text>
                  }
                </TouchableOpacity>
              </Animated.View>
            ) : (
              /* Success Result */
              <Animated.View
                style={[successStyle]}
                className="bg-surface-card rounded-3xl p-6 items-center"
              >
                <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
                <Text className="text-text-primary text-xl font-bold text-center mb-1">
                  {result.name} Provisioned
                </Text>
                <Text className="text-text-secondary text-sm text-center mb-6 px-4">
                  The admin has been pre-registered. Send them this code:
                </Text>

                <View className="bg-surface-background border border-surface-border rounded-2xl w-full py-6 items-center justify-center mb-6">
                  <Text className="text-text-primary text-3xl font-bold tracking-[8px]">
                    {result.authCode}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleShare}
                  activeOpacity={0.85}
                  className="bg-[#0071e3] rounded-2xl py-4 w-full flex-row items-center justify-center mb-3"
                >
                  <Ionicons name="share-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-base">Share with Client</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setResult(null); control._reset(); }}
                  activeOpacity={0.7}
                  className="py-3"
                >
                  <Text className="text-text-secondary font-semibold">Provision another</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
