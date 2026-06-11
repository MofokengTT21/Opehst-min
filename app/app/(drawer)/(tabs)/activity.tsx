import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Platform,
  StatusBar,
  TextInput,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
  PanResponder,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation, runOnJS, useAnimatedScrollHandler, cancelAnimation } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useRouter, useSegments, useNavigation } from 'expo-router';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUS_DURATION = 5000; // 5 seconds per status

const FriesIcon = ({ size = 26, color = '#000' }: { size?: number, color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path stroke={color} strokeWidth="2" strokeLinecap="round" d="M4 6h16 M4 12h10 M4 18h14" />
  </Svg>
);

// Dummy data for notifications
const NOTIFICATIONS = [
  {
    id: '1',
    type: 'system',
    title: 'System Alert',
    message: 'Server maintenance scheduled for 02:00 AM. Expect partial downtime across hubs.',
    time: '2m ago',
    read: false,
  },
  {
    id: '2',
    type: 'warning',
    title: 'Boiler 3 Pressure Drop',
    message: 'SCADA detected a pressure drop of 15% below threshold. Artisan dispatched.',
    time: '15m ago',
    read: false,
  },
  {
    id: '3',
    type: 'mention',
    title: 'New Reply',
    message: 'Sarah mentioned you in "Shift Handover": Can you verify the end of shift checklist?',
    time: '1h ago',
    read: true,
  },
  {
    id: '4',
    type: 'update',
    title: 'Task Assigned',
    message: 'You have been assigned to "Weekly Safety Audit" by John Doe.',
    time: '2h ago',
    read: true,
  },
  {
    id: '5',
    type: 'system',
    title: 'App Update Available',
    message: 'Version 2.4 is now available with new CI Board features.',
    time: '1d ago',
    read: true,
  },
];

const FILTERS: { key: 'all' | 'unread' | 'mentions'; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'unread',   label: 'Unread' },
  { key: 'mentions', label: 'Mentions' },
];

// ─── Icon configs ────────────────────────────────────────────────
const ICON_CONFIGS: Record<string, { icon: any; color: string; gradientStart: string; gradientEnd: string }> = {
  system:  { icon: 'hardware-chip-outline', color: '#ef4444', gradientStart: '#7f1d1d', gradientEnd: '#1a0000' },
  warning: { icon: 'warning-outline',       color: '#eab308', gradientStart: '#713f12', gradientEnd: '#1a1000' },
  mention: { icon: 'chatbubble-outline',     color: '#880034', gradientStart: '#1e3a5f', gradientEnd: '#000e1a' },
  update:  { icon: 'clipboard-outline',      color: '#10b981', gradientStart: '#064e3b', gradientEnd: '#001a12' },
};

// ─── Status Viewer ───────────────────────────────────────────────
interface StatusViewerProps {
  statuses: typeof NOTIFICATIONS;
  onClose: () => void;
}

function StatusViewer({ statuses, onClose }: StatusViewerProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [visible, setVisible] = useState(true);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;

  const progressAnim = useSharedValue(0);

  const current = statuses[currentIndex];
  const cfg = current ? (ICON_CONFIGS[current.type] ?? ICON_CONFIGS.system) : ICON_CONFIGS.system;

  const onAnimationFinished = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev < statuses.length - 1) {
        progressAnim.value = 0;
        return prev + 1;
      } else {
        handleClose();
        return prev;
      }
    });
  }, [statuses.length, handleClose, progressAnim]);

  const startAnimation = useCallback((fromValue: number) => {
    cancelAnimation(progressAnim);
    progressAnim.value = fromValue;
    const remainingDuration = STATUS_DURATION * (1 - fromValue);
    progressAnim.value = withTiming(1, { duration: remainingDuration }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(onAnimationFinished)();
      }
    });
  }, [progressAnim, onAnimationFinished]);

  const pause = useCallback(() => {
    cancelAnimation(progressAnim);
    setIsPaused(true);
  }, [progressAnim]);

  const resume = useCallback(() => {
    setIsPaused(false);
    startAnimation(progressAnim.value);
  }, [startAnimation, progressAnim]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev < statuses.length - 1) {
        cancelAnimation(progressAnim);
        progressAnim.value = 0;
        return prev + 1;
      } else {
        handleClose();
        return prev;
      }
    });
  }, [statuses.length, handleClose, progressAnim]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev > 0) {
        cancelAnimation(progressAnim);
        progressAnim.value = 0;
        return prev - 1;
      }
      return prev;
    });
  }, [progressAnim]);

  const wasLongPressed = useRef(false);

  const handlePressIn = useCallback(() => {
    wasLongPressed.current = false;
    pause();
  }, [pause]);

  const handleLongPress = useCallback(() => {
    wasLongPressed.current = true;
  }, []);

  const handlePressLeft = useCallback(() => {
    if (wasLongPressed.current) {
      wasLongPressed.current = false;
      return;
    }
    goPrev();
  }, [goPrev]);

  const handlePressRight = useCallback(() => {
    if (wasLongPressed.current) {
      wasLongPressed.current = false;
      return;
    }
    goNext();
  }, [goNext]);

  // PanResponder to handle swipe-down-to-collapse gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return dy > 10 && Math.abs(dx) < Math.abs(dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          handleCloseRef.current();
        }
      },
    })
  ).current;

  useEffect(() => {
    progressAnim.value = 0;
    setIsPaused(false);
    startAnimation(0);

    return () => {
      cancelAnimation(progressAnim);
    };
  }, [currentIndex]);

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${interpolate(progressAnim.value, [0, 1], [0, 100], Extrapolation.CLAMP)}%` as any
    };
  });

  if (!current) return null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent transparent onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: '#000000' }} {...panResponder.panHandlers}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <View
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: cfg.gradientStart,
            opacity: 0.35,
          }}
        />

        {/* ── Tap zones for navigation (covers entire screen) ── */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
          <TouchableWithoutFeedback
            onPress={handlePressLeft}
            onPressIn={handlePressIn}
            onPressOut={resume}
            onLongPress={handleLongPress}
            delayLongPress={180}
          >
            <View style={{ flex: 0.28, height: '100%' }} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback
            onPress={handlePressRight}
            onPressIn={handlePressIn}
            onPressOut={resume}
            onLongPress={handleLongPress}
            delayLongPress={180}
          >
            <View style={{ flex: 0.72, height: '100%' }} />
          </TouchableWithoutFeedback>
        </View>

        {/* ── Top safe-area: progress bars + close ── */}
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12 }} pointerEvents="box-none">
          {/* Progress bars */}
          <View style={{ flexDirection: 'row', gap: 4, marginBottom: 14 }}>
            {statuses.map((_, i) => (
              <View
                key={i}
                style={{
                  flex: 1, height: 3, borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  overflow: 'hidden',
                }}
              >
                {i < currentIndex ? (
                  <View style={{ flex: 1, backgroundColor: '#ffffff' }} />
                ) : i === currentIndex ? (
                  <Animated.View
                    style={[{
                      height: '100%',
                      backgroundColor: '#ffffff',
                    }, progressStyle]}
                  />
                ) : null}
              </View>
            ))}
          </View>

          {/* Header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }} pointerEvents="box-none">
            <View style={{ width: 48, alignItems: 'flex-start' }} pointerEvents="box-none">
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }} pointerEvents="none">
              <View
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: cfg.color + '30',
                  borderWidth: 2, borderColor: cfg.color,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name={cfg.icon} size={16} color={cfg.color} />
              </View>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                {current.title}
              </Text>
            </View>

            <View style={{ width: 48 }} pointerEvents="none" />
          </View>

          <View style={{ alignItems: 'center', marginBottom: 4 }} pointerEvents="none">
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
              {current.time}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }} pointerEvents="none" />

        {/* ── Content card ── */}
        <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 28 }} pointerEvents="none">
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.10)',
              borderRadius: 28,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
              padding: 24,
            }}
          >
            <View
              style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: cfg.color + '22',
                borderWidth: 2, borderColor: cfg.color + '60',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name={cfg.icon} size={30} color={cfg.color} />
            </View>

            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginBottom: 10 }}>
              {current.title}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, lineHeight: 24 }}>
              {current.message}
            </Text>

            <View style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cfg.color }} />
              <Text style={{ color: cfg.color, fontSize: 13, fontWeight: '600' }}>Unread</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginLeft: 4 }}>{current.time}</Text>
            </View>
          </View>

          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginTop: 14 }}>
            {currentIndex + 1} of {statuses.length}  ·  Tap sides to navigate
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const StyleAbsolute = {
  position: 'absolute' as const,
  top: 0, left: 0, right: 0, bottom: 0,
};

// ─── Main Screen ─────────────────────────────────────────────────
export default function NotificationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'mentions'>('all');

  const segments = useSegments();
  const isFocused = segments[segments.length - 1] === 'activity';
  const unreadNotifs = NOTIFICATIONS.filter((n) => !n.read);
  
  // Track if the user has manually dismissed the viewer during this visit
  const [hasDismissed, setHasDismissed] = useState(false);

  // Reset the dismissal state whenever the user leaves the tab
  useEffect(() => {
    if (!isFocused) {
      setHasDismissed(false);
    }
  }, [isFocused]);

  // It shows immediately on the first focused frame if there are unreads and it hasn't been dismissed
  const showStatusViewer = isFocused && !hasDismissed && unreadNotifs.length > 0;

  // ── Paged horizontal ScrollView ref ────────────────────────────
  const pagerRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });
  const [tabLayouts, setTabLayouts] = useState<Array<{ x: number; width: number } | null>>(
    FILTERS.map(() => null)
  );
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

  const switchToFilter = (key: 'all' | 'unread' | 'mentions') => {
    const idx = FILTERS.findIndex(f => f.key === key);
    pagerRef.current?.scrollTo({ x: SCREEN_WIDTH * idx, animated: true });
    setActiveFilter(key);
  };

  const onPageChange = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    const filter = FILTERS[idx]?.key;
    if (filter) setActiveFilter(filter);
  };

  // Theme tokens
  const glassmorphicBg = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const iconColor      = isDark ? '#ffffff' : '#1a1718';
  const textColor      = isDark ? '#ffffff' : '#1a1718';
  const secondaryText  = isDark ? '#8899a6' : '#7a7577';
  const borderColor    = isDark ? '#253341' : '#e8e4e5';
  const cardBg         = isDark ? '#1d2a35' : '#ffffff';

  const getIconConfigLocal = (type: string) => {
    switch (type) {
      case 'system':  return { icon: 'hardware-chip-outline' as any, color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)' };
      case 'warning': return { icon: 'warning-outline' as any,       color: '#eab308', bg: isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.12)' };
      case 'mention': return { icon: 'chatbubble-outline' as any,    color: isDark ? '#880034' : '#780532', bg: isDark ? 'rgba(193,60,112,0.20)' : 'rgba(120,5,50,0.12)' };
      case 'update':  return { icon: 'clipboard-outline' as any,     color: '#10b981', bg: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.12)' };
      default:        return { icon: 'notifications-outline' as any, color: secondaryText, bg: glassmorphicBg };
    }
  };

  const getFilteredNotifs = (filter: 'all' | 'unread' | 'mentions') =>
    NOTIFICATIONS.filter((n) => {
      const matchesSearch =
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (filter === 'unread')   return !n.read;
      if (filter === 'mentions') return n.type === 'mention';
      return true;
    });

  const renderNotification = (notif: typeof NOTIFICATIONS[0], index: number, isLast: boolean) => {
    const config = getIconConfigLocal(notif.type);
    return (
      <View key={notif.id}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            padding: 16,
            backgroundColor: notif.read
              ? 'transparent'
              : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          }}
        >
          <View
            style={{
              width: 48, height: 48, borderRadius: 24,
              borderWidth: 2,
              borderColor: !notif.read ? (isDark ? '#880034' : '#780532') : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: config.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={config.icon} size={20} color={config.color} />
            </View>
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: textColor, flex: 1, marginRight: 8 }} numberOfLines={1}>
                {notif.title}
              </Text>
              <Text style={{ fontSize: 13, color: secondaryText }}>{notif.time}</Text>
            </View>
            <Text style={{ fontSize: 14.5, color: secondaryText, lineHeight: 20 }} numberOfLines={2}>
              {notif.message}
            </Text>
          </View>
        </TouchableOpacity>
        {!isLast && <View style={{ height: 0.5, backgroundColor: borderColor, marginLeft: 74 }} />}
      </View>
    );
  };

  const renderPage = (filter: 'all' | 'unread' | 'mentions') => {
    const notifs = getFilteredNotifs(filter);
    const recentNotifs  = notifs.slice(0, 3);
    const earlierNotifs = notifs.slice(3);

    return (
      <ScrollView
        key={filter}
        style={{ width: SCREEN_WIDTH }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 60, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {notifs.length === 0 ? (
          <View className="pt-20 items-center px-6">
            <Ionicons name="notifications-off-outline" size={52} color={secondaryText} />
            <Text className="text-text-secondary text-[15px] mt-3 text-center">
              No matching notifications
            </Text>
          </View>
        ) : (
          <>
            {recentNotifs.length > 0 && (
              <>
                <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 12, marginBottom: 8, letterSpacing: 0.5, color: secondaryText }}>
                  Recent
                </Text>
                <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: cardBg, marginBottom: 24 }}>
                  {recentNotifs.map((n, i) => renderNotification(n, i, i === recentNotifs.length - 1))}
                </View>
              </>
            )}
            {earlierNotifs.length > 0 && (
              <>
                <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 12, marginBottom: 8, letterSpacing: 0.5, color: secondaryText }}>
                  Earlier
                </Text>
                <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: cardBg }}>
                  {earlierNotifs.map((n, i) => renderNotification(n, i, i === earlierNotifs.length - 1))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-surface-background">
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ── Status Viewer ── */}
      {showStatusViewer && unreadNotifs.length > 0 && (
        <StatusViewer
          statuses={unreadNotifs}
          onClose={() => setHasDismissed(true)}
        />
      )}

      {/* ── Normal Notifications View ── */}
      <SafeAreaView edges={['top']} className="bg-surface-background">
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
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
            <Text style={{ fontSize: 20, fontWeight: '700', color: textColor, letterSpacing: -0.5 }}>
              Activity
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => unreadNotifs.length > 0 && setHasDismissed(false)}
          >
            <Ionicons name="ellipsis-horizontal" size={26} color={iconColor} />
          </TouchableOpacity>
        </View>

        {/* Unread status preview strip */}
        {unreadNotifs.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowStatusViewer(true)}
            style={{
              marginHorizontal: 16, marginBottom: 16,
              paddingVertical: 16, paddingHorizontal: 20,
              borderRadius: 24,
              backgroundColor: isDark ? 'rgba(193,60,112,0.15)' : 'rgba(120,5,50,0.08)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(193,60,112,0.35)' : 'rgba(120,5,50,0.20)',
              flexDirection: 'row', alignItems: 'center', gap: 16,
            }}
          >
            <View style={{ flexDirection: 'row' }}>
              {unreadNotifs.slice(0, 3).map((n, i) => {
                const cfg = ICON_CONFIGS[n.type] ?? ICON_CONFIGS.system;
                return (
                  <View
                    key={n.id}
                    style={{
                      width: 42, height: 42, borderRadius: 21,
                      backgroundColor: cfg.color + '25',
                      borderWidth: 2, borderColor: cfg.color,
                      alignItems: 'center', justifyContent: 'center',
                      marginLeft: i === 0 ? 0 : -12,
                    }}
                  >
                    <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                  </View>
                );
              })}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: isDark ? '#880034' : '#780532', fontSize: 16, fontWeight: '600' }}>
                {unreadNotifs.length} unread {unreadNotifs.length === 1 ? 'alert' : 'alerts'}
              </Text>
              <Text style={{ color: secondaryText, fontSize: 14.5, marginTop: 2 }}>Tap to view</Text>
            </View>
            <Ionicons name="play-circle" size={34} color={isDark ? '#880034' : '#780532'} />
          </TouchableOpacity>
        )}

        {/* Search Bar */}
        <View style={{ backgroundColor: glassmorphicBg, height: 48, borderRadius: 24 }} className="mx-3 mb-3 flex-row items-center px-4">
          <Ionicons name="search-outline" size={20} color={isDark ? '#8899a6' : '#7a7577'} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search notifications..."
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

        {/* Filter Tabs — indicator tracks live with swipe */}
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, position: 'relative' }}>
            {FILTERS.map((f, i) => {
              const isActive = activeFilter === f.key;
              const filterTextColor = isActive
                ? isDark ? '#ffffff' : '#1a1718'
                : isDark ? '#8899a6' : '#7a7577';
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
                  <Text style={{ color: filterTextColor }} className="text-[14.5px] font-semibold">
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
                  backgroundColor: isDark ? '#880034' : '#780532',
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
    </View>
  );
}
