import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  useColorScheme,
  Platform,
  StatusBar,
  Dimensions,
  Image,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import {
  getTenantStructure,
  getMemberChannels,
  updateMemberChannels,
  TenantHub,
  TenantChannel,
} from '../../services/auth';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../database';
import Post from '../../database/models/Post';
import Reaction from '../../database/models/Reaction';
import Hub from '../../database/models/Hub';
import Channel from '../../database/models/Channel';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemberSnapshot = {
  id: string;
  name: string | null;
  phone: string;
  status: string;
  role?: string;
  createdAt?: string;
};

type Props = {
  member: MemberSnapshot | null;
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getChannelAvatarUrl(category: string | null): string {
  let imageUrl = 'https://images.unsplash.com/photo-1504307651254-35680f356f12?w=150&h=150&fit=crop';
  if (category === 'asset') imageUrl = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=150&h=150&fit=crop';
  else if (category === 'location') imageUrl = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop';
  else if (category === 'process') imageUrl = 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=150&h=150&fit=crop';
  else if (category === 'role') imageUrl = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop';
  return imageUrl;
}

function categoryIcon(category: string | null): keyof typeof Ionicons.glyphMap {
  switch (category) {
    case 'safety': return 'shield-checkmark-outline';
    case 'audit':  return 'clipboard-outline';
    case 'ops':    return 'construct-outline';
    default:       return 'radio-button-on-outline';
  }
}

function statusConfig(status: string) {
  switch (status) {
    case 'active':           return { color: '#10b981', label: 'Active' };
    case 'pending_approval': return { color: '#f59e0b', label: 'Pending' };
    case 'invited_to_org':   return { color: '#0071e3', label: 'Invited' };
    case 'rejected':         return { color: '#ef4444', label: 'Rejected' };
    default:                 return { color: '#8899a6', label: status };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MemberDetailSheet({ member, visible, onClose, onSaved }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // ── Exact tokens matching home/notifications screens ──
  const canvasBg      = isDark ? '#15202b' : '#f2f2f7';
  const cardBg        = isDark ? '#1d2a35' : '#ffffff';
  const glassBg       = isDark ? 'rgba(255,255,255,0.12)' : '#ffffff';
  const textPrimary   = isDark ? '#ffffff' : '#1a1718';
  const textSecondary = isDark ? '#8899a6' : '#7a7577';
  const activeBrand   = '#0071e3';
  const separatorColor = isDark ? '#253341' : '#e8e4e5';

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerTitleStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [40, 90], [0, 1], Extrapolation.CLAMP),
    };
  });

  // ── Data ────────────────────────────────────────────────────────────────────
  const [hubs, setHubs] = useState<TenantHub[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'hub' | 'manual'>('hub');
  const [expandedHubs, setExpandedHubs] = useState<Set<string>>(new Set());
  const [postsCount, setPostsCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);

  // Manage Access Modal State
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalTab, setModalTab] = useState<'all' | 'suggestions'>('all');

  useEffect(() => {
    if (!visible || !member) return;
    setMode('hub');
    setExpandedHubs(new Set());
    loadData();
  }, [visible, member?.id]);

  const loadData = async () => {
    if (!member) return;
    setLoadingData(true);
    try {
      // Fetch user stats locally first, so they show up even if network fails
      try {
        const pCount = await database.collections.get<Post>('posts')
          .query(Q.where('author_id', member.id))
          .fetchCount();
        
        const lCount = await database.collections.get<Reaction>('reactions')
          .query(Q.on('posts', 'author_id', member.id))
          .fetchCount();

        setPostsCount(pCount);
        setLikesCount(lCount);
      } catch (dbErr) {
        console.error('Local DB stats error:', dbErr);
        setPostsCount(0);
        setLikesCount(0);
      }

      // Fetch channel data from WatermelonDB (Offline-first / Instant)
      let structure: TenantHub[] = [];
      let currentChannelIds: string[] = [];
      
      try {
        const allHubs = await database.collections.get<Hub>('hubs').query().fetch();
        const allChannels = await database.collections.get<Channel>('channels').query().fetch();
        const allMemberships = await database.collections.get<any>('channel_members').query(Q.where('user_id', member.id)).fetch();

        currentChannelIds = allMemberships.map(m => m.channelId);

        // Group channels by hub
        structure = allHubs.map(h => ({
          id: h.id,
          name: h.name,
          channels: allChannels.filter(c => c.hubId === h.id).map(c => ({
            id: c.id,
            name: c.name,
            category: c.category || 'ops',
            accessType: c.accessType,
          }))
        }));

        const ungroupedChannels = allChannels.filter(c => !c.hubId).map(c => ({
            id: c.id,
            name: c.name,
            category: c.category || 'ops',
            accessType: c.accessType,
        }));

        if (ungroupedChannels.length > 0) {
          structure.push({ id: '__ungrouped__', name: 'General', channels: ungroupedChannels });
        }
      } catch (err: any) {
        console.error('Failed to get tenant structure from DB:', err.message);
      }
      
      setHubs(structure);
      setSelectedIds(new Set(currentChannelIds));

    } finally {
      // Because this is all local, setLoadingData is essentially instant, removing the spinner!
      setLoadingData(false);
    }
  };

  // ── Selection helpers ────────────────────────────────────────────────────────

  const toggleChannel = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleHub = useCallback((hub: TenantHub) => {
    const hubIds = hub.channels.map((c) => c.id);
    const allSelected = hubIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) hubIds.forEach((id) => next.delete(id));
      else hubIds.forEach((id) => next.add(id));
      return next;
    });
  }, [selectedIds]);

  const toggleHubExpand = (hubId: string) => {
    setExpandedHubs((prev) => {
      const next = new Set(prev);
      if (next.has(hubId)) next.delete(hubId); else next.add(hubId);
      return next;
    });
  };

  const hubSelectionState = (hub: TenantHub): 'all' | 'some' | 'none' => {
    const ids = hub.channels.map((c) => c.id);
    const count = ids.filter((id) => selectedIds.has(id)).length;
    if (count === 0) return 'none';
    if (count === ids.length) return 'all';
    return 'some';
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    try {
      await updateMemberChannels(member.id, Array.from(selectedIds));
      onSaved?.();
      setIsManageModalOpen(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save channel access');
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  // Matches the Ophest checkbox style exactly
  const CheckBox = ({ checked, partial = false, onPress }: { checked: boolean; partial?: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{
        width: 24, height: 24, borderRadius: 7,
        backgroundColor: checked ? textPrimary : 'transparent',
        borderWidth: checked ? 0 : 1.5,
        borderColor: separatorColor,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {partial && !checked && (
        <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: textPrimary }} />
      )}
      {checked && <Ionicons name="checkmark" size={14} color={isDark ? '#1a1718' : '#fff'} />}
    </TouchableOpacity>
  );

  // Matches the exact notification/home row pattern
  const ChannelRow = ({ channel, isLast }: { channel: TenantChannel; isLast: boolean }) => {
    const isSelected = selectedIds.has(channel.id);
    return (
      <View>
        <TouchableOpacity
          onPress={() => toggleChannel(channel.id)}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14 }}
        >
          <Image
            source={{ uri: getChannelAvatarUrl(channel.category) }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              marginRight: 12,
              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
            }}
          />

          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary }}>{channel.name}</Text>
            {!!channel.accessType && (
              <Text style={{ fontSize: 13, color: textSecondary, marginTop: 1, textTransform: 'capitalize' }}>
                {channel.accessType}
              </Text>
            )}
          </View>

          <CheckBox checked={isSelected} onPress={() => toggleChannel(channel.id)} />
        </TouchableOpacity>
        {!isLast && <View style={{ height: 0.5, backgroundColor: separatorColor, marginLeft: 66 }} />}
      </View>
    );
  };

  // Hub row: header that auto-selects all channels; expands to show individual channels
  const HubSection = ({ hub }: { hub: TenantHub }) => {
    const state = hubSelectionState(hub);
    const isExpanded = expandedHubs.has(hub.id);
    const selectedCount = hub.channels.filter((c) => selectedIds.has(c.id)).length;

    return (
      <View style={{ marginBottom: 12 }}>
        {/* Hub card header — exactly like notification cards */}
        <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: cardBg }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => toggleHubExpand(hub.id)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14 }}
          >
            {/* Hub avatar — matches the home screen channel avatar size */}
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: state !== 'none' ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)') : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)'),
              alignItems: 'center', justifyContent: 'center',
              marginRight: 12,
            }}>
              <Ionicons
                name="layers-outline"
                size={20}
                color={state !== 'none' ? textPrimary : textSecondary}
              />
            </View>

            <View style={{ flex: 1, justifyContent: 'center', paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary, flex: 1, marginRight: 8 }} numberOfLines={1}>
                  {hub.name}
                </Text>
                <Text style={{ fontSize: 13, color: textSecondary }}>
                  {selectedCount}/{hub.channels.length}
                </Text>
              </View>
              <Text style={{ fontSize: 14.5, marginTop: 2, color: textSecondary }}>
                {hub.channels.length} {hub.channels.length === 1 ? 'channel' : 'channels'}
              </Text>
            </View>

            {/* Select-all checkbox */}
            <TouchableOpacity
              onPress={() => toggleHub(hub)}
              activeOpacity={0.7}
              style={{ marginRight: 12 }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <CheckBox
                checked={state === 'all'}
                partial={state === 'some'}
                onPress={() => toggleHub(hub)}
              />
            </TouchableOpacity>

            {/* Expand chevron */}
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-forward'}
              size={16}
              color={textSecondary}
            />
          </TouchableOpacity>

          {/* Expanded channel list — same separator style as notifications screen */}
          {isExpanded && (
            <React.Fragment>
              <View style={{ height: 0.5, backgroundColor: separatorColor, marginLeft: 68 }} />
              {hub.channels.map((ch, i) => (
                <ChannelRow key={ch.id} channel={ch} isLast={i === hub.channels.length - 1} />
              ))}
            </React.Fragment>
          )}
        </View>
      </View>
    );
  };

  const allChannels: TenantChannel[] = hubs.flatMap((h) => h.channels);

  // Assigned channels for read-only main view
  const assignedChannels = allChannels.filter(c => selectedIds.has(c.id));

  // Search & Filters for Modal
  const lowerQuery = searchQuery.toLowerCase();
  const filteredHubs = hubs.map(hub => ({
    ...hub,
    channels: hub.channels.filter(c => c.name.toLowerCase().includes(lowerQuery))
  })).filter(h => h.channels.length > 0 || h.name.toLowerCase().includes(lowerQuery));

  const filteredAllChannels = allChannels.filter(c => c.name.toLowerCase().includes(lowerQuery));

  // Mock Suggestions based on role
  const suggestedChannels = allChannels.filter(c => {
    if (!member?.role) return false;
    const r = member.role.toLowerCase();
    if (r.includes('engineer') && c.category === 'process') return true;
    if (r.includes('manager') && c.category === 'role') return true;
    return false;
  }).slice(0, 3); // Max 3 suggestions for mock

  const memberStatus = member ? statusConfig(member.status) : null;
  const initials = member ? (member.name || member.phone).slice(0, 2).toUpperCase() : '??';
  const joinedDate = member?.createdAt
    ? new Date(member.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // ── Read Only Render Helpers ──────────────────────────────────────────────────

  const AssignedChannelRow = ({ channel, isLast }: { channel: TenantChannel; isLast: boolean }) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14 }}>
        <Image source={{ uri: getChannelAvatarUrl(channel.category) }} style={{ width: 38, height: 38, borderRadius: 19, marginRight: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)' }} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary }}>{channel.name}</Text>
          {!!channel.accessType && <Text style={{ fontSize: 13, color: textSecondary, marginTop: 1, textTransform: 'capitalize' }}>{channel.accessType}</Text>}
        </View>
      </View>
      {!isLast && <View style={{ height: 0.5, backgroundColor: separatorColor, marginLeft: 66 }} />}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: canvasBg }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

        {/* ── Header — exact same pattern as home / notifications ── */}
        <View style={{ paddingTop: insets.top, backgroundColor: canvasBg, zIndex: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
            {/* Back button — matches notifications exactly */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              style={{ backgroundColor: glassBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="arrow-back-outline" size={26} color={textPrimary} />
            </TouchableOpacity>

            <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, headerTitleStyle]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 13 }}>{initials}</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary }} numberOfLines={1}>
                  {member?.name || 'Member'}
                </Text>
                {member?.status === 'active' ? (
                  <Ionicons name="checkmark-circle" size={16} color="#0071e3" />
                ) : (
                  <Ionicons name="alert-circle" size={16} color="#f59e0b" />
                )}
              </View>
            </Animated.View>

            {/* Options button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert('Options', 'More options coming soon.')}
              style={{ backgroundColor: glassBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom + 24 : 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickyHeaderIndices={[1]}
        >
          {/* ── Member info card — WhatsApp Style ── */}
          <View style={{ marginHorizontal: 16, marginBottom: 16, marginTop: 4, borderRadius: 28, backgroundColor: cardBg, padding: 20 }}>
            {/* Horizontal Block */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Avatar */}
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
                alignItems: 'center', justifyContent: 'center', marginRight: 16,
              }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 24 }}>{initials}</Text>
              </View>

              {/* Name & Stats */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary, letterSpacing: -0.5, marginRight: 6 }} numberOfLines={1}>
                    {member?.name || 'No name yet'}
                  </Text>
                </View>
                
                {/* Stats inline with avatar */}
                <Text style={{ color: textSecondary, fontSize: 13, fontWeight: '500', marginTop: 6, marginBottom: 8 }}>
                  {postsCount} {postsCount === 1 ? 'post' : 'posts'}  •  {likesCount} {likesCount === 1 ? 'like' : 'likes'}  •  {selectedIds.size} {selectedIds.size === 1 ? 'channel' : 'channels'}
                </Text>

                {/* Verification Status */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {member?.status === 'active' ? (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#0071e3" />
                      <Text style={{ color: '#0071e3', fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Verified</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="alert-circle" size={16} color="#f59e0b" />
                      <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Needs Verification</Text>
                    </>
                  )}
                </View>
              </View>
            </View>

            {/* Other details going vertically down */}
            <View style={{ marginTop: 20, borderTopWidth: 0.5, borderTopColor: separatorColor, paddingTop: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: textSecondary, fontWeight: '500' }}>Role</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: textPrimary, textTransform: 'capitalize' }}>{member?.role || 'Member'}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: textSecondary, fontWeight: '500' }}>Phone</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: textPrimary }}>{member?.phone}</Text>
              </View>
              {!!joinedDate && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: textSecondary, fontWeight: '500' }}>Joined Date</Text>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: textPrimary }}>{joinedDate}</Text>
                </View>
              )}
              {/* Mock Last Verified */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: textSecondary, fontWeight: '500' }}>Last Verified</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: textPrimary }}>
                  {member?.status === 'active' ? '12 Oct 2025' : 'Never'}
                </Text>
              </View>
            </View>
          </View>


          {/* ── Main View Channels Header ── */}
          <View style={{ backgroundColor: canvasBg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary, letterSpacing: -0.5 }}>
                  Assigned Channels
                </Text>
                <View style={{ backgroundColor: glassBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary }}>{assignedChannels.length}</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setIsManageModalOpen(true)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: glassBg }}
              >
                <Ionicons name="create-outline" size={16} color={textPrimary} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>Manage Access</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 0.5, backgroundColor: separatorColor, marginHorizontal: 16 }} />
          </View>

          {/* ── Main View Assigned Channels Content ── */}
          {loadingData ? (
            <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={activeBrand} size="large" />
              <Text style={{ color: textSecondary, fontSize: 15, marginTop: 14 }}>Loading channels...</Text>
            </View>
          ) : assignedChannels.length === 0 ? (
            <View style={{ height: 200, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <Ionicons name="albums-outline" size={52} color={textSecondary} />
              <Text style={{ color: textSecondary, fontSize: 15, marginTop: 14, textAlign: 'center' }}>
                No assigned channels.
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 12, paddingTop: 16 }}>
              <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: cardBg }}>
                {assignedChannels.map((ch, i) => (
                  <AssignedChannelRow key={ch.id} channel={ch} isLast={i === assignedChannels.length - 1} />
                ))}
              </View>
            </View>
          )}
        </Animated.ScrollView>
      </View>

      {/* ── Manage Access Modal ── */}
      <Modal visible={isManageModalOpen} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => setIsManageModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: canvasBg }}>
          <View style={{ paddingTop: insets.top, backgroundColor: canvasBg, zIndex: 10 }}>
             <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8 }}>
               <TouchableOpacity activeOpacity={0.7} onPress={() => setIsManageModalOpen(false)} style={{ backgroundColor: glassBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
                 <Ionicons name="close" size={26} color={textPrimary} />
               </TouchableOpacity>
               <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                 <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary, letterSpacing: -0.5 }}>Manage Access</Text>
               </View>
               <View style={{ width: 48, height: 48 }} />
             </View>
             
             {/* Search Bar + Hubs/All Toggle */}
             <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12 }}>
               <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: glassBg, height: 44, borderRadius: 22, paddingHorizontal: 12, marginRight: 12 }}>
                 <Ionicons name="search-outline" size={20} color={textSecondary} style={{ marginRight: 8 }} />
                 <TextInput 
                   placeholder="Search channels..." 
                   placeholderTextColor={textSecondary}
                   value={searchQuery}
                   onChangeText={setSearchQuery}
                   style={{ flex: 1, fontSize: 16, color: textPrimary, padding: 0 }}
                 />
                 {searchQuery.length > 0 && (
                   <TouchableOpacity onPress={() => setSearchQuery('')}>
                     <Ionicons name="close-circle" size={18} color={textSecondary} />
                   </TouchableOpacity>
                 )}
               </View>
               
               <TouchableOpacity onPress={() => setMode(mode === 'hub' ? 'manual' : 'hub')} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 44, borderRadius: 22, backgroundColor: glassBg, justifyContent: 'center' }}>
                 <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>{mode === 'manual' ? 'All' : 'Hubs'}</Text>
                 <Ionicons name="swap-vertical" size={14} color={textPrimary} style={{ marginLeft: 6 }} />
               </TouchableOpacity>
             </View>

             {/* Tabs: All | Suggestions */}
             <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 32, marginBottom: 8 }}>
               <TouchableOpacity onPress={() => setModalTab('all')} style={{ paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: modalTab === 'all' ? activeBrand : 'transparent' }}>
                 <Text style={{ fontSize: 15, fontWeight: '600', color: modalTab === 'all' ? textPrimary : textSecondary }}>All Channels</Text>
               </TouchableOpacity>
               <TouchableOpacity onPress={() => setModalTab('suggestions')} style={{ paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: modalTab === 'suggestions' ? activeBrand : 'transparent' }}>
                 <Text style={{ fontSize: 15, fontWeight: '600', color: modalTab === 'suggestions' ? textPrimary : textSecondary }}>Suggestions</Text>
               </TouchableOpacity>
             </View>
             <View style={{ height: 0.5, backgroundColor: separatorColor }} />
          </View>

          {/* Manage Modal Content */}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            {modalTab === 'all' ? (
              mode === 'hub' ? (
                filteredHubs.map((hub) => <HubSection key={hub.id} hub={hub} />)
              ) : (
                <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: cardBg }}>
                  {filteredAllChannels.map((ch, i) => <ChannelRow key={ch.id} channel={ch} isLast={i === filteredAllChannels.length - 1} />)}
                </View>
              )
            ) : (
              suggestedChannels.length > 0 ? (
                <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: cardBg }}>
                  {suggestedChannels.map((ch, i) => <ChannelRow key={ch.id} channel={ch} isLast={i === suggestedChannels.length - 1} />)}
                </View>
              ) : (
                <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
                   <Text style={{ color: textSecondary, fontSize: 15 }}>No suggestions available for this role.</Text>
                </View>
              )
            )}
          </ScrollView>

          {/* Floating Save Button */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? insets.bottom + 16 : 24, paddingTop: 16, backgroundColor: canvasBg }}>
             <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.8} style={{ height: 56, borderRadius: 28, backgroundColor: textPrimary, alignItems: 'center', justifyContent: 'center' }}>
                {saving ? <ActivityIndicator color={isDark ? '#1a1718' : '#ffffff'} /> : (
                  <Text style={{ color: isDark ? '#1a1718' : '#ffffff', fontSize: 18, fontWeight: '700' }}>Save Changes</Text>
                )}
             </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}
