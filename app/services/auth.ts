import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { jwtDecode } from 'jwt-decode';
import { database } from '../database';
import { Platform } from 'react-native';
import { clearSyncState } from './sync';

import { API_AUTH_URL as API_URL } from './apiConfig';
const TOKEN_KEY = 'opehst_access_token';
const REFRESH_KEY = 'opehst_refresh_token';

// Wrapper for secure store that falls back to localStorage on web
const storage = {
  setItemAsync: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch (e) {}
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  getItemAsync: async (key: string) => {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  deleteItemAsync: async (key: string) => {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch (e) {}
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }
};

export interface DecodedToken {
  sub: string;
  /** Role claim — always 'authenticated' at the JWT level */
  role: string;
  /**
   * Onboarding status: pending_org | pending_approval | active | rejected
   * Present on limited JWTs (before full approval).
   */
  status?: string;
  app_metadata?: {
    tenant_id: string;
    user_role: string; // 'admin' | 'user'
  };
  exp: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns the raw JWT string for use in Authorization headers */
export const getFullToken = async (): Promise<string | null> => {
  return storage.getItemAsync(TOKEN_KEY);
};

const saveTokens = async (accessToken: string, refreshToken: string) => {
  await storage.setItemAsync(TOKEN_KEY, accessToken);
  await storage.setItemAsync(REFRESH_KEY, refreshToken);
};

/** Upserts a user record into WatermelonDB from a server user payload */
const upsertLocalUser = async (user: {
  id: string;
  tenantId?: string | null;
  role: string;
  name?: string | null;
  phone: string;
  email?: string | null;
  status: string;
}) => {
  await database.write(async () => {
    const usersCollection = database.collections.get('users');
    try {
      const existingUser = await usersCollection.find(user.id);
      await existingUser.update((record: any) => {
        record.tenantId = user.tenantId ?? null;
        record.role = user.role;
        record.name = user.name ?? null;
        record.phone = user.phone;
        record.status = user.status;
        if (user.email !== undefined) record.email = user.email;
      });
    } catch {
      // Record not found — create it
      await usersCollection.create((record: any) => {
        record._raw.id = user.id;
        record.tenantId = user.tenantId ?? null;
        record.role = user.role;
        record.name = user.name ?? null;
        record.phone = user.phone;
        record.status = user.status;
        record.email = user.email ?? null;
      });
    }
  });
};

// ─── Part A: OTP Flow ────────────────────────────────────────────────────────

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

export const verifyOTP = async (
  phone: string,
  code: string
): Promise<{ isNewUser: boolean; session: { access_token: string; refresh_token: string } }> => {
  const response = await fetch(`${API_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to verify OTP');

  await saveTokens(data.session.access_token, data.session.refresh_token);

  if (data.user) {
    await upsertLocalUser({ ...data.user, phone });
  }

  return data;
};

/** Save profile name after OTP — Part A end-state */
export const saveProfile = async (name: string) => {
  const token = await getFullToken();
  const response = await fetch(`${API_URL}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to save profile');

  // Update local record (upsert handles case where local DB was wiped but server session is active)
  if (data.user) {
    await upsertLocalUser({
      id: data.user.id,
      tenantId: data.user.tenantId,
      role: data.user.role || 'user',
      name: data.user.name,
      phone: data.user.phone,
      status: data.user.status,
    });
  }

  // Save new session if the status was upgraded
  if (data.session) {
    await saveTokens(data.session.access_token, data.session.refresh_token);
  }

  return data;
};

// ─── Staff: Provision Organisation ───────────────────────────────────────────

export const provisionOrg = async (orgName: string, adminPhone: string) => {
  const response = await fetch(`${API_URL}/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgName, adminPhone }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to provision organisation');
  return data;
};

// ─── Client Admin: Verify Auth Code ──────────────────────────────────────────

export const verifyAdminAuth = async (authCode: string) => {
  const token = await getFullToken();
  const response = await fetch(`${API_URL}/verify-admin-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ authCode }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to verify auth code');

  // Swap in full JWT (admin role, status: active)
  await saveTokens(data.session.access_token, data.session.refresh_token);

  // Upsert local user record
  if (data.user) {
    await database.write(async () => {
      const record = await database.collections.get('users').find(data.user.id);
      await record.update((r: any) => {
        r.status = data.user.status;
        r.role = data.user.role;
        r.tenantId = data.user.tenantId;
      });
    });
  }

  return data;
};

// ─── Admin: Invite Code Helpers ──────────────────────────────────────────────

export const generateInviteCode = async (expiresInDays = 30, customCode?: string) => {
  const token = await getFullToken();
  const response = await fetch(`${API_URL}/admin/generate-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ expiresInDays, customCode }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to generate invite code');
  return data.invite as { id: string; code: string; expiresAt: string; createdAt: string };
};

export const listInviteCodes = async () => {
  const token = await getFullToken();
  const response = await fetch(`${API_URL}/admin/invite-codes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch invite codes');
  return data.codes as Array<{
    id: string;
    code: string;
    expiresAt: string | null;
    createdAt: string;
    isUsed: boolean;
    isExpired: boolean;
    usedBy: Array<{ name: string | null; phone: string }>;
    createdBy: string;
  }>;
};

export const inviteUserByPhone = async (phone: string) => {
  const token = await getFullToken();
  const response = await fetch(`${API_URL}/admin/invite-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ phone }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to invite user');
  return data.user as { id: string; phone: string; status: string };
};

export type TenantChannel = { id: string; name: string; category: string | null; accessType: string | null };
export type TenantHub = { id: string; name: string; channels: TenantChannel[] };

export const getTenantStructure = async (): Promise<TenantHub[]> => {
  const token = await getFullToken();
  const response = await fetch(`${API_URL}/admin/tenant-structure`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch tenant structure');
  return data.hubs as TenantHub[];
};

export const getMemberChannels = async (userId: string): Promise<string[]> => {
  const token = await getFullToken();
  const response = await fetch(`${API_URL}/admin/member-channels/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch member channels');
  return data.channelIds as string[];
};

export const updateMemberChannels = async (userId: string, channelIds: string[]): Promise<void> => {
  const token = await getFullToken();
  const response = await fetch(`${API_URL}/admin/member-channels/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channelIds }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to update member channels');
};

// ─── Part B: Organisation Join ───────────────────────────────────────────────

export const joinOrg = async (inviteCode: string) => {
  const token = await getFullToken();
  const response = await fetch(`${API_URL}/join-org`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ inviteCode }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to join organisation');

  // Persist new limited JWT (status: pending_approval)
  await saveTokens(data.session.access_token, data.session.refresh_token);

  // Update local user status
  if (data.user) {
    await database.write(async () => {
      const record = await database.collections.get('users').find(data.user.id);
      await record.update((r: any) => {
        r.status = 'pending_approval';
      });
    });
  }

  return data; // includes tenantName
};

// ─── Session ─────────────────────────────────────────────────────────────────

export const logout = async () => {
  await storage.deleteItemAsync(TOKEN_KEY);
  await storage.deleteItemAsync(REFRESH_KEY);
};

export const getSession = async (): Promise<DecodedToken | null> => {
  try {
    const token = await storage.getItemAsync(TOKEN_KEY);
    if (!token) return null;

    const decoded = jwtDecode<DecodedToken>(token);
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp < currentTime) {
      console.log('Session expired, logging out...');
      await logout();
      return null;
    }

    return decoded;
  } catch (err) {
    console.error('Session validation error:', err);
    return null;
  }
};

/** Called by authContext after socket delivers approval:granted — swaps in full JWT */
export const applyApprovalTokens = async (accessToken: string, refreshToken: string) => {
  await saveTokens(accessToken, refreshToken);
  return jwtDecode<DecodedToken>(accessToken);
};

export const authenticateBiometric = async (): Promise<boolean> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) return true;

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
