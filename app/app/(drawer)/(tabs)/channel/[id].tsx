import React from 'react';
import { EmojiPickerPanel } from '../../../../components/EmojiPickerPanel';
import {
  View, Text, TouchableOpacity, FlatList,
  useColorScheme, StatusBar, TextInput,
  NativeSyntheticEvent, NativeScrollEvent, Keyboard,
  Alert, Image, BackHandler, Modal, ScrollView, Platform, Dimensions, useWindowDimensions,
  Animated as RNAnimated, StyleSheet
} from 'react-native';

import Animated, {
  useAnimatedStyle, withTiming, useSharedValue,
  withSpring, FadeIn, FadeOut, FadeInDown, FadeOutDown, SlideInDown, SlideOutDown,
  ZoomIn, ZoomOut, LinearTransition,
  useAnimatedScrollHandler, runOnJS, interpolate, Extrapolation, SharedValue, withDelay,
  useDerivedValue, useAnimatedReaction,
} from 'react-native-reanimated';

import { KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, EvilIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createPost } from '../../../../services/feed';
import { syncDatabase } from '../../../../services/sync';
import { database } from '../../../../database';
import Channel from '../../../../database/models/Channel';
import Post from '../../../../database/models/Post';
import Comment from '../../../../database/models/Comment';
import User from '../../../../database/models/User';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as LucideIcons from 'lucide-react-native';
import { ChannelEventType } from '@opehst/shared';
import { useAuth } from '../../../../services/authContext';
import { useDraftsStore } from '../../../../store/useDraftsStore';

const SEMANTIC_COLORS = [
  '#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#8b5cf6', '#ec4899',
];

const LEGACY_ICON_MAP: Record<string, string> = {
  'Wrench': 'build',
  'AlertTriangle': 'warning',
  'CheckCircle': 'checkmark-circle',
  'Shield': 'shield',
  'Zap': 'flash',
  'Activity': 'pulse',
  'Tag': 'pricetag',
  'Box': 'cube',
  'FileText': 'document-text',
  'Clock': 'time',
  'Lightbulb': 'bulb',
};

const getIconName = (name: string | any) => {
  if (typeof name !== 'string') return 'pricetag';
  return LEGACY_ICON_MAP[name] || name || 'pricetag';
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

const AVATAR_CONFIGS: Record<string, { url: string }> = {
  asset: { url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=150&h=150&fit=crop' },
  location: { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop' },
  process: { url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=150&h=150&fit=crop' },
  role: { url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop' },
  group: { url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&h=150&fit=crop' },
  default: { url: 'https://images.unsplash.com/photo-1504307651254-35680f356f12?w=150&h=150&fit=crop' },
};

// ─── createComment Helper ─────────────────────────────────────────────────────
async function createComment(
  postId: string,
  content: string,
  tenantId: string,
  authorId: string,
  quotedCommentId?: string
) {
  await database.write(async () => {
    await database.collections.get<Comment>('comments').create(record => {
      record._raw.id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      record.tenantId = tenantId;
      record.postId = postId;
      record.authorId = authorId;
      record.content = content;
      record.quotedCommentId = quotedCommentId;
      record.createdAt = Date.now();
      record.updatedAt = Date.now();
    });
  });
  syncDatabase().catch(console.error);
}

// ─── Synchronous Memory Cache ──────────────────────────────────────────────────
// This guarantees that comments already loaded in the feed will instantly resolve
// their author names and likes in the thread modal without any SQLite bridge delay!
const userNameCache = new Map<string, string>();
const commentLikesCache = new Map<string, number>();
const quotedSnippetCache = new Map<string, { author: string, content: string }>();
const globalPostCardRefs = new Map<string, any>();

// ─── InlineReplyBubble ────────────────────────────────────────────────────────
const InlineReplyBubble = React.memo(function InlineReplyBubble({
  comment, isSelf, isDark, onReply, onLike
}: {
  comment: Comment; isSelf: boolean; isDark: boolean;
  onReply?: (comment: Comment, authorName: string) => void; onLike?: () => void;
}) {
  const textColor = isDark ? '#ffffff' : '#1a1718';
  const secondaryColor = isDark ? '#8899a6' : '#7a7577';
  const replyBg = isDark ? '#253341' : '#f2f2f7'; // Gray inset background to contrast with the thread modal

  const [authorName, setAuthorName] = useState(userNameCache.get(comment.authorId) || comment.authorId?.slice(0, 8) || 'Unknown');
  const [likesCount, setLikesCount] = useState(commentLikesCache.get(comment.id) || 0);

  const [quotedSnippet, setQuotedSnippet] = useState<{ author: string, content: string } | null>(
    comment.quotedCommentId ? (quotedSnippetCache.get(comment.quotedCommentId) || null) : null
  );

  useEffect(() => {
    database.collections.get<User>('users').find(comment.authorId).then(user => {
      if (user?.name) {
        userNameCache.set(comment.authorId, user.name);
        setAuthorName(user.name);
      }
    }).catch(() => { });

    // Observe likes
    const sub = database.collections.get('reactions').query(Q.where('comment_id', comment.id)).observe().subscribe(rx => {
      commentLikesCache.set(comment.id, rx.length);
      setLikesCount(rx.length);
    });

    if (comment.quotedCommentId) {
      database.collections.get<Comment>('comments').find(comment.quotedCommentId).then(async qc => {
        const u = await database.collections.get<User>('users').find(qc.authorId).catch(() => null);
        const snippet = { author: u?.name || 'Unknown', content: qc.content };
        quotedSnippetCache.set(comment.quotedCommentId!, snippet);
        setQuotedSnippet(snippet);
      }).catch(() => { });
    }

    return () => sub.unsubscribe();
  }, [comment.quotedCommentId, comment.authorId, comment.id]);

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: replyBg,
        borderRadius: 24,
        paddingLeft: 8,
        paddingRight: 16,
        paddingVertical: 12,
      }}>
        {/* Left Column: Avatar (Inside the grey bubble) */}
        <View style={{ marginRight: 8 }}>
          <Image
            source={{ uri: `https://i.pravatar.cc/150?u=${encodeURIComponent(comment.authorId)}` }}
            style={{ width: 36, height: 36, borderRadius: 18 }}
          />
        </View>

        {/* Right Column: Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: textColor, marginRight: 6 }}>
              {authorName}
            </Text>
            <Text style={{ fontSize: 13, color: secondaryColor }}>
              {formatTimeAgo(new Date(comment.createdAt).toISOString())}
            </Text>
          </View>

          {quotedSnippet && (
            <View style={{
              marginTop: 6, marginBottom: 4, paddingHorizontal: 10, paddingVertical: 8,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderRadius: 12
            }}>
              <Text style={{ color: '#c13c70', fontWeight: '700', fontSize: 13 }}>{quotedSnippet.author}</Text>
              <Text style={{ color: secondaryColor, fontSize: 13, marginTop: 1, lineHeight: 17 }} numberOfLines={2}>{quotedSnippet.content}</Text>
            </View>
          )}

          <Text style={{ fontSize: 16, color: textColor, lineHeight: 22, marginTop: 4 }}>
            {comment.content}
          </Text>
        </View>
      </View>

      {/* Action Row below the bubble */}
      <View style={{ flexDirection: 'row', marginLeft: 56, marginRight: 16, marginTop: 4, gap: 16, alignItems: 'center', justifyContent: 'flex-end' }}>
        <TouchableOpacity onPress={onLike} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <EvilIcons name="heart" size={20} color={likesCount > 0 ? '#ef4444' : secondaryColor} />
          {likesCount > 0 && <Text style={{ color: secondaryColor, fontSize: 12, marginLeft: 2, fontWeight: '500' }}>{likesCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onReply?.(comment, authorName)} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="arrow-undo-outline" size={16} color={secondaryColor} style={{ marginRight: 4 }} />
          <Text style={{ color: secondaryColor, fontSize: 12, fontWeight: '500' }}>Reply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── ThreadModal ──────────────────────────────────────────────────────────────
interface ThreadModalProps {
  visible: boolean;
  post: Post | null;
  isDark: boolean;
  currentUserId: string;
  currentUserTenantId: string;
  authorName: string;
  autoFocusReply?: boolean;
  channelEventTypes?: ChannelEventType[];
  originLayout?: { x: number, y: number, width: number, height: number } | null;
  preloadedComments?: Comment[];
  repliesCount?: number;
  onClose: () => void;
  threadScrollY?: SharedValue<number>;
  onCommentsCountChange?: (count: number) => void;
  onReplyToComment?: (comment: Comment, authorName: string) => void;
  composerHeightBase?: SharedValue<number>;
}

function ThreadModalInner({ visible, post, isDark, currentUserId, currentUserTenantId, authorName, autoFocusReply, channelEventTypes = [], originLayout, onClose, threadScrollY, onCommentsCountChange, onReplyToComment, preloadedComments = [], repliesCount = 0, composerHeightBase }: ThreadModalProps) {
  const insets = useSafeAreaInsets();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);

  const [commentsReady, setCommentsReady] = useState(preloadedComments.length > 0);
  const [comments, setComments] = useState<Comment[]>(preloadedComments);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setComments(preloadedComments);
      setCommentsReady(preloadedComments.length > 0);
    }
  }, [visible, post]);

  useEffect(() => {
    if (!post) return;
    const subscription = post.comments.observe().subscribe((newComments: Comment[]) => {
      // If DB hasn't resolved real count yet, don't flash empty screen over preloaded
      if (newComments.length === 0 && preloadedComments.length > 0) return;
      setComments(newComments);
      setCommentsReady(true);
    });
    return () => subscription.unsubscribe();
  }, [post]);

  const bgColor = isDark ? '#15202b' : '#f2f2f7';
  const cardColor = isDark ? '#1d2a35' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1718';
  const secondaryColor = isDark ? '#8899a6' : '#7a7577';
  const borderColor = isDark ? '#253341' : '#e8e4e5';
  const inputBg = isDark ? '#253341' : '#ffffff';
  const canSend = text.trim().length > 0 && !sending;

  const expandProgress = useSharedValue(0);
  const isDismissingKeyboard = useSharedValue(false);
  const doDismissKeyboard = () => Keyboard.dismiss();

  const pan = useMemo(() => Gesture.Pan()
    .hitSlop({ top: 20, bottom: 40, left: 20, right: 20 })
    .onStart(() => {
      isDismissingKeyboard.value = keyboardHeight.value < -10;
    })
    .onUpdate((e) => {
      if (isDismissingKeyboard.value) {
        if (e.translationY > 10) {
          runOnJS(doDismissKeyboard)();
        }
      } else {
        if (e.translationY < 0) {
          expandProgress.value = interpolate(e.translationY, [0, -150], [1, 0], Extrapolation.CLAMP);
        } else {
          expandProgress.value = interpolate(e.translationY, [0, 150], [1, 0], Extrapolation.CLAMP);
        }
      }
    })
    .onEnd((e) => {
      if (isDismissingKeyboard.value) {
        expandProgress.value = withSpring(1, { damping: 22, mass: 0.6, stiffness: 150 });
        isDismissingKeyboard.value = false;
        return;
      }
      if (Math.abs(e.translationY) > 50 || Math.abs(e.velocityY) > 500) {
        expandProgress.value = withTiming(0, { duration: 200 }, (finished) => {
          if (finished) {
            runOnJS(onClose)();
          }
        });
      } else {
        expandProgress.value = withSpring(1, { damping: 22, mass: 0.6, stiffness: 150 });
      }
    }), [expandProgress, onClose, keyboardHeight, isDismissingKeyboard]);

  useEffect(() => {
    if (onCommentsCountChange) {
      onCommentsCountChange(comments.length);
    }
  }, [comments.length, onCommentsCountChange]);

  const threadScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (threadScrollY) threadScrollY.value = event.contentOffset.y;
    },
  });

  useEffect(() => {
    if (visible) {
      setText('');
      setCommentsReady(false);
      hasScrolledRef.current = false;
      // Run morph animation
      expandProgress.value = 0;
      expandProgress.value = withSpring(1, { damping: 26, mass: 0.5, stiffness: 350 });

      const timer = setTimeout(() => {
        setCommentsReady(true);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      expandProgress.value = withTiming(0, { duration: 200 });
    }
  }, [visible, autoFocusReply, expandProgress]);

  const prevCommentsLengthRef = useRef(comments.length);
  useEffect(() => {
    if (visible && commentsReady && comments.length > prevCommentsLengthRef.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
    prevCommentsLengthRef.current = comments.length;
  }, [comments.length, visible, commentsReady]);

  // Aggressive scroll to bottom when auto focusing a reply
  useEffect(() => {
    if (visible && commentsReady && autoFocusReply) {
      // Actively poll scrollToEnd for 600ms to guarantee it rides the keyboard animation
      // and overcomes any late layout changes or image loads.
      const interval = setInterval(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
      setTimeout(() => clearInterval(interval), 600);
    }
  }, [visible, commentsReady, autoFocusReply]);

  const handleSend = async () => {
    if (!canSend || !post) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      await createComment(post.id, content, currentUserTenantId, currentUserId);
    } finally {
      setSending(false);
    }
  };

  if (!post) return null;

  const displayName = authorName || post.authorId?.slice(0, 8) || 'Unknown';
  const timeAgo = formatTimeAgo(new Date(post.createdAt).toISOString());

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

  const animatedContainerStyle = useAnimatedStyle(() => {
    // The Composer height already includes safe area bottom padding, so we just use it directly
    const composerHeight = composerHeightBase?.value ?? 54;
    const kbOffset = Math.max(0, -keyboardHeight.value);

    if (!originLayout) {
      return {
        position: 'absolute',
        top: insets.top + 64,
        bottom: composerHeight + 4 + kbOffset,
        left: 12,
        right: 12,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        // Keep fully opaque the moment it starts moving
        opacity: expandProgress.value > 0.001 ? 1 : 0,
      };
    }

    // Custom Expansion: origin = card position, destination = edge-to-edge
    return {
      position: 'absolute',
      top: interpolate(expandProgress.value, [0, 1], [originLayout.y, insets.top + 64]),
      bottom: interpolate(expandProgress.value, [0, 1], [SCREEN_HEIGHT - originLayout.y - originLayout.height, composerHeight + 4 + kbOffset]),
      left: originLayout.x,
      right: SCREEN_WIDTH - originLayout.x - originLayout.width,
      borderTopLeftRadius: interpolate(expandProgress.value, [0, 1], [28, 28]),
      borderTopRightRadius: interpolate(expandProgress.value, [0, 1], [28, 28]),
      borderBottomLeftRadius: interpolate(expandProgress.value, [0, 1], [28, 28]),
      borderBottomRightRadius: interpolate(expandProgress.value, [0, 1], [28, 28]),
      // Keep fully opaque the moment it starts moving
      opacity: expandProgress.value > 0.001 ? 1 : 0,
    };
  });

  return (
    <Animated.View
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 55, pointerEvents: visible ? 'box-none' : 'none' }]}
    >
      {/* ── Background fill: matches the app bg exactly so rounded corners show clean screen, not feed cards ── */}
      <Animated.View
        pointerEvents="none"
        style={[{
          position: 'absolute', top: insets.top + 64, left: 0, right: 0, bottom: 0,
          backgroundColor: bgColor,
        }, useAnimatedStyle(() => ({ opacity: expandProgress.value }))]}
      />
      <Animated.View style={[animatedContainerStyle, {
        backgroundColor: cardColor,
        overflow: 'hidden',
      }]}>
        <Animated.FlatList
          ref={scrollRef as any}
          style={{ flex: 1 }}
          data={comments}
          keyExtractor={(item: any) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onScroll={threadScrollHandler}
          scrollEventThrottle={16}
          onContentSizeChange={(w, h) => {
            // Standard content size change scrolling logic
          }}
          ListHeaderComponent={
            <>
              <View>
                <PostCard log={post} channelEventTypes={channelEventTypes} isThreadView={true} />
              </View>

              <View style={{ marginTop: -6, marginBottom: 10 }}>
                <View className="flex-row px-4">
                  <View style={{ width: 36 }} className="mr-3" />
                  <View className="flex-1">
                    <View style={{ marginLeft: -52, marginRight: -4, height: 0.5, backgroundColor: borderColor }} />
                  </View>
                </View>
              </View>

              {!(commentsReady || preloadedComments.length > 0 || repliesCount === 0) && (
                <View style={{ paddingHorizontal: 12, opacity: 0.5 }}>
                  <View style={{ height: 64, backgroundColor: borderColor, borderRadius: 16, marginBottom: 12 }} />
                  <View style={{ height: 80, backgroundColor: borderColor, borderRadius: 16, marginBottom: 12, width: '85%' }} />
                  <View style={{ height: 50, backgroundColor: borderColor, borderRadius: 16, marginBottom: 12, alignSelf: 'flex-end', width: '70%' }} />
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            commentsReady && comments.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="chatbubbles-outline" size={40} color={secondaryColor} />
                <Text style={{ color: secondaryColor, marginTop: 10, fontSize: 14 }}>
                  No Chats yet. Start the conversation!
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={<View style={{ height: 44 }} />}
          renderItem={({ item: c }: any) => (
            <View className="flex-row px-4">
              <View style={{ width: 36 }} className="mr-3" />
              <View className="flex-1">
                <View style={{ marginLeft: -52, marginRight: -4 }}>
                  <InlineReplyBubble
                    comment={c}
                    isSelf={c.authorId === currentUserId}
                    isDark={isDark}
                    onReply={(commentObj, name) => {
                      onReplyToComment?.(commentObj, name);
                    }}
                    onLike={async () => {
                      await database.write(async () => {
                        await database.collections.get('reactions').create(record => {
                          record._raw.id = Math.random().toString();
                          (record as any).tenantId = currentUserTenantId;
                          (record as any).commentId = c.id;
                          (record as any).userId = 'local-user';
                          (record as any).type = 'heart';
                          (record as any).createdAt = Date.now();
                          (record as any).updatedAt = Date.now();
                        });
                      });
                    }}
                  />
                </View>
              </View>
            </View>
          )}
        />

        {/* Soft Fade Gradient at Bottom */}
        <LinearGradient
          colors={[
            isDark ? 'rgba(29, 42, 53, 0)' : 'rgba(255, 255, 255, 0)',
            isDark ? 'rgba(29, 42, 53, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            isDark ? 'rgba(29, 42, 53, 1)' : 'rgba(255, 255, 255, 1)'
          ]}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, pointerEvents: 'none' }}
        />

        {/* Floating Swipe Bar */}
        <GestureDetector gesture={pan}>
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <View style={{
              width: 48,
              height: 4,
              borderRadius: 2,
              backgroundColor: secondaryColor,
              opacity: 0.5
            }} />
          </View>
        </GestureDetector>
      </Animated.View>
    </Animated.View>
  );
}

// Removed withObservables wrapper so the modal mounts instantly
const ThreadModal = ThreadModalInner as any;

// ─── Post Card ────────────────────────────────────────────────────────────────
const PostCardInner = React.memo(function PostCardInner({ log, author, comments: rawComments, reactions, channelEventTypes = [], onOpenThread, onReplyPress, isThreadView }: {
  log: Post; author: User; comments: Comment[]; reactions: any[]; channelEventTypes?: ChannelEventType[];
  onOpenThread?: (post: Post, layout?: any, repliesCount?: number, preloadedComments?: Comment[]) => void;
  onReplyPress?: (post: Post, authorName: string, layout?: any, repliesCount?: number, preloadedComments?: Comment[]) => void;
  isThreadView?: boolean;
}) {
  const comments = useMemo(() => rawComments?.filter(c => c.postId === log.id) || [], [rawComments, log.id]);
  const cardRef = useRef<View>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (cardRef.current && !isThreadView) {
      globalPostCardRefs.set(log.id, cardRef.current);
    }
    return () => {
      if (!isThreadView) globalPostCardRefs.delete(log.id);
    };
  }, [log.id, isThreadView]);

  useEffect(() => {
    if (author?.id && author?.name) {
      userNameCache.set(author.id, author.name);
    }
  }, [author?.id, author?.name]);

  const isDark = colorScheme === 'dark';
  const isAlert = log.isPinned;

  const draftKey = `draft_${log.channelId}_${log.id}`;
  const draftText = useDraftsStore((state) => state.drafts[draftKey]);

  let eventTypeLabel = log.eventType || null;
  let eventTypeColor = '#3b82f6';
  let TagIconComp: any = LucideIcons.Tag;

  if (eventTypeLabel) {
    const matchedTag = channelEventTypes.find(t => t.name === eventTypeLabel);
    if (matchedTag) {
      eventTypeColor = matchedTag.color;
      TagIconComp = matchedTag.icon;
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
    caption = eventTypeLabel;
  } else if (log.subject) {
    caption = 'Logged an activity';
  }

  const replies = comments.length;
  const retweets = 0;
  const likes = reactions.length;
  const views = Math.floor(Math.random() * 500) + 50;

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
      <View className="items-center my-1 mx-3 mb-3">
        <View className="px-5 py-2 rounded-full max-w-[85%] bg-surface-card">
          <Text className="text-[13px] font-medium text-center text-text-secondary" style={{ lineHeight: 18 }}>
            {log.content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        cardRef.current?.measure((x, y, w, h, pageX, pageY) => {
          const layout = { x: pageX, y: pageY, width: w, height: h };
          if (onOpenThread) {
            onOpenThread(log, layout, replies, comments.slice(0, 3));
          }
        });
      }}
    >
      <Animated.View
        ref={cardRef as any}
        sharedTransitionTag={`post-${log.id}`}
        className={`flex-row px-4 py-4 rounded-[28px] ${isThreadView ? '' : 'mb-3 mx-3'}`}
        style={{ backgroundColor: isDark ? '#1d2a35' : '#ffffff' }}
      >
        {/* Left Column: Tag/Alert Icon */}
        <View style={{
          backgroundColor: leftIconColor,
          borderRadius: 18,
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 4,
        }} className="mr-3">
          {isAlert ? (
            <Ionicons name="warning" size={20} color="#ffffff" />
          ) : eventTypeLabel ? (
            <Ionicons name={getIconName(TagIconComp) as any} size={20} color="#ffffff" />
          ) : (
            <Ionicons name="document-text" size={20} color="#ffffff" />
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
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() => {
                cardRef.current?.measure((x, y, w, h, pageX, pageY) => {
                  const layout = { x: pageX, y: pageY, width: w, height: h };
                  if (onReplyPress) {
                    onReplyPress(log, author?.name || log.authorId?.slice(0, 8) || 'Unknown', layout, replies, comments.slice(0, 3));
                  } else if (onOpenThread) {
                    onOpenThread(log, layout, replies, comments.slice(0, 3));
                  }
                });
              }}
            >
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

          {/* ── Inline Reply Thread (WhatsApp-style, max 3 bubbles) AND Draft ── */}
          {!isThreadView && (comments.length > 0 || draftText) && (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', marginLeft: -52, marginRight: -4 }}>
              {comments.slice(0, 3).map(c => (
                <InlineReplyBubble
                  key={c.id}
                  comment={c}
                  isSelf={c.authorId === log.authorId}
                  isDark={isDark}
                />
              ))}

              {/* Draft Indicator mimicking a chat bubble but without bg */}
              {draftText ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    cardRef.current?.measure((x, y, w, h, pageX, pageY) => {
                      const layout = { x: pageX, y: pageY, width: w, height: h };
                      if (onReplyPress) {
                        onReplyPress(log, author?.name || log.authorId?.slice(0, 8) || 'Unknown', layout, replies, comments.slice(0, 3));
                      }
                    });
                  }}
                  style={{ 
                    marginTop: comments.length > 0 ? 4 : 0,
                    marginBottom: 0, 
                    paddingTop: comments.length > 0 ? 12 : 0,
                    paddingBottom: 4,
                    flexDirection: 'row', 
                    alignItems: 'flex-start', 
                    paddingLeft: 8, 
                    paddingRight: 16,
                    borderTopWidth: comments.length > 0 ? 0.5 : 0,
                    borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
                  }}
                >
                  <View style={{ marginRight: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}>
                    <LucideIcons.Edit2 size={16} color="#c13c70" />
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center', minHeight: 36 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#c13c70', marginBottom: 2 }}>
                      Draft
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, color: isDark ? '#6e767d' : '#8899a6' }}>
                      {draftText}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {comments.length > 3 && (
                <TouchableOpacity
                  onPress={() => {
                    cardRef.current?.measure((x, y, w, h, pageX, pageY) => {
                      const layout = { x: pageX, y: pageY, width: w, height: h };
                      if (onReplyPress) {
                        onReplyPress(log, author?.name || log.authorId?.slice(0, 8) || 'Unknown', layout, replies, comments.slice(0, 3));
                      }
                    });
                  }}
                  style={{ marginTop: 4, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#c13c70' }}>
                    View all {comments.length} Chats
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color="#c13c70" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

const PostCard = withObservables(['log'], ({ log }: { log: Post; channelEventTypes?: any; onOpenThread?: any; onReplyPress?: any; isThreadView?: boolean }) => ({
  log,
  author: log.author.observe(),
  comments: log.comments.observe(),
  reactions: log.reactions.observe(),
}))(PostCardInner as any);

// ─── Speed Dial FAB ───────────────────────────────────────────────────────────
interface SpeedDialItem {
  eventType: ChannelEventType | null; // null = general post
  label: string;
  icon: any;
  color: string;
}

// ─── Composer ───────────────────────────────────────────────────────────
interface ComposerProps {
  isDark: boolean;
  replyTargetName: string;
  replyTarget?: any;
  onClearReply?: () => void;
  onReplyBarPress: () => void;
  text: string;
  onChangeText: React.Dispatch<React.SetStateAction<string>>;
  onSend: () => void;
  sending: boolean;
  isThreadOpen?: boolean;
  autoFocusTrigger?: number;
  channelEventTypes?: ChannelEventType[];
  isReplyBoxCollapsed?: boolean;
  isHidden?: boolean;
  onHeightChange?: (height: number) => void;
}

interface SpeedDialFABProps {
  items: SpeedDialItem[];
  isDark: boolean;
  onSelect: (item: SpeedDialItem) => void;
  visible: boolean;
}

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
  }));

  const iconName = item.icon;
  const iconBg = item.color;
  const iconColor = '#ffffff';

  return (
    <Animated.View style={style}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => onSelect(item)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Text style={{
          fontSize: 19, fontWeight: '600', letterSpacing: -0.2,
          color: isDark ? '#ffffff' : '#0f0f0f',
        }}>
          {item.label}
        </Text>
        <View style={{
          width: 44, height: 44, borderRadius: 22, backgroundColor: iconBg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={getIconName(iconName) as any} size={22} color={iconColor} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SpeedDialFAB({ items, isDark, onSelect, visible }: SpeedDialFABProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const fabRotation = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const insets = useSafeAreaInsets();
  
  const bottomOffset = Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 8;
  const bottomPadding = 6;

  const openDial = () => {
    setOpen(true);
    setActive(true);
    fabRotation.value = withTiming(45, { duration: 120 });
    overlayOpacity.value = withTiming(1, { duration: 100 });
  };

  const closeDial = () => {
    setActive(false);
    fabRotation.value = withTiming(0, { duration: 100 });
    overlayOpacity.value = withTiming(0, { duration: 100 });
    setTimeout(() => setOpen(false), 120);
  };

  const handleSelect = (item: SpeedDialItem) => {
    closeDial();
    setTimeout(() => onSelect(item), 150);
  };

  const xIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${fabRotation.value}deg` }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const fabLiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 0 }],
  }));

  if (!visible && !open) return null;

  return (
    <>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 65,
          backgroundColor: isDark ? 'rgba(21,32,43,0.93)' : 'rgba(255,255,255,0.93)',
        }, overlayStyle]}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeDial} />
      </Animated.View>

      <Animated.View style={[{
        position: 'absolute',
        bottom: bottomPadding,
        right: 12,
        zIndex: 70,
      }, fabLiftStyle]}>
        <Animated.View entering={ZoomIn.duration(120)} exiting={ZoomOut.duration(120)} layout={LinearTransition.springify().damping(16).mass(0.4).stiffness(300)}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={open ? closeDial : openDial}
            style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: isDark ? '#880034' : '#780532',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Animated.View style={xIconStyle}>
              {React.createElement(LucideIcons.Plus as any, {
                size: 26,
                color: isDark ? '#15202b' : '#f2f2f7',
                strokeWidth: 2.0
              })}
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[{
        position: 'absolute',
        bottom: bottomPadding + 48 + 12 + 8,
        zIndex: 70,
        right: 14,
        alignItems: 'flex-end',
        flexDirection: 'column-reverse',
      }, fabLiftStyle]} pointerEvents={open ? 'box-none' : 'none'}>
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
      </Animated.View>
    </>
  );
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

function Composer({ isDark, replyTargetName, replyTarget, onClearReply, onReplyBarPress, text, onChangeText, onSend, sending, isThreadOpen, autoFocusTrigger, channelEventTypes, isReplyBoxCollapsed, isHidden, onHeightChange }: ComposerProps) {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isEmojiMode, setIsEmojiMode] = useState(false);
  const [renderEmojiPanel, setRenderEmojiPanel] = useState(false);

  const savedKbHeight = useSharedValue(320);
  const manualLift = useSharedValue(0);
  const isSwitchingToKeyboard = useSharedValue(false);
  const isEmojiSearching = useSharedValue(false);

  const handleEmojiSelected = useCallback((emoji: string) => {
    onChangeText((prev: string) => prev + emoji);
  }, [onChangeText]);

  useEffect(() => {
    if (autoFocusTrigger && autoFocusTrigger > 0) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [autoFocusTrigger]);

  const handleSearchStateChange = useCallback((isSearching: boolean) => {
    isEmojiSearching.value = isSearching;
  }, [isEmojiSearching]);

  useEffect(() => {
    let mounted = true;
    const kShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        if (!mounted) return;
        savedKbHeight.value = e.endCoordinates.height;
        setKeyboardVisible(true);
      }
    );
    const kShowEnd = Keyboard.addListener('keyboardDidShow', () => {
      if (!mounted) return;
      setTimeout(() => {
        if (isSwitchingToKeyboard.value) {
          isSwitchingToKeyboard.value = false;
          manualLift.value = withTiming(0, { duration: 150 });
          setRenderEmojiPanel(false);
        }
      }, 250);
    });
    const kHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        if (!mounted) return;
        setKeyboardVisible(false);
      }
    );
    return () => { mounted = false; kShow.remove(); kShowEnd.remove(); kHide.remove(); };
  }, []);

  useEffect(() => {
    const handleBackPress = () => {
      if (isEmojiMode) {
        manualLift.value = withTiming(0, { duration: 150 }, (finished) => {
          if (finished) {
            runOnJS(setIsEmojiMode)(false);
            runOnJS(setRenderEmojiPanel)(false);
          }
        });
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [isEmojiMode, manualLift]);

  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  useAnimatedReaction(
    () => keyboardHeight.value,
    (currentHeight) => {
      if (isSwitchingToKeyboard.value && currentHeight <= manualLift.value + 15) {
        isSwitchingToKeyboard.value = false;
        manualLift.value = withTiming(0, { duration: 150 });
        runOnJS(setRenderEmojiPanel)(false);
      }
    }
  );

  const activeTranslateY = useDerivedValue(() => {
    'worklet';
    if (isEmojiMode && keyboardHeight.value < -10 && isEmojiSearching.value) {
      return keyboardHeight.value - 108;
    }
    return Math.min(keyboardHeight.value, manualLift.value);
  });

  const bottomOffset = Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 8;
  const bottomPadding = (isKeyboardVisible || isEmojiMode) ? 6 : bottomOffset;
  const glassmorphicBg = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1718';
  const placeholderCol = isDark ? '#D1D5DB' : '#6B7280';

  const hiddenTranslateY = useDerivedValue(() => {
    const hideOffset = (isHidden && !isKeyboardVisible && text.trim().length === 0) ? 200 : 0;
    return withTiming(hideOffset, { duration: 250 });
  });

  const hiddenOpacity = useDerivedValue(() => {
    const targetOpacity = (isHidden && !isKeyboardVisible && text.trim().length === 0) ? 0 : 1;
    return withTiming(targetOpacity, { duration: 250 });
  });

  const liftStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: activeTranslateY.value + hiddenTranslateY.value }],
      opacity: hiddenOpacity.value,
    };
  });

  const fabLiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: activeTranslateY.value }],
  }));

  let eventIconName = 'pricetag'; // default Ionicons fallback
  let eventIconColor = '#3b82f6';
  const evtType = replyTarget?.eventType || replyTarget?._raw?.event_type;
  
  if (evtType) {
    if (channelEventTypes) {
      const matchedTag = channelEventTypes.find(t => t.name === evtType || t.name.toLowerCase() === evtType.toLowerCase());
      if (matchedTag) {
        eventIconColor = matchedTag.color;
        eventIconName = matchedTag.icon;
      }
    }
  }

  return (
    <>
      <Animated.View 
        onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
        style={[{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
      }, liftStyle]}>
        {/* Reply Preview Card */}
        {replyTarget && (!isThreadOpen || ('postId' in replyTarget)) && !isReplyBoxCollapsed && (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 8,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onReplyBarPress}
              style={{
                padding: 12,
                backgroundColor: isDark ? '#253341' : '#e8e4e5',
                borderRadius: 24,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ width: 36, height: 36 }}>
                <Image
                  source={{ uri: `https://i.pravatar.cc/150?u=${encodeURIComponent(replyTarget.authorId)}` }}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
                />
                {evtType && (
                  <View style={{ 
                    position: 'absolute', 
                    bottom: -4, 
                    right: -4, 
                    backgroundColor: isDark ? '#253341' : '#e8e4e5', 
                    borderRadius: 12, 
                    padding: 2 
                  }}>
                    <View style={{
                      backgroundColor: eventIconColor,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Ionicons name={getIconName(eventIconName) as any} size={12} color="#ffffff" />
                    </View>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: textColor, fontWeight: '700', fontSize: 14 }}>
                  Replying to {replyTargetName}
                </Text>
                <Text style={{ color: placeholderCol, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
                  {('subject' in replyTarget ? replyTarget.subject : undefined) || replyTarget.content || 'No content'}
                </Text>
              </View>
              {onClearReply && (
                <TouchableOpacity onPress={onClearReply} style={{ padding: 4, paddingLeft: 12 }}>
                  <Ionicons name="close" size={20} color={placeholderCol} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View
          style={{
            paddingBottom: bottomPadding,
            paddingHorizontal: 8,
            paddingTop: 6,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            backgroundColor: 'transparent',
          }}
          pointerEvents={'box-none'}
        >
          {/* Static Background layer */}
          <View
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
              backgroundColor: isDark ? '#15202b' : '#f2f2f7'
            }}
          />

          {/* Composer Field Container */}
          <View
            style={{
              flex: 1,
              backgroundColor: glassmorphicBg,
              borderRadius: 24,
              flexDirection: 'row',
              alignItems: 'flex-end',
              paddingHorizontal: 12,
              minHeight: 48,
              maxHeight: 200,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }}
          >
            {/* Emoji */}
            <TouchableOpacity
              onPress={() => {
                if (isEmojiMode) {
                  isSwitchingToKeyboard.value = true;
                  inputRef.current?.focus();
                  setIsEmojiMode(false);
                } else {
                  const kbh = savedKbHeight.value || 320;
                  manualLift.value = keyboardHeight.value < 0 ? keyboardHeight.value : -kbh;
                  setIsEmojiMode(true);
                  setRenderEmojiPanel(true);
                  setKeyboardVisible(false);
                  Keyboard.dismiss();
                }
              }}
              style={{ marginRight: 8, marginBottom: 11 }}
            >
              {isEmojiMode ? (
                <LucideIcons.Keyboard size={24} color={placeholderCol} strokeWidth={2.2} />
              ) : (
                <LucideIcons.Smile size={24} color={placeholderCol} strokeWidth={2.2} />
              )}
            </TouchableOpacity>
            {text.length === 0 && (
              <Text
                style={{
                  position: 'absolute',
                  left: 48,
                  right: 70,
                  top: 13,
                  fontSize: 18,
                  lineHeight: 24,
                  color: placeholderCol,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
                pointerEvents="none"
              >
                {replyTargetName ? `Reply ${replyTargetName}…` : 'Write an update...'}
              </Text>
            )}

            <TextInput
              ref={inputRef as any}
              style={{
                flex: 1,
                fontSize: 18,
                lineHeight: 24,
                color: textColor,
                textAlignVertical: 'top',
                paddingTop: Platform.OS === 'ios' ? 12 : 12,
                paddingBottom: Platform.OS === 'ios' ? 12 : 12,
                paddingHorizontal: 4,
              }}
              placeholder=""
              value={text}
              onChangeText={onChangeText}
              onFocus={() => {
                if (isEmojiMode) {
                  setIsEmojiMode(false);
                }
                if (onReplyBarPress) onReplyBarPress();
              }}
              multiline
              cursorColor={isDark ? '#FF7F57' : '#D47255'}
            />

            <View>
              <TouchableOpacity onPress={() => Alert.alert('Coming Soon', 'Attachment')} style={{ paddingHorizontal: 6, marginBottom: 11 }}>
                <Ionicons name="attach" size={24} color={placeholderCol} style={{ transform: [{ rotate: '-45deg' }] }} />
              </TouchableOpacity>
            </View>

            {text.trim().length === 0 && (
              <View>
                <TouchableOpacity onPress={() => Alert.alert('Coming Soon', 'Camera')} style={{ paddingLeft: 6, marginBottom: 11 }}>
                  <LucideIcons.Camera size={24} color={placeholderCol} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {text.trim().length === 0 && (
            <View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Alert.alert('Coming Soon', 'Voice recording')}
                style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="mic" size={24} color={isDark ? '#FF7F57' : '#D47255'} />
              </TouchableOpacity>
            </View>
          )}

          {/* Unified Right Action Button Placeholder */}
          <View style={{ width: 48, height: 48 }} />
        </View>
      </Animated.View>

      {/* ── ACTUAL Send Action Button (Above Overlay) ── */}
      <Animated.View style={[{
        position: 'absolute',
        bottom: bottomPadding,
        right: 12,
        zIndex: 70,
      }, fabLiftStyle]}>
        {!isThreadOpen && text.trim().length === 0 ? null : (
          <View>
            <TouchableOpacity
              activeOpacity={isThreadOpen && text.trim().length > 0 ? 0.7 : 1}
              disabled={!(isThreadOpen && text.trim().length > 0) || sending}
              onPress={() => {
                if (isThreadOpen && text.trim().length > 0) {
                  onSend();
                }
              }}
              style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: (isThreadOpen && text.trim().length > 0) ? (isDark ? '#880034' : '#780532') : (isDark ? '#253341' : '#e8e4e5'),
                alignItems: 'center', justifyContent: 'center',
                paddingLeft: 2,
              }}
            >
              {(isThreadOpen && text.trim().length > 0 && sending) ? (
                <Ionicons name="hourglass-outline" size={20} color="#ffffff" />
              ) : (
                <Ionicons name="send" size={20} color={(isThreadOpen && text.trim().length > 0) ? "#ffffff" : (isDark ? '#8899a6' : '#7a7577')} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* ── WhatsApp-style Inline Emoji Panel ── */}
      <Animated.View
        style={[{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: isDark ? '#1d2a35' : '#ffffff',
          zIndex: isEmojiMode ? 55 : -1,
          opacity: isEmojiMode ? 1 : 0,
        },
        useAnimatedStyle(() => {
          const height = isEmojiSearching.value ? 108 : (savedKbHeight.value || 320);
          if (isEmojiMode && keyboardHeight.value < -10 && isEmojiSearching.value) {
            return { height, transform: [{ translateY: keyboardHeight.value }] };
          }
          const ty = height + activeTranslateY.value;
          return { height, transform: [{ translateY: Math.max(0, ty) }] };
        })]}
        pointerEvents={isEmojiMode ? 'box-none' : 'none'}
      >
        <EmojiPickerPanel
          onEmojiSelected={handleEmojiSelected}
          isDark={isDark}
          onSearchStateChange={handleSearchStateChange}
        />
      </Animated.View>
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
  const canSend = content.trim().length > 0 && !isSending;

  const bgColor = isDark ? '#15202b' : '#f2f2f7';
  const cardColor = isDark ? '#1d2a35' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1718';
  const secondaryColor = isDark ? '#8899a6' : '#7a7577';
  const borderColor = isDark ? '#253341' : '#e8e4e5';
  const pillBg = isDark ? 'rgba(255,255,255,0.08)' : '#f2f2f7';

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

  const iconName = selectedItem?.icon ?? 'document-text';
  const accentColor = selectedItem?.color ?? (isDark ? '#880034' : '#780532');
  const eventLabel = selectedItem?.label ?? 'General Post';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: bgColor }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* ── Header (Matches [id] navigation header styling) ── */}
        <View style={{ backgroundColor: bgColor, paddingTop: insets.top }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>

            {/* Cancel (Matches Back Button) */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleClose}
              style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            >
              {React.createElement(LucideIcons.X as any, { size: 26, color: textColor, strokeWidth: 2.5 })}
            </TouchableOpacity>

            {/* Title */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }} numberOfLines={1}>
                New Post
              </Text>
              <Text style={{ fontSize: 13, color: secondaryColor, marginTop: 1 }} numberOfLines={1}>
                {channelName}
              </Text>
            </View>

            {/* Options Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert('Coming Soon', 'Composer options')}
              style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="ellipsis-horizontal" size={26} color={textColor} />
            </TouchableOpacity>

          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 20 }}
          >
            {/* ── Post Card Template ── */}
            <View
              className="flex-row px-4 py-4 rounded-[28px] mb-3 mx-3"
              style={{ backgroundColor: cardColor }}
            >
              {/* Left Column: Event Type Icon */}
              <View className="mr-3 items-center pt-1.5 w-[36px] h-[36px] justify-center">
                <Ionicons name={getIconName(iconName) as any} size={24} color={accentColor} />
              </View>

              <View className="flex-1">
                {/* Header */}
                <View className="flex-row mb-1">
                  <Image
                    source={{ uri: 'https://i.pravatar.cc/150?u=Me' }}
                    className="w-[44px] h-[44px] rounded-full mr-2.5"
                    style={{ backgroundColor: pillBg }}
                  />
                  <View className="flex-1 justify-center">
                    <View className="flex-row items-center">
                      <Text className="text-[15px] font-bold" style={{ color: textColor }} numberOfLines={1}>
                        Me
                      </Text>
                      <Text className="text-[14px] ml-1.5 flex-shrink-0" style={{ color: secondaryColor }}>
                        · Draft
                      </Text>
                    </View>
                    <Text className="text-[14px] mt-0.5" style={{ color: secondaryColor }} numberOfLines={1}>
                      {eventLabel}
                    </Text>
                  </View>
                </View>

                {/* Content */}
                <View className="mt-1">
                  <TextInput
                    style={{
                      width: '90%',
                      fontSize: 15,
                      fontWeight: '700',
                      color: textColor,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: bgColor,
                      borderRadius: 20,
                      marginTop: 12,
                      marginBottom: 14,
                    }}
                    cursorColor={textColor}
                    selectionColor={textColor}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="Add a summary..."
                    placeholderTextColor={secondaryColor}
                    maxLength={80}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => contentInputRef.current?.focus()}
                  />

                  <TextInput
                    ref={contentInputRef}
                    style={{
                      fontSize: 15,
                      color: textColor,
                      lineHeight: 20,
                      minHeight: 120,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      backgroundColor: bgColor,
                      borderRadius: 20, // Increased rounded corners
                      textAlignVertical: 'top',
                    }}
                    cursorColor={textColor}
                    selectionColor={textColor}
                    value={content}
                    onChangeText={setContent}
                    placeholder="What's the update?"
                    placeholderTextColor={secondaryColor}
                    multiline
                    maxLength={1000}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Attachment Bar & Send Button (Matches Universal Composer Layout) */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 10,
            paddingBottom: Math.max(insets.bottom, 10),
            backgroundColor: bgColor,
          }}>
            {/* Far Left Group: Emoji, Attachment, Camera */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Alert.alert('Coming Soon', 'Emoji picker')}
                style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="happy-outline" size={26} color={secondaryColor} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Alert.alert('Coming Soon', 'Attachment')}
                style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="attach" size={26} color={secondaryColor} style={{ transform: [{ rotate: '-45deg' }] }} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Alert.alert('Coming Soon', 'Camera capture')}
                style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="camera" size={26} color={secondaryColor} />
              </TouchableOpacity>
            </View>

            {/* Far Right Group: Mic, Send Button */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Alert.alert('Coming Soon', 'Voice recording')}
                style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="mic" size={26} color={isDark ? '#FF7F57' : '#D47255'} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={handleSend}
                disabled={!canSend}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: canSend ? (isDark ? '#880034' : '#780532') : (isDark ? '#253341' : '#e8e4e5'),
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingLeft: 2, // Visual centering for paper plane icon
                }}
              >
                {isSending ? (
                  <Ionicons name="hourglass-outline" size={20} color={canSend ? '#ffffff' : (isDark ? '#8899a6' : '#7a7577')} />
                ) : (
                  <Ionicons name="send" size={20} color={canSend ? '#ffffff' : (isDark ? '#8899a6' : '#7a7577')} />
                )}
              </TouchableOpacity>
            </View>
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
  const router = useRouter();
  const { dbUser } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const flatListRef = useRef<any>(null);
  const isAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isExplicitReply, setIsExplicitReply] = useState(false);
  const [isComposerDismissed, setIsComposerDismissed] = useState(false);
  const [isReplyBoxCollapsed, setIsReplyBoxCollapsed] = useState(false);
  const composerHeightBase = useSharedValue(54);
  const suppressDraftLoadRef = useRef(false);
  const threadDraftModifiedRef = useRef(false);

  const scrollY = useSharedValue(0);

  const updateIsAtBottom = (atBottom: boolean) => {
    if (isAtBottomRef.current !== atBottom) {
      isAtBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
    }
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      runOnJS(updateIsAtBottom)(event.contentOffset.y <= 50);
    },
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadBoundaryId, setUnreadBoundaryId] = useState<string | null | 'NONE'>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerSending, setComposerSending] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);

  const [selectedDialItem, setSelectedDialItem] = useState<SpeedDialItem | null>(null);
  const [replyTarget, setReplyTarget] = useState<Post | null>(null);
  const [replyTargetAuthorName, setReplyTargetAuthorName] = useState('');
  const [threadPost, setThreadPost] = useState<Post | null>(null);
  const [threadVisible, setThreadVisible] = useState(false);
  const [isThreadScrolled, setIsThreadScrolled] = useState(false);
  const setDraft = useDraftsStore((state) => state.setDraft);
  const removeDraft = useDraftsStore((state) => state.removeDraft);

  const channelId = targetId;
  const activeTargetId = quotedComment?.id || threadPost?.id || replyTarget?.id || 'new_post';
  const draftKey = `draft_${channelId}_${activeTargetId}`;
  const draftKeyRef = useRef(draftKey);
  useEffect(() => { draftKeyRef.current = draftKey; }, [draftKey]);

  const handleComposerTextChange = useCallback((text: string | ((prev: string) => string)) => {
    setIsReplyBoxCollapsed(false);
    threadDraftModifiedRef.current = true;
    if (typeof text === 'function') {
      setComposerText((prev) => {
        const newText = text(prev);
        setDraft(draftKeyRef.current, newText);
        return newText;
      });
    } else {
      setComposerText(text);
      setDraft(draftKeyRef.current, text);
    }
  }, [setDraft]);

  useEffect(() => {
    if (!threadPost && isReplyBoxCollapsed && !isExplicitReply) {
      setComposerText('');
      return;
    }
    if (suppressDraftLoadRef.current) {
      suppressDraftLoadRef.current = false;
      return;
    }
    const existingDraft = useDraftsStore.getState().drafts[draftKey] || '';
    setComposerText(existingDraft);
  }, [draftKey, threadPost, isReplyBoxCollapsed, isExplicitReply]);
  const [threadReplyCount, setThreadReplyCount] = useState(0);
  const [threadPostAuthorName, setThreadPostAuthorName] = useState('');
  const [threadAutoFocus, setThreadAutoFocus] = useState(false);
  const [composerFocusTrigger, setComposerFocusTrigger] = useState(0);
  const [threadOriginLayout, setThreadOriginLayout] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const [quotedComment, setQuotedComment] = useState<Comment | null>(null);
  const [quotedCommentAuthorName, setQuotedCommentAuthorName] = useState('');

  const threadScrollY = useSharedValue(0);
  useAnimatedReaction(
    () => threadScrollY.value > 30,
    (scrolled, previous) => {
      if (scrolled !== previous) {
        runOnJS(setIsThreadScrolled)(scrolled);
      }
    }
  );
  const hasCheckedUnreadRef = useRef(false);
  const hasScrolledToUnreadRef = useRef(false);
  const hasFinishedInitialCheckRef = useRef(false);
  const sessionMaxReadTimeRef = useRef(0);

  const closeThreadTimeoutRef = useRef<any>(null);
  const clearCloseThreadTimeout = useCallback(() => {
    if (closeThreadTimeoutRef.current) {
      clearTimeout(closeThreadTimeoutRef.current);
      closeThreadTimeoutRef.current = null;
    }
  }, []);


  const name = channel?.name ?? 'Unknown Channel';
  const logs = posts;

  const latestLogsRef = useRef(logs);
  useEffect(() => { latestLogsRef.current = logs; }, [logs]);

  // ── Reset state on channel switch ───────────────────────────────────────────
  useEffect(() => {
    clearCloseThreadTimeout();
    setReplyTarget(null);
    setReplyTargetAuthorName('');
    setThreadPost(null);
    setThreadPostAuthorName('');
    setComposerText('');
    setThreadAutoFocus(false);
    setThreadOriginLayout(null);
    setQuotedComment(null);
    setQuotedCommentAuthorName('');
    return () => {
      clearCloseThreadTimeout();
    };
  }, [targetId, clearCloseThreadTimeout]);

  // ── Unread count ───────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      hasCheckedUnreadRef.current = false;
      hasScrolledToUnreadRef.current = false;
      setIsScrolled(false);
      setUnreadBoundaryId(null);

      if (logs.length > 0 && dbUser) {
        hasCheckedUnreadRef.current = true;
        database.adapter.getLocal(`channel_visited_${dbUser.id}_${targetId}`).then(async (lastVisitedStr) => {
          if (!isMounted) return;

          let lastVisitedAt = 0;
          if (lastVisitedStr) {
            lastVisitedAt = parseInt(lastVisitedStr, 10);
          } else {
            const installTimeStr = await database.adapter.getLocal(`install_time_${dbUser.id}`);
            lastVisitedAt = installTimeStr ? parseInt(installTimeStr, 10) : 0;
          }

          sessionMaxReadTimeRef.current = lastVisitedAt;

          let count = 0;
          let boundaryId: string | null = null;

          for (let i = 0; i < logs.length; i++) {
            if (new Date(logs[i].createdAt).getTime() > lastVisitedAt) {
              if (logs[i].authorId !== dbUser.id) {
                count++;
                boundaryId = logs[i].id;
              }
            }
          }

          setUnreadCount(count);
          setUnreadBoundaryId(boundaryId ?? 'NONE');
          hasFinishedInitialCheckRef.current = true;
        });
      } else if (logs.length === 0 && dbUser) {
        hasCheckedUnreadRef.current = true;
        setUnreadBoundaryId('NONE');
        // We DO NOT set hasFinishedInitialCheckRef to true here, because we haven't read anything yet.
        // This completely prevents the continuous sync race condition if messages arrive milliseconds later.
      }

      return () => {
        isMounted = false;
        hasFinishedInitialCheckRef.current = false;
      };
    }, [targetId, dbUser, logs.length === 0])
  );

  useEffect(() => {
    if (unreadBoundaryId !== null && logs.length > 0 && !hasScrolledToUnreadRef.current) {
      if (unreadBoundaryId !== 'NONE') {
        hasScrolledToUnreadRef.current = true;
        setTimeout(() => {
          try {
            const index = logs.findIndex(l => l.id === unreadBoundaryId);
            if (index !== -1) {
              flatListRef.current?.scrollToIndex({
                index,
                animated: false,
                viewPosition: 1
              });
            }
          } catch (e) {
            // Handled by onScrollToIndexFailed
          }
          // Small delay to allow the instant scroll to settle before making it visible
          setTimeout(() => setIsScrolled(true), 50);
        }, 50);
      } else {
        setIsScrolled(true);
      }
    } else if (unreadBoundaryId !== null && logs.length === 0) {
      setIsScrolled(true);
    }
  }, [unreadBoundaryId, logs.length]);

  // ── Advance Read Cursor strictly based on visibility ───────────────────────
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (!dbUser || viewableItems.length === 0 || !hasFinishedInitialCheckRef.current) return;

    let maxVisibleTime = 0;
    for (const v of viewableItems) {
      if (v.item && v.item.createdAt) {
        const time = new Date(v.item.createdAt).getTime();
        if (time > maxVisibleTime) {
          maxVisibleTime = time;
        }
      }
    }

    if (maxVisibleTime > sessionMaxReadTimeRef.current) {
      sessionMaxReadTimeRef.current = maxVisibleTime;
      database.adapter.setLocal(`channel_visited_${dbUser.id}_${targetId}`, maxVisibleTime.toString()).catch(() => { });
    }
  }, [dbUser, targetId]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // ── Avatar for channel header ──────────────────────────────────────────────
  let avatarConfig = AVATAR_CONFIGS.default;
  if (channel) {
    // @ts-ignore
    avatarConfig = AVATAR_CONFIGS[channel.category] ?? AVATAR_CONFIGS.default;
  }

  // ── Build Speed Dial items from channel event types ────────────────────────
  const speedDialItems: SpeedDialItem[] = [
    // Channel-specific event types (unreversed, maintaining creation order)
    ...(channel?.eventTypes ?? []).map((et: ChannelEventType): SpeedDialItem => ({
      eventType: et,
      label: et.name,
      icon: et.icon,
      color: et.color,
    })),
  ];

  // ── Auto-set reply target based on strict replying rule ─────────────────────────
  useEffect(() => {
    if (isComposerDismissed) return;
    if (isExplicitReply) return;
    if (composerText.trim().length > 0) return; // Don't hide if typing

    if (posts.length > 0) {
      const latestPost = posts[0];
      if (replyTarget?.id !== latestPost.id) {
        setReplyTarget(latestPost);
        const cachedName = userNameCache.get(latestPost.authorId);
        setReplyTargetAuthorName(cachedName || latestPost.authorId?.slice(0, 8) || 'Unknown');
        if (!cachedName) {
          database.collections.get<User>('users').find(latestPost.authorId).then(user => {
            if (user?.name) {
              userNameCache.set(user.id, user.name);
              setReplyTargetAuthorName(user.name);
            }
          }).catch(() => { });
        }
      }
    } else {
      if (replyTarget !== null) {
        setReplyTarget(null);
        setReplyTargetAuthorName('');
      }
    }
  }, [posts, isExplicitReply, composerText, replyTarget?.id, isComposerDismissed]);

  // ── Open ThreadModal (browse mode, no keyboard) ───────────────────────────
  const [threadPreloadedComments, setThreadPreloadedComments] = useState<Comment[]>([]);

  const handleOpenThread = useCallback((post: Post, layout?: any, repliesCount?: number, preloadedComments: Comment[] = []) => {
    clearCloseThreadTimeout();
    setIsComposerDismissed(false);
    threadDraftModifiedRef.current = false;
    
    // Explicitly load draft when opening thread
    const draftKey = `draft_${channel?.id}_${post.id}`;
    const existingDraft = useDraftsStore.getState().drafts[draftKey] || '';
    setComposerText(existingDraft);
    
    setThreadPost(post);
    setThreadVisible(true);
    setThreadPreloadedComments(preloadedComments);
    setThreadPostAuthorName(replyTargetAuthorName); // will be overridden by handleReplyPress
    setThreadAutoFocus(false);
    if (layout) setThreadOriginLayout(layout);
    if (repliesCount !== undefined) setThreadReplyCount(repliesCount);
  }, [replyTargetAuthorName, clearCloseThreadTimeout]);

  const handleComposerSend = async () => {
    if (!composerText.trim() || !channel) return;
    const content = composerText.trim();
    setComposerText('');
    removeDraft(draftKey); // Clear the draft from AsyncStorage
    setComposerSending(true);
    setIsExplicitReply(false); // Reset explicit reply state after sending
    try {
      const target = threadPost || replyTarget;
      if (target) {
        await createComment(target.id, content, dbUser?.tenantId || '', dbUser?.id || 'local-user', quotedComment?.id);
        setQuotedComment(null);
        setQuotedCommentAuthorName('');
      } else {
        await createPost(content, channel.id, [], undefined, undefined);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setComposerSending(false);
    }
  };

  // ── Comment icon tap: switch target + open thread WITH keyboard ──────────────
  const handleReplyPress = useCallback((post: Post, authorName: string, layout?: any, repliesCount?: number, preloadedComments: Comment[] = []) => {
    clearCloseThreadTimeout();
    setIsComposerDismissed(false);
    setIsExplicitReply(true);
    setIsReplyBoxCollapsed(false);
    
    // Explicitly load draft when replying
    const draftKey = `draft_${channel?.id}_${post.id}`;
    const existingDraft = useDraftsStore.getState().drafts[draftKey] || '';
    setComposerText(existingDraft);
    
    setReplyTarget(post);
    setReplyTargetAuthorName(authorName);
    setThreadPost(post);
    setThreadVisible(true);
    setThreadPreloadedComments(preloadedComments);
    setThreadPostAuthorName(authorName);
    setThreadAutoFocus(true);
    setComposerFocusTrigger(prev => prev + 1);
    if (layout) setThreadOriginLayout(layout);
    if (repliesCount !== undefined) setThreadReplyCount(repliesCount);
  }, [clearCloseThreadTimeout]);

  // ── Close Thread ──────────────────────────────────────────────────────────
  const handleCloseThread = useCallback(() => {
    setThreadVisible(false);
    threadScrollY.value = 0;
    clearCloseThreadTimeout();
    closeThreadTimeoutRef.current = setTimeout(() => {
      const currentThreadPost = threadPost;
      
      setThreadPost(null);
      setThreadOriginLayout(null);
      setQuotedComment(null);
      setQuotedCommentAuthorName('');
      
      if (currentThreadPost) {
        const threadDraftKey = `draft_${channel?.id}_${currentThreadPost.id}`;
        const threadDraft = useDraftsStore.getState().drafts[threadDraftKey] || '';
        
        if (threadDraft.trim().length > 0 && threadDraftModifiedRef.current) {
          // Keep this thread as the active reply target on the feed
          setReplyTarget(currentThreadPost);
          setReplyTargetAuthorName(threadPostAuthorName);
          setIsExplicitReply(true);
          setIsReplyBoxCollapsed(false);
        } else {
          // Normal feed fallback logic
          const target = replyTarget || (posts.length > 0 ? posts[0] : null);
          if (target) {
            const feedDraftKey = `draft_${channel?.id}_${target.id}`;
            const feedDraft = useDraftsStore.getState().drafts[feedDraftKey] || '';
            if (!isExplicitReply && !feedDraft.trim()) {
              setIsReplyBoxCollapsed(true);
            }
          }
        }
      }
      
      closeThreadTimeoutRef.current = null;
    }, 300);
  }, [threadScrollY, clearCloseThreadTimeout, isExplicitReply, replyTarget, posts, channel?.id, threadPost, threadPostAuthorName]);

  // ── Footer bar tap: use current replyTarget, open with keyboard ────────────
  const handleReplyBarPress = useCallback(() => {
    if (threadPost) return;
    const target = replyTarget || (posts.length > 0 ? posts[0] : null);
    if (!target) return;

    setIsReplyBoxCollapsed(false);

    // Explicitly load draft when opening thread via composer bar tap
    const draftKey = `draft_${channel?.id}_${target.id}`;
    const existingDraft = useDraftsStore.getState().drafts[draftKey] || '';
    setComposerText(existingDraft);

    const openThread = (layout?: any) => {
      clearCloseThreadTimeout();
      if (layout) setThreadOriginLayout(layout);
      else setThreadOriginLayout(null);
      setThreadPost(target);
      setThreadVisible(true);
      setThreadPostAuthorName(replyTargetAuthorName);
      setThreadAutoFocus(true);
      setComposerFocusTrigger(prev => prev + 1);
    };

    const cardRef = globalPostCardRefs.get(target.id);
    if (cardRef && cardRef.measure) {
      cardRef.measure((x: number, y: number, w: number, h: number, px: number, py: number) => {
        if (py === undefined || w === undefined) {
          openThread();
        } else {
          openThread({ x: px, y: py, width: w, height: h });
        }
      });
    } else {
      openThread();
    }
  }, [replyTarget, replyTargetAuthorName, posts, threadPost, clearCloseThreadTimeout]);

  // ── Send handler (full composer) ───────────────────────────────────────────
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
  const glassmorphicBg = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const iconColor = isDark ? '#ffffff' : '#1a1718';
  const textColor = isDark ? '#ffffff' : '#1a1718';
  const placeholderColor = isDark ? '#8899a6' : '#7a7577';

  // ── Back handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (composerVisible) {
        setComposerVisible(false);
        return true;
      }
      if (threadPost) {
        handleCloseThread();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [composerVisible, threadPost]);

  useEffect(() => {
    if (!threadPost) {
      Keyboard.dismiss();
    }
  }, [threadPost]);

  // ── Thread Header Icon ────────────────────────────────────────────────────
  let headerEventTypeColor = '#3b82f6';
  let HeaderTagIconComp: any = LucideIcons.Tag;
  let hasHeaderEventIcon = false;
  let headerIsAlert = false;

  if (threadPost) {
    headerIsAlert = threadPost.isPinned;
    if (threadPost.eventType) {
      hasHeaderEventIcon = true;
      const matchedTag = channel?.eventTypes?.find(t => t.name === threadPost.eventType);
      if (matchedTag) {
        headerEventTypeColor = matchedTag.color;
        HeaderTagIconComp = matchedTag.icon;
      } else {
        const hash = threadPost.eventType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        headerEventTypeColor = SEMANTIC_COLORS[hash % SEMANTIC_COLORS.length];
      }
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#15202b' : '#f2f2f7' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <View style={{ zIndex: 20, position: 'absolute', top: 0, left: 0, right: 0 }}>
        <View style={{ backgroundColor: isDark ? '#15202b' : '#f2f2f7', paddingTop: insets.top }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => {
                if (threadPost) handleCloseThread();
                else if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
            >
              <Ionicons name="arrow-back-outline" size={26} color={iconColor} />
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {(!threadPost || !threadVisible) && (
                <Animated.View key="default-header" entering={FadeIn.duration(250)} exiting={FadeOut.duration(250)} style={{ alignItems: 'center', position: 'absolute' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 30 }}>
                    <Image
                      source={{ uri: avatarConfig.url }}
                      style={{ width: 24, height: 24, borderRadius: 12 }}
                    />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: textColor }} numberOfLines={1}>
                      {name}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: placeholderColor, marginTop: 1 }} numberOfLines={1}>
                    Day Shift • Shift D
                  </Text>
                </Animated.View>
              )}

              {threadPost && threadVisible && !(isThreadScrolled || threadAutoFocus) && (
                <Animated.View key="thread-header-simple" entering={FadeIn.duration(250)} exiting={FadeOut.duration(250)} style={{ alignItems: 'center', position: 'absolute' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: textColor }} numberOfLines={1}>
                      Post
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: placeholderColor, marginTop: 1 }} numberOfLines={1}>
                    {`${threadReplyCount} ${threadReplyCount === 1 ? 'Chat' : 'Chats'}`}
                  </Text>
                </Animated.View>
              )}

              {threadPost && threadVisible && (isThreadScrolled || threadAutoFocus) && (
                <Animated.View key="thread-header-detailed" entering={FadeIn.duration(250)} exiting={FadeOut.duration(250)} style={{ alignItems: 'center', position: 'absolute' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: (headerIsAlert || hasHeaderEventIcon) ? 30 : 0 }}>
                    {(headerIsAlert || hasHeaderEventIcon) && (
                      <View style={{
                        backgroundColor: headerIsAlert ? '#f59e0b' : headerEventTypeColor,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Ionicons
                          name={headerIsAlert ? 'warning' : getIconName(HeaderTagIconComp) as any}
                          size={12}
                          color="#ffffff"
                        />
                      </View>
                    )}
                    <Text style={{ fontSize: 16, fontWeight: '600', color: textColor }} numberOfLines={1}>
                      {threadPost.subject || threadPost.eventType || 'Thread'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: placeholderColor, marginTop: 1 }} numberOfLines={1}>
                    {`Reply to ${threadPostAuthorName}...`}
                  </Text>
                </Animated.View>
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="ellipsis-horizontal" size={26} color={iconColor} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Fade Overlay for smooth transition ── */}
        <LinearGradient
          colors={[
            isDark ? 'rgba(21, 32, 43, 1)' : 'rgba(242, 242, 247, 1)',
            isDark ? 'rgba(21, 32, 43, 0)' : 'rgba(242, 242, 247, 0)'
          ]}
          style={{ height: 32, width: '100%', position: 'absolute', bottom: -32 }}
          pointerEvents="none"
        />
      </View>

      {/* ── Feed ── */}
      <View style={{ flex: 1 }}>
        <Animated.FlatList
          ref={flatListRef}
          style={{ opacity: isScrolled ? 1 : 0 }}
          data={logs}
          keyExtractor={(item: any) => item.id}
          inverted
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
          contentContainerStyle={{
            paddingTop: Platform.OS === 'ios' ? 200 : 180, // Visually bottom: pushed up further to clear the FAB and add breathing room
            paddingBottom: insets.top + 88, // Visually top: spacing above the feed (header height + extra)
            flexGrow: 1,
            justifyContent: 'flex-end',
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEventThrottle={16}
          onScroll={scrollHandler}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 1 });
            }, 500);
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
          renderItem={({ item: log, index }) => (
            <View>
              {log.id === unreadBoundaryId && unreadCount > 0 && (
                <Animated.View
                  layout={LinearTransition.springify().damping(22).mass(0.6).stiffness(150)}
                  entering={ZoomIn.springify().damping(20).mass(0.5).stiffness(200)}
                  exiting={ZoomOut.duration(200)}
                  className="items-center my-1 mx-3 mb-3"
                >
                  <View className="px-5 py-2 rounded-full max-w-[85%]" style={{ backgroundColor: '#000000' }}>
                    <Text className="text-[13px] font-medium text-center" style={{ color: '#ffffff', lineHeight: 18 }}>
                      {unreadCount} new post{unreadCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </Animated.View>
              )}
              <PostCard
                log={log}
                channelEventTypes={channel?.eventTypes || []}
                onOpenThread={handleOpenThread}
                onReplyPress={handleReplyPress}
              />
            </View>
          )}
        />
      </View>

      {/* ── Speed Dial FAB ── */}
      <SpeedDialFAB
        items={speedDialItems}
        isDark={isDark}
        onSelect={(item) => {
          setSelectedDialItem(item);
          setComposerVisible(true);
        }}
        visible={!threadPost && !quotedComment && composerText.trim().length === 0}
      />

      {/* ── Universal Composer ── */}
      {posts.length > 0 && !isComposerDismissed && (replyTarget !== null || threadPost !== null) && (
        <Composer
          isDark={isDark}
          replyTargetName={quotedComment ? quotedCommentAuthorName : (threadPost ? threadPostAuthorName : replyTargetAuthorName)}
          replyTarget={quotedComment || replyTarget}
          onClearReply={(!threadPost || quotedComment) ? () => {
            if (quotedComment) {
              setQuotedComment(null);
              setQuotedCommentAuthorName('');
            } else {
              setComposerText('');
              setIsExplicitReply(false);
              setIsReplyBoxCollapsed(true);
              suppressDraftLoadRef.current = true;
              // We intentionally do NOT call setIsComposerDismissed(true) so the text field stays visible.
              // The useEffect auto-set logic will run since text is empty and isExplicitReply is false,
              // automatically resetting replyTarget to posts[0] (the default last recent post).
            }
          } : undefined}
          onReplyBarPress={handleReplyBarPress}
          text={composerText}
          onChangeText={handleComposerTextChange}
          onSend={handleComposerSend}
          sending={composerSending}
          isThreadOpen={!!threadPost}
          autoFocusTrigger={composerFocusTrigger}
          channelEventTypes={channel?.eventTypes || []}
          isReplyBoxCollapsed={isReplyBoxCollapsed}
          isHidden={!isAtBottom && !threadPost}
          onHeightChange={(h) => { composerHeightBase.value = h; }}
        />
      )}

      {/* ── Full Screen Composer Modal ── */}
      <ComposerModal
        visible={composerVisible}
        selectedItem={selectedDialItem}
        channelName={name}
        isDark={isDark}
        onClose={() => setComposerVisible(false)}
        onSend={handleSend}
      />

      {/* ── Thread Modal ── */}
      {threadPost && (
        <ThreadModal
          post={threadPost}
          preloadedComments={threadPreloadedComments}
          repliesCount={threadReplyCount}
          visible={threadVisible}
          isDark={isDark}
          currentUserId={dbUser?.id ?? 'local-user'}
          currentUserTenantId={dbUser?.tenantId ?? ''}
          authorName={threadPostAuthorName}
          autoFocusReply={threadAutoFocus}
          originLayout={threadOriginLayout}
          channelEventTypes={channel?.eventTypes || []}
          onClose={handleCloseThread}
          threadScrollY={threadScrollY}
          onCommentsCountChange={setThreadReplyCount}
          onReplyToComment={(c: any, authorName: string) => {
            setQuotedComment(c);
            setQuotedCommentAuthorName(authorName);
            setComposerVisible(false); // Make sure keyboard stays open via auto focus
          }}
          composerHeightBase={composerHeightBase}
        />
      )}
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
