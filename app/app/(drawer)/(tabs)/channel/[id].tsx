import React from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  useColorScheme, StatusBar, TextInput,
  NativeSyntheticEvent, NativeScrollEvent, Keyboard,
  Alert, Image, BackHandler, Modal, ScrollView,
} from 'react-native';

import Animated, {
  useAnimatedStyle, withTiming, useSharedValue,
  withSpring, FadeInDown, FadeOutDown,
  ZoomIn, ZoomOut, LinearTransition,
  useAnimatedScrollHandler, runOnJS, interpolate, Extrapolation, SharedValue, withDelay
} from 'react-native-reanimated';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState, useCallback, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, EvilIcons } from '@expo/vector-icons';
import { createPost } from '../../../../services/feed';
import { database } from '../../../../database';
import Channel from '../../../../database/models/Channel';
import Post from '../../../../database/models/Post';
import User from '../../../../database/models/User';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import * as LucideIcons from 'lucide-react-native';
import { ChannelEventType } from '@opehst/shared';
import { CommentsSheet } from '../../../../components/CommentsSheet';
import { useAuth } from '../../../../services/authContext';

const SEMANTIC_COLORS = [
  '#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#8b5cf6', '#ec4899',
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

const AVATAR_CONFIGS: Record<string, { url: string }> = {
  asset:    { url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=150&h=150&fit=crop' },
  location: { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop' },
  process:  { url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=150&h=150&fit=crop' },
  role:     { url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop' },
  group:    { url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&h=150&fit=crop' },
  default:  { url: 'https://images.unsplash.com/photo-1504307651254-35680f356f12?w=150&h=150&fit=crop' },
};

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCardInner({ log, author, comments, reactions, channelEventTypes = [] }: {
  log: Post; author: User; comments: Comment[]; reactions: any[]; channelEventTypes?: ChannelEventType[];
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isAlert = log.isPinned;

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

  const actionColor = isDark ? '#a1a1aa' : '#536471';
  let leftIconColor = '#f59e0b';
  let caption = 'Posted an update';

  if (isAlert) {
    leftIconColor = '#f59e0b';
    caption = 'Pinned / Alert';
  } else if (eventTypeLabel) {
    leftIconColor = eventTypeColor;
    caption = `Reported a ${eventTypeLabel.toLowerCase()}`;
  } else if (log.subject) {
    caption = 'Logged an activity';
  }

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
        (record as any).userId = 'local-user';
        (record as any).type = type;
        (record as any).createdAt = Date.now();
        (record as any).updatedAt = Date.now();
      });
    });
  };

  if (log.eventType === 'system') {
    return (
      <View className="items-center my-1 mx-4 mb-3">
        <View className="px-5 py-2 rounded-full max-w-[85%] bg-surface-card">
          <Text className="text-[13px] font-medium text-center text-text-secondary" style={{ lineHeight: 18 }}>
            {log.content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-row px-4 py-4 rounded-[28px] mb-3 mx-4"
      style={{ backgroundColor: isDark ? '#1d2a35' : '#ffffff' }}
    >
      {/* Left Column: Tag/Alert Icon */}
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
        {/* Header */}
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
              <Text className="text-[15px] font-bold text-text-primary" numberOfLines={1}>
                {author?.name || 'Unknown User'}
              </Text>
              {isAlert && <Ionicons name="checkmark-circle" size={14} color="#1d9bf0" style={{ marginLeft: 4 }} />}
              <Text className="text-[14px] text-text-secondary ml-1.5 flex-shrink-0">
                · {formatTimeAgo(new Date(log.createdAt).toISOString())}
              </Text>
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
  author: log.author.observe(),
  comments: log.comments.observe(),
  reactions: log.reactions.observe(),
}))(PostCardInner);

// ─── Speed Dial FAB ───────────────────────────────────────────────────────────
interface SpeedDialItem {
  eventType: ChannelEventType | null; // null = general post
  label: string;
  icon: any;
  color: string;
}

interface SpeedDialProps {
  items: SpeedDialItem[];
  isDark: boolean;
  onSelect: (item: SpeedDialItem) => void;
  scrollY: SharedValue<number>;
}

import { Platform, useWindowDimensions } from 'react-native';

function SpeedDialOption({ item, index, isDark, active, onSelect }: any) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      const delay = index * 10; // Extremely fast stagger
      const t = setTimeout(() => {
        progress.value = withTiming(1, { duration: 120 });
      }, delay);
      return () => clearTimeout(t);
    } else {
      progress.value = withTiming(0, { duration: 100 });
    }
  }, [active, index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: 10 * (1 - progress.value) }, // short smooth slide, no scale
    ],
    marginBottom: 14,
    paddingRight: 26,
  }));

  const IconComp  = item.icon;
  const iconBg    = isDark ? '#3f3f46' : '#f4f4f5';
  const iconColor = isDark ? '#ffffff' : '#000000';

  return (
    <Animated.View style={style}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => onSelect(item)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Text style={{
          fontSize: 19, fontWeight: '700', letterSpacing: -0.2,
          color: isDark ? '#ffffff' : '#0f0f0f',
        }}>
          {item.label}
        </Text>
        <View style={{
          width: 44, height: 44, borderRadius: 22, backgroundColor: 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {React.createElement(IconComp as any, { size: 24, color: iconColor, strokeWidth: 2 })}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SpeedDial({ items, isDark, onSelect, scrollY }: SpeedDialProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const isMenuOpen     = useSharedValue(false);
  const fabRotation    = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  
  const { width: screenWidth } = useWindowDimensions();
  const bottomOffset = Platform.OS === 'ios' ? 44 : 24; // Lower down since tab bar is hidden

  const fabStyle = useAnimatedStyle(() => {
    // Snap closed if the menu is open OR if scrolled just 10 pixels away from bottom
    const isCollapsed = isMenuOpen.value || scrollY.value > 10;
    
    const expandedWidth = screenWidth - 160; // Leaves room for two 60px action slots (48px button + 12px gap)
    
    return {
      width: withTiming(isCollapsed ? 56 : expandedWidth, { duration: 150 }),
      height: withTiming(isCollapsed ? 56 : 48, { duration: 150 }),
      borderRadius: withTiming(isCollapsed ? 28 : 24, { duration: 150 }),
    };
  });

  const fabIconStyle = useAnimatedStyle(() => {
    const isCollapsed = isMenuOpen.value || scrollY.value > 10;
    return {
      transform: [{ rotate: `${fabRotation.value}deg` }],
      opacity: withTiming(isCollapsed ? 1 : 0, { duration: 100 }),
      width: withTiming(isCollapsed ? 26 : 0, { duration: 150 }),
      overflow: 'hidden',
      alignItems: 'center',
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const isCollapsed = isMenuOpen.value || scrollY.value > 10;
    
    return {
      opacity: isCollapsed 
        ? withTiming(0, { duration: 40 }) 
        : withDelay(80, withTiming(1, { duration: 80 })),
      maxWidth: withTiming(isCollapsed ? 0 : 150, { duration: 150 }),
    };
  });

  const actionsStyle = useAnimatedStyle(() => {
    const isCollapsed = isMenuOpen.value || scrollY.value > 10;
    return {
      opacity: withTiming(isCollapsed ? 0 : 1, { duration: 100 }),
      width: withTiming(isCollapsed ? 0 : 60, { duration: 150 }), // 48px button + 12px gap on left
    };
  });

  const innerContainerStyle = useAnimatedStyle(() => {
    const isCollapsed = isMenuOpen.value || scrollY.value > 10;
    return {
      paddingHorizontal: withTiming(isCollapsed ? 0 : 20, { duration: 150 }),
      justifyContent: 'center',
    };
  });

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const openDial = () => {
    isMenuOpen.value = true;
    setOpen(true);
    setActive(true);
    fabRotation.value    = withTiming(45, { duration: 120 });
    overlayOpacity.value = withTiming(1, { duration: 100 });
  };

  const closeDial = () => {
    isMenuOpen.value = false;
    setActive(false);
    fabRotation.value    = withTiming(0, { duration: 100 });
    overlayOpacity.value = withTiming(0, { duration: 100 });
    setTimeout(() => setOpen(false), 120);
  };

  const handleSelect = (item: SpeedDialItem) => {
    closeDial();
    setTimeout(() => onSelect(item), 150);
  };

  return (
    <>
      {/* ── Main FAB (Underneath, always visible) ── */}
      <View
        style={{
          position: 'absolute',
          bottom: bottomOffset,
          right: 20,
          zIndex: 50, // Must sit above overlay
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
        pointerEvents="box-none"
      >
        
        {/* Main "New Post" Button */}
        <Animated.View
          style={[{
            backgroundColor: '#0071e3',
          }, fabStyle]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={open ? closeDial : openDial}
            style={{ flex: 1 }}
          >
            <Animated.View style={[{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              overflow: 'hidden',
            }, innerContainerStyle]}>
              
              <Animated.View style={fabIconStyle}>
                {React.createElement(LucideIcons.Plus as any, { size: 26, color: '#ffffff', strokeWidth: 2.5 })}
              </Animated.View>
              
              <Animated.View style={[{ flex: 1 }, labelStyle]}>
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
                  New Post
                </Text>
              </Animated.View>

            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

        {/* Camera Floating Button */}
        <Animated.View style={[{ overflow: 'hidden', alignItems: 'flex-end' }, actionsStyle]}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => Alert.alert('Coming Soon', 'Camera capture')}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}
          >
            {React.createElement(LucideIcons.Camera as any, { size: 22, color: isDark ? '#ffffff' : '#1a1718' })}
          </TouchableOpacity>
        </Animated.View>

        {/* Mic Floating Button */}
        <Animated.View style={[{ overflow: 'hidden', alignItems: 'flex-end' }, actionsStyle]}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => Alert.alert('Coming Soon', 'Voice recording')}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? '#3f3f46' : '#ffffff', alignItems: 'center', justifyContent: 'center' }}
          >
            {React.createElement(LucideIcons.Mic as any, { size: 22, color: '#0071e3' })}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── White-wash overlay — feed content visible but faded ── */}
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 45,
          backgroundColor: isDark ? 'rgba(21,32,43,0.93)' : 'rgba(255,255,255,0.93)',
        }, overlayStyle]}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeDial} />
      </Animated.View>

      {/* ── Speed dial items — perfectly vertically aligned with FAB ── */}
      <View style={{
        position: 'absolute',
        bottom: bottomOffset + 68,   // sits just above the FAB (56 + 12 gap)
        right: 0,
        zIndex: 50,
        alignItems: 'flex-end',
      }} pointerEvents={open ? 'box-none' : 'none'}>
        {[...items].reverse().map((item, index) => (
          <SpeedDialOption
            key={item.label}
            item={item}
            index={index}
            isDark={isDark}
            active={active}
            onSelect={handleSelect}
          />
        ))}
      </View>
    </>
  );
}


// ─── Full Screen Composer Modal ────────────────────────────────────────────────
interface ComposerModalProps {
  visible: boolean;
  selectedItem: SpeedDialItem | null;
  channelName: string;
  isDark: boolean;
  onClose: () => void;
  onSend: (subject: string, content: string, eventType: string | null) => Promise<void>;
}

function ComposerModal({ visible, selectedItem, channelName, isDark, onClose, onSend }: ComposerModalProps) {
  const insets = useSafeAreaInsets();
  const contentInputRef = useRef<TextInput>(null);

  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const hasDraft = subject.trim().length > 0 || content.trim().length > 0;
  const canSend  = content.trim().length > 0 && !isSending;

  const bgColor        = isDark ? '#15202b' : '#f2f2f7';
  const cardColor      = isDark ? '#1d2a35' : '#ffffff';
  const textColor      = isDark ? '#ffffff' : '#1a1718';
  const secondaryColor = isDark ? '#8899a6' : '#7a7577';
  const borderColor    = isDark ? '#253341' : '#e8e4e5';
  const pillBg         = isDark ? 'rgba(255,255,255,0.08)' : '#f2f2f7';

  // Reset fields each time the modal opens
  useEffect(() => {
    if (visible) {
      setSubject('');
      setContent('');
      setIsSending(false);
      // Auto-focus after animation settles
      const t = setTimeout(() => contentInputRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (hasDraft) {
      Alert.alert(
        'Discard draft?',
        'Your post will not be saved.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              Keyboard.dismiss();
              onClose();
            }
          },
        ]
      );
    } else {
      Keyboard.dismiss();
      onClose();
    }
  }, [hasDraft, onClose]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setIsSending(true);
    try {
      await onSend(subject.trim(), content.trim(), selectedItem?.eventType?.name ?? null);
      Keyboard.dismiss();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to post. Please try again.');
      setIsSending(false);
    }
  }, [canSend, subject, content, selectedItem, onSend, onClose]);

  const IconComp = selectedItem?.icon ?? LucideIcons.FileText;
  const accentColor = selectedItem?.color ?? '#0071e3';
  const eventLabel  = selectedItem?.label ?? 'General Post';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: bgColor }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* ── Header ── */}
        <View style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: cardColor,
          borderBottomWidth: 0.5,
          borderBottomColor: borderColor,
        }}>
          {/* Cancel */}
          <TouchableOpacity
            onPress={handleClose}
            activeOpacity={0.7}
            style={{ paddingVertical: 6, paddingRight: 16 }}
          >
            <Text style={{ fontSize: 16, color: secondaryColor, fontWeight: '500' }}>Cancel</Text>
          </TouchableOpacity>

          {/* Title */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }}>
              New Post
            </Text>
            <Text style={{ fontSize: 12, color: secondaryColor, marginTop: 1 }}>
              {channelName}
            </Text>
          </View>

          {/* Post Button */}
          <TouchableOpacity
            onPress={handleSend}
            activeOpacity={0.82}
            disabled={!canSend}
            style={{
              backgroundColor: canSend ? '#0071e3' : (isDark ? 'rgba(255,255,255,0.12)' : '#e5e5ea'),
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 20,
            }}
          >
            <Text style={{
              fontSize: 15,
              fontWeight: '700',
              color: canSend ? '#ffffff' : secondaryColor,
            }}>
              {isSending ? 'Posting…' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          >
            {/* Author Row */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
              {/* Avatar */}
              <Image
                source={{ uri: 'https://i.pravatar.cc/150?u=Me' }}
                style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
              />

              <View style={{ flex: 1 }}>
                {/* User + Event Type Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }}>Me</Text>

                  {/* Event Type Chip */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: `${accentColor}1a`,
                    borderColor: accentColor,
                    borderWidth: 1.25,
                    borderRadius: 14,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    gap: 5,
                  }}>
                    <IconComp size={12} color={accentColor} strokeWidth={2.5} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: accentColor }}>
                      {eventLabel}
                    </Text>
                  </View>
                </View>

                {/* Subject Input */}
                <TextInput
                  style={{
                    fontSize: 17,
                    fontWeight: '700',
                    color: textColor,
                    paddingVertical: 0,
                    marginBottom: 12,
                    borderBottomWidth: 0.5,
                    borderBottomColor: borderColor,
                    paddingBottom: 10,
                  }}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Add a quick summary…"
                  placeholderTextColor={secondaryColor}
                  maxLength={80}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => contentInputRef.current?.focus()}
                />

                {/* Content Input */}
                <TextInput
                  ref={contentInputRef}
                  style={{
                    fontSize: 16,
                    color: textColor,
                    lineHeight: 23,
                    minHeight: 120,
                    paddingVertical: 0,
                    textAlignVertical: 'top',
                  }}
                  value={content}
                  onChangeText={setContent}
                  placeholder="What's the update?"
                  placeholderTextColor={secondaryColor}
                  multiline
                  maxLength={1000}
                />
              </View>
            </View>
          </ScrollView>

          {/* Attachment Bar */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 10,
            paddingBottom: Math.max(insets.bottom, 10),
            borderTopWidth: 0.5,
            borderTopColor: borderColor,
            backgroundColor: cardColor,
            gap: 4,
          }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert('Coming Soon', 'Camera capture will be added here.')}
              style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="camera-outline" size={23} color={isDark ? '#ffffff' : '#1a1718'} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert('Coming Soon', 'Image attachments will be added here.')}
              style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="image-outline" size={23} color={isDark ? '#ffffff' : '#1a1718'} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert('Coming Soon', 'File attachments will be added here.')}
              style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="attach-outline" size={24} color={isDark ? '#ffffff' : '#1a1718'} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert('Coming Soon', 'Voice recording will be added here.')}
              style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="mic-outline" size={23} color={isDark ? '#ffffff' : '#1a1718'} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Channel Wall Screen ───────────────────────────────────────────────────────
function ChannelWallScreenInner({ targetId, channel, posts }: {
  targetId: string; channel: Channel | null; posts: Post[];
}) {
  const router      = useRouter();
  const { dbUser }  = useAuth();
  const insets      = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';

  const flatListRef     = useRef<any>(null);
  const isAtBottomRef   = useRef(true);

  const scrollY = useSharedValue(0);

  const updateIsAtBottom = (isAtBottom: boolean) => {
    isAtBottomRef.current = isAtBottom;
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      runOnJS(updateIsAtBottom)(event.contentOffset.y <= 50);
    },
  });

  const [unreadCount, setUnreadCount]             = useState(0);
  const [composerVisible, setComposerVisible]     = useState(false);
  const [selectedDialItem, setSelectedDialItem]   = useState<SpeedDialItem | null>(null);
  const hasCheckedUnreadRef = useRef(false);

  const name = channel?.name ?? 'Unknown Channel';
  const logs = posts;

  const latestLogsRef = useRef(logs);
  useEffect(() => { latestLogsRef.current = logs; }, [logs]);

  // ── Unread count ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (logs.length > 0 && !hasCheckedUnreadRef.current && dbUser) {
      hasCheckedUnreadRef.current = true;
      database.adapter.getLocal(`channel_visited_${dbUser.id}_${targetId}`).then(lastVisitedStr => {
        const lastVisitedAt = lastVisitedStr ? parseInt(lastVisitedStr, 10) : 0;
        let count = 0;
        for (const log of logs) {
          if (new Date(log.createdAt).getTime() > lastVisitedAt && log.authorId !== dbUser.id) {
            count++;
          }
        }
        setUnreadCount(count);
      });
    }
  }, [logs.length, targetId, dbUser]);

  useEffect(() => {
    return () => {
      if (!dbUser) return;
      const currentLogs = latestLogsRef.current;
      const maxTime = currentLogs.length > 0
        ? Math.max(...currentLogs.map(l => new Date(l.createdAt).getTime()))
        : Date.now();
      database.adapter.setLocal(`channel_visited_${dbUser.id}_${targetId}`, maxTime.toString()).catch(() => {});
    };
  }, [targetId, dbUser]);

  // ── Avatar for channel header ──────────────────────────────────────────────
  let avatarConfig = AVATAR_CONFIGS.default;
  if (channel) {
    // @ts-ignore
    avatarConfig = AVATAR_CONFIGS[channel.category] ?? AVATAR_CONFIGS.default;
  }

  // ── Build Speed Dial items from channel event types ────────────────────────
  const speedDialItems: SpeedDialItem[] = [
    // General post always available at the bottom of the list (shown first = appears topmost)
    {
      eventType: null,
      label: 'General Post',
      icon: LucideIcons.FileText,
      color: '#64748b',
    },
    // Channel-specific event types listed above the general post
    ...(channel?.eventTypes ?? []).map((et: ChannelEventType): SpeedDialItem => ({
      eventType: et,
      label: et.name,
      icon: (LucideIcons as any)[et.icon] ?? LucideIcons.Tag,
      color: et.color,
    })).reverse(),
  ].reverse(); // reverse so general post appears at the bottom of the visual stack

  // ── Send handler ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async (subject: string, content: string, eventType: string | null) => {
    await createPost(
      content || subject,
      targetId,
      [],
      subject || undefined,
      eventType || undefined,
    );
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 80);
  }, [targetId]);

  // ── Theme ──────────────────────────────────────────────────────────────────
  const glassmorphicBg  = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const iconColor       = isDark ? '#ffffff' : '#1a1718';
  const textColor       = isDark ? '#ffffff' : '#1a1718';
  const placeholderColor = isDark ? '#8899a6' : '#7a7577';

  // ── Back handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (composerVisible) {
        setComposerVisible(false);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [composerVisible]);

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
              if (router.canGoBack()) router.back();
              else router.replace('/');
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

      {/* ── Feed ── */}
      <View style={{ flex: 1 }}>
        <Animated.FlatList
          ref={flatListRef}
          data={logs}
          keyExtractor={(item: any) => item.id}
          inverted
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
          contentContainerStyle={{
            paddingTop: Platform.OS === 'ios' ? 150 : 130, // Visually bottom: pushed up further to clear the FAB
            paddingBottom: 24, // Visually top: spacing above the feed
            flexGrow: 1,
            justifyContent: 'flex-end',
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEventThrottle={16}
          onScroll={scrollHandler}
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
          renderItem={({ item: log, index }) => (
            <View>
              <PostCard
                log={log}
                channelEventTypes={channel?.eventTypes || []}
              />
              {index === unreadCount - 1 && unreadCount > 0 && (
                <Animated.View
                  layout={LinearTransition.springify().damping(22).mass(0.6).stiffness(150)}
                  entering={ZoomIn.springify().damping(20).mass(0.5).stiffness(200)}
                  exiting={ZoomOut.duration(200)}
                  className="items-center my-1 mx-4 mb-3"
                >
                  <View className="px-5 py-2 rounded-full max-w-[85%]" style={{ backgroundColor: '#000000' }}>
                    <Text className="text-[13px] font-medium text-center" style={{ color: '#ffffff', lineHeight: 18 }}>
                      {unreadCount} New Post{unreadCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </Animated.View>
              )}
            </View>
          )}
        />
      </View>

      {/* ── Speed Dial ── */}
      <SpeedDial
        items={speedDialItems}
        isDark={isDark}
        onSelect={(item) => {
          setSelectedDialItem(item);
          setComposerVisible(true);
        }}
        scrollY={scrollY}
      />

      {/* ── Full Screen Composer Modal ── */}
      <ComposerModal
        visible={composerVisible}
        selectedItem={selectedDialItem}
        channelName={name}
        isDark={isDark}
        onClose={() => setComposerVisible(false)}
        onSend={handleSend}
      />
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
