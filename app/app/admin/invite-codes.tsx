import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateInviteCode, listInviteCodes } from '../../services/auth';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';

type InviteCode = {
  id: string;
  code: string;
  expiresAt: string | null;
  createdAt: string;
  isUsed: boolean;
  isExpired: boolean;
  usedBy: { name: string | null; phone: string } | null;
  createdBy: string;
};

export default function InviteCodesScreen() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const canvasBg      = isDark ? '#15202b' : '#f2f2f7';
  const cardBg        = isDark ? '#1d2a35' : '#ffffff';
  const textPrimary   = isDark ? '#ffffff'  : '#1a1718';
  const textSecondary = isDark ? '#8899a6'  : '#7a7577';
  const borderColor   = isDark ? '#253341' : '#e8e4e5';

  const fetchCodes = useCallback(async () => {
    try {
      const data = await listInviteCodes();
      setCodes(data);
    } catch (err) {
      console.error('Failed to fetch invite codes', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCodes(); }, [fetchCodes]));

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const invite = await generateInviteCode(30);
      setCodes((prev) => [{
        id: invite.id,
        code: invite.code,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        isUsed: false,
        isExpired: false,
        usedBy: null,
        createdBy: 'You',
      }, ...prev]);
      // Auto-share the new code
      await Share.share({
        message: `Join our organisation on Opehst with this invite code:\n\n${invite.code}\n\nExpires in 30 days.`,
        title: 'Opehst Invite Code',
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async (code: string) => {
    await Share.share({
      message: `Join our organisation on Opehst with this invite code:\n\n${code}\n\nOpen the Opehst app and enter this code to request access.`,
      title: 'Opehst Invite Code',
    });
  };

  const statusBadge = (item: InviteCode) => {
    if (item.isUsed) return { label: 'Used', bg: '#22c55e22', text: '#22c55e' };
    if (item.isExpired) return { label: 'Expired', bg: '#ef444422', text: '#ef4444' };
    return { label: 'Active', bg: '#0071e322', text: '#0071e3' };
  };

  const renderCode = ({ item, index }: { item: InviteCode; index: number }) => {
    const badge = statusBadge(item);
    const expiryDate = item.expiresAt
      ? new Date(item.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'No expiry';
    const isShareable = !item.isUsed && !item.isExpired;

    return (
      <Animated.View
        entering={FadeInDown.duration(300).delay(index * 40)}
        layout={Layout.springify()}
        style={{
          backgroundColor: cardBg,
          borderRadius: 24,
          padding: 16,
          marginBottom: 10,
          marginHorizontal: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          {/* Code display */}
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 24,
              fontWeight: '800',
              color: item.isUsed || item.isExpired ? textSecondary : textPrimary,
              letterSpacing: 4,
              textDecorationLine: item.isUsed ? 'line-through' : 'none',
            }}>
              {item.code}
            </Text>
            <Text style={{ fontSize: 12, color: textSecondary, marginTop: 4 }}>
              Expires {expiryDate}
            </Text>
          </View>

          {/* Status badge */}
          <View style={{
            backgroundColor: badge.bg,
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}>
            <Text style={{ color: badge.text, fontSize: 12, fontWeight: '700' }}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* Used-by row */}
        {item.usedBy && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 12,
          }}>
            <Ionicons name="person-circle-outline" size={16} color={textSecondary} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 13, color: textSecondary, flex: 1 }}>
              Used by {item.usedBy.name ?? item.usedBy.phone}
            </Text>
          </View>
        )}

        {/* Share button — only for active codes */}
        {isShareable && (
          <TouchableOpacity
            id={`btn-share-${item.id}`}
            onPress={() => handleShare(item.code)}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#0071e3',
              borderRadius: 16,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="share-outline" size={16} color="#0071e3" style={{ marginRight: 6 }} />
            <Text style={{ color: '#0071e3', fontWeight: '700', fontSize: 14 }}>Share Code</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: canvasBg }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingBottom: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: cardBg,
            alignItems: 'center', justifyContent: 'center', marginRight: 12,
          }}
        >
          <Ionicons name="arrow-back-outline" size={22} color={textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary }}>Invite Codes</Text>
          <Text style={{ fontSize: 13, color: textSecondary }}>
            {codes.filter(c => !c.isUsed && !c.isExpired).length} active
          </Text>
        </View>
      </View>

      {/* Generate button */}
      <Animated.View entering={FadeIn.duration(400)} style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <TouchableOpacity
          id="btn-generate-code"
          onPress={handleGenerate}
          disabled={generating}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#0071e3',
            borderRadius: 20,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {generating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Generate New Code</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Section label */}
      <Text style={{
        fontSize: 12, fontWeight: '700', color: textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.6,
        marginHorizontal: 32, marginBottom: 8,
      }}>
        All Codes
      </Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#0071e3" />
        </View>
      ) : codes.length === 0 ? (
        <Animated.View entering={FadeIn.duration(500)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🔑</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary, textAlign: 'center' }}>No codes yet</Text>
          <Text style={{ fontSize: 14, color: textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
            Generate your first invite code and share it with your team.
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={codes}
          renderItem={renderCode}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchCodes(); }}
              tintColor="#0071e3"
            />
          }
        />
      )}
    </View>
  );
}
