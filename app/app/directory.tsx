import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, Platform, Image, TextInput } from 'react-native';
import { ComponentProps, useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { database } from '../database';

import withObservables from '@nozbe/with-observables';
import Channel from '../database/models/Channel';

const DirectoryScreenBase = ({ channels }: { channels: Channel[] }) => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreateNewChannel = () => {
    router.push('/new-channel');
  };

  const filteredChannels = channels.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Theme tokens matching the composer bottom pane styling
  const canvasBg        = isDark ? '#15202b' : '#f2f2f7'; // softer light grey canvas background
  const cardBg          = isDark ? '#1d2a35' : '#ffffff'; // custom sheet/card background
  const borderColor     = isDark ? '#253341' : '#e8e4e5';
  const textColor       = isDark ? '#ffffff' : '#1a1718';
  const placeholderColor = isDark ? '#8899a6' : '#7a7577';
  const glassmorphicBg  = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';

  return (
    <View style={{ flex: 1, backgroundColor: canvasBg }}>
      {/* ── Custom Header ── */}
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: canvasBg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back-outline" size={28} color={textColor} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: textColor, letterSpacing: -0.5 }} numberOfLines={1}>
              Select Channel
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="ellipsis-horizontal" size={28} color={textColor} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={{ backgroundColor: glassmorphicBg, height: 48, borderRadius: 24 }} className="mx-4 mb-3 flex-row items-center px-4">
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
      </SafeAreaView>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Action Options (Grouped Card) */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <TouchableOpacity 
              style={styles.actionRow} 
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#0071e3' }]}>
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
              <View style={[styles.iconContainer, { backgroundColor: '#0071e3' }]}>
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
            {/* Channels Directory */}
            {filteredChannels.length > 0 && (
              <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
                <Text style={[styles.sectionTitle, { color: placeholderColor }]}>Channels Directory</Text>
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                  {filteredChannels.map((channel, index) => {
                    let imageUrl = 'https://images.unsplash.com/photo-1504307651254-35680f356f12?w=150&h=150&fit=crop';
                    
                    if (channel.category === 'asset') {
                      imageUrl = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=150&h=150&fit=crop';
                    } else if (channel.category === 'location') {
                      imageUrl = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop';
                    } else if (channel.category === 'process') {
                      imageUrl = 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=150&h=150&fit=crop';
                    } else if (channel.category === 'role') {
                      imageUrl = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop';
                    }

                    return (
                      <View key={channel.id}>
                        <TouchableOpacity 
                          style={styles.listItem} 
                          onPress={() => router.push(`/channel/${channel.id}`)} 
                          activeOpacity={0.7}
                        >
                          <Image source={{ uri: imageUrl }} style={styles.avatar} />
                          <View style={styles.itemDetails}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>{channel.name}</Text>
                              {channel.accessType === 'approval_required' && (
                                <Ionicons name="lock-closed-outline" size={13} color={placeholderColor} style={{ marginLeft: 6 }} />
                              )}
                            </View>
                            <Text style={[styles.itemDesc, { color: placeholderColor }]} numberOfLines={1}>
                              {channel.description || 'No description provided'}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={placeholderColor} />
                        </TouchableOpacity>
                        {index < filteredChannels.length - 1 && <View style={[styles.divider, { backgroundColor: borderColor }]} />}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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

export default withObservables([], () => ({
  channels: database.collections.get<Channel>('channels').query().observe(),
}))(DirectoryScreenBase);
