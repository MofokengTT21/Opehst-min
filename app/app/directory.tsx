import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TouchableWithoutFeedback, useColorScheme, Platform, Image, TextInput, Dimensions, Alert, RefreshControl } from 'react-native';
import { ComponentProps, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, interpolateColor, Extrapolate, runOnJS } from 'react-native-reanimated';
import { database } from '../database';
import { useAuth } from '../services/authContext';
import { getFullToken } from '../services/auth';
import { API_AUTH_URL } from '../services/apiConfig';

import withObservables from '@nozbe/with-observables';
import Channel from '../database/models/Channel';
import Hub from '../database/models/Hub';
import ChannelMember from '../database/models/ChannelMember';
import { Q } from '@nozbe/watermelondb';
import { useHubContext } from '../contexts/HubContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DirectoryScreenBase = ({ channels, hubs, currentUserId }: { channels: Channel[], hubs: Hub[], currentUserId?: string }) => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [hubModalOpen, setHubModalOpen] = useState(false);
  const { activeHubId, setActiveHubId } = useHubContext();
  
  const hubMenuAnim = useSharedValue(0);

  // ── Dynamic Island Animation ──────────────────────────────────
  // Target state for Directory is ALWAYS 'Select Channel' (0).
  // Initial state is ALWAYS the Hub Pill (1) so it seamlessly morphs from Home.
  const dynamicIslandAnim = useSharedValue(1);
  const deptRef = useRef(activeHubId);
  deptRef.current = activeHubId;
  const lastHub = useRef(activeHubId);

  const triggerDynamicIsland = (toValue: number, delayMs: number = 500) => {
    setTimeout(() => {
      dynamicIslandAnim.value = withSpring(toValue, { stiffness: 250, damping: 30, mass: 1, overshootClamping: true });
    }, delayMs);
  };

  useFocusEffect(
    useCallback(() => {
      const task = setTimeout(() => {
        // Always animate to 'Select Channel' (0) after transition
        triggerDynamicIsland(0, 450);
      }, 50);
      return () => clearTimeout(task);
    }, [])
  );

  useEffect(() => {
    if (activeHubId === lastHub.current) return;

    // Whenever hub changes, briefly show the hub pill, then animate back to 'Select Channel'
    dynamicIslandAnim.value = 1;
    triggerDynamicIsland(0, 1500); // Increased delay so the user can read the new hub name
    lastHub.current = activeHubId;
  }, [activeHubId]);

  const hubOptions = [{ id: 'all', name: 'All Hubs' }, ...hubs];

  const switchHubDown = () => {
    const idx = hubOptions.findIndex(h => h.id === activeHubId);
    const nextHubId = hubOptions[(idx + 1) % hubOptions.length].id;
    setActiveHubId(nextHubId);
  };

  const handleCreateNewHub = () => {
    setHubModalOpen(false);
    router.push('/hubs-listing');
  };

  const openHubMenu = () => {
    setHubModalOpen(true);
    requestAnimationFrame(() => {
      hubMenuAnim.value = withSpring(1, { stiffness: 250, damping: 30, mass: 1, overshootClamping: true });
    });
  };

  const closeHubMenu = (newHubId?: string) => {
    hubMenuAnim.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setHubModalOpen)(false);
        if (newHubId && newHubId !== activeHubId) {
          runOnJS(setActiveHubId)(newHubId);
        }
      }
    });
  };

  const handleCreateNewChannel = () => {
    router.push('/new-channel');
  };

  // 1 & 2. Filter by search query and active hub
  const filteredChannels = useMemo(() => {
    let result = channels.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (activeHubId !== 'all') {
      result = result.filter(c => c.hubId === activeHubId);
    }
    return result;
  }, [channels, searchQuery, activeHubId]);

  // 3. Group by hub if 'all' is selected
  const channelsByHub = useMemo(() => {
    if (activeHubId !== 'all') return {};

    const grouped: Record<string, Channel[]> = {};
    hubs.forEach(h => {
      grouped[h.id] = filteredChannels.filter(c => c.hubId === h.id);
    });
    // Channels without a hub
    grouped['unassigned'] = filteredChannels.filter(c => !c.hubId);
    return grouped;
  }, [activeHubId, hubs, filteredChannels]);

  // Theme tokens matching the composer bottom pane styling
  const canvasBg        = isDark ? '#15202b' : '#f2f2f7'; // softer light grey canvas background
  const cardBg          = isDark ? '#1d2a35' : '#ffffff'; // custom sheet/card background
  const borderColor     = isDark ? '#253341' : '#e8e4e5';
  const textColor       = isDark ? '#ffffff' : '#1a1718';
  const placeholderColor = isDark ? '#8899a6' : '#7a7577';
  const glassmorphicBg  = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  
  const dynamicIslandStyle = useAnimatedStyle(() => ({
    maxWidth: interpolate(dynamicIslandAnim.value, [0, 1], [24, 300], Extrapolate.CLAMP),
    opacity: interpolate(dynamicIslandAnim.value, [0, 0.1, 1], [0, 1, 1], Extrapolate.CLAMP) * interpolate(hubMenuAnim.value, [0, 0.1], [1, 0], Extrapolate.CLAMP),
    backgroundColor: interpolateColor(hubMenuAnim.value, [0, 1], [glassmorphicBg, 'transparent'])
  }));

  const dynamicIslandTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dynamicIslandAnim.value, [0.5, 1], [0, 1], Extrapolate.CLAMP),
    transform: [{ scale: interpolate(dynamicIslandAnim.value, [0.5, 1], [0.9, 1], Extrapolate.CLAMP) }]
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dynamicIslandAnim.value, [0, 0.5, 1], [1, 0, 0], Extrapolate.CLAMP),
    transform: [{ scale: interpolate(dynamicIslandAnim.value, [0, 0.5, 1], [1, 0.8, 0.8], Extrapolate.CLAMP) }]
  }));

  // Replicate Home Screen Animated Styles exactly
  const modalBgStyle = useAnimatedStyle(() => {
    return {
      borderRadius: interpolate(hubMenuAnim.value, [0, 1], [24, 32]),
      height: interpolate(hubMenuAnim.value, [0, 1], [48, 400]),
      width: interpolate(hubMenuAnim.value, [0, 1], [160, SCREEN_WIDTH - 32]),
      opacity: interpolate(hubMenuAnim.value, [0, 0.1, 1], [0, 1, 1], Extrapolate.CLAMP),
      backgroundColor: isDark
        ? interpolateColor(hubMenuAnim.value, [0, 1], ['rgba(255, 255, 255, 0.12)', 'rgba(29, 42, 53, 1)'])
        : '#ffffff'
    };
  });

  const modalContentStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(hubMenuAnim.value, [0.5, 1], [0, 1], Extrapolate.CLAMP),
    };
  });

  const modalOverlayStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(hubMenuAnim.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: canvasBg }}>
      {/* ── Custom Header ── */}
      <View style={{ backgroundColor: canvasBg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 14 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back-outline" size={28} color={textColor} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ height: 48, justifyContent: 'center', alignItems: 'center' }}>
              <TouchableWithoutFeedback onPress={openHubMenu}>
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
                    style={{ height: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, dynamicIslandTextStyle]}>
                      <Text style={{ fontSize: 17, fontWeight: '600', letterSpacing: -0.5, color: isDark ? '#ffffff' : '#1a1718' }} numberOfLines={1}>
                        {activeHubId === 'all' ? 'All Hubs' : hubOptions.find(h => h.id === activeHubId)?.name}
                      </Text>
                      <Ionicons
                        name="chevron-down-outline"
                        size={17}
                        color={textColor}
                      />
                    </Animated.View>
                  </View>
                </Animated.View>
              </TouchableWithoutFeedback>

              {/* Title acting as the Logo */}
              <Animated.View 
                pointerEvents="auto"
                style={[{ position: 'absolute' }, titleStyle]}
              >
                <TouchableOpacity 
                  activeOpacity={0.65}
                  onPress={openHubMenu}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Text style={{ fontSize: 22, fontWeight: '700', color: textColor, letterSpacing: -0.5 }}>
                    Select Channel
                  </Text>
                  <Ionicons 
                    name="chevron-down-outline" 
                    size={16} 
                    color={textColor} 
                    style={{ opacity: 0.5 }} 
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="ellipsis-horizontal" size={28} color={textColor} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={{ backgroundColor: glassmorphicBg, height: 48, borderRadius: 24 }} className="mx-3 mb-3 flex-row items-center px-4">
          <Ionicons name="search-outline" size={20} color={placeholderColor} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search channels..."
            placeholderTextColor={placeholderColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-text-primary text-[16px] p-0 h-full"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={placeholderColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
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
        {/* Action Options (Grouped Card) */}
        <View style={{ paddingHorizontal: 12, marginTop: 12 }}>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <TouchableOpacity 
              style={styles.actionRow} 
              onPress={handleCreateNewHub}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: isDark ? '#FF7F57' : '#D47255' }]}>
                <Ionicons name="business-outline" size={22} color="#ffffff" />
              </View>
              <Text style={[styles.actionText, { color: textColor }]}>New Hub</Text>
              <Ionicons name="chevron-forward" size={16} color={placeholderColor} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <TouchableOpacity 
              style={styles.actionRow} 
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: isDark ? '#880034' : '#780532' }]}>
                <Ionicons name="people-outline" size={22} color="#ffffff" />
              </View>
              <Text style={[styles.actionText, { color: textColor }]}>New Group</Text>
              <Ionicons name="chevron-forward" size={16} color={placeholderColor} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <TouchableOpacity 
              style={styles.actionRow} 
              onPress={handleCreateNewChannel}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: isDark ? '#880034' : '#780532' }]}>
                <Ionicons name="add-outline" size={22} color="#ffffff" />
              </View>
              <Text style={[styles.actionText, { color: textColor }]}>New Channel</Text>
              <Ionicons name="chevron-forward" size={16} color={placeholderColor} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </View>
        </View>

        {filteredChannels.length === 0 && searchQuery.length > 0 ? (
          <View style={{ paddingTop: 64, alignItems: 'center', paddingHorizontal: 24 }}>
            <Ionicons name="search-outline" size={52} color={placeholderColor} />
            <Text style={{ color: placeholderColor, fontSize: 15, textAlign: 'center', marginTop: 12 }}>
              No matching channels found
            </Text>
          </View>
        ) : (
          <>
            {activeHubId !== 'all' ? (
              // Specific Hub Selected: Render simple list
              filteredChannels.length > 0 && (
                <View style={{ paddingHorizontal: 12, marginTop: 24 }}>
                  <Text style={[styles.sectionTitle, { color: placeholderColor }]}>
                    {hubs.find(h => h.id === activeHubId)?.name || 'Channels'}
                  </Text>
                  <View style={[styles.card, { backgroundColor: cardBg }]}>
                    {filteredChannels.map((channel, index) => (
                      <ChannelListItem 
                        key={channel.id} 
                        channel={channel} 
                        isLast={index === filteredChannels.length - 1} 
                        textColor={textColor}
                        placeholderColor={placeholderColor}
                        borderColor={borderColor}
                        onPress={() => router.push(`/channel/${channel.id}`)}
                      />
                    ))}
                  </View>
                </View>
              )
            ) : (
              // 'All' Selected: Render grouped by Hub
              <>
                {hubs.map((hub) => {
                  const hubChannels = channelsByHub[hub.id] || [];
                  if (hubChannels.length === 0) return null;

                  return (
                    <View key={hub.id} style={{ paddingHorizontal: 12, marginTop: 24 }}>
                      <Text style={[styles.sectionTitle, { color: placeholderColor }]}>{hub.name}</Text>
                      <View style={[styles.card, { backgroundColor: cardBg }]}>
                        {hubChannels.map((channel, index) => (
                          <ChannelListItem 
                            key={channel.id} 
                            channel={channel} 
                            isLast={index === hubChannels.length - 1} 
                            textColor={textColor}
                            placeholderColor={placeholderColor}
                            borderColor={borderColor}
                            onPress={() => router.push(`/channel/${channel.id}`)}
                            currentUserId={currentUserId}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}

                {/* Unassigned channels */}
                {channelsByHub['unassigned'] && channelsByHub['unassigned'].length > 0 && (
                  <View style={{ paddingHorizontal: 12, marginTop: 24 }}>
                    <Text style={[styles.sectionTitle, { color: placeholderColor }]}>Unassigned</Text>
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                      {channelsByHub['unassigned'].map((channel, index) => (
                        <ChannelListItem 
                          key={channel.id} 
                          channel={channel} 
                          isLast={index === channelsByHub['unassigned'].length - 1} 
                          textColor={textColor}
                          placeholderColor={placeholderColor}
                          borderColor={borderColor}
                          onPress={() => router.push(`/channel/${channel.id}`)}
                            currentUserId={currentUserId}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Hub Selection Modal (Exact Replication of Home Screen) */}
      {hubModalOpen && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }} pointerEvents="box-none">
          <View style={{ flex: 1 }}>
            {/* Animated Background Overlay */}
            <Animated.View style={[{
              position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
            }, modalOverlayStyle]}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => closeHubMenu()} activeOpacity={1} />
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
                <Text style={{ textAlign: 'center', paddingTop: 18, paddingBottom: 10, fontSize: 16, fontWeight: '600', color: placeholderColor }}>
                  Select Hub
                </Text>
                
                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 60 }} 
                >
                  {hubOptions.map((hObj, i) => {
                    const isSelected = hObj.id === activeHubId;
                    const isLast = i === hubOptions.length - 1;
                    return (
                      <View key={hObj.id}>
                        <TouchableOpacity
                          onPress={() => closeHubMenu(hObj.id)}
                          style={{ 
                            paddingVertical: 14, 
                            paddingHorizontal: 24, 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            backgroundColor: isSelected ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : 'transparent'
                          }}
                        >
                          <Text style={{ fontSize: 16, fontWeight: isSelected ? '700' : '500', color: isSelected ? (isDark ? '#880034' : '#780532') : textColor }}>
                            {hObj.name}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={20} color={isDark ? '#880034' : '#780532'} />
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 0.5,
    marginLeft: 68, // Aligns precisely after the icon container
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemDesc: {
    fontSize: 14.5,
    marginTop: 2,
  },
});

const ChannelListItem = ({ channel, isLast, textColor, placeholderColor, borderColor, onPress, currentUserId }: any) => {
  const isDark = useColorScheme() === 'dark';
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [requesting, setRequesting] = useState(false);
  const isPrivate = channel.accessType === 'approval_required' || channel.accessType === 'private';

  // Check membership for private channels
  useEffect(() => {
    if (!isPrivate || !currentUserId) {
      setIsMember(true); // Public channels: always accessible
      return;
    }
    database.collections
      .get<ChannelMember>('channel_members')
      .query(Q.where('channel_id', channel.id), Q.where('user_id', currentUserId))
      .fetchCount()
      .then((count) => setIsMember(count > 0))
      .catch(() => setIsMember(false));
  }, [channel.id, currentUserId, isPrivate]);

  const handleRequestJoin = async () => {
    setRequesting(true);
    try {
      const token = await getFullToken();
      await fetch(`${API_AUTH_URL}/channels/${channel.id}/request-join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert('Request sent', `Your request to join "${channel.name}" has been sent to the admin.`);
    } catch {
      Alert.alert('Error', 'Failed to send join request. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  let imageUrl = 'https://images.unsplash.com/photo-1504307651254-35680f356f12?w=150&h=150&fit=crop';
  if (channel.category === 'asset') imageUrl = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=150&h=150&fit=crop';
  else if (channel.category === 'location') imageUrl = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop';
  else if (channel.category === 'process') imageUrl = 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=150&h=150&fit=crop';
  else if (channel.category === 'role') imageUrl = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop';

  const isLocked = isPrivate && isMember === false;

  return (
    <View>
      <TouchableOpacity
        style={[styles.listItem, isLocked && { opacity: 0.8 }]}
        onPress={isLocked ? undefined : onPress}
        activeOpacity={isLocked ? 1 : 0.7}
      >
        {/* Avatar with lock overlay */}
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: imageUrl }} style={[styles.avatar, isLocked && { opacity: 0.5 }]} />
          {isLocked && (
            <View style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 18, height: 18, borderRadius: 9,
              backgroundColor: '#ef4444',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="lock-closed" size={10} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.itemDetails}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>{channel.name}</Text>
            {isPrivate && (
              <Ionicons name="lock-closed-outline" size={13} color={placeholderColor} style={{ marginLeft: 6 }} />
            )}
          </View>
          <Text style={[styles.itemDesc, { color: placeholderColor }]} numberOfLines={1}>
            {isLocked ? 'Private — request access to join' : (channel.description || 'No description provided')}
          </Text>
        </View>

        {isLocked ? (
          <TouchableOpacity
            id={`btn-request-join-${channel.id}`}
            style={{
              backgroundColor: isDark ? '#880034' : '#780532',
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
            onPress={handleRequestJoin}
            disabled={requesting}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
              {requesting ? '...' : 'Request'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={placeholderColor} />
        )}
      </TouchableOpacity>
      {!isLast && <View style={[styles.divider, { backgroundColor: borderColor }]} />}
    </View>
  );
};

// ── Main export wrapped with withObservables ──────────────────────────────────

const DirectoryScreenWithAuth = (props: any) => {
  const { session } = useAuth();
  return <DirectoryScreenBase {...props} currentUserId={session?.sub} />;
};

export default withObservables([], () => ({
  channels: database.collections.get<Channel>('channels').query().observe(),
  hubs: database.collections.get<Hub>('hubs').query().observe(),
}))(DirectoryScreenWithAuth);
