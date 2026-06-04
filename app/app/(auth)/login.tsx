import React, { useRef } from 'react';
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
import { useAuth } from '../../services/authContext';
import { requestOTP, verifyOTP } from '../../services/auth';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

type Step = 'phone' | 'otp';

type PhoneForm = { phone: string };
type OTPForm = { code: string };

export default function LoginScreen() {
  const [step, setStep] = React.useState<Step>('phone');
  const [loading, setLoading] = React.useState(false);
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const { setSession } = useAuth();
  const router = useRouter();

  const phoneForm = useForm<PhoneForm>({ defaultValues: { phone: '' } });
  const otpForm = useForm<OTPForm>({ defaultValues: { code: '' } });

  // Card scale spring for step transition feedback
  const cardScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const bounceCard = () => {
    cardScale.value = withSpring(0.97, { stiffness: 400, damping: 20 }, () => {
      'worklet';
      cardScale.value = withSpring(1, { stiffness: 250, damping: 30, overshootClamping: true });
    });
  };

  const handleRequestOTP = async (data: PhoneForm) => {
    setLoading(true);
    bounceCard();
    try {
      await requestOTP(data.phone);
      setPhoneNumber(data.phone);
      setStep('otp');
    } catch (err: any) {
      phoneForm.setError('phone', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (data: OTPForm) => {
    setLoading(true);
    bounceCard();
    try {
      const result = await verifyOTP(phoneNumber, data.code);
      const { getSession } = await import('../../services/auth');
      const session = await getSession();
      setSession(session);
      // RootNavigationGuard will route based on userStatus
    } catch (err: any) {
      otpForm.setError('code', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-surface-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center px-6 pb-10">

            {/* Logo + heading */}
            <Animated.View entering={FadeIn.duration(500)} className="mb-10 items-center">
              {/* Brand mark */}
              <View
                className="w-16 h-16 rounded-2xl bg-ophest items-center justify-center mb-6"
                style={{ shadowColor: '#0071e3', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}
              >
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>O</Text>
              </View>
              <Text className="text-text-primary text-3xl font-bold tracking-tight text-center">
                {step === 'phone' ? 'Welcome to Opehst' : 'Check your messages'}
              </Text>
              <Text className="text-text-secondary text-base mt-2 text-center px-4">
                {step === 'phone'
                  ? 'Enter your mobile number to get started'
                  : `We sent a 6-digit code to\n${phoneNumber}`}
              </Text>
            </Animated.View>

            {/* Card */}
            <Animated.View style={cardStyle} className="bg-surface-card rounded-3xl p-6">

              {step === 'phone' ? (
                <Animated.View key="phone" entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
                  {/* Country code + phone number */}
                  <Text className="text-text-secondary text-xs font-semibold mb-2 uppercase tracking-widest">
                    Mobile Number
                  </Text>
                  <Controller
                    control={phoneForm.control}
                    name="phone"
                    rules={{
                      required: 'Phone number is required',
                      pattern: { value: /^\+\d{7,15}$/, message: 'Include country code, e.g. +27...' },
                    }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="bg-surface-background border border-surface-border text-text-primary rounded-2xl px-4 py-4 text-base mb-1"
                        placeholder="+27 82 000 0000"
                        placeholderTextColor="#a1a1aa"
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        value={value}
                        onChangeText={onChange}
                        returnKeyType="done"
                        onSubmitEditing={phoneForm.handleSubmit(handleRequestOTP)}
                      />
                    )}
                  />
                  {phoneForm.formState.errors.phone && (
                    <Text className="text-semantic-breakdown text-xs mt-1 mb-3">
                      {phoneForm.formState.errors.phone.message}
                    </Text>
                  )}
                  <View className="h-4" />
                  <TouchableOpacity
                    id="btn-send-otp"
                    className="bg-ophest rounded-2xl items-center justify-center py-4"
                    onPress={phoneForm.handleSubmit(handleRequestOTP)}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text className="text-text-brand font-bold text-base">Send Verification Code</Text>
                    }
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <Animated.View key="otp" entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
                  <Text className="text-text-secondary text-xs font-semibold mb-2 uppercase tracking-widest">
                    Verification Code
                  </Text>
                  <Controller
                    control={otpForm.control}
                    name="code"
                    rules={{
                      required: 'Code is required',
                      minLength: { value: 6, message: 'Must be 6 digits' },
                      maxLength: { value: 6, message: 'Must be 6 digits' },
                    }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="bg-surface-background border border-surface-border text-text-primary rounded-2xl px-4 py-4 text-center text-2xl tracking-[14px] font-bold mb-1"
                        placeholder="· · · · · ·"
                        placeholderTextColor="#a1a1aa"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={value}
                        onChangeText={onChange}
                        returnKeyType="done"
                        onSubmitEditing={otpForm.handleSubmit(handleVerifyOTP)}
                        autoFocus
                      />
                    )}
                  />
                  {otpForm.formState.errors.code && (
                    <Text className="text-semantic-breakdown text-xs mt-1 mb-3">
                      {otpForm.formState.errors.code.message}
                    </Text>
                  )}
                  <View className="h-4" />
                  <TouchableOpacity
                    id="btn-verify-otp"
                    className="bg-ophest rounded-2xl items-center justify-center py-4"
                    onPress={otpForm.handleSubmit(handleVerifyOTP)}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text className="text-text-brand font-bold text-base">Verify & Continue</Text>
                    }
                  </TouchableOpacity>

                  <TouchableOpacity
                    id="btn-back-phone"
                    className="bg-surface-background border border-surface-border rounded-2xl items-center justify-center py-4 mt-3"
                    onPress={() => { setStep('phone'); otpForm.reset(); }}
                    activeOpacity={0.75}
                  >
                    <Text className="text-text-primary font-semibold text-base">Wrong number? Go back</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </Animated.View>

            {/* Footer note */}
            <Text className="text-text-secondary text-xs text-center mt-6 px-8 leading-5">
              By continuing you agree to Opehst's Terms of Service and Privacy Policy.
            </Text>

            {/* Opehst Staff Tool */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/provision' as any)}
              className="mt-8 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-ophest text-xs font-semibold">
                Opehst Partner? Provision Organisation →
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
