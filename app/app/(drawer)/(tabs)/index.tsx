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
  Dimensions,
  RefreshControl,
  PanResponder,
  StyleSheet,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, interpolateColor, Extrapolation, runOnJS, useAnimatedScrollHandler } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useEffect, useCallback, ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { database } from '../../../database';
import Item from '../../../database/models/Item';
import Group from '../../../database/models/Group';
import Subscription from '../../../database/models/Subscription';
import Log from '../../../database/models/Log';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Avatar configs ──────────────────────────────────────────────
const AVATAR_CONFIGS: Record<string, { url: string }> = {
  asset:    { url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=150&h=150&fit=crop' },
  location: { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop' },
  process:  { url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=150&h=150&fit=crop' },
  role:     { url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop' },
  group:    { url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&h=150&fit=crop' },
  default:  { url: 'https://images.unsplash.com/photo-1504307651254-35680f356f12?w=150&h=150&fit=crop' },
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

const FriesIcon = ({ size = 26, color = '#000' }: { size?: number, color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path stroke={color} strokeWidth="2.5" strokeLinecap="round" d="M4 6h16 M4 12h10 M4 18h14" />
  </Svg>
);

const RawHomeScreen = ({
  subscriptions, logs, items, groups,
}: {
  subscriptions: Subscription[];
  logs: Log[];
  items: Item[];
  groups: Group[];
}) => {
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [searchQuery, setSearchQuery]   = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'alerts' | 'artisan'>('all');
  const [department, setDepartment]     = useState('All Departments');
  const [deptOpen, setDeptOpen]         = useState(false);
  const deptMenuAnim = useSharedValue(0);
  const deptScrollRef = useRef<ScrollView>(null);
  const [iconSwapped, setIconSwapped]   = useState(false);
  const [pillWidth, setPillWidth] = useState(160);
  const insets = useSafeAreaInsets();

  const openDeptMenu = () => {
    setDeptOpen(true);
    requestAnimationFrame(() => {
      deptMenuAnim.value = withSpring(1, { stiffness: 250, damping: 30, mass: 1, overshootClamping: true });
    });
  };

  const onDeptMenuClosed = useCallback((newDept?: string) => {
    setDeptOpen(false);
    if (newDept) setDepartment(newDept);
  }, []);

  const closeDeptMenu = (newDept?: string) => {
    deptMenuAnim.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(onDeptMenuClosed)(newDept);
      }
    });
  };

  // ── Dynamic Island Animation ──────────────────────────────────
  // Target states: 'All Departments' -> Logo (0), Specific Dept -> Text Pill (1)
  const dynamicIslandAnim = useSharedValue(department === 'All Departments' ? 0 : 1);
  const deptRef = useRef(department);
  deptRef.current = department;
  const lastDepartment = useRef(department);

  const triggerDynamicIsland = (toValue: number, delayMs: number = 500) => {
    setTimeout(() => {
      dynamicIslandAnim.value = withSpring(toValue, { stiffness: 250, damping: 30, mass: 1, overshootClamping: true });
    }, delayMs);
  };

  useFocusEffect(
    useCallback(() => {
      if (deptRef.current === 'All Departments') {
        dynamicIslandAnim.value = 1;
        triggerDynamicIsland(0, 400);
      } else {
        dynamicIslandAnim.value = 0;
        triggerDynamicIsland(1, 400);
      }
    }, [])
  );

  useEffect(() => {
    if (department === lastDepartment.current) return;

    if (department === 'All Departments') {
      dynamicIslandAnim.value = 1;
      triggerDynamicIsland(0, 100);
    } else {
      dynamicIslandAnim.value = 1;
    }
    lastDepartment.current = department;
  }, [department]);

  useEffect(() => {
    if (deptOpen) {
      setTimeout(() => {
        const idx = DEPARTMENTS.indexOf(department);
        deptScrollRef.current?.scrollTo({
          y: Math.max(0, idx * 49 - 120),
          animated: false,
        });
      }, 0);
    }
  }, [deptOpen]);

  // Logo: theme-aware
  const logoSource = isDark
    ? require('../../../assets/images/logo_dark.png')
    : require('../../../assets/images/logo.png');

  // ── Paged horizontal ScrollView ref ────────────────────────────
  const pagerRef = useRef<ScrollView>(null);
  // Animated scroll position — drives the live-tracking tab indicator
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });
  // Measured {x, width} for each tab label, populated via onLayout
  const [tabLayouts, setTabLayouts] = useState<Array<{ x: number; width: number } | null>>(
    FILTERS.map(() => null)
  );

  const switchToFilter = (key: 'all' | 'alerts' | 'artisan') => {
    const idx = FILTERS.findIndex(f => f.key === key);
    pagerRef.current?.scrollTo({ x: SCREEN_WIDTH * idx, animated: true });
    setActiveFilter(key);
  };

  const onPageChange = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    const filter = FILTERS[idx]?.key;
    if (filter) setActiveFilter(filter);
  };

  const allTabsMeasured = tabLayouts.every(Boolean);

  const scrollYRefs = useRef<Record<string, number>>({ all: 0, alerts: 0, artisan: 0 });
  const lastSwitchRef = useRef(0);

  const switchDepartmentDown = () => {
    setDepartment((prev) =>
      DEPARTMENTS[(DEPARTMENTS.indexOf(prev) + 1) % DEPARTMENTS.length]
    );
    setIconSwapped(true);
    setTimeout(() => setIconSwapped(false), 600);
  };


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

  const dummyItems = [
    {
      id: 'dummy-1',
      name: 'Shift Handover',
      avatarConfig: AVATAR_CONFIGS.process,
      lastSender: 'John Doe',
      lastMessage: 'Night shift completed without incidents.',
      time: '2h ago',
      isScadaAlert: false,
      isOnline: true,
    },
    {
      id: 'dummy-2',
      name: 'Boiler Pressure',
      avatarConfig: AVATAR_CONFIGS.asset,
      lastSender: 'SCADA',
      lastMessage: 'Pressure drop detected in Boiler 3.',
      time: '5h ago',
      isScadaAlert: true,
      isOnline: false,
    },
    {
      id: 'dummy-3',
      name: 'Weekly Safety',
      avatarConfig: AVATAR_CONFIGS.group,
      lastSender: 'Sarah Smith',
      lastMessage: 'Please review the new safety guidelines.',
      time: '1d ago',
      isScadaAlert: false,
      isOnline: true,
    },
    {
      id: 'dummy-4',
      name: 'Pump Station 2',
      avatarConfig: AVATAR_CONFIGS.location,
      lastSender: 'Mike T.',
      lastMessage: 'Routine maintenance scheduled for tomorrow.',
      time: '2d ago',
      isScadaAlert: false,
      isOnline: false,
    },
    {
      id: 'dummy-5',
      name: 'Quality Assurance',
      avatarConfig: AVATAR_CONFIGS.role,
      lastSender: 'Jane Doe',
      lastMessage: 'Batch #4592 passed all tests.',
      time: '3d ago',
      isScadaAlert: false,
      isOnline: true,
    }
  ];

  const fullChatData = [...chatData, ...dummyItems];

  const getFilteredChats = (filter: 'all' | 'alerts' | 'artisan') =>
    fullChatData.filter((chat) => {
      const matchesSearch =
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (filter === 'alerts')  return chat.isScadaAlert;
      if (filter === 'artisan') return !chat.isScadaAlert;
      return true;
    });

  const renderChatItem = (chat: any, index: number, isLast: boolean) => (
    <View key={chat.id}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/item/${chat.id}`)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}
      >
        <View style={{ position: 'relative', marginRight: 12 }}>
          <Image
            source={{ uri: chat.avatarConfig.url }}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
          {chat.isOnline && (
            <View style={{ position: 'absolute', bottom: -1, right: -1, width: 13, height: 13, borderRadius: 6.5, backgroundColor: '#22c55e', borderWidth: 2, borderColor: isDark ? '#1d2a35' : '#ffffff' }} />
          )}
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#ffffff' : '#1a1718', flex: 1, marginRight: 8 }}
            >
              {chat.name}
            </Text>
            <Text style={{ fontSize: 13, color: isDark ? '#8899a6' : '#7a7577', flexShrink: 0 }}>
              {chat.time}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={{ fontSize: 14.5, marginTop: 2, color: isDark ? '#8899a6' : '#7a7577' }}
          >
            {chat.lastSender ? `${chat.lastSender}: ` : ''}{chat.lastMessage}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? '#8899a6' : '#7a7577'} />
      </TouchableOpacity>
      {!isLast && (
        <View style={{ height: 0.5, backgroundColor: isDark ? '#253341' : '#e8e4e5', marginLeft: 68 }} />
      )}
    </View>
  );

  const renderPage = (filter: 'all' | 'alerts' | 'artisan') => {
    const chats = getFilteredChats(filter);
    const topChats    = chats.slice(0, 3);
    const recentChats = chats.slice(3);

    return (
      <View key={filter} style={{ width: SCREEN_WIDTH }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={switchDepartmentDown}
              tintColor="transparent"
              colors={['transparent']}
              progressBackgroundColor="transparent"
              progressViewOffset={-1000}
            />
          }
        >
        {chats.length === 0 ? (
          <View className="pt-20 items-center px-6">
            <Ionicons name="reader-outline" size={52} color={isDark ? '#8899a6' : '#7a7577'} />
            <Text className="text-text-secondary text-[15px] mt-3 text-center">
              No matching logs or channels
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            {topChats.length > 0 && (
              <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: isDark ? '#1d2a35' : '#ffffff' }}>
                {topChats.map((chat, index) => renderChatItem(chat, index, index === topChats.length - 1))}
              </View>
            )}

            {recentChats.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 8, letterSpacing: 0.5, color: isDark ? '#8899a6' : '#7a7577' }}>
                  Recent
                </Text>
                <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: isDark ? '#1d2a35' : '#ffffff' }}>
                  {recentChats.map((chat, index) => renderChatItem(chat, index, index === recentChats.length - 1))}
                </View>
              </View>
            )}
          </View>
        )}
        </ScrollView>
      </View>
    );
  };

  const glassmorphicBg = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const iconColor = isDark ? '#ffffff' : '#1a1718';
  const dynamicIslandStyle = useAnimatedStyle(() => ({
    maxWidth: interpolate(dynamicIslandAnim.value, [0, 1], [24, 300], Extrapolation.CLAMP),
    opacity: interpolate(dynamicIslandAnim.value, [0, 0.1, 1], [0, 1, 1], Extrapolation.CLAMP) * interpolate(deptMenuAnim.value, [0, 0.1], [1, 0], Extrapolation.CLAMP)
  }));

  const dynamicIslandTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dynamicIslandAnim.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(dynamicIslandAnim.value, [0.5, 1], [0.9, 1], Extrapolation.CLAMP) }]
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dynamicIslandAnim.value, [0, 0.5, 1], [1, 0, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(dynamicIslandAnim.value, [0, 0.5, 1], [1, 0.8, 0.8], Extrapolation.CLAMP) }]
  }));

  const modalOverlayStyle = useAnimatedStyle(() => ({
    opacity: deptMenuAnim.value
  }));

  const modalBgStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(deptMenuAnim.value, [0, 1], [24, 32]),
    height: interpolate(deptMenuAnim.value, [0, 1], [48, 400]),
    width: interpolate(deptMenuAnim.value, [0, 1], [pillWidth || 160, SCREEN_WIDTH - 32]),
    opacity: interpolate(deptMenuAnim.value, [0, 0.1, 1], [0, 1, 1], Extrapolation.CLAMP),
    backgroundColor: isDark
      ? interpolateColor(deptMenuAnim.value, [0, 1], ['rgba(255, 255, 255, 0.12)', 'rgba(29, 42, 53, 1)'])
      : '#ffffff'
  }));

  const modalContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(deptMenuAnim.value, [0.5, 1], [0, 1], Extrapolation.CLAMP)
  }));

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

  return (
    <View className="flex-1 bg-surface-background">
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <SafeAreaView edges={['top']} className="bg-surface-background">
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 14,
        }}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => (navigation as any).openDrawer()}
          >
            <FriesIcon size={26} color={iconColor} />
          </TouchableOpacity>

          <View className="flex-1 items-center justify-center">
            <View style={{ height: 48, justifyContent: 'center', alignItems: 'center' }}>
              
              {/* Dynamic Island Pill */}
              <Animated.View style={[{
                position: 'absolute',
                height: 48,
                backgroundColor: glassmorphicBg,
                borderRadius: 24,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }, dynamicIslandStyle]}>
                <TouchableOpacity
                  activeOpacity={0.65}
                  onPress={openDeptMenu}
                  onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}
                  style={{ height: 48 }}
                  className="px-5 flex-row items-center justify-center gap-1.5"
                >
                  <Animated.View style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }, dynamicIslandTextStyle]}>
                    <Text className="text-[17px] font-semibold text-text-primary tracking-tight" numberOfLines={1}>
                      {department === 'All Departments' ? 'All Departments' : department}
                    </Text>
                    <Ionicons
                      name={iconSwapped ? 'swap-horizontal-outline' : 'chevron-down-outline'}
                      size={17}
                      color={iconColor}
                    />
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>

              {/* Logo */}
              <Animated.View 
                pointerEvents={department === 'All Departments' ? 'auto' : 'none'}
                style={[{
                  position: 'absolute',
                }, logoStyle]}
              >
                <TouchableOpacity 
                  activeOpacity={0.65}
                  onPress={openDeptMenu}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Image source={logoSource} style={{ width: 125, height: 30, resizeMode: 'contain' }} />
                  <Ionicons 
                    name={iconSwapped ? 'swap-horizontal-outline' : 'chevron-down-outline'} 
                    size={16} 
                    color={iconColor} 
                    style={{ opacity: 0.5 }} 
                  />
                </TouchableOpacity>
              </Animated.View>

            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={26} color={iconColor} />
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: glassmorphicBg, height: 48, borderRadius: 24 }} className="mx-4 mb-3 flex-row items-center px-4">
          <Ionicons name="search-outline" size={20} color={isDark ? '#8899a6' : '#7a7577'} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search channels & logs..."
            placeholderTextColor={isDark ? '#8899a6' : '#7a7577'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-text-primary text-[16px] p-0 h-full"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={isDark ? '#8899a6' : '#7a7577'} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs — tapping scrolls the pager; indicator tracks live */}
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, position: 'relative' }}>
            {FILTERS.map((f, i) => {
              const isActive = activeFilter === f.key;
              const textColor = isActive ? (isDark ? '#ffffff' : '#1a1718') : (isDark ? '#8899a6' : '#7a7577');
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => switchToFilter(f.key)}
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
                  <Text style={{ color: textColor }} className="text-[14.5px] font-semibold">
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Live-tracking blue indicator */}
            {allTabsMeasured && (
              <Animated.View
                style={[{
                  position: 'absolute',
                  bottom: 0,
                  height: 2.5,
                  borderRadius: 2,
                  backgroundColor: '#0071e3',
                }, tabIndicatorStyle]}
              />
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* ── Paged content — native horizontal pager ────────────── */}
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
      >
        {FILTERS.map(f => renderPage(f.key))}
      </Animated.ScrollView>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/directory')}
        className="absolute right-[22px] w-[62px] h-[62px] rounded-full bg-ophest items-center justify-center z-50"
        style={{ bottom: Platform.OS === 'ios' ? 108 : 88 }}
      >
        <Ionicons name="add" size={32} color="#ffffff" />
      </TouchableOpacity>

      <Modal
        visible={deptOpen}
        transparent
        animationType="none"
        onRequestClose={() => closeDeptMenu()}
      >
        <View style={{ flex: 1 }}>
          {/* Animated Background Overlay */}
          <Animated.View style={[{
            position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
          }, modalOverlayStyle]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => closeDeptMenu()} activeOpacity={1} />
          </Animated.View>

          {/* Animated Dynamic Island Growing Background */}
          <Animated.View 
            style={[{ 
              position: 'absolute',
              top: insets.top + 8,
              alignSelf: 'center',
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 10,
            }, modalBgStyle]} 
          >
            <Animated.View style={[{ flex: 1 }, modalContentStyle]}>
              <Text className="text-center pt-[18px] pb-[10px] text-[16px] font-semibold text-text-secondary">
                Select Department
              </Text>
              
              <ScrollView 
                ref={deptScrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60 }} // Generous padding so last item clears the gradient
              >
                {DEPARTMENTS.map((dept, i) => {
                  const isSelected = dept === department;
                  const isLast = i === DEPARTMENTS.length - 1;
                  return (
                    <View key={dept}>
                      <TouchableOpacity
                        onPress={() => closeDeptMenu(dept)}
                        className="py-[14px] px-[24px] flex-row items-center justify-between"
                        style={{ backgroundColor: isSelected ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : 'transparent' }}
                      >
                        <Text className={isSelected ? "text-ophest font-bold text-[16px]" : "text-text-primary font-medium text-[16px]"}>
                          {dept}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#0071e3" />
                        )}
                      </TouchableOpacity>
                      {!isLast && (
                        <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginHorizontal: 24 }} />
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Scroll Fade Indicator (Simulated Gradient using stacked absolute views to prevent sub-pixel rendering gaps) */}
              <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 50 }}>
                {Array.from({ length: 10 }).map((_, index) => {
                  const k = index + 1;
                  const alpha = k === 1 ? 0.15 : 1 / (11 - k);
                  return (
                    <View
                      key={index}
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 50 - index * 5,
                        backgroundColor: isDark
                          ? `rgba(29, 42, 53, ${alpha})`
                          : `rgba(255, 255, 255, ${alpha})`,
                      }}
                    />
                  );
                })}
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

export default function HomeScreen() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    const subSub = database.collections.get<Subscription>('subscriptions').query().observe().subscribe(setSubscriptions);
    const logsSub = database.collections.get<Log>('logs').query().observe().subscribe(setLogs);
    const itemsSub = database.collections.get<Item>('items').query().observe().subscribe(setItems);
    const groupsSub = database.collections.get<Group>('groups').query().observe().subscribe(setGroups);
    
    return () => {
      subSub.unsubscribe();
      logsSub.unsubscribe();
      itemsSub.unsubscribe();
      groupsSub.unsubscribe();
    };
  }, []);

  return (
    <RawHomeScreen 
      subscriptions={subscriptions}
      logs={logs}
      items={items}
      groups={groups}
    />
  );
}
