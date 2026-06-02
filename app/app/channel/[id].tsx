import {
  View, Text, ScrollView, TouchableOpacity, FlatList,
  Platform, useColorScheme, StatusBar, TextInput, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent, Keyboard,
  Alert, Image, BackHandler, PanResponder, LayoutAnimation
} from 'react-native';

import Animated, { useAnimatedStyle, withTiming, useSharedValue, interpolate, Extrapolation, withSpring, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState, useCallback, useEffect, ComponentProps, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, EvilIcons } from '@expo/vector-icons';
import { createPost } from '../../services/feed';
import { database } from '../../database';
import Channel from '../../database/models/Channel';
import Post from '../../database/models/Post';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import * as LucideIcons from 'lucide-react-native';
import { ChannelEventType } from '@opehst/shared';
import { CommentsSheet } from '../../components/CommentsSheet';

// We no longer have hardcoded event types because they are defined dynamically per channel
const SEMANTIC_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#f59e0b', // Orange
  '#22c55e', // Green
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

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
function PostCardInner({ log, comments, reactions, channelEventTypes = [] }: { log: Post, comments: Comment[], reactions: any[], channelEventTypes?: ChannelEventType[] }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isAlert = log.isPinned; // Map legacy is_scada_alert to isPinned for UI coloring for now

  let eventTypeLabel = log.eventType || null;
  let eventTypeColor = '#3b82f6';
  let TagIconComp: any = LucideIcons.Tag;
  
  if (eventTypeLabel) {
    const matchedTag = channelEventTypes.find(t => t.name === eventTypeLabel);
    if (matchedTag) {
      eventTypeColor = matchedTag.color;
      TagIconComp = (LucideIcons as any)[matchedTag.icon] || LucideIcons.Tag;
    } else {
      const hash = eventTypeLabel.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      eventTypeColor = SEMANTIC_COLORS[hash % SEMANTIC_COLORS.length];
    }
  }

  // --- Left Icon Area (EventTypes/Alerts) ---
  const actionColor = isDark ? '#a1a1aa' : '#536471';
  
  let leftIconColor = '#f59e0b';
  let leftBgStyle: any = { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)' };
  let caption = 'Posted an update';

  if (isAlert) {
    leftIconColor = '#f59e0b';
    leftBgStyle = { backgroundColor: 'rgba(245, 158, 11, 0.10)' };
  } else if (eventTypeLabel) {
    leftIconColor = eventTypeColor;
    leftBgStyle = { backgroundColor: `${leftIconColor}20` };
  }

  if (isAlert) {
    caption = 'Pinned / Alert';
  } else if (eventTypeLabel) {
    caption = `Reported a ${eventTypeLabel.toLowerCase()}`;
  } else if (log.subject) {
    caption = 'Logged an activity';
  }

  const userAvatarBg = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)';
  const userAvatarIconColor = isDark ? '#ffffff' : '#2e2a2b';
  const userAvatarIconName = isAlert ? 'hardware-chip-outline' : 'person-outline';

  const [commentsVisible, setCommentsVisible] = useState(false);

  const replies  = comments.length;
  const retweets = 0;
  const likes    = reactions.length;
  const views    = Math.floor(Math.random() * 500) + 50;

  const handleReact = () => {
    Alert.alert('React', 'Choose a reaction', [
      { text: 'Acknowledged', onPress: () => saveReaction('acknowledged') },
      { text: 'Needs Attention', onPress: () => saveReaction('needs_attention') },
      { text: 'Fixed', onPress: () => saveReaction('fixed') },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const saveReaction = async (type: string) => {
    await database.write(async () => {
      await database.collections.get('reactions').create(record => {
        record._raw.id = Math.random().toString();
        (record as any).tenantId = log.tenantId;
        (record as any).postId = log.id;
        (record as any).userId = 'local-user'; // Replace with real auth ID
        (record as any).type = type;
        (record as any).createdAt = Date.now();
        (record as any).updatedAt = Date.now();
      });
    });
  };

  return (
    <View 
      className="flex-row px-4 py-4 rounded-[28px] mb-3 mx-4"
      style={{ backgroundColor: isDark ? '#1d2a35' : '#ffffff' }}
    >
      {/* Left Column: Tag/Alert Icon (No background, increased size & stroke) */}
      <View className="mr-3 items-center pt-1.5 w-[36px] h-[36px] justify-center">
        {isAlert ? (
          <Ionicons name="warning-outline" size={28} color={leftIconColor} />
        ) : eventTypeLabel ? (
          <TagIconComp size={24} color={leftIconColor} strokeWidth={2.5} />
        ) : (
          <Ionicons name="document-text-outline" size={28} color={leftIconColor} />
        )}
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
              source={{ uri: `https://i.pravatar.cc/150?u=${encodeURIComponent(log.authorId)}` }}
              className="w-[44px] h-[44px] rounded-full mr-2.5 bg-surface-card"
            />
          )}
          <View className="flex-1 justify-center">
             <View className="flex-row items-center">
               <Text className="text-[15px] font-bold text-text-primary" numberOfLines={1}>User</Text>
               {isAlert && <Ionicons name="checkmark-circle" size={14} color="#1d9bf0" style={{ marginLeft: 4 }} />}
               <Text className="text-[14px] text-text-secondary ml-1.5 flex-shrink-0">· {formatTimeAgo(new Date(log.createdAt).toISOString())}</Text>
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
          <TouchableOpacity className="flex-row items-center" onPress={() => setCommentsVisible(true)}>
            <EvilIcons name="comment" size={22} color={actionColor} />
            {replies > 0 && <Text className="text-[13px] text-text-secondary ml-0.5">{replies}</Text>}
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center">
            <EvilIcons name="retweet" size={26} color={actionColor} />
            {retweets > 0 && <Text className="text-[13px] text-text-secondary ml-0.5">{retweets}</Text>}
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center" onPress={handleReact}>
            <EvilIcons name="heart" size={24} color={likes > 0 ? '#ef4444' : actionColor} />
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

        {commentsVisible && (
          <CommentsSheet 
            visible={commentsVisible} 
            onClose={() => setCommentsVisible(false)} 
            post={log} 
          />
        )}
      </View>
    </View>
  );
}

const PostCard = withObservables(['log'], ({ log }: { log: Post }) => ({
  log,
  comments: log.comments.observe(),
  reactions: log.reactions.observe(),
}))(PostCardInner);

// ─── Channel Wall Screen ───────────────────────────────────────────────────────
function ChannelWallScreenInner({ targetId, channel, posts }: { targetId: string; channel: Channel | null; posts: Post[] }) {
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';

  const flatListRef  = useRef<FlatList>(null);
  const inputRef       = useRef<TextInput>(null);
  const isAtBottomRef  = useRef(true);

  // ── Compose state ──────────────────────────────────────────────────────────
  const [messageText, setMessageText]  = useState('');
  const [subjectText, setSubjectText]  = useState('');
  const [selectedEventType, setSelectedEventType]  = useState<string | null>(null);
  
  const [keyboardVisible,  setKeyboardVisible]  = useState(false);
  const [composerActive, setComposerActive] = useState(false);
  const [eventTypesVisible, setEventTypesVisible] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastShownRef = useRef(false);

  const hasDraft = messageText.trim().length > 0 || subjectText.trim().length > 0;
  const isComposerExpanded = composerActive || eventTypesVisible;

  // The wrapper has 16px horizontal padding on each side (32px).
  // The left column (avatar) is 44px + 12px margin = 56px.
  // The flex: 1 right column takes the rest: screenWidth - 32 - 56 = screenWidth - 88.
  const [carouselWidth, setCarouselWidth] = useState(screenWidth - 88);
  // Subtract 20px for the two 10px gaps, and an extra 2px as a subpixel rounding safety buffer
  const tagPillWidth = Math.floor((carouselWidth - 22) / 3);

  // Sync state refs to prevent stale closures in PanResponder
  const keyboardVisibleRef = useRef(keyboardVisible);
  const eventTypesVisibleRef = useRef(eventTypesVisible);
  const composerActiveRef = useRef(composerActive);

  useEffect(() => {
    keyboardVisibleRef.current = keyboardVisible;
  }, [keyboardVisible]);
  useEffect(() => {
    eventTypesVisibleRef.current = eventTypesVisible;
  }, [eventTypesVisible]);
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
    setEventTypesVisible(false);
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
  const name = channel?.name ?? 'Unknown Channel';
  const logs = posts;

  useEffect(() => {
    if (logs.length > 0 && !toastShownRef.current) {
      toastShownRef.current = true;
      const showTimer = setTimeout(() => setShowToast(true), 700);
      const hideTimer = setTimeout(() => setShowToast(false), 3700);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [logs.length]);

  let avatarConfig = AVATAR_CONFIGS.default;
  if (channel) {
    // @ts-ignore
    avatarConfig = AVATAR_CONFIGS[channel.category] ?? AVATAR_CONFIGS.default;
  }

  // ── Keyboard listeners ────────────────────────────────────────────────────
  const composerCarouselAnim = useSharedValue(0);

  useEffect(() => {
    composerCarouselAnim.value = withSpring(eventTypesVisible ? 1 : 0, {
      stiffness: 250,
      damping: 30,
      mass: 1,
      overshootClamping: true,
    });
  }, [eventTypesVisible, composerCarouselAnim]);

  const carouselWrapperStyle = useAnimatedStyle(() => {
    return {
      flexDirection: 'row',
      width: isComposerExpanded ? '200%' : '100%',
      transform: [{
        translateX: isComposerExpanded 
          ? interpolate(composerCarouselAnim.value, [0, 1], [0, -carouselWidth]) 
          : 0
      }]
    };
  }, [isComposerExpanded, carouselWidth]);

  const page1Style = useAnimatedStyle(() => {
    const progress = composerCarouselAnim.value;
    return {
      opacity: interpolate(progress, [0, 0.4, 1], [1, 0.02, 0.02], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(progress, [0, 1], [0, carouselWidth]) },
        { scale: interpolate(progress, [0, 0.4, 1], [1, 0.95, 0.95], Extrapolation.CLAMP) }
      ],
    };
  }, [carouselWidth]);

  const page2Style = useAnimatedStyle(() => {
    const progress = composerCarouselAnim.value;
    return {
      opacity: interpolate(progress, [0.4, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(progress, [0, 1], [-carouselWidth, 0]) },
        { scale: interpolate(progress, [0.4, 1], [0.95, 1], Extrapolation.CLAMP) }
      ],
    };
  }, [carouselWidth]);

  const actionButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - composerCarouselAnim.value * 0.03 }],
  }));

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      if (isAtBottomRef.current && logs.length > 0) {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
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
      setEventTypesVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);


  // Intercept hardware back button for composer-local state before navigation.
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (eventTypesVisible) {
        setEventTypesVisible(false);
        return true;
      }
      if (composerActive || keyboardVisible) {
        collapseComposer();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [composerActive, keyboardVisible, eventTypesVisible, collapseComposer]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const content = messageText.trim();
    const subject = subjectText.trim();
    if (!content && !subject) return;

    await createPost(
      content || subject, 
      targetId, 
      [], 
      subject || undefined, 
      selectedEventType || undefined
    );

    setMessageText('');
    setSubjectText('');
    setSelectedEventType(null);
    LayoutAnimation.configureNext({
      duration: 380,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    setComposerActive(false);
    setEventTypesVisible(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
    setTimeout(() => {
      if (logs.length >= 0) {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
    }, 80);
  }, [messageText, subjectText, selectedEventType, targetId]);


  const handlePrimaryComposerAction = useCallback(() => {
    if (!eventTypesVisible) {
      setEventTypesVisible(true);
      return;
    }
    handleSend();
  }, [eventTypesVisible, handleSend]);

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
  if (selectedEventType) {
    composerCaption = `Reporting a ${selectedEventType.toLowerCase()}`;
  } else if (subjectText.trim().length > 0) {
    composerCaption = 'Logging an activity';
  }

  // You can only send after collapsing keyboard and added a text
  const canSend = hasDraft && selectedEventType !== null;
  const primaryActionDisabled = eventTypesVisible ? !canSend : !hasDraft;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#15202b' : '#f2f2f7' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <View style={{ backgroundColor: isDark ? '#15202b' : '#f2f2f7', paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => {
              if (eventTypesVisible) {
                setEventTypesVisible(false);
              } else if (composerActive) {
                collapseComposer();
              } else {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }
            }}
          >
            <Ionicons name="arrow-back-outline" size={26} color={iconColor} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Image 
                source={{ uri: avatarConfig.url }}
                style={{ width: 32, height: 32, borderRadius: 16 }}
              />
              <Text style={{ fontSize: 16, fontWeight: '600', color: textColor }} numberOfLines={1}>
                {name}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="ellipsis-horizontal" size={26} color={iconColor} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1, zIndex: 2 }}
        behavior="padding"
      >
        {/* Feed & Composer Layout transition wrapper */}
        <Animated.View style={{ flex: 1 }}>
          {/* Unread Postings Toast */}
          {showToast && logs.length > 0 && (
            <Animated.View 
              entering={FadeInDown.duration(400)}
              exiting={FadeOutUp.duration(300)}
              style={{
                position: 'absolute',
                top: 16,
                alignSelf: 'center',
                zIndex: 10,
                backgroundColor: isDark ? '#ffffff' : '#1a1718',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
              }}
            >
              <Text style={{ color: isDark ? '#1a1718' : '#ffffff', fontSize: 13, fontWeight: '700' }}>
                {logs.length} New {logs.length === 1 ? 'Post' : 'Posts'}
              </Text>
            </Animated.View>
          )}
          <FlatList
            ref={flatListRef}
            data={logs}
            keyExtractor={(item) => item.id}
            inverted
            initialNumToRender={8}
            maxToRenderPerBatch={5}
            windowSize={5}
            contentContainerStyle={{ paddingBottom: 12, paddingTop: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            scrollEventThrottle={16}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              isAtBottomRef.current = e.nativeEvent.contentOffset.y <= 50;
            }}
            onContentSizeChange={() => {
              if (isAtBottomRef.current && logs.length > 0) {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
              }
            }}
            ListEmptyComponent={() => (
              <View style={{ paddingTop: 96, alignItems: 'center', paddingHorizontal: 32, transform: [{ scaleY: -1 }] }}>
                <Ionicons name="reader-outline" size={52} color={placeholderColor} />
                <Text style={{ color: placeholderColor, fontSize: 15, textAlign: 'center', marginTop: 12 }}>
                  No logs yet — be the first to post
                </Text>
              </View>
            )}
            renderItem={({ item: log }) => (
              <PostCard 
                log={log} 
                channelEventTypes={channel?.eventTypes || []}
              />
            )}
          />
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
            borderTopLeftRadius: isComposerExpanded ? 28 : 0,
            borderTopRightRadius: isComposerExpanded ? 28 : 0,
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
              {isComposerExpanded && eventTypesVisible ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setEventTypesVisible(false)}
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
              <View 
                onLayout={(e) => setCarouselWidth(e.nativeEvent.layout.width)}
                style={{ overflow: 'hidden', minHeight: isComposerExpanded ? 120 : undefined, position: 'relative' }}
              >
                <Animated.View style={carouselWrapperStyle}>
                  {/* PAGE 1: Text Inputs */}
                  <Animated.View style={[
                    { width: isComposerExpanded ? '50%' : '100%' }, 
                    page1Style
                  ]}>
                    <View style={{ flexDirection: isComposerExpanded ? 'column' : 'row', alignItems: isComposerExpanded ? 'stretch' : 'center' }}>
                      {isComposerExpanded && (
                        <TextInput
                          style={{
                            width: '90%',
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
                            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                          }
                        }}
                        onPressIn={() => {
                          if (!isComposerExpanded) {
                            LayoutAnimation.configureNext({
                              duration: 380,
                              create: { type: 'easeInEaseOut', property: 'opacity' },
                              update: { type: 'easeInEaseOut' },
                              delete: { type: 'easeInEaseOut', property: 'opacity' },
                            });
                            setComposerActive(true);
                            setEventTypesVisible(false);
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
                            setEventTypesVisible(false);
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
                  </Animated.View>

                  {/* PAGE 2: Event Types */}
                  {isComposerExpanded && (
                    <Animated.View 
                      {...panResponder.panHandlers}
                      pointerEvents={eventTypesVisible ? 'auto' : 'none'}
                      style={[
                        { width: '50%', minHeight: 120, justifyContent: 'center' }, 
                        page2Style
                      ]}
                    >
                      <TouchableOpacity activeOpacity={1} style={{ flex: 1, justifyContent: 'center' }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {(channel?.eventTypes || []).map((eventTypeObj: ChannelEventType) => {
                          const eventTypeStr = eventTypeObj.name;
                          const isSelected = selectedEventType === eventTypeStr;
                          const color = eventTypeObj.color;
                          const TagIconComp = (LucideIcons as any)[eventTypeObj.icon] || LucideIcons.Tag;
                          
                          const pillBgColor = isSelected ? `${color}26` : `${color}16`;
                          const neutralPillBg = isDark ? 'rgba(255,255,255,0.08)' : '#ffffff';
                          const pillIconColor = isSelected ? color : placeholderColor;
                          const pillTextColor = isSelected ? textColor : placeholderColor;

                          return (
                            <TouchableOpacity
                              key={eventTypeStr}
                              activeOpacity={0.75}
                              onPress={() => setSelectedEventType(isSelected ? null : eventTypeStr)}
                              style={{
                                height: 38,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingHorizontal: 16,
                                borderRadius: 19,
                                backgroundColor: isSelected ? pillBgColor : neutralPillBg,
                                borderWidth: isSelected ? 1.5 : 1.25,
                                borderColor: isSelected ? color : borderColor,
                              }}
                            >
                              <TagIconComp size={16} color={pillIconColor} style={{ marginRight: 6 }} strokeWidth={2.5} />
                              <Text style={{ fontSize: 13, fontWeight: '600', color: pillTextColor }} numberOfLines={1}>
                                {eventTypeStr}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      </TouchableOpacity>
                    </Animated.View>
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
                    name={eventTypesVisible ? 'send' : 'arrow-forward'}
                    size={eventTypesVisible ? 23 : 24}
                    color="#ffffff"
                    style={eventTypesVisible ? { marginLeft: 2 } : undefined}
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

const ObservedChannelInner = withObservables(['targetId'], ({ targetId }: { targetId: string }) => ({
  channel: database.collections.get<Channel>('channels').findAndObserve(targetId),
  posts: database.collections.get<Post>('posts').query(
    Q.where('channel_id', targetId),
    Q.sortBy('created_at', Q.desc)
  ).observe()
}))(ChannelWallScreenInner);

export default function ChannelWallScreen() {
  const { id } = useLocalSearchParams();
  const targetId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  
  if (!targetId) return null;
  return <ObservedChannelInner targetId={targetId} />;
}
