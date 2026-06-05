import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  getSession,
  authenticateBiometric,
  DecodedToken,
  logout as authLogout,
  applyApprovalTokens,
} from './auth';
import { clearSyncState } from './sync';
import { database } from '../database';
import User from '../database/models/User';
import { getSocket } from './socket';

type UserStatus = 'pending_org' | 'pending_admin_auth' | 'pending_approval' | 'active' | 'rejected' | null;

interface AuthContextType {
  session: DecodedToken | null;
  dbUser: User | null;
  userStatus: UserStatus;
  rejectionReason: string | null;
  setSession: (session: DecodedToken | null) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isReady: boolean;
  syncTrigger: number;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSessionState] = useState<DecodedToken | null>(null);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [syncTrigger, setSyncTrigger] = useState(0);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  // ── Derived status: prefer local DB (source of truth), fall back to JWT claim
  const userStatus: UserStatus = (dbUser?.status ?? session?.status ?? null) as UserStatus;

  // ── Socket approval listeners ─────────────────────────────────────────────
  const connectApprovalSocket = (userId: string) => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.emit('auth:join_room', userId);

    socket.on('approval:granted', async (payload: {
      accessToken: string;
      refreshToken: string;
      user: { id: string; name: string; role: string; tenantId: string };
    }) => {
      const newSession = await applyApprovalTokens(payload.accessToken, payload.refreshToken);
      setSessionState(newSession);
      setRejectionReason(null);
      // Update local DB user status
      try {
        const record = await database.collections.get<User>('users').find(payload.user.id);
        await database.write(async () => {
          await record.update((r: any) => {
            r.status = 'active';
            r.tenantId = payload.user.tenantId;
            r.role = payload.user.role;
          });
        });
        setDbUser(record);
      } catch (e) {
        console.error('Failed to update local user on approval', e);
      }
    });

    socket.on('approval:rejected', (payload: { reason: string }) => {
      setRejectionReason(payload.reason);
      // Update local status to rejected
      if (dbUser) {
        database.write(async () => {
          await dbUser.update((r: any) => { r.status = 'rejected'; });
        }).catch(console.error);
      }
    });
  };

  const disconnectApprovalSocket = () => {
    if (socketRef.current) {
      socketRef.current.off('approval:granted');
      socketRef.current.off('approval:rejected');
    }
  };

  // ── Initialise ────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const token = await getSession();
      if (token) {
        const success = await authenticateBiometric();
        if (success) {
          setSessionState(token);
          try {
            const userRecord = await database.collections.get<User>('users').find(token.sub);
            setDbUser(userRecord);
          } catch (e) {
            console.warn('User not in local DB, will be hydrated on next sync');
          }
        } else {
          await authLogout();
        }
      }
      setIsReady(true);
    };
    init();
    return () => { disconnectApprovalSocket(); };
  }, []);

  // ── Keep dbUser in sync when session changes ──────────────────────────────
  const refreshUser = async () => {
    if (session) {
      try {
        const userRecord = await database.collections.get<User>('users').find(session.sub);
        setDbUser(userRecord);
        setSyncTrigger(prev => prev + 1); // Force re-render for mutated WatermelonDB object
      } catch (e) {
        console.error('Failed to refresh user', e);
      }
    }
  };

  useEffect(() => {
    if (session) {
      refreshUser();
    } else {
      setDbUser(null);
    }
  }, [session]);

  // ── Connect to approval socket while in pending states ───────────────────
  useEffect(() => {
    if (session && (userStatus === 'pending_approval')) {
      connectApprovalSocket(session.sub);
    } else {
      disconnectApprovalSocket();
    }
  }, [session?.sub, userStatus]);

  // ── Public setSession wrapper ─────────────────────────────────────────────
  const setSession = (s: DecodedToken | null) => {
    setSessionState(s);
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    disconnectApprovalSocket();
    await authLogout();
    await clearSyncState(); // Reset lastPulledAt so the next user gets a clean full pull
    setSessionState(null);
    setDbUser(null);
    setRejectionReason(null);
    try {
      await database.write(async () => { await database.unsafeResetDatabase(); });
      console.log('Local database wiped on logout.');
    } catch (e) {
      console.error('Failed to reset database', e);
    }
  };

  return (
    <AuthContext.Provider value={{ session, dbUser, userStatus, rejectionReason, setSession, logout, refreshUser, isReady, syncTrigger }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
