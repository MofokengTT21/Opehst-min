import {
  View, Text, ScrollView, TouchableOpacity,
  Platform, useColorScheme, StatusBar, TextInput,
  NativeSyntheticEvent, NativeScrollEvent, Keyboard, Animated,
  Alert, Image
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState, useCallback, useEffect, ComponentProps } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, EvilIcons } from '@expo/vector-icons';
import { useStore } from '../../store/useStore';
import { Post } from '@opehst/shared';

// LayoutAnimation is not used to prevent conflicts with KeyboardAvoidingView

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
  
  let leftIconName: ComponentProps<typeof Ionicons>['name'] = 'reader-outline';
  let leftIconColor = isDark ? '#ffffff' : '#2e2a2b';
  let leftBgStyle: any = { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)' };

  let caption = 'Posted an update';

  if (isAlert) {
    leftIconName = 'warning-outline';
    leftIconColor = '#ef4444';
    leftBgStyle = { backgroundColor: 'rgba(239, 68, 68, 0.10)' };
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
    <View className="flex-row px-4 py-3 border-b border-surface-border bg-surface-background">
      {/* Left Column: Tag/Alert Icon (Slightly increased size) */}
      <View className="mr-3 items-center pt-1.5">
        <View style={leftBgStyle} className="w-[36px] h-[36px] rounded-full items-center justify-center">
          <Ionicons name={leftIconName} size={18} color={leftIconColor} />
        </View>
      </View>

      <View className="flex-1">
        {/* Header: User Avatar (Large) next to name, and caption under name */}
        <View className="flex-row mb-1">
          <Image
            source={{ uri: isAlert ? AVATAR_CONFIGS.asset.url : `https://i.pravatar.cc/150?u=${encodeURIComponent(log.author_name)}` }}
            className="w-[44px] h-[44px] rounded-full mr-2.5 bg-surface-card"
          />
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
  
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [optionsVisible, setOptionsVisible]   = useState(false);

  const hasText     = messageText.trim().length > 0 || subjectText.trim().length > 0;
  const isExpanded  = keyboardVisible || optionsVisible || hasText;
  const showOptions = isExpanded && !keyboardVisible;

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

  // ── Sync tray with Keyboard lifecycle ────────────────────────────────────
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setOptionsVisible(false);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      inputRef.current?.blur();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleChevronPress = useCallback(() => {
    if (keyboardVisible) {
      setOptionsVisible(true);
      Keyboard.dismiss();
    } else {
      setOptionsVisible(false);
      setMessageText('');
      setSubjectText('');
      setSelectedTag(null);
    }
  }, [keyboardVisible]);

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
    setOptionsVisible(false);
    Keyboard.dismiss();
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messageText, subjectText, selectedTag, targetId, targetType, addPost]);

  const handleOpenCamera = useCallback(() => {
    Alert.alert('Coming Soon', 'Inline image uploads are being integrated directly into this new composer!');
  }, []);

  // ── Attention Animations (Staggered Apple "Fall into Place") ────────────────
  const numTags = TAG_OPTIONS.length;
  const [tagScaleAnims]   = useState(() => Array.from({ length: numTags }, () => new Animated.Value(1.1)));
  const [tagOpacityAnims] = useState(() => Array.from({ length: numTags }, () => new Animated.Value(0)));
  const [tagTransAnims]   = useState(() => Array.from({ length: numTags }, () => new Animated.Value(-15)));

  const [imageScaleAnim]   = useState(() => new Animated.Value(1.1));
  const [imageOpacityAnim] = useState(() => new Animated.Value(0));
  const [imageTransAnim]   = useState(() => new Animated.Value(-15));

  const triggerFallIntoPlace = useCallback(() => {
    // Reset values
    for (let i = 0; i < numTags; i++) {
      tagScaleAnims[i].setValue(1.1);
      tagOpacityAnims[i].setValue(0);
      tagTransAnims[i].setValue(-15);
    }

    imageScaleAnim.setValue(1.1);
    imageOpacityAnim.setValue(0);
    imageTransAnim.setValue(-15);

    // Create parallel animations for each tag
    const tagAnimations = tagScaleAnims.map((_, i) => {
      return Animated.parallel([
        Animated.spring(tagScaleAnims[i], {
          toValue: 1,
          tension: 70,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.spring(tagTransAnims[i], {
          toValue: 0,
          tension: 70,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(tagOpacityAnims[i], {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]);
    });

    // Create parallel animation for the image skeleton
    const imageAnimation = Animated.parallel([
      Animated.spring(imageScaleAnim, {
        toValue: 1,
        tension: 70,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(imageTransAnim, {
        toValue: 0,
        tension: 70,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(imageOpacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      })
    ]);

    // Stagger everything with a short delay (e.g. 50ms) to create a cascade
    Animated.stagger(50, [...tagAnimations, imageAnimation]).start();
  }, [numTags, tagScaleAnims, tagOpacityAnims, tagTransAnims, imageScaleAnim, imageOpacityAnim, imageTransAnim]);

  useEffect(() => {
    if (showOptions) {
      triggerFallIntoPlace();
    }
  }, [showOptions, triggerFallIntoPlace]);

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const glassmorphicBg  = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const avatarBgColor   = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)';
  const composerAvatarBg = isDark ? 'rgba(255, 255, 255, 0.12)' : '#f8f6f7';
  const iconColor       = isDark ? '#ffffff' : '#1a1718';
  const barBg           = isDark ? '#15202b' : '#ffffff';
  const pillBg          = isDark ? 'rgba(255,255,255,0.08)' : '#f8f6f7';
  const trayBg          = isDark ? '#253341' : '#f8f6f7';
  const borderColor     = isDark ? '#253341' : '#e8e4e5';
  const placeholderColor = isDark ? '#8899a6' : '#7a7577';
  const textColor       = isDark ? '#ffffff' : '#1a1718';

  const bottomPad = Platform.OS === 'ios' ? Math.max(insets.bottom, 4) : 4;

  let composerLeftIconName: ComponentProps<typeof Ionicons>['name'] = 'reader-outline';
  let composerLeftIconColor = isDark ? '#ffffff' : '#2e2a2b';
  let composerLeftBg = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)';
  let composerCaption = 'Drafting an update';

  if (selectedTag) {
    composerLeftIconName = selectedTag.iconName;
    composerLeftIconColor = SEMANTIC_COLORS[selectedTag.semantic] || composerLeftIconColor;
    composerLeftBg = `${composerLeftIconColor}20`;
    composerCaption = `Reporting a ${selectedTag.label.toLowerCase()}`;
  } else if (subjectText.trim().length > 0) {
    composerCaption = 'Logging an activity';
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#15202b' : '#f8f6f7' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: isDark ? '#15202b' : '#f8f6f7' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }}
          >
            <Ionicons name="arrow-back" size={26} color={iconColor} />
          </TouchableOpacity>

          <View style={{ flex: 1, paddingLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image 
                source={{ uri: avatarConfig.url }}
                style={{ width: 52, height: 52, borderRadius: 26 }}
              />
              <View>
                <Text style={{ fontSize: 19, fontWeight: '700', color: textColor, letterSpacing: -0.3 }} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: placeholderColor, letterSpacing: 0.5 }}>
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
        style={{ flex: 1 }}
        behavior="padding"
      >
        {/* Feed */}
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
          onLayout={() => {
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
            logs.map((log) => <PostCard key={log.id} log={log} />)
          )}
        </ScrollView>

        {/* ── Compose area ── */}
        <View style={{ 
          backgroundColor: barBg, 
          borderTopLeftRadius: isExpanded ? 32 : 0, 
          borderTopRightRadius: isExpanded ? 32 : 0, 
          borderTopWidth: 0.5,
          borderLeftWidth: isExpanded ? 0.5 : 0,
          borderRightWidth: isExpanded ? 0.5 : 0,
          borderColor: borderColor, 
          paddingTop: 16, 
          paddingBottom: bottomPad,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: isDark ? 0.4 : 0.1,
          shadowRadius: 16,
          elevation: 24,
        }}>
          
          {/* Main Row: Avatar + Fields */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: isExpanded ? 'flex-start' : 'center', 
            paddingHorizontal: 16, 
            paddingBottom: isExpanded ? 0 : 12 
          }}>
            
            {/* Left Column: User Avatar */}
            <View style={{ marginRight: 12, paddingTop: isExpanded ? 2 : 0, alignItems: 'center' }}>
              <Image 
                source={{ uri: 'https://i.pravatar.cc/150?u=Me' }}
                style={{ width: 44, height: 44, borderRadius: 22 }}
              />
            </View>

            {/* Content Column (Inputs & Options) */}
            <View style={{ flex: 1, marginRight: isExpanded ? 0 : 8 }}>
              
              {/* Header: Name and Caption */}
              {isExpanded && (
                <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                     <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                       <Text style={{ fontSize: 15, fontWeight: 'bold', color: textColor }}>Me</Text>
                       <Text style={{ fontSize: 14, color: placeholderColor, marginLeft: 6 }}>· now</Text>
                     </View>
                     <Text style={{ fontSize: 14, color: placeholderColor, marginTop: 2 }}>{composerCaption}</Text>
                  </View>
                </View>
              )}

              {/* Subject Input */}
              {isExpanded && (
                <TextInput
                  style={{
                    backgroundColor: pillBg,
                    borderRadius: 100,
                    width: '90%',
                    paddingHorizontal: 16,
                    fontSize: 15,
                    fontWeight: 'bold',
                    color: textColor,
                    paddingVertical: 8,
                    marginBottom: 8,
                    borderWidth: 0,
                  }}
                  value={subjectText}
                  onChangeText={setSubjectText}
                  placeholder="Subject / headline (optional)"
                  placeholderTextColor={placeholderColor}
                  maxLength={80}
                  returnKeyType="next"
                />
              )}

              {/* Message Input */}
              <TextInput
                ref={inputRef}
                style={{
                  backgroundColor: pillBg,
                  borderRadius: isExpanded ? 20 : 24,
                  paddingHorizontal: 14,
                  fontSize: 15,
                  color: textColor,
                  minHeight: isExpanded ? 60 : 48,
                  maxHeight: 140,
                  paddingTop: isExpanded ? 10 : 14,
                  paddingBottom: isExpanded ? 10 : 14,
                  lineHeight: 20,
                  borderWidth: 0,
                }}
                value={messageText}
                onChangeText={setMessageText}
                placeholder={isExpanded ? "What's the update?" : "Log a message..."}
                placeholderTextColor={placeholderColor}
                multiline
                maxLength={1000}
              />

              {/* Options Area (Tags & Attachments) - Aligned with fields */}
              {showOptions && (
                <View style={{ marginTop: 12, marginBottom: 4 }}>
                  {/* Tags */}
                  <View style={{ 
                    flexDirection: 'row', 
                    flexWrap: 'wrap', 
                    gap: 6, 
                    marginBottom: 12,
                  }}>
                    {TAG_OPTIONS.map((tag, index) => {
                      const isSelected = selectedTag?.label === tag.label;
                      const color      = SEMANTIC_COLORS[tag.semantic];
                      const pillBgColor = isSelected ? `${color}20` : pillBg;
                      const pillIconColor = isSelected ? color : placeholderColor;
                      const pillTextColor = isSelected ? textColor : placeholderColor;

                      return (
                        <Animated.View key={tag.label} style={{
                          opacity: tagOpacityAnims[index],
                          transform: [
                            { translateY: tagTransAnims[index] },
                            { scale: tagScaleAnims[index] }
                          ]
                        }}>
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => setSelectedTag(isSelected ? null : tag)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 12,
                              backgroundColor: pillBgColor,
                            }}
                          >
                            <Ionicons name={tag.iconName} size={14} color={pillIconColor} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 13, fontWeight: '500', color: pillTextColor }}>
                              {tag.label}
                            </Text>
                          </TouchableOpacity>
                        </Animated.View>
                      );
                    })}
                  </View>

                  {/* Attachments: Encourage Picture Upload Skeleton */}
                  <Animated.View style={{ 
                    marginTop: 4,
                    opacity: imageOpacityAnim,
                    transform: [
                      { translateY: imageTransAnim },
                      { scale: imageScaleAnim }
                    ]
                  }}>
                    <TouchableOpacity 
                      onPress={handleOpenCamera}
                      activeOpacity={0.75}
                      style={{
                        width: '100%',
                        height: 160,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: borderColor,
                        borderStyle: 'dashed',
                        backgroundColor: pillBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="images-outline" size={32} color={placeholderColor} />
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              )}
            </View>

            {/* INLINE ACTIONS: Only visible when fully collapsed */}
            {!isExpanded && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity activeOpacity={0.7} onPress={handleOpenCamera} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
                  <Ionicons name="camera-outline" size={26} color={isDark ? '#ffffff' : '#2e2a2b'} />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#0071e3', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="mic-outline" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>
            )}

          </View>

          {/* NEXT LINE ACTIONS: Only visible when expanded */}
          {isExpanded && (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              paddingHorizontal: 12, 
              paddingBottom: 8, 
              paddingTop: 8,
            }}>
              
              {/* Left Actions: Attachment Shortcuts */}
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <TouchableOpacity activeOpacity={0.7} onPress={handleOpenCamera} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="camera-outline" size={24} color={iconColor} />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={handleOpenCamera} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="image-outline" size={24} color={iconColor} />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="document-text-outline" size={24} color={iconColor} />
                </TouchableOpacity>
              </View>

              {/* Right Actions: Smart WhatsApp Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (keyboardVisible) {
                    handleChevronPress();
                  } else if (hasText) {
                    handleSend();
                  } else {
                    handleChevronPress(); // Close options
                  }
                }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#0071e3',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons 
                  name={keyboardVisible ? 'chevron-down' : hasText ? 'send' : 'close'} 
                  size={keyboardVisible || hasText ? 24 : 28} 
                  color="#ffffff" 
                  style={(!keyboardVisible && hasText) ? { marginLeft: 2 } : undefined} 
                />
              </TouchableOpacity>
            </View>
          )}

        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
