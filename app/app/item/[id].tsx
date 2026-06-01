import {
  View, Text, ScrollView, TouchableOpacity,
  Platform, useColorScheme, StatusBar, TextInput, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent, Keyboard,
  Alert, Image, BackHandler, PanResponder, LayoutAnimation
} from 'react-native';

import Animated, { useAnimatedStyle, withTiming, useSharedValue, interpolate, Extrapolation, withSpring } from 'react-native-reanimated';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState, useCallback, useEffect, ComponentProps } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, EvilIcons } from '@expo/vector-icons';
import { useStore } from '../../store/useStore';
import { Post } from '@opehst/shared';

// ─── Types ────────────────────────────────────────────────────────────────────
type TagOption = {
  label: string;
  iconName: ComponentProps<typeof Ionicons>['name'];
  semantic: 'breakdown' | 'jobcard' | 'kaizen' | 'audit';
};

const TAG_OPTIONS: TagOption[] = [
  { label: 'Breakdown', iconName: 'build-outline', semantic: 'breakdown' },
  { label: 'Handover',  iconName: 'briefcase-outline', semantic: 'jobcard' },
  { label: 'Hazard',    iconName: 'warning-outline', semantic: 'kaizen' },
  { label: '5S Check',  iconName: 'checkmark-circle-outline', semantic: 'audit' },
];

const SEMANTIC_COLORS: Record<string, string> = {
  breakdown: '#ef4444',
  jobcard:   '#3b82f6',
  audit:     '#22c55e',
  kaizen:    '#f59e0b',
};

// ─── Helper Utilities ─────────────────────────────────────────────────────────
function formatTimeAgo(dateString?: string) {
  if (!dateString) return '';
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function generateHandle(name: string) {
  return `@${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
}

const AVATAR_CONFIGS: Record<string, { url: string }> = {
  asset:    { url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=150&h=150&fit=crop' },
  location: { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop' },
  process:  { url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=150&h=150&fit=crop' },
  role:     { url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop' },
  group:    { url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&h=150&fit=crop' },
  default:  { url: 'https://images.unsplash.com/photo-1504307651254-35680f356f12?w=150&h=150&fit=crop' },
};

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ log }: { log: Post }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isAlert = log.is_scada_alert;

  let tagOpt = null;
  if (log.tag) {
    tagOpt = TAG_OPTIONS.find(o => log.tag!.includes(o.label)) || null;
  }

  // --- Left Icon Area (Tags/Alerts) ---
  const actionColor = isDark ? '#a1a1aa' : '#536471';
  
  let leftIconName: ComponentProps<typeof Ionicons>['name'] = 'warning-outline';
  let leftIconColor = '#f59e0b';
  let leftBgStyle: any = { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)' };
  let caption = 'Posted an update';

  if (isAlert) {
    leftIconName = 'warning-outline';
    leftIconColor = '#f59e0b';
    leftBgStyle = { backgroundColor: 'rgba(245, 158, 11, 0.10)' };
  } else if (tagOpt) {
    leftIconName = tagOpt.iconName;
    leftIconColor = SEMANTIC_COLORS[tagOpt.semantic] || leftIconColor;
    leftBgStyle = { backgroundColor: `${leftIconColor}20` };
  }

  if (isAlert) {
    caption = 'Automated SCADA Alert';
  } else if (tagOpt) {
    caption = `Reported a ${tagOpt.label.toLowerCase()}`;
  } else if (log.subject) {
    caption = 'Logged an activity';
  }

  const userAvatarBg = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)';
  const userAvatarIconColor = isDark ? '#ffffff' : '#2e2a2b';
  const userAvatarIconName = isAlert ? 'hardware-chip-outline' : 'person-outline';

  const replies  = Math.floor(Math.random() * 5);
  const retweets = Math.floor(Math.random() * 3);
  const likes    = Math.floor(Math.random() * 20);
  const views    = Math.floor(Math.random() * 500) + 50;

  return (
    <View 
      className="flex-row px-4 py-4 rounded-[28px] mb-3 mx-4"
      style={{ backgroundColor: isDark ? '#1d2a35' : '#ffffff' }}
    >
      {/* Left Column: Tag/Alert Icon (No background, increased size & stroke) */}
      <View className="mr-3 items-center pt-1.5 w-[36px] h-[36px] justify-center">
        <Ionicons name={leftIconName} size={28} color={leftIconColor} />
      </View>

      <View className="flex-1">
        {/* Header: User Avatar (Large) next to name, and caption under name */}
        <View className="flex-row mb-1">
          {isAlert ? (
            <View 
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
              className="w-[44px] h-[44px] rounded-full mr-2.5 items-center justify-center"
            >
              <Ionicons name="hardware-chip-outline" size={24} color="#ef4444" />
            </View>
          ) : (
            <Image
              source={{ uri: `https://i.pravatar.cc/150?u=${encodeURIComponent(log.author_name)}` }}
              className="w-[44px] h-[44px] rounded-full mr-2.5 bg-surface-card"
            />
          )}
          <View className="flex-1 justify-center">
             <View className="flex-row items-center">
               <Text className="text-[15px] font-bold text-text-primary" numberOfLines={1}>{log.author_name}</Text>
               {isAlert && <Ionicons name="checkmark-circle" size={14} color="#1d9bf0" style={{ marginLeft: 4 }} />}
               <Text className="text-[14px] text-text-secondary ml-1.5 flex-shrink-0">· {formatTimeAgo(log.created_at)}</Text>
             </View>
             <Text className="text-[14px] text-text-secondary mt-0.5" numberOfLines={1}>{caption}</Text>
          </View>
          <TouchableOpacity className="p-1 pl-2">
            <Ionicons name="ellipsis-horizontal" size={16} color={isDark ? '#8899a6' : '#7a7577'} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="mt-1">
          {log.subject ? (
            <Text className="text-[15px] font-bold text-text-primary mb-3">{log.subject}</Text>
          ) : null}
          <Text className="text-[15px] text-text-primary leading-5">{log.content}</Text>
        </View>

        {/* Actions */}
        <View className="flex-row justify-between mt-3 mr-5">
          <TouchableOpacity className="flex-row items-center">
            <EvilIcons name="comment" size={22} color={actionColor} />
            {replies > 0 && <Text className="text-[13px] text-text-secondary ml-0.5">{replies}</Text>}
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center">
            <EvilIcons name="retweet" size={26} color={actionColor} />
            {retweets > 0 && <Text className="text-[13px] text-text-secondary ml-0.5">{retweets}</Text>}
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center">
            <EvilIcons name="heart" size={24} color={actionColor} />
            {likes > 0 && <Text className="text-[13px] text-text-secondary ml-0.5">{likes}</Text>}
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center">
            <Ionicons name="stats-chart" size={14} color={actionColor} style={{ marginRight: 4 }} />
            <Text className="text-[13px] text-text-secondary">{views}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center">
            <EvilIcons name="share-apple" size={24} color={actionColor} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Item Wall Screen ─────────────────────────────────────────────────────────
export default function ItemWallScreen() {
  const { id }     = useLocalSearchParams();
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const targetId   = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';

  const { posts, items, groups, addPost } = useStore();
  const scrollViewRef  = useRef<ScrollView>(null);
  const inputRef       = useRef<TextInput>(null);
  const isAtBottomRef  = useRef(true);

  // ── Compose state ──────────────────────────────────────────────────────────
  const [messageText, setMessageText]  = useState('');
  const [subjectText, setSubjectText]  = useState('');
  const [selectedTag, setSelectedTag]  = useState<TagOption | null>(null);
  
  const [keyboardVisible,  setKeyboardVisible]  = useState(false);
  const [composerActive, setComposerActive] = useState(false);
  const [tagsVisible, setTagsVisible] = useState(false);

  const hasDraft = messageText.trim().length > 0 || subjectText.trim().length > 0;
  const isComposerExpanded = composerActive || tagsVisible;

  // The wrapper has 16px horizontal padding on each side (32px).
  // The left column (avatar) is 44px + 12px margin = 56px.
  // The flex: 1 right column takes the rest: screenWidth - 32 - 56 = screenWidth - 88.
  const activeComposerPageWidth = screenWidth - 88;
  const tagPillWidth = Math.max(76, (activeComposerPageWidth - 20) / 3);

  // Sync state refs to prevent stale closures in PanResponder
  const keyboardVisibleRef = useRef(keyboardVisible);
  const tagsVisibleRef = useRef(tagsVisible);
  const composerActiveRef = useRef(composerActive);

  useEffect(() => {
    keyboardVisibleRef.current = keyboardVisible;
  }, [keyboardVisible]);
  useEffect(() => {
    tagsVisibleRef.current = tagsVisible;
  }, [tagsVisible]);
  useEffect(() => {
    composerActiveRef.current = composerActive;
  }, [composerActive]);

  const collapseComposer = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 380,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    Keyboard.dismiss();
    setTagsVisible(false);
    setComposerActive(false);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only trigger if moving downwards significantly
        return gestureState.dy > 10 && Math.abs(gestureState.dx) < gestureState.dy;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 40) {
          collapseComposer();
        }
      },
    })
  ).current;

  // ── Data ───────────────────────────────────────────────────────────────────
  const item  = items.find((i) => i.id === targetId) || null;
  const group = groups.find((g) => g.id === targetId) || null;
  const targetType = item ? 'item' : 'group';

  const logs = posts
    .filter((p) => p.target_id === targetId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const name = item?.name ?? group?.name ?? 'Unknown';

  let avatarConfig = AVATAR_CONFIGS.default;
  if (item) {
    // @ts-ignore
    avatarConfig = AVATAR_CONFIGS[item.category] ?? AVATAR_CONFIGS.default;
  } else if (group) {
    avatarConfig = AVATAR_CONFIGS.group;
  }

  // ── Keyboard listeners ────────────────────────────────────────────────────
  const composerCarouselAnim = useSharedValue(0);

  useEffect(() => {
    composerCarouselAnim.value = withSpring(tagsVisible ? 1 : 0, {
      stiffness: 250,
      damping: 30,
      mass: 1,
      overshootClamping: true,
    });
  }, [tagsVisible, composerCarouselAnim]);

  // The input page never animates opacity/scale, it just slides horizontally
  const summaryPageStyle = useAnimatedStyle(() => {
    return {
      zIndex: tagsVisible ? 0 : 1,
    };
  });

  const carouselWrapperStyle = useAnimatedStyle(() => {
    return {
      flexDirection: 'row',
      width: isComposerExpanded ? '200%' : '100%',
      transform: [{
        translateX: isComposerExpanded 
          ? interpolate(composerCarouselAnim.value, [0, 1], [0, -activeComposerPageWidth]) 
          : 0
      }]
    };
  });

  const tagsPageStyle = useAnimatedStyle(() => {
    const progress = composerCarouselAnim.value;
    return {
      opacity: interpolate(progress, [0, 0.5, 1], [0, 0, 1], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(progress, [0, 1], [1.08, 1], Extrapolation.CLAMP) },
      ],
      zIndex: tagsVisible ? 1 : 0,
    };
  });

  const actionButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - composerCarouselAnim.value * 0.03 }],
  }));

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      if (isAtBottomRef.current) {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);

      // Blur the input to reset its native state, so tapping it again fires onFocus
      inputRef.current?.blur();

      setComposerActive((prev) => {
        if (prev) LayoutAnimation.configureNext({
          duration: 380,
          create: { type: 'easeInEaseOut', property: 'opacity' },
          update: { type: 'easeInEaseOut' },
          delete: { type: 'easeInEaseOut', property: 'opacity' },
        });
        return false;
      });
      setTagsVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);


  // Intercept hardware back button for composer-local state before navigation.
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tagsVisible) {
        setTagsVisible(false);
        return true;
      }
      if (keyboardVisible) {
        Keyboard.dismiss();
        return true;
      }
      if (composerActive) {
        setComposerActive(false);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [composerActive, keyboardVisible, tagsVisible]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const content = messageText.trim();
    const subject = subjectText.trim();
    if (!content && !subject) return;

    addPost({
      id:           Math.random().toString(36).substr(2, 9),
      target_id:    targetId,
      target_type:  targetType,
      author_name:  'Me',
      subject:      subject,
      content:      content || subject,
      tag:          selectedTag ? selectedTag.label : undefined,
      is_scada_alert: false,
      created_at:   new Date().toISOString(),
    });

    setMessageText('');
    setSubjectText('');
    setSelectedTag(null);
    LayoutAnimation.configureNext({
      duration: 380,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    setComposerActive(false);
    setTagsVisible(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messageText, subjectText, selectedTag, targetId, targetType, addPost]);


  const handlePrimaryComposerAction = useCallback(() => {
    if (!tagsVisible) {
      setTagsVisible(true);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
      return;
    }
    handleSend();
  }, [tagsVisible, handleSend]);

  const handleComposerInputFocus = useCallback(() => {
    // Only used by the subject input inside the expanded tray —
    // just make sure the visible state is correct.
    setComposerActive(true);
    setKeyboardVisible(true);
  }, []);

  const handleOpenCamera = useCallback(() => {
    Alert.alert('Coming Soon', 'Camera capture will be added here.');
  }, []);

  const handleAttachItem = useCallback(() => {
    Alert.alert('Coming Soon', 'Item attachments will be added here.');
  }, []);

  const handleStartRecording = useCallback(() => {
    Alert.alert('Coming Soon', 'Voice recording will be added here.');
  }, []);

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const glassmorphicBg  = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const iconColor       = isDark ? '#ffffff' : '#1a1718';
  const barBg           = isDark ? '#15202b' : '#ffffff';
  const pillBg          = isDark ? 'rgba(255,255,255,0.08)' : '#f2f2f7';
  const borderColor     = isDark ? '#253341' : '#e8e4e5';
  const placeholderColor = isDark ? '#8899a6' : '#7a7577';
  const textColor       = isDark ? '#ffffff' : '#1a1718';
  const bottomPad = Platform.OS === 'ios' ? Math.max(insets.bottom, 4) : 4;

  let composerCaption = 'Drafting an update';
  if (selectedTag) {
    composerCaption = `Reporting a ${selectedTag.label.toLowerCase()}`;
  } else if (subjectText.trim().length > 0) {
    composerCaption = 'Logging an activity';
  }

  // You can only send after collapsing keyboard and added a text
  const canSend = hasDraft && !keyboardVisible;
  const primaryActionDisabled = tagsVisible ? !canSend : !hasDraft;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#15202b' : '#f2f2f7' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: isDark ? '#15202b' : '#f2f2f7' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => {
              if (tagsVisible) {
                setTagsVisible(false);
              } else if (composerActive) {
                setComposerActive(false);
              } else {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }
            }}
          >
            <Ionicons name="arrow-back-outline" size={26} color={iconColor} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image 
                source={{ uri: avatarConfig.url }}
                style={{ width: 44, height: 44, borderRadius: 22 }}
              />
              <View>
                <Text style={{ fontSize: 17, fontWeight: '600', color: textColor, letterSpacing: -0.3 }} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: placeholderColor, letterSpacing: 0.5 }}>
                  {logs.length} POSTS
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="ellipsis-horizontal" size={26} color={iconColor} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView 
        style={{ flex: 1, zIndex: 2 }}
        behavior="padding"
      >
        {/* Feed & Composer Layout transition wrapper */}
        <Animated.View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              // User is at the bottom if within 50px of the end
              isAtBottomRef.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
            }}
            onContentSizeChange={() => {
              if (isAtBottomRef.current) {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }
            }}
          >
            {logs.length === 0 ? (
              <View style={{ paddingTop: 96, alignItems: 'center', paddingHorizontal: 32 }}>
                <Ionicons name="reader-outline" size={52} color={placeholderColor} />
                <Text style={{ color: placeholderColor, fontSize: 15, textAlign: 'center', marginTop: 12 }}>
                  No logs yet — be the first to post
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                {logs.map((log) => (
                  <PostCard 
                    key={log.id} 
                    log={log} 
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </Animated.View>

        {/* Composer */}
        <Animated.View
          style={{
            borderTopWidth: 0.5,
            borderColor: borderColor,
            backgroundColor: barBg,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: bottomPad + 8,
            elevation: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: isDark ? 0.4 : 0.1,
            shadowRadius: 16,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderLeftWidth: 0.5,
            borderRightWidth: 0.5,
          }}
        >
          {/* Grab handle/Drag Area */}
          {isComposerExpanded && (
            <View 
              {...panResponder.panHandlers}
              style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 8, marginTop: -6, backgroundColor: 'transparent' }}
            >
              <View style={{ width: 36, height: 5, borderRadius: 2.5, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }} />
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: isComposerExpanded ? 'flex-start' : 'center' }}>
            {/* Avatar Column */}
            <View style={{ marginRight: isComposerExpanded ? 12 : 10, paddingTop: isComposerExpanded ? 2 : 0, alignItems: 'center' }}>
              {isComposerExpanded && tagsVisible ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setTagsVisible(false)}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: pillBg, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="chevron-back" size={20} color={iconColor} />
                </TouchableOpacity>
              ) : (
                <Image
                  source={{ uri: 'https://i.pravatar.cc/150?u=Me' }}
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                />
              )}
            </View>

            {/* Main Content Column */}
            <View style={{ flex: 1 }}>
              {/* Header */}
              {isComposerExpanded && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: 'bold', color: textColor }}>Me</Text>
                      <Text style={{ fontSize: 14, color: placeholderColor, marginLeft: 6 }}>· now</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: placeholderColor, marginTop: 2 }}>{composerCaption}</Text>
                  </View>
                </View>
              )}

              {/* Carousel Container */}
              <View style={{ overflow: 'hidden', minHeight: isComposerExpanded ? 120 : undefined, position: 'relative' }}>
                <Animated.View style={carouselWrapperStyle}>
                  {/* PAGE 1: Text Inputs */}
                  <View style={{ width: isComposerExpanded ? '50%' : '100%' }}>
                    <View style={{ flexDirection: isComposerExpanded ? 'column' : 'row', alignItems: isComposerExpanded ? 'stretch' : 'center' }}>
                      {isComposerExpanded && (
                        <TextInput
                          style={{
                            backgroundColor: pillBg,
                            borderRadius: 18,
                            paddingHorizontal: 16,
                            fontSize: 15,
                            fontWeight: 'bold',
                            color: textColor,
                            paddingVertical: 9,
                            marginBottom: 8,
                            borderWidth: 0.5,
                            borderColor: borderColor,
                          }}
                          value={subjectText}
                          onChangeText={setSubjectText}
                          onFocus={handleComposerInputFocus}
                          onSubmitEditing={() => inputRef.current?.focus()}
                          placeholder="Add a quick summary..."
                          placeholderTextColor={placeholderColor}
                          maxLength={80}
                          returnKeyType="next"
                          blurOnSubmit={false}
                        />
                      )}

                      <TextInput
                        ref={inputRef}
                        style={isComposerExpanded ? {
                          backgroundColor: pillBg,
                          borderRadius: 18,
                          paddingHorizontal: 14,
                          fontSize: 15,
                          color: textColor,
                          minHeight: 72,
                          maxHeight: 140,
                          paddingTop: 10,
                          paddingBottom: 10,
                          lineHeight: 20,
                          borderWidth: 0.5,
                          borderColor: borderColor,
                          textAlignVertical: 'top',
                        } : {
                          flex: 1,
                          height: 46,
                          borderRadius: 23,
                          backgroundColor: pillBg,
                          borderWidth: 0.5,
                          borderColor: borderColor,
                          paddingHorizontal: 14,
                          fontSize: 15,
                          color: textColor,
                        }}
                        value={messageText}
                        onChangeText={setMessageText}
                        onContentSizeChange={() => {
                          if (isAtBottomRef.current) {
                            scrollViewRef.current?.scrollToEnd({ animated: true });
                          }
                        }}
                        onFocus={() => {
                          if (!isComposerExpanded) {
                            LayoutAnimation.configureNext({
                              duration: 380,
                              create: { type: 'easeInEaseOut', property: 'opacity' },
                              update: { type: 'easeInEaseOut' },
                              delete: { type: 'easeInEaseOut', property: 'opacity' },
                            });
                            setComposerActive(true);
                            setTagsVisible(false);
                          } else {
                            handleComposerInputFocus();
                          }
                        }}
                        placeholder="What's the update?"
                        placeholderTextColor={placeholderColor}
                        multiline={isComposerExpanded}
                        maxLength={1000}
                      />

                      {!isComposerExpanded && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity activeOpacity={0.75} onPress={handleOpenCamera} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
                            <Ionicons name="camera-outline" size={25} color={iconColor} />
                          </TouchableOpacity>
                          <TouchableOpacity activeOpacity={0.82} onPress={handleStartRecording} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#0071e3', alignItems: 'center', justifyContent: 'center', marginLeft: 2 }}>
                            <Ionicons name="mic-outline" size={23} color="#ffffff" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* PAGE 2: Tags */}
                  {isComposerExpanded && (
                    <View 
                      {...panResponder.panHandlers}
                      style={{ width: '50%', minHeight: 120, justifyContent: 'center' }}
                    >
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {TAG_OPTIONS.map((tag) => {
                          const isSelected = selectedTag?.label === tag.label;
                          const color = SEMANTIC_COLORS[tag.semantic];
                          const pillBgColor = isSelected ? `${color}26` : `${color}16`;
                          const neutralPillBg = isDark ? 'rgba(255,255,255,0.08)' : '#ffffff';
                          const pillIconColor = isSelected ? color : placeholderColor;
                          const pillTextColor = isSelected ? textColor : placeholderColor;

                          return (
                            <TouchableOpacity
                              key={tag.label}
                              activeOpacity={0.75}
                              onPress={() => setSelectedTag(isSelected ? null : tag)}
                              style={{
                                width: tagPillWidth,
                                height: 38,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingHorizontal: 8,
                                borderRadius: 19,
                                backgroundColor: isSelected ? pillBgColor : neutralPillBg,
                                borderWidth: isSelected ? 1.5 : 1.25,
                                borderColor: isSelected ? color : borderColor,
                              }}
                            >
                              <Ionicons name={tag.iconName} size={14} color={pillIconColor} style={{ marginRight: 4 }} />
                              <Text style={{ fontSize: 12, fontWeight: '600', color: pillTextColor }} numberOfLines={1}>
                                {tag.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </Animated.View>
              </View>
            </View>
          </View>

          {/* Expanded Footer Actions */}
          {isComposerExpanded && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handleOpenCamera}
                  style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="camera-outline" size={23} color={iconColor} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handleAttachItem}
                  style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="image-outline" size={23} color={iconColor} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handleAttachItem}
                  style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="attach-outline" size={24} color={iconColor} />
                </TouchableOpacity>
              </View>

              <Animated.View style={actionButtonStyle}>
                <TouchableOpacity
                  activeOpacity={0.82}
                  disabled={primaryActionDisabled}
                  onPress={handlePrimaryComposerAction}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: primaryActionDisabled ? placeholderColor : '#0071e3',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: primaryActionDisabled ? 0.55 : 1,
                  }}
                >
                  <Ionicons
                    name={tagsVisible ? 'send' : 'arrow-forward'}
                    size={tagsVisible ? 23 : 24}
                    color="#ffffff"
                    style={tagsVisible ? { marginLeft: 2 } : undefined}
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
