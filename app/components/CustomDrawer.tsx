import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  useColorScheme,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../services/authContext';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import User from '../database/models/User';

const NAV_ITEMS: { label: string; icon: any; route: string }[] = [
  { label: 'Settings',   icon: 'settings-outline',    route: '/settings' },
  { label: 'Support',    icon: 'help-circle-outline',  route: '/support' },
];

export function CustomDrawerContentInner({ users = [], ..._props }: any) {
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const { dbUser, session } = useAuth();

  const isAdmin = session?.app_metadata?.user_role === 'admin';

  const pendingUsers = users.filter((u: User) => u.status === 'pending_approval');
  const activeUsers = users.filter((u: User) => u.status !== 'pending_approval');
  const displayUsers = [...pendingUsers, ...activeUsers];

  // ── Design tokens ─────────────────────────────────────────────
  const canvasBg      = isDark ? '#15202b' : '#f2f2f7';
  const cardBg        = isDark ? '#1d2a35' : '#ffffff';
  const borderColor   = isDark ? '#253341' : '#e8e4e5';
  const textPrimary   = isDark ? '#ffffff'  : '#1a1718';
  const textSecondary = isDark ? '#8899a6'  : '#7a7577';
  const avatarBg      = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)';
  const iconNeutral   = isDark ? '#ffffff'  : '#2e2a2b';
  const glassmorphic  = isDark ? 'rgba(255,255,255,0.12)' : '#ffffff';
  const activeBrand   = '#0071e3';
  const activeBg      = isDark ? 'rgba(0,113,227,0.18)' : 'rgba(0,113,227,0.10)';

  // Logo: theme-aware
  const logoSource = isDark
    ? require('../assets/images/logo_dark.png')
    : require('../assets/images/logo.png');

  const renderMemberRow = (user: User) => (
    <TouchableOpacity
      key={user.id}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
      }}
    >
      <Image
        source={{ uri: user.avatarUrl || 'https://ui-avatars.com/api/?name=' + (user.name || 'User') + '&background=0D8ABC&color=fff' }}
        style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12, backgroundColor: glassmorphic }}
      />
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: textPrimary }}>
        {user.name || 'Unknown User'}
      </Text>
      {user.status === 'pending_approval' && (
        <View style={{ backgroundColor: '#ff9500', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
          <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }}>PENDING</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: canvasBg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* ── Header Area (Logo Only) ────────────────────────── */}
        <View
          style={{
            paddingTop: insets.top + 16,
            paddingLeft: 12,
            paddingRight: 20,
            paddingBottom: 28,
          }}
        >
          {/* Logo (Top Left Aligned) */}
          <View style={{ alignItems: 'flex-start' }}>
            <Image
              source={logoSource}
              style={{ width: 125, height: 30 }}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* ── Navigation ─────────────────────────────────── */}
        <View style={{ marginTop: 0 }}>
          {NAV_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              activeOpacity={0.7}
              onPress={() => router.push(item.route as any)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 20,
              }}
            >
              <Ionicons name={item.icon} size={22} color={textSecondary} style={{ marginRight: 16 }} />
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: textPrimary }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Admin Tools (role-gated) ──────────────────────── */}
        {isAdmin && (
          <View style={{ marginTop: 8 }}>
            {[
              { label: 'Members', icon: 'people-outline' as const, route: '/admin/members' },
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push(item.route as any)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flex: 1,
                    paddingVertical: 12,
                  }}
                >
                  <Ionicons name={item.icon} size={22} color={activeBrand} style={{ marginRight: 16 }} />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: textPrimary }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  id="btn-add-member"
                  activeOpacity={0.65}
                  onPress={() => router.push(`${item.route}?generate=true` as any)}
                  style={{
                    padding: 8,
                    marginRight: -8,
                  }}
                >
                  <Ionicons name="add-outline" size={22} color={activeBrand} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── Pending Approval (if any) ───────────────── */}
        {pendingUsers.length > 0 && (
          <>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: textSecondary,
                letterSpacing: 0.5,
                marginHorizontal: 20,
                marginTop: 24,
                marginBottom: 12,
              }}
            >
              Pending Approval
            </Text>
            {pendingUsers.map(renderMemberRow)}
          </>
        )}

        {/* ── Recent ───────────────────────────────── */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: textSecondary,
            letterSpacing: 0.5,
            marginHorizontal: 20,
            marginTop: pendingUsers.length > 0 ? 20 : 24,
            marginBottom: 12,
          }}
        >
          Recent
        </Text>
        {activeUsers.map(renderMemberRow)}
      </ScrollView>

      {/* ── Footer: Profile Info (Inline, no email) ────────────────── */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push('/profile')}
        style={{
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + 6 : 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Avatar */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name="person-outline" size={20} color={iconNeutral} />
        </View>

        {/* Profile Details */}
        <View style={{ flex: 1 }}>
          {/* Name */}
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: textPrimary,
              letterSpacing: -0.3,
              marginBottom: 2,
            }}
          >
            {dbUser?.name ?? 'Opehst User'}
          </Text>

          {/* Role caption */}
          <Text style={{ fontSize: 11, color: isDark ? '#0a84ff' : activeBrand, fontWeight: '600' }}>
            {isAdmin ? 'Admin' : 'Member'}{session?.app_metadata?.tenant_id ? '' : ''}
          </Text>
        </View>

        {/* Chevron to take to profile */}
        <Ionicons name="chevron-forward" size={16} color={textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

export const CustomDrawerContent = withObservables([], () => ({
  users: database.collections.get<User>('users').query().observe(),
}))(CustomDrawerContentInner);
