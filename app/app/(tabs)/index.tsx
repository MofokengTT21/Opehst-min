import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  Image,
  Modal,
  Platform,
  StatusBar,
  SafeAreaView,
  PanResponder,
} from 'react-native';
import { useState, useRef, ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import withObservables from '@nozbe/with-observables';
import { database } from '../../database';
import Item from '../../database/models/Item';
import Group from '../../database/models/Group';
import Subscription from '../../database/models/Subscription';
import Log from '../../database/models/Log';

// ─── Design tokens ──────────────────────────────────────────────
const LIGHT = {
  canvas:      '#f0edee',   // soft warm grey background (balanced contrast)
  card:        '#ffffff',   // list rows & search bar
  pillBg:      '#ffffff',   // white pills sit gently on the soft canvas
  pillBorder:  '#e8e4e5',
  pillActiveBg:'#2e2a2b',   // inverted neutral for active pill
  pillActiveText:'#ffffff',
  text1:       '#1a1718',   // primary
  text2:       '#7a7577',   // secondary
  divider:     '#ffffff',
  iconBg:      '#ffffff',   // logo circle bg
  iconBorder:  '#e0dcdd',
  dropdownBg:  '#ffffff',
  dropdownBorder: '#e0dcdd',
  actionIcon:  '#1a1718',
};

const DARK = {
  canvas:      '#15202b',   // X.com Dim background
  card:        'rgba(255, 255, 255, 0.12)', // translucent overlay (matches avatar bg)
  pillBg:      'rgba(255, 255, 255, 0.12)',
  pillBorder:  '#253341',
  pillActiveBg:'#38444d',   // X.com Dim active pill
  pillActiveText:'#ffffff',
  text1:       '#ffffff',
  text2:       '#8899a6',
  divider:     '#253341',
  iconBg:      'rgba(255, 255, 255, 0.12)', // matches avatar bg
  iconBorder:  '#253341',
  dropdownBg:  '#192734',
  dropdownBorder:'#253341',
  actionIcon:  '#ffffff',
};

// ─── Avatar configs ──────────────────────────────────────────────
const AVATAR_CONFIGS: Record<string, {
  icon: ComponentProps<typeof Ionicons>['name'];
}> = {
  asset:    { icon: 'cog-outline' },
  location: { icon: 'location-outline' },
  process:  { icon: 'git-network-outline' },
  role:     { icon: 'person-outline' },
  group:    { icon: 'people-outline' },
  default:  { icon: 'ellipse-outline' },
};

// ─── Department options ─────────────────────────────────────────
const DEPARTMENTS = [
  'All Departments',
  'Engineering',
  'Production',
  'SHEQ',
  'Maintenance',
  'Quality',
  'Logistics',
  'Finance',
];

// ─── Filter tags ────────────────────────────────────────────────
const FILTERS: { key: 'all' | 'alerts' | 'artisan'; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'alerts',  label: 'Alerts' },
  { key: 'artisan', label: 'Artisan Logs' },
];

// ═══════════════════════════════════════════════════════════════
const RawHomeScreen = ({
  subscriptions, logs, items, groups,
}: {
  subscriptions: Subscription[];
  logs: Log[];
  items: Item[];
  groups: Group[];
}) => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const C = isDark ? DARK : LIGHT;

  const [searchQuery, setSearchQuery]   = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'alerts' | 'artisan'>('all');
  const [department, setDepartment]     = useState('All Departments');
  const [deptOpen, setDeptOpen]         = useState(false);

  // ── Gesture tracking: is scroll at top? ────────────────────────
  const scrollAtTop = useRef(true);

  // ── Icon swap feedback: chevron → swap icon briefly on switch ──
  const [iconSwapped, setIconSwapped] = useState(false);

  // ── Instant department switch ─────────────────────────────
  const switchDepartmentDown = () => {
    setDepartment((prev) =>
      DEPARTMENTS[(DEPARTMENTS.indexOf(prev) + 1) % DEPARTMENTS.length]
    );
    setIconSwapped(true);
    setTimeout(() => setIconSwapped(false), 900);
  };

  // ── PanResponder: only activates at top + clear downward swipe ──
  const panResponder = useRef(
    PanResponder.create({
      // Offer to take gesture only when: scroll is at top, finger moves down
      // more than 15px, and more vertical than horizontal
      onMoveShouldSetPanResponder: (_evt, gs) =>
        scrollAtTop.current &&
        gs.dy > 15 &&
        Math.abs(gs.dy) > Math.abs(gs.dx) * 1.2,

      // Don't block ScrollView's own scroll handling when already scrolled down
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderRelease: (_evt, gs) => {
        if (gs.dy > 60) {
          switchDepartmentDown();
        }
      },
    })
  ).current;

  // ── Derived chat list ──────────────────────────────────────────
  const chatData = subscriptions.map((sub) => {
    let name = '';
    let avatarConfig = AVATAR_CONFIGS.default;

    if (sub.targetType === 'item') {
      const item = items.find((i) => i.id === sub.targetId);
      if (item) {
        name = item.name;
        avatarConfig = AVATAR_CONFIGS[item.category] ?? AVATAR_CONFIGS.default;
      }
    } else {
      const group = groups.find((g) => g.id === sub.targetId);
      if (group) { name = group.name; avatarConfig = AVATAR_CONFIGS.group; }
    }

    const targetPosts = logs.filter((m) => m.targetId === sub.targetId);
    const latestPost  = targetPosts[0] ?? null;

    return {
      id:           sub.targetId,
      name:         name || 'Unknown',
      avatarConfig,
      lastSender:   latestPost?.authorName ?? '',
      lastMessage:  latestPost?.content    ?? 'No updates yet.',
      time:         latestPost             ? 'Just now' : '',
      isScadaAlert: latestPost?.isScadaAlert ?? false,
      isOnline:     Math.random() > 0.4,
    };
  });

  const filteredChats = chatData.filter((chat) => {
    const matchesSearch =
      chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'alerts')  return chat.isScadaAlert;
    if (activeFilter === 'artisan') return !chat.isScadaAlert;
    return true;
  });

  // ── Render ─────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }} {...panResponder.panHandlers}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={C.canvas} />

      <ScrollView
        style={{ flex: 1, backgroundColor: C.canvas }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollAtTop.current = e.nativeEvent.contentOffset.y <= 2;
        }}
      >

        {/* ════════════════════════════════════════════════
            CUSTOM IPHONE-STYLE HEADER
            [Logo●]   [Dept ▾]   [🔔][🔍][⋯]
        ════════════════════════════════════════════════ */}
        <SafeAreaView style={{ backgroundColor: C.canvas }}>
          {/* ── Apple HIG: min 44pt tap targets, 3-zone layout ── */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 8,
            paddingBottom: 14,
            backgroundColor: C.canvas,
          }}>

            {/* LEFT — Hamburger menu, 48pt touch target, no shadows */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: C.iconBg,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="menu" size={28} color={C.actionIcon} />
            </TouchableOpacity>

            {/* CENTRE — Plain text dept selector, no box */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <TouchableOpacity
                activeOpacity={0.65}
                onPress={() => setDeptOpen(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 48,           // Larger touch target
                  paddingHorizontal: 8,
                  gap: 6,
                }}
              >
                <Text style={{
                  fontSize: 19,            // Slightly reduced font
                  fontWeight: '700',
                  color: C.text1,
                  letterSpacing: -0.4,
                }} numberOfLines={1}>
                  {department === 'All Departments' ? 'All Departments' : department}
                </Text>
                {/* Icon: swap-horizontal while switching, chevron-down at rest */}
                <Ionicons
                  name={iconSwapped ? 'swap-horizontal-outline' : 'chevron-down'}
                  size={17}
                  color={C.text1}
                />
              </TouchableOpacity>
            </View>

            {/* RIGHT — Three dots menu, 48pt, no shadows */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: C.iconBg,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={26} color={C.actionIcon} />
            </TouchableOpacity>
          </View>

          {/* ── Search bar ─────────────────────────────────── */}
          <View style={{
            marginHorizontal: 16, marginBottom: 12,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: C.card,
            borderRadius: 100,
            paddingHorizontal: 16, paddingVertical: 15,
          }}>
            <Ionicons name="search-outline" size={21} color={C.text2} style={{ marginRight: 11 }} />
            <TextInput
              placeholder="Search channels & logs..."
              placeholderTextColor={C.text2}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ flex: 1, color: C.text1, fontSize: 17, padding: 0 }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={C.text2} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Filter pills ───────────────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ paddingLeft: 16, marginBottom: 10 }}
            contentContainerStyle={{ paddingRight: 16, gap: 8 }}
          >
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setActiveFilter(f.key)}
                  style={{
                    paddingHorizontal: 18, paddingVertical: 8,
                    borderRadius: 99,
                    backgroundColor: isActive ? C.pillActiveBg : C.pillBg,
                  }}
                >
                  <Text style={{
                    fontSize: 13, fontWeight: '600',
                    color: isActive ? C.pillActiveText : C.text2,
                  }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
        {filteredChats.length === 0 ? (
          <View style={{ paddingTop: 80, alignItems: 'center', paddingHorizontal: 24 }}>
            <Ionicons name="reader-outline" size={52} color={C.text2} />
            <Text style={{ color: C.text2, fontSize: 15, marginTop: 12, textAlign: 'center' }}>
              No matching logs or channels
            </Text>
          </View>
        ) : (
          filteredChats.map((chat, index) => {
            const avatarBg = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)';
            const isLast   = index === filteredChats.length - 1;

            return (
              <View key={chat.id} style={{ backgroundColor: C.canvas }}>
                <TouchableOpacity
                  activeOpacity={0.5}
                  onPress={() => router.push(`/item/${chat.id}`)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    // Apple HIG: 44pt min row height, generous horizontal padding
                    paddingHorizontal: 16,
                    paddingVertical: 15,
                    minHeight: 80,
                  }}
                >
                  {/* Avatar + online dot */}
                  <View style={{ position: 'relative', marginRight: 15 }}>
                    <View style={{
                      width: 60, height: 60, borderRadius: 30,
                      backgroundColor: avatarBg,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons
                        name={chat.avatarConfig.icon}
                        size={28}
                        color={isDark ? '#ffffff' : C.pillActiveBg}
                      />
                    </View>
                    {chat.isOnline && (
                      <View style={{
                        position: 'absolute', bottom: 1, right: 1,
                        width: 15, height: 15, borderRadius: 7.5,
                        backgroundColor: '#22c55e',
                        borderWidth: 2.5,
                        borderColor: C.canvas,    // match canvas so ring blends
                      }} />
                    )}
                  </View>

                  {/* Text block */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Text
                        numberOfLines={1}
                        style={{ flex: 1, marginRight: 8, fontSize: 17, fontWeight: '600', color: C.text1 }}
                      >
                        {chat.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: C.text2, flexShrink: 0 }}>
                        {chat.time}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{ marginTop: 2, fontSize: 14.5, color: C.text2, lineHeight: 21 }}
                    >
                      {chat.lastSender ? `${chat.lastSender}: ` : ''}{chat.lastMessage}
                    </Text>
                  </View>
                </TouchableOpacity>
                {!isLast && (
                  <View style={{
                    height: 0.5,
                    backgroundColor: C.divider,
                    marginLeft: 16,
                    marginRight: 16,
                  }} />
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ═══════════════════════════════════════════════
          FAB — 10% brand accent, no shadows
      ═══════════════════════════════════════════════ */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/directory')}
        style={{
          position: 'absolute', bottom: 26, right: 22,
          width: 62, height: 62, borderRadius: 31,
          backgroundColor: '#FF4237',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}
      >
        <Ionicons name="create" size={27} color="#ffffff" />
      </TouchableOpacity>

      {/* ═══════════════════════════════════════════════
          DEPARTMENT DROPDOWN MODAL
      ═══════════════════════════════════════════════ */}
      <Modal
        visible={deptOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeptOpen(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: '#00000030', justifyContent: 'flex-start', paddingTop: 100 }}
          activeOpacity={1}
          onPress={() => setDeptOpen(false)}
        >
          <View style={{
            marginHorizontal: 60,
            backgroundColor: C.dropdownBg,
            borderRadius: 18,
            overflow: 'hidden',
          }}>
            <Text style={{
              textAlign: 'center',
              paddingTop: 14, paddingBottom: 6,
              fontSize: 12, fontWeight: '600',
              color: C.text2, letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}>
              Department
            </Text>
            {DEPARTMENTS.map((dept, i) => {
              const isSelected = dept === department;
              const isLast     = i === DEPARTMENTS.length - 1;
              return (
                <TouchableOpacity
                  key={dept}
                  onPress={() => { setDepartment(dept); setDeptOpen(false); }}
                  style={{
                    paddingVertical: 13,
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isSelected ? (isDark ? '#2e2a2b' : '#faf9f9') : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 15,
                    fontWeight: isSelected ? '700' : '400',
                    color: isSelected ? '#FF4237' : C.text1,
                  }}>
                    {dept}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color="#FF4237" />
                  )}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 6 }} />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const enhance = withObservables([], () => ({
  subscriptions: database.collections.get<Subscription>('subscriptions').query(),
  logs: database.collections.get<Log>('logs').query(),
  items: database.collections.get<Item>('items').query(),
  groups: database.collections.get<Group>('groups').query(),
}));

export default enhance(RawHomeScreen);
