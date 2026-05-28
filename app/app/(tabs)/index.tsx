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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import withObservables from '@nozbe/with-observables';
import { database } from '../../database';
import Item from '../../database/models/Item';
import Group from '../../database/models/Group';
import Subscription from '../../database/models/Subscription';
import Log from '../../database/models/Log';

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

  const [searchQuery, setSearchQuery]   = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'alerts' | 'artisan'>('all');
  const [department, setDepartment]     = useState('All Departments');
  const [deptOpen, setDeptOpen]         = useState(false);

  const [iconSwapped, setIconSwapped] = useState(false);

  const switchDepartmentDown = () => {
    setDepartment((prev) =>
      DEPARTMENTS[(DEPARTMENTS.indexOf(prev) + 1) % DEPARTMENTS.length]
    );
    setIconSwapped(true);
    setTimeout(() => {
      setIconSwapped(false);
    }, 600);
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

  const filteredChats = fullChatData.filter((chat) => {
    const matchesSearch =
      chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'alerts')  return chat.isScadaAlert;
    if (activeFilter === 'artisan') return !chat.isScadaAlert;
    return true;
  });

  const topChats = filteredChats.slice(0, 3);
  const recentChats = filteredChats.slice(3);

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

  // Apple HIG specific translucent layers
  const glassmorphicBg = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const avatarBg = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)';
  const iconColor = isDark ? '#ffffff' : '#1a1718';

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
            style={{ backgroundColor: glassmorphicBg }}
            className="w-12 h-12 rounded-full items-center justify-center"
          >
            <Ionicons name="menu" size={28} color={iconColor} />
          </TouchableOpacity>

          <View className="flex-1 items-center">
            <TouchableOpacity
              activeOpacity={0.65}
              onPress={() => setDeptOpen(true)}
              className="flex-row items-center min-h-[48px] px-2 gap-1.5"
            >
              <Text className="text-[19px] font-bold text-text-primary tracking-tight" numberOfLines={1}>
                {department === 'All Departments' ? 'All Departments' : department}
              </Text>
              <Ionicons
                name={iconSwapped ? 'swap-horizontal-outline' : 'chevron-down'}
                size={17}
                color={iconColor}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg }}
            className="w-12 h-12 rounded-full items-center justify-center"
          >
            <Ionicons name="ellipsis-horizontal" size={26} color={iconColor} />
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: glassmorphicBg }} className="mx-4 mb-3 flex-row items-center rounded-full px-4 py-[10px]">
          <Ionicons name="search-outline" size={20} color={isDark ? '#8899a6' : '#7a7577'} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search channels & logs..."
            placeholderTextColor={isDark ? '#8899a6' : '#7a7577'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-text-primary text-[16px] p-0"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={isDark ? '#8899a6' : '#7a7577'} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28 }}>
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.key;
              const textColor = isActive ? (isDark ? '#ffffff' : '#1a1718') : (isDark ? '#8899a6' : '#7a7577');
              
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setActiveFilter(f.key)}
                  style={{ 
                    borderBottomWidth: 2.5, 
                    borderBottomColor: isActive ? '#0071e3' : 'transparent',
                    paddingBottom: 10,
                  }}
                >
                  <Text style={{ color: textColor }} className="text-[14.5px] font-semibold">
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1 bg-surface-background"
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

        {filteredChats.length === 0 ? (
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
        animationType="fade"
        onRequestClose={() => setDeptOpen(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/20 justify-start pt-[100px]"
          activeOpacity={1}
          onPress={() => setDeptOpen(false)}
        >
          <View className="mx-[60px] bg-white dark:bg-[#192734] rounded-[18px] overflow-hidden">
            <Text className="text-center pt-[14px] pb-[6px] text-[12px] font-semibold text-text-secondary tracking-[0.6px] uppercase">
              Department
            </Text>
            {DEPARTMENTS.map((dept, i) => {
              const isSelected = dept === department;
              return (
                <TouchableOpacity
                  key={dept}
                  onPress={() => { setDepartment(dept); setDeptOpen(false); }}
                  className="py-[13px] px-[20px] flex-row items-center justify-between"
                  style={{ backgroundColor: isSelected ? (isDark ? '#2e2a2b' : '#faf9f9') : 'transparent' }}
                >
                  <Text style={{
                    fontSize: 15,
                    fontWeight: isSelected ? '700' : '400',
                    color: isSelected ? '#FF4237' : (isDark ? '#ffffff' : '#1a1718'),
                  }}>
                    {dept}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color="#FF4237" />
                  )}
                </TouchableOpacity>
              );
            })}
            <View className="h-[6px]" />
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
