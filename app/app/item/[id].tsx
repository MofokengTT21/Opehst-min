import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, EvilIcons } from '@expo/vector-icons';
import { useStore } from '../../store/useStore';
import { Post } from '@opehst/shared';
import FloatingActionMenu from '../../components/FloatingActionMenu';

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

// ─── Twitter-Style Post Card Component ────────────────────────────────────────

function PostCard({ log }: { log: Post }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const isAlert = log.is_scada_alert;
  const avatarBg = isAlert ? 'bg-semantic-breakdown/10 border border-semantic-breakdown/30' : 'bg-surface-background border border-surface-border';
  const iconColor = isAlert ? '#ef4444' : (isDark ? '#a1a1aa' : '#64748b');
  const iconName = isAlert ? 'hardware-chip' : 'person';

  // Randomize some mock counts for the layout
  const replies = Math.floor(Math.random() * 5);
  const retweets = Math.floor(Math.random() * 3);
  const likes = Math.floor(Math.random() * 20);
  const views = Math.floor(Math.random() * 500) + 50;

  const actionIconColor = isDark ? '#a1a1aa' : '#536471';

  return (
    <View className="flex-row px-4 py-3 border-b border-surface-border bg-surface-card">
      <View className="mr-3 items-center">
        <View className={`w-10 h-10 rounded-full items-center justify-center ${avatarBg}`}>
          <Ionicons name={iconName} size={22} color={iconColor} />
        </View>
      </View>
      
      <View className="flex-1">
        {/* Header Row */}
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center flex-shrink-1">
            <Text className="text-[15px] font-bold text-text-primary flex-shrink-1" numberOfLines={1}>{log.author_name}</Text>
            {isAlert && <Ionicons name="checkmark-circle" size={14} color="#1d9bf0" className="ml-1 mr-1" />}
            <Text className="text-[15px] text-text-secondary ml-1 flex-shrink-1" numberOfLines={1}>{generateHandle(log.author_name)}</Text>
            <Text className="text-[15px] text-text-secondary mx-1">·</Text>
            <Text className="text-[15px] text-text-secondary">{formatTimeAgo(log.created_at)}</Text>
          </View>
          <TouchableOpacity className="p-0.5">
            <Ionicons name="ellipsis-horizontal" size={16} color="#536471" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="mt-1">
          {log.subject ? <Text className="text-[15px] font-bold text-text-primary mb-1">{log.subject}</Text> : null}
          <Text className="text-[15px] text-text-primary leading-5">{log.content}</Text>
          
          {log.tag ? (
            <View className="mt-2 self-start bg-surface-background px-2 py-1 rounded-xl border border-surface-border">
              <Text className="text-[13px] text-text-secondary font-medium">{log.tag}</Text>
            </View>
          ) : null}
        </View>

        {/* Action Row */}
        <View className="flex-row justify-between mt-3 mr-5">
          <TouchableOpacity className="flex-row items-center">
            <EvilIcons name="comment" size={22} color={actionIconColor} />
            {replies > 0 && <Text className="text-[13px] text-text-secondary ml-0.5">{replies}</Text>}
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center">
            <EvilIcons name="retweet" size={26} color={actionIconColor} />
            {retweets > 0 && <Text className="text-[13px] text-text-secondary ml-0.5">{retweets}</Text>}
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center">
            <EvilIcons name="heart" size={24} color={actionIconColor} />
            {likes > 0 && <Text className="text-[13px] text-text-secondary ml-0.5">{likes}</Text>}
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center">
            <Ionicons name="stats-chart" size={14} color={actionIconColor} style={{ marginRight: 4 }} />
            <Text className="text-[13px] text-text-secondary">{views}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center">
            <EvilIcons name="share-apple" size={24} color={actionIconColor} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Item Wall Screen ─────────────────────────────────────────────────────────

export default function ItemWallScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const targetId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { posts, items, groups } = useStore();
  const scrollViewRef = useRef<ScrollView>(null);

  // Derive data from Zustand mock store instead of WatermelonDB
  const logs = posts
    .filter((p) => p.target_id === targetId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); // descending, newest top just like Twitter

  const item = items.find((i) => i.id === targetId) || null;
  const group = groups.find((g) => g.id === targetId) || null;

  const name = item?.name ?? group?.name ?? 'Unknown';

  const textPrimaryColor = isDark ? '#ffffff' : '#18181b';

  return (
    <View className="flex-1 bg-surface-background">
      {/* Header */}
      <SafeAreaView className="bg-surface-card border-b border-surface-border" edges={['top', 'left', 'right']}>
        <View className="flex-row items-center h-[53px] px-2">
          <TouchableOpacity 
            className="p-2 mr-4" 
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
          >
            <Ionicons name="arrow-back" size={24} color={textPrimaryColor} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-[18px] font-bold text-text-primary" numberOfLines={1}>{name}</Text>
            <Text className="text-[13px] text-text-secondary" numberOfLines={1}>
              {logs.length} Posts
            </Text>
          </View>
          <TouchableOpacity className="p-3">
            <Ionicons name="ellipsis-horizontal" size={20} color={textPrimaryColor} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Feed */}
        <ScrollView ref={scrollViewRef} className="flex-1 bg-surface-background" contentContainerStyle={{ paddingBottom: 100 }}>
          {logs.length === 0 ? (
            <View className="flex-1 pt-24 items-center px-8">
              <Text className="text-text-secondary text-[15px] text-center leading-5">No logs yet. Be the first to post!</Text>
            </View>
          ) : (
            logs.map((log) => <PostCard key={log.id} log={log} />)
          )}
        </ScrollView>

        {/* Floating Action Menu inside the log wall */}
        <FloatingActionMenu />
      </KeyboardAvoidingView>
    </View>
  );
}
