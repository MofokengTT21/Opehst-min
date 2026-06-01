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

// ─── Nav item config ──────────────────────────────────────────────
const NAV_ITEMS: { label: string; icon: any; route: string }[] = [
  { label: 'My Profile', icon: 'person-outline',      route: '/profile' },
  { label: 'Settings',   icon: 'settings-outline',    route: '/settings' },
  { label: 'Support',    icon: 'help-circle-outline',  route: '/support' },
];

export function CustomDrawerContent(_props: any) {
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();
  const insets      = useSafeAreaInsets();

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
            paddingHorizontal: 20,
            paddingBottom: 40,
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

        {/* ── Divider ─────────────────────────────────────────── */}

        {/* ── Navigation Card ─────────────────────────────────── */}
        <View
          style={{
            marginHorizontal: 16,
            backgroundColor: cardBg,
            borderRadius: 28,
            overflow: 'hidden',
          }}
        >
          {NAV_ITEMS.map((item, i) => (
            <View key={item.label}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push(item.route as any)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 13,
                  paddingHorizontal: 16,
                }}
              >
                {/* Icon badge */}
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: glassmorphic,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name={item.icon} size={18} color={iconNeutral} />
                </View>

                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: '500',
                    color: textPrimary,
                  }}
                >
                  {item.label}
                </Text>

                <Ionicons name="chevron-forward" size={15} color={textSecondary} />
              </TouchableOpacity>

              {/* Row separator */}
              {i < NAV_ITEMS.length - 1 && (
                <View
                  style={{
                    height: 0.5,
                    backgroundColor: borderColor,
                    marginLeft: 62,
                  }}
                />
              )}
            </View>
          ))}
        </View>

        {/* ── My Activity Header ───────────────────────────────── */}
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: textSecondary,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginHorizontal: 32,
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          My Activity
        </Text>

        {/* ── Quick Stats Card ────────────────────────────────── */}
        <View
          style={{
            marginHorizontal: 16,
            backgroundColor: cardBg,
            borderRadius: 28,
            paddingVertical: 14,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[
              { label: 'Logs',   value: '24', icon: 'document-text-outline' as any },
              { label: 'Alerts', value: '3',  icon: 'warning-outline' as any },
              { label: 'Tasks',  value: '7',  icon: 'clipboard-outline' as any },
            ].map((stat) => (
              <View key={stat.label} style={{ alignItems: 'center', flex: 1 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: glassmorphic,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 5,
                  }}
                >
                  <Ionicons name={stat.icon} size={17} color={iconNeutral} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary }}>
                  {stat.value}
                </Text>
                <Text style={{ fontSize: 11, color: textSecondary, marginTop: 1 }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
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
            Jane Doe
          </Text>

          {/* Role caption */}
          <Text style={{ fontSize: 11, color: isDark ? '#0a84ff' : activeBrand, fontWeight: '600' }}>
            Artisan · Engineering
          </Text>
        </View>

        {/* Chevron to take to profile */}
        <Ionicons name="chevron-forward" size={16} color={textSecondary} />
      </TouchableOpacity>
    </View>
  );
}
