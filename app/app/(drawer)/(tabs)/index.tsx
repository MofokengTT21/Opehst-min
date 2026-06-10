import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
import { useState, useRef, useEffect, useCallback, useMemo, ComponentProps } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { database } from '../../../database';
import { fetchPosts } from '../../../services/feed';
import { syncDatabase } from '../../../services/sync';
import { useHubContext } from '../../../contexts/HubContext';
import { useAuth } from '../../../services/authContext';
import { of as of$ } from 'rxjs';
import withObservables from '@nozbe/with-observables';
import Post from '../../../database/models/Post';
import Channel from '../../../database/models/Channel';
import Hub from '../../../database/models/Hub';
import Svg, { Path, Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Avatar configs ──────────────────────────────────────────────
const AVATAR_CONFIGS: Record<string, { url: string }> = {
  asset: { url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=150&h=150&fit=crop' },
  location: { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop' },
  process: { url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=150&h=150&fit=crop' },
  role: { url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop' },
  group: { url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&h=150&fit=crop' },
  default: { url: 'https://images.unsplash.com/photo-1504307651254-35680f356f12?w=150&h=150&fit=crop' },
};

// ─── Filter tags ────────────────────────────────────────────────
const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'favourites', label: 'Favourites' },
];

import { MessageSquarePlus } from 'lucide-react-native';

const FriesIcon = ({ size = 26, color = '#000' }: { size?: number, color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path stroke={color} strokeWidth="2" strokeLinecap="round" d="M4 6h16 M4 12h10 M4 18h14" />
  </Svg>
);

const YoutubePlusIcon = ({ size = 26, color = '#ffffff', strokeWidth = 1.75 }: { size?: number, color?: string, strokeWidth?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="4" />
    <Path d="M9 12h6 M12 9v6" />
  </Svg>
);

const formatHomeTime = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';

  // check if same day
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  // older
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

const ChatItemInner = ({ chat, author, index, isLast, isDark, router }: any) => {
  const lastSender = author ? author.name.split(' ')[0] : '';

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/channel/${chat.id}`)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}
      >
        <View style={{ position: 'relative', marginRight: 12 }}>
          <Image
            source={{ uri: chat.avatarConfig.url }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
          />
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{ 
                fontSize: 16, 
                fontWeight: chat.unreadCount > 0 ? '800' : '600', 
                color: isDark ? '#ffffff' : '#1a1718', 
                flex: 1, 
                marginRight: 8 
              }}
            >
              {chat.name}
            </Text>
            <Text style={{ 
                fontSize: 12, 
                fontWeight: chat.unreadCount > 0 ? '700' : '400',
                color: chat.unreadCount > 0 ? (isDark ? '#ffffff' : '#1a1718') : (isDark ? '#8899a6' : '#7a7577'), 
                flexShrink: 0 
              }}>
              {chat.time}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <Text
              numberOfLines={1}
              style={{ 
                fontSize: 14.5, 
                fontWeight: chat.unreadCount > 0 ? '700' : '400',
                color: chat.unreadCount > 0 ? (isDark ? '#ffffff' : '#1a1718') : (isDark ? '#8899a6' : '#7a7577'), 
                flex: 1, 
                paddingRight: 8 
              }}
            >
              {chat.unreadCount > 1 
                ? `${chat.unreadCount} new posts` 
                : `${lastSender ? `${lastSender}: ` : ''}${chat.lastMessage}`}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      {!isLast && (
        <View style={{ height: 0.5, backgroundColor: isDark ? '#253341' : '#e8e4e5', marginLeft: 76 }} />
      )}
    </View>
  );
};

const ChatItem = withObservables(['chat'], ({ chat }: any) => ({
  chat: of$(chat),
  author: chat.latestPost ? chat.latestPost.author.observe() : of$(null),
}))(ChatItemInner);

const RawHomeScreen = ({
  posts, channels, hubs
}: {
  posts: any[];
  channels: any[];
  hubs: any[];
}) => {
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'favourites'>('all');

  const { activeHubId: hub, setActiveHubId: setHub } = useHubContext();
  const hubOptions = [{ id: 'all', name: 'All Hubs' }, ...hubs];

  const [deptOpen, setDeptOpen] = useState(false);
  const deptMenuAnim = useSharedValue(0);
  const deptScrollRef = useRef<ScrollView>(null);
  const [iconSwapped, setIconSwapped] = useState(false);
  const [pillWidth, setPillWidth] = useState(160);
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { dbUser } = useAuth();
  
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      if (!dbUser) return;
      
      let isMounted = true;
      const loadUnreadCounts = async () => {
        const counts: Record<string, number> = {};
        
        for (const channel of channels) {
          const lastVisitedStr = await database.adapter.getLocal(`channel_visited_${dbUser.id}_${channel.id}`);
          let lastVisitedAt = 0;
          if (lastVisitedStr) {
            lastVisitedAt = parseInt(lastVisitedStr, 10);
          } else {
            const installTimeStr = await database.adapter.getLocal(`install_time_${dbUser.id}`);
            lastVisitedAt = installTimeStr ? parseInt(installTimeStr, 10) : 0;
          }
          
          let count = 0;
          const channelPosts = posts.filter(p => p.channelId === channel.id);
          for (const post of channelPosts) {
            if (new Date(post.createdAt).getTime() > lastVisitedAt && post.authorId !== dbUser.id) {
              count++;
            }
          }
          counts[channel.id] = count;
        }
        
        if (isMounted) {
          setUnreadCounts(counts);
        }
      };
      
      loadUnreadCounts();
      return () => { isMounted = false; };
    }, [posts, channels, dbUser])
  );
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    // syncDatabase() uses WatermelonDB's native synchronize() protocol:
    // true delta sync, native-layer writes, proper deletion handling.
    await Promise.all([syncDatabase(), fetchPosts()]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  const openDeptMenu = () => {
    setDeptOpen(true);
    requestAnimationFrame(() => {
      deptMenuAnim.value = withSpring(1, { stiffness: 250, damping: 30, mass: 1, overshootClamping: true });
    });
  };

  const onDeptMenuClosed = useCallback((newHubId?: string) => {
    setDeptOpen(false);
    if (newHubId) setHub(newHubId);
  }, []);

  const closeDeptMenu = (newHubId?: string) => {
    deptMenuAnim.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(onDeptMenuClosed)(newHubId);
      }
    });
  };

  // ── Dynamic Island Animation ──────────────────────────────────
  // Target states: 'All Hubs' -> Logo (0), Specific Hub -> Text Pill (1)
  // Initial state should be the opposite so it animates TO the target state after transition
  const dynamicIslandAnim = useSharedValue(hub === 'all' ? 1 : 0);
  const deptRef = useRef(hub);
  deptRef.current = hub;
  const lastHub = useRef(hub);

  const triggerDynamicIsland = (toValue: number, delayMs: number = 500) => {
    setTimeout(() => {
      dynamicIslandAnim.value = withSpring(toValue, { stiffness: 250, damping: 30, mass: 1, overshootClamping: true });
    }, delayMs);
  };

  useFocusEffect(
    useCallback(() => {
      if (deptRef.current === 'all') {
        dynamicIslandAnim.value = 1;
        triggerDynamicIsland(0, 850);
      } else {
        dynamicIslandAnim.value = 0;
        triggerDynamicIsland(1, 850);
      }
    }, [])
  );

  useEffect(() => {
    if (hub === lastHub.current) return;

    if (hub === 'all') {
      dynamicIslandAnim.value = 1;
      triggerDynamicIsland(0, 1500); // Slowed down so user can read 'All Hubs' before it collapses
    } else {
      dynamicIslandAnim.value = 1;
    }
    lastHub.current = hub;
  }, [hub]);

  useEffect(() => {
    if (deptOpen) {
      setTimeout(() => {
        const idx = hubOptions.findIndex(h => h.id === hub);
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
    FILTER_TABS.map(() => null)
  );

  const switchToFilter = (key: 'all' | 'unread' | 'favourites') => {
    const idx = FILTER_TABS.findIndex(f => f.key === key);
    pagerRef.current?.scrollTo({ x: SCREEN_WIDTH * idx, animated: true });
    setActiveFilter(key);
  };

  const onPageChange = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    const filter = FILTER_TABS[idx]?.key as 'all' | 'unread' | 'favourites';
    if (filter) setActiveFilter(filter);
  };

  const allTabsMeasured = tabLayouts.every(Boolean);

  const scrollYRefs = useRef<Record<string, number>>({ all: 0, unread: 0, favourites: 0 });
  const lastSwitchRef = useRef(0);

  const switchHubDown = () => {
    const idx = hubOptions.findIndex(h => h.id === hub);
    const nextHubId = hubOptions[(idx + 1) % hubOptions.length].id;
    setHub(nextHubId);
    setIconSwapped(true);
    setTimeout(() => setIconSwapped(false), 600);
  };

  // Only show channels that belong to the selected Hub (or all channels if 'all' is selected)
  const filteredChannelsByHub = useMemo(() => {
    return hub === 'all'
      ? channels
      : channels.filter(c => c.hubId === hub);
  }, [hub, channels]);

  const chatData = useMemo(() => {
    return filteredChannelsByHub.map((channel) => {
      const channelPosts = posts.filter(p => p.channelId === channel.id).sort((a, b) => b.createdAt - a.createdAt);
      const latestPost = channelPosts[0];

      return {
        id: channel.id,
        channel,
        latestPost,
        name: channel.name || 'Unknown',
        avatarConfig: AVATAR_CONFIGS[channel.category || 'group'] || AVATAR_CONFIGS.group,
        lastMessage: latestPost ? (latestPost.subject || latestPost.content) : 'No updates yet.',
        time: formatHomeTime(latestPost?.createdAt),
        isScadaAlert: false,
        isOnline: Math.random() > 0.4,
        unreadCount: unreadCounts[channel.id] || 0,
        isFavourite: false,
      };
    });
  }, [filteredChannelsByHub, posts, unreadCounts]);

  const getFilteredChats = useCallback((filter: 'all' | 'unread' | 'favourites') => {
    return chatData.filter((chat) => {
      const matchesSearch =
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (filter === 'unread') return chat.unreadCount > 0;
      if (filter === 'favourites') return chat.isFavourite;
      return true;
    });
  }, [chatData, searchQuery]);

  const renderPage = (filter: 'all' | 'unread' | 'favourites') => {
    const chats = getFilteredChats(filter);

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
              onRefresh={switchHubDown}
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
              {chats.length > 0 && (
                <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: isDark ? '#1d2a35' : '#ffffff' }}>
                  {chats.map((chat, index) => <ChatItem key={chat.id} chat={chat} index={index} isLast={index === chats.length - 1} isDark={isDark} router={router} />)}
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
              <TouchableWithoutFeedback onPress={openDeptMenu}>
                <Animated.View style={[{
                  position: 'absolute',
                  height: 48,
                  backgroundColor: glassmorphicBg,
                  borderRadius: 24,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                }, dynamicIslandStyle]}>
                  <View
                    onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}
                    style={{ height: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Animated.View style={[{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }, dynamicIslandTextStyle]}>
                      <Text style={{ fontSize: 17, fontWeight: '600', letterSpacing: -0.5, color: isDark ? '#ffffff' : '#1a1718' }}>
                        {hub === 'all' ? 'All Hubs' : hubOptions.find(h => h.id === hub)?.name}
                      </Text>
                      <Ionicons
                        name={iconSwapped ? 'swap-horizontal-outline' : 'chevron-down-outline'}
                        size={17}
                        color={iconColor}
                      />
                    </Animated.View>
                  </View>
                </Animated.View>
              </TouchableWithoutFeedback>

              {/* Logo */}
              <Animated.View
                pointerEvents={hub === 'all' ? 'auto' : 'none'}
                style={[{
                  position: 'absolute',
                }, logoStyle]}
              >
                <TouchableOpacity
                  activeOpacity={0.65}
                  onPress={openDeptMenu}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Image source={logoSource} style={{ width: 130, height: 32, resizeMode: 'contain' }} />
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
            onPress={() => console.log('Camera pressed')}
          >
            <Ionicons name="camera-outline" size={26} color={iconColor} />
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
            {FILTER_TABS.map((f, i) => {
              const isActive = activeFilter === f.key;
              const textColor = isActive ? (isDark ? '#ffffff' : '#1a1718') : (isDark ? '#8899a6' : '#7a7577');
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => switchToFilter(f.key as any)}
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
                  backgroundColor: isDark ? '#c13c70' : '#780532',
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
        {FILTER_TABS.map((f) => renderPage(f.key as any))}
      </Animated.ScrollView>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/directory')}
        className="absolute right-[16px] items-center justify-center z-50 shadow-lg shadow-black/20"
        style={{
          bottom: Platform.OS === 'ios' ? 108 : 88,
          backgroundColor: isDark ? '#c13c70' : '#780532',
          width: 60,
          height: 60,
          borderRadius: 20
        }}
      >
        <YoutubePlusIcon size={28} color="#ffffff" />
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
                Select Hub
              </Text>

              <ScrollView
                ref={deptScrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60 }} // Generous padding so last item clears the gradient
              >
                {hubOptions.map((hObj, i) => {
                  const isSelected = hObj.id === hub;
                  const isLast = i === hubOptions.length - 1;
                  return (
                    <View key={hObj.id}>
                      <TouchableOpacity
                        onPress={() => closeDeptMenu(hObj.id)}
                        className="py-[14px] px-[24px] flex-row items-center justify-between"
                        style={{ backgroundColor: isSelected ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : 'transparent' }}
                      >
                        <Text className={isSelected ? "text-ophest font-bold text-[16px]" : "text-text-primary font-medium text-[16px]"}>
                          {hObj.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={isDark ? '#c13c70' : '#780532'} />
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



const HomeScreenBase = ({ posts, channels, hubs }: { posts: Post[], channels: Channel[], hubs: Hub[] }) => {
  return (
    <RawHomeScreen
      posts={posts}
      channels={channels}
      hubs={hubs}
    />
  );
};

export default withObservables([], () => ({
  posts: database.collections.get<Post>('posts').query().observe(),
  channels: database.collections.get<Channel>('channels').query().observe(),
  hubs: database.collections.get<Hub>('hubs').query().observe(),
}))(HomeScreenBase);
