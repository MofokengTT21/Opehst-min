import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSession, authenticateBiometric, DecodedToken, logout as authLogout } from './auth';
import { database } from '../database';
import User from '../database/models/User';

interface AuthContextType {
  session: DecodedToken | null;
  dbUser: User | null;
  setSession: (session: DecodedToken | null) => void;
  logout: () => Promise<void>;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<DecodedToken | null>(null);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const token = await getSession();
      if (token) {
        const success = await authenticateBiometric();
        if (success) {
          setSession(token);
          try {
            const userRecord = await database.collections.get<User>('users').find(token.sub);
            setDbUser(userRecord);
          } catch (e) {
            console.error('User not found in local db, might need to re-login');
          }
        } else {
          await authLogout();
        }
      }
      setIsReady(true);
    };
    
    init();
  }, []);

  useEffect(() => {
    if (session && !dbUser) {
      database.collections.get<User>('users').find(session.sub)
        .then(setDbUser)
        .catch(console.error);
    } else if (!session) {
      setDbUser(null);
    }
  }, [session]);

  const logout = async () => {
    await authLogout();
    setSession(null);
    setDbUser(null);
    try {
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });
      console.log('Local database completely wiped.');
    } catch (e) {
      console.error('Failed to reset database', e);
    }
  };

  return (
    <AuthContext.Provider value={{ session, dbUser, setSession, logout, isReady }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
