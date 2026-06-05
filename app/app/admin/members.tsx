import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Platform,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Share,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../services/authContext';
import { getFullToken, generateInviteCode, listInviteCodes, inviteUserByPhone } from '../../services/auth';
import { fetchMembers } from '../../services/feed';
import { syncDatabase } from '../../services/sync';
import * as Contacts from 'expo-contacts';
import withObservables from '@nozbe/with-observables';
import { database } from '../../database';
import User from '../../database/models/User';
import MemberDetailSheet, { MemberSnapshot } from './member-detail';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const API_URL = 'http://192.168.1.102:3000/api/auth';

type PendingMember = {
  id: string;
  name: string | null;
  phone: string;
  createdAt: string;
};

type InviteCode = {
  id: string;
  code: string;
  expiresAt: string | null;
  createdAt: string;
  isUsed: boolean;
  isExpired: boolean;
  usedBy: Array<{ name: string | null; phone: string }>;
  createdBy: string;
};

const TABS: { key: 'pending' | 'all'; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'pending', label: 'Pending' },
];

function MembersScreen({ users = [] }: { users: User[] }) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { session, dbUser } = useAuth();
  const { tab, generate } = useLocalSearchParams<{ tab?: string; generate?: string }>();

  // Data states
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal visibility for new invite code
  const [modalVisible, setModalVisible] = useState(false);
  const [inviteMethod, setInviteMethod] = useState<'phone' | 'code'>('phone');
  const [invitePhone, setInvitePhone] = useState('');
  const [invitingPhone, setInvitingPhone] = useState(false);

  // Member detail sheet
  const [selectedMember, setSelectedMember] = useState<MemberSnapshot | null>(null);
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);

  const openMemberDetail = (snapshot: MemberSnapshot) => {
    setSelectedMember(snapshot);
    setDetailSheetVisible(true);
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Determine initial active tab based on query param
  const initialTab = useMemo(() => {
    if (tab === 'pending') return 'pending';
    return 'all';
  }, [tab]);

  const initialIndex = TABS.findIndex(t => t.key === initialTab);

  // Tab state & paging
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>(initialTab);
  const pagerRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(initialIndex * SCREEN_WIDTH);

  const [tabLayouts, setTabLayouts] = useState<Array<{ x: number; width: number } | null>>(
    TABS.map(() => null)
  );

  // Theme tokens
  const canvasBg      = isDark ? '#15202b' : '#f2f2f7';
  const cardBg        = isDark ? '#1d2a35' : '#ffffff';
  const textPrimary   = isDark ? '#ffffff' : '#1a1718';
  const textSecondary = isDark ? '#8899a6' : '#7a7577';
  const activeBrand   = '#0071e3';
  const glassmorphicBg = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const avatarBg      = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)';
  const activeBg      = isDark ? 'rgba(0,113,227,0.18)' : 'rgba(0,113,227,0.10)';

  const fetchInvites = useCallback(async () => {
    try {
      const data = await listInviteCodes();
      setInvites(data || []);
    } catch (err) {
      console.error('Failed to fetch invite codes', err);
    }
  }, []);

  const fetchAllData = useCallback(async (showIndicator = false) => {
    if (showIndicator) setLoading(true);
    await Promise.all([fetchMembers(), fetchInvites(), syncDatabase()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchInvites]);

  useFocusEffect(
    useCallback(() => {
      fetchAllData(true);
    }, [fetchAllData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData(false);
  };

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      const token = await getFullToken();
      const res = await fetch(`${API_URL}/admin/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        await fetchMembers();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error || 'Failed to approve member');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = (userId: string, memberName: string | null) => {
    Alert.prompt(
      'Reject Member',
      `Provide a reason for rejecting ${memberName ?? 'this user'}:`,
      async (reason) => {
        if (reason === undefined) return;
        setActionLoading(userId);
        try {
          const token = await getFullToken();
          const res = await fetch(`${API_URL}/admin/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ userId, reason: reason || 'Your request was not approved.' }),
          });
          if (res.ok) {
            await fetchMembers();
          } else {
            const err = await res.json();
            Alert.alert('Error', err.error || 'Failed to reject member');
          }
        } catch {
          Alert.alert('Error', 'Network error. Please try again.');
        } finally {
          setActionLoading(null);
        }
      },
      'plain-text'
    );
  };

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const invite = await generateInviteCode(30);
      setInvites((prev) => [
        {
          id: invite.id,
          code: invite.code,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
          isUsed: false,
          isExpired: false,
          usedBy: [],
          createdBy: 'You',
        },
        ...prev,
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate code');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleShareCode = async (code: string) => {
    try {
      await Share.share({
        message: `Join our organisation on Opehst with this invite code:\n\n${code}\n\nExpires in 30 days.`,
        title: 'Opehst Invite Code',
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to share code');
    }
  };

  const handleInviteByPhone = async () => {
    if (!invitePhone || invitePhone.trim().length < 5) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number.');
      return;
    }
    setInvitingPhone(true);
    try {
      await inviteUserByPhone(invitePhone.trim());
      Alert.alert('Success', `Invitation sent to ${invitePhone.trim()}`);
      setInvitePhone('');
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to invite user');
    } finally {
      setInvitingPhone(false);
    }
  };

  const handlePickContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const contact = await Contacts.presentContactPickerAsync();
        if (contact && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          // Clean the phone number (remove spaces, dashes)
          const number = contact.phoneNumbers[0].number?.replace(/[\s-]/g, '') || '';
          setInvitePhone(number);
        }
      } else {
        Alert.alert('Permission Denied', 'Please grant contacts permission in settings.');
      }
    } catch (err) {
      console.error('Contact picker error:', err);
    }
  };



  // Reanimated scroll logic
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const switchToTab = (key: 'pending' | 'all') => {
    const idx = TABS.findIndex(t => t.key === key);
    pagerRef.current?.scrollTo({ x: SCREEN_WIDTH * idx, animated: true });
    setActiveTab(key);
  };

  const onPageChange = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    const tabItem = TABS[idx]?.key;
    if (tabItem) setActiveTab(tabItem);
  };

  const allTabsMeasured = tabLayouts.every(Boolean);

  const tabIndicatorStyle = useAnimatedStyle(() => {
    let allMeasured = true;
    for (let i = 0; i < tabLayouts.length; i++) {
      if (!tabLayouts[i]) {
        allMeasured = false;
        break;
      }
    }
    if (!allMeasured) return { left: 0, width: 0 };

    const inputVals = [];
    const outputLefts = [];
    const outputWidths = [];
    for (let i = 0; i < tabLayouts.length; i++) {
      inputVals.push(i * SCREEN_WIDTH);
      const layout = tabLayouts[i];
      if (layout) {
        outputLefts.push(layout.x);
        outputWidths.push(layout.width);
      }
    }

    return {
      left: interpolate(
        scrollX.value,
        inputVals,
        outputLefts,
        Extrapolation.CLAMP
      ),
      width: interpolate(
        scrollX.value,
        inputVals,
        outputWidths,
        Extrapolation.CLAMP
      ),
    };
  });

  // Dynamic tab synchronization on param change
  useEffect(() => {
    const idx = TABS.findIndex(t => t.key === tab);
    if (idx !== -1) {
      const targetTab = TABS[idx].key;
      setActiveTab(targetTab);
      scrollX.value = idx * SCREEN_WIDTH;
      pagerRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: false });
    }
  }, [tab]);

  // Pull-up modal trigger on shortcut
  useEffect(() => {
    if (generate === 'true') {
      setModalVisible(true);
      router.setParams({ generate: undefined });
    }
  }, [generate]);

  // Filters locally observed users
  const activeMembers = useMemo(() => {
    return users.filter(u => u.status === 'active' || u.status === 'approved');
  }, [users]);

  const pendingMembers = useMemo(() => {
    return users.filter(u => u.status === 'pending_approval');
  }, [users]);

  // Filtered lists in real time by search query
  const filteredPending = useMemo(() => {
    return pendingMembers.filter(u => {
      const nameMatch = (u.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const phoneMatch = (u.phone || '').toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch || phoneMatch;
    });
  }, [pendingMembers, searchQuery]);

  const filteredAllMembers = useMemo(() => {
    return activeMembers.filter(u => {
      const nameMatch = (u.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const phoneMatch = (u.phone || '').toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch || phoneMatch;
    });
  }, [activeMembers, searchQuery]);



  const renderPendingMember = (item: User) => {
    const isActing = actionLoading === item.id;
    const initials = (item.name || item.phone).slice(0, 2).toUpperCase();
    const joined = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric',
    }) : 'Unknown';

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.85}
        onPress={() => openMemberDetail({ id: item.id, name: item.name, phone: item.phone, status: 'pending_approval', createdAt: item.createdAt ? String(item.createdAt) : undefined })}
        style={{ backgroundColor: cardBg, borderRadius: 28, padding: 16, marginBottom: 12, marginHorizontal: 16 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          {/* Avatar */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: avatarBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>{initials}</Text>
          </View>

          {/* Info */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary, flex: 1, paddingRight: 8 }} numberOfLines={1}>
                {item.name || 'No name yet'}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: textSecondary, marginTop: 1 }}>{item.phone}</Text>
            <Text style={{ fontSize: 13, color: textSecondary, marginTop: 3 }}>Requested {joined}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={textSecondary} style={{ marginLeft: 8 }} />
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            id={`btn-approve-${item.id}`}
            style={{
              flex: 1,
              backgroundColor: activeBrand,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              height: 44,
            }}
            onPress={() => handleApprove(item.id)}
            disabled={isActing}
            activeOpacity={0.85}
          >
            {isActing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Approve</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            id={`btn-reject-${item.id}`}
            style={{
              flex: 1,
              backgroundColor: canvasBg,
              borderWidth: 1,
              borderColor: '#ef4444',
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              height: 44,
            }}
            onPress={() => handleReject(item.id, item.name)}
            disabled={isActing}
            activeOpacity={0.75}
          >
            <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 14 }}>Reject</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderActiveMember = (item: User) => {
    const initials = (item.name || item.phone).slice(0, 2).toUpperCase();
    const joined = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('en-ZA', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      : 'Unknown';

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.85}
        onPress={() => openMemberDetail({ id: item.id, name: item.name, phone: item.phone, status: item.status ?? 'active', role: item.role, createdAt: item.createdAt ? String(item.createdAt) : undefined })}
        style={{ backgroundColor: cardBg, borderRadius: 28, padding: 16, marginBottom: 12, marginHorizontal: 16 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Avatar */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: avatarBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>{initials}</Text>
          </View>

          {/* Info */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary }} numberOfLines={1}>
                  {item.name || 'No name yet'}
                </Text>
                <Ionicons name="checkmark-circle" size={16} color={activeBrand} />
              </View>
            </View>
            <Text style={{ fontSize: 14, color: textSecondary, marginTop: 1 }}>{item.phone}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
              <Text style={{ fontSize: 13, color: textSecondary }}>Joined {joined}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={textSecondary} style={{ marginLeft: 8 }} />
        </View>
      </TouchableOpacity>
    );
  };



  return (
    <View style={{ flex: 1, backgroundColor: canvasBg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={{ paddingTop: insets.top }} className="bg-surface-background">
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.back()}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back-outline" size={28} color={textPrimary} />
          </TouchableOpacity>

          <View className="flex-1 items-center justify-center">
            <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary, letterSpacing: -0.5 }} numberOfLines={1}>
              Members
            </Text>
          </View>

          {/* Options button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Alert.alert('Options', 'More options coming soon.')}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="ellipsis-horizontal" size={28} color={textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={{ backgroundColor: glassmorphicBg, height: 48, borderRadius: 24 }} className="mx-4 mb-3 flex-row items-center px-4">
          <Ionicons name="search-outline" size={20} color={textSecondary} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search members..."
            placeholderTextColor={textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-text-primary text-[16px] p-0 h-full"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tab switcher */}
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, position: 'relative' }}>
            {TABS.map((tabItem, i) => {
              const isActive = activeTab === tabItem.key;
              const tabTextColor = isActive ? textPrimary : textSecondary;
              return (
                <TouchableOpacity
                  key={tabItem.key}
                  onPress={() => switchToTab(tabItem.key)}
                  onLayout={(e) => {
                    const { x, width } = e.nativeEvent.layout;
                    setTabLayouts(prev => {
                      const next = [...prev];
                      next[i] = { x, width };
                      return next;
                    });
                  }}
                  style={{ paddingBottom: 10 }}
                >
                  <Text style={{ color: tabTextColor }} className="text-[14.5px] font-semibold">
                    {tabItem.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Sliding Indicator */}
            {allTabsMeasured && (
              <Animated.View
                style={[{
                  position: 'absolute',
                  bottom: 0,
                  height: 2.5,
                  borderRadius: 2,
                  backgroundColor: activeBrand,
                }, tabIndicatorStyle]}
              />
            )}
          </View>
        </View>
      </View>

      {/* Paged Content */}
      <Animated.ScrollView
        ref={pagerRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onMomentumScrollEnd={onPageChange}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
      >
        {/* Tab 1: All Members */}
        <ScrollView
          style={{ width: SCREEN_WIDTH }}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={activeBrand}
            />
          }
        >
          {filteredAllMembers.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 80 }}>
              <Ionicons name="people-outline" size={48} color={textSecondary} style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary, textAlign: 'center' }}>
                {searchQuery.length > 0 ? 'No matching members' : 'No active members'}
              </Text>
              <Text style={{ fontSize: 14, color: textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
                {searchQuery.length > 0
                  ? 'Try adjusting your search query.'
                  : 'Organisation has no active members.'}
              </Text>
            </View>
          ) : (
            filteredAllMembers.map((member) => renderActiveMember(member))
          )}
        </ScrollView>

        {/* Tab 2: Pending Approvals */}
        <ScrollView
          style={{ width: SCREEN_WIDTH }}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={activeBrand}
            />
          }
        >
          {filteredPending.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 80 }}>
              <Ionicons name="people-outline" size={48} color={textSecondary} style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary, textAlign: 'center' }}>
                {searchQuery.length > 0 ? 'No matching pending requests' : 'All caught up!'}
              </Text>
              <Text style={{ fontSize: 14, color: textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
                {searchQuery.length > 0 
                  ? 'Try adjusting your search criteria.' 
                  : 'No pending member requests for your organisation.'}
              </Text>
            </View>
          ) : (
            filteredPending.map((member) => renderPendingMember(member))
          )}
        </ScrollView>

      </Animated.ScrollView>

      {/* Floating Action Button for Add/Invite */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
        className="absolute right-[22px] w-[54px] h-[54px] rounded-full items-center justify-center z-50"
        style={{ 
          bottom: Platform.OS === 'ios' ? insets.bottom + 24 : 40,
          backgroundColor: textPrimary
        }}
      >
        <Ionicons name="add" size={28} color={isDark ? '#1a1718' : '#ffffff'} />
      </TouchableOpacity>

      {/* Generate Invite Code Modal (Slide-up Bottom Sheet) */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ 
              backgroundColor: cardBg, 
              borderTopLeftRadius: 28, 
              borderTopRightRadius: 28, 
              padding: 24, 
              paddingBottom: Platform.OS === 'ios' ? insets.bottom + 20 : 40,
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' 
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary, letterSpacing: -0.5 }}>Invite Member</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={{ backgroundColor: glassmorphicBg, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={20} color={textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Segmented Control */}
              <View style={{ flexDirection: 'row', backgroundColor: glassmorphicBg, borderRadius: 12, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                <TouchableOpacity
                  onPress={() => setInviteMethod('phone')}
                  style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: inviteMethod === 'phone' ? canvasBg : 'transparent', borderWidth: inviteMethod === 'phone' ? 1 : 0, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                >
                  <Text style={{ fontWeight: '600', color: inviteMethod === 'phone' ? textPrimary : textSecondary }}>By Phone</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setInviteMethod('code')}
                  style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: inviteMethod === 'code' ? canvasBg : 'transparent', borderWidth: inviteMethod === 'code' ? 1 : 0, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                >
                  <Text style={{ fontWeight: '600', color: inviteMethod === 'code' ? textPrimary : textSecondary }}>By Code</Text>
                </TouchableOpacity>
              </View>

              {inviteMethod === 'phone' ? (
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary, marginBottom: 8 }}>Phone Number</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                    <View style={{ flex: 1, backgroundColor: glassmorphicBg, height: 50, borderRadius: 16, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', marginRight: 12 }}>
                      <TextInput
                        value={invitePhone}
                        onChangeText={setInvitePhone}
                        placeholder="+1234567890"
                        placeholderTextColor={textSecondary}
                        keyboardType="phone-pad"
                        style={{ fontSize: 16, color: textPrimary, fontWeight: '600' }}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={handlePickContact}
                      style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: glassmorphicBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
                    >
                      <Ionicons name="person-add-outline" size={22} color={activeBrand} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={handleInviteByPhone}
                    disabled={invitingPhone || !invitePhone}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: textPrimary,
                      borderRadius: 20,
                      height: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      opacity: invitePhone ? 1 : 0.5
                    }}
                  >
                    {invitingPhone ? (
                      <ActivityIndicator color={isDark ? '#1a1718' : '#ffffff'} size="small" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color={isDark ? '#1a1718' : '#ffffff'} style={{ marginRight: 8 }} />
                        <Text style={{ color: isDark ? '#1a1718' : '#ffffff', fontSize: 16, fontWeight: '700' }}>Send Invite</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  {invites.length > 0 ? (
                    <View style={{ marginBottom: 24, backgroundColor: glassmorphicBg, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: textPrimary, letterSpacing: 2 }}>
                          {invites[0].code}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleShareCode(invites[0].code)}
                          style={{ backgroundColor: activeBrand, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Ionicons name="share-outline" size={22} color="#fff" style={{ marginLeft: -2 }} />
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 14, color: textSecondary, fontWeight: '600' }}>
                          Joined: <Text style={{ color: textPrimary }}>{invites[0].usedBy.length}</Text>
                        </Text>
                        <Text style={{ fontSize: 14, color: textSecondary, fontWeight: '600' }}>
                          Generated: <Text style={{ color: textPrimary }}>{new Date(invites[0].createdAt).toLocaleDateString()}</Text>
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 15, color: textSecondary, lineHeight: 22, marginBottom: 20 }}>
                      You have not generated any invite codes yet. Click below to create one for your organisation.
                    </Text>
                  )}

                  <TouchableOpacity
                    onPress={handleGenerateInvite}
                    disabled={generatingInvite}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: canvasBg,
                      borderRadius: 20,
                      height: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                    }}
                  >
                    {generatingInvite ? (
                      <ActivityIndicator color={textPrimary} size="small" />
                    ) : (
                      <>
                        <Ionicons name="add-circle-outline" size={20} color={textPrimary} style={{ marginRight: 8 }} />
                        <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>Generate New Code</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Member Channel Assignment Sheet */}
      <MemberDetailSheet
        member={selectedMember}
        visible={detailSheetVisible}
        onClose={() => setDetailSheetVisible(false)}
        onSaved={() => {
          // Optionally show a brief success toast
        }}
      />
    </View>
  );
}

const MembersScreenObserved = withObservables([], () => ({
  users: database.collections.get<User>('users').query().observe(),
}))(MembersScreen);

export default MembersScreenObserved;
