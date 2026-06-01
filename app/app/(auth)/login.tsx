import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../services/authContext';
import { requestOTP, verifyOTP, getSession } from '../../services/auth';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const { setSession } = useAuth();
  const router = useRouter();

  const handleRequestOTP = async () => {
    if (!phone) return Alert.alert('Error', 'Please enter a valid phone number');
    setLoading(true);
    try {
      await requestOTP(phone);
      setStep('otp');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!code) return Alert.alert('Error', 'Please enter the OTP code');
    setLoading(true);
    try {
      await verifyOTP(phone, code);
      const session = await getSession();
      setSession(session);
      // The RootNavigationGuard in _layout.tsx automatically redirects us to (drawer) when the session updates
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-surface-100 dark:bg-surface-900">
      <View className="mb-12">
        <Text className="text-4xl font-bold text-text-900 dark:text-text-100 text-center tracking-tight">
          Opehst
        </Text>
        <Text className="text-lg text-text-500 dark:text-text-400 text-center mt-2">
          {step === 'phone' ? 'Enter your number to sign in' : 'Verify your identity'}
        </Text>
      </View>
      
      {step === 'phone' ? (
        <>
          <TextInput
            className="bg-surface-200 dark:bg-surface-800 p-4 rounded-2xl text-text-900 dark:text-text-100 mb-6 text-lg"
            placeholder="Phone number (e.g., +27...)"
            placeholderTextColor="#888"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TouchableOpacity 
            className="bg-ophest-500 py-4 rounded-2xl items-center shadow-sm"
            onPress={handleRequestOTP}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">Send Verification Code</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            className="bg-surface-200 dark:bg-surface-800 p-4 rounded-2xl text-text-900 dark:text-text-100 mb-6 text-center text-3xl tracking-[12px] font-bold"
            placeholder="------"
            placeholderTextColor="#888"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            maxLength={6}
          />
          <TouchableOpacity 
            className="bg-ophest-500 py-4 rounded-2xl items-center shadow-sm"
            onPress={handleVerifyOTP}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">Verify & Login</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            className="py-4 items-center mt-2"
            onPress={() => setStep('phone')}
          >
            <Text className="text-ophest-500 font-medium">Wrong number? Go back</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
