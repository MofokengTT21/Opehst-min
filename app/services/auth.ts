import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { jwtDecode } from 'jwt-decode';
import { database } from '../database';

const API_URL = 'http://192.168.1.102:3000/api/auth';
const TOKEN_KEY = 'opehst_access_token';
const REFRESH_KEY = 'opehst_refresh_token';

export interface DecodedToken {
  sub: string;
  role: string;
  app_metadata?: {
    tenant_id: string;
    user_role: string;
  };
  exp: number;
}

export const requestOTP = async (phone: string) => {
  const response = await fetch(`${API_URL}/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to request OTP');
  return data;
};

export const verifyOTP = async (phone: string, code: string) => {
  const response = await fetch(`${API_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to verify OTP');

  if (data.session) {
    await SecureStore.setItemAsync(TOKEN_KEY, data.session.access_token);
    await SecureStore.setItemAsync(REFRESH_KEY, data.session.refresh_token);

    // Save user to WatermelonDB core
    const { user } = data;
    if (user) {
      await database.write(async () => {
        const usersCollection = database.collections.get('users');
        try {
          const existingUser = await usersCollection.find(user.id);
          await existingUser.update((record: any) => {
            record.tenantId = user.tenantId;
            record.role = user.role;
            record.name = user.name;
            record.phone = user.phone;
            record.email = user.email;
            record.department = user.department;
          });
        } catch (e) {
          // If not found, create it locally
          await usersCollection.create((record: any) => {
            record._raw.id = user.id; // Match remote ID
            record.tenantId = user.tenantId;
            record.role = user.role;
            record.name = user.name;
            record.phone = user.phone;
            record.email = user.email;
            record.department = user.department;
          });
        }
      });
    }
  }

  return data;
};

export const logout = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  // Optional: database.unsafeResetDatabase() to wipe data on logout
};

export const getSession = async (): Promise<DecodedToken | null> => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return null;

    const decoded = jwtDecode<DecodedToken>(token);
    
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp < currentTime) {
      console.log('Session expired, triggering logout...');
      await logout();
      return null;
    }

    return decoded;
  } catch (err) {
    console.error('Session validation error:', err);
    return null;
  }
};

export const authenticateBiometric = async (): Promise<boolean> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      return true; 
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Opehst Secure Data',
      fallbackLabel: 'Use Device Passcode',
    });

    return result.success;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return false;
  }
};
