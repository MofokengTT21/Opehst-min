import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  memo,
  useEffect,
} from 'react';
import {
  SectionList,
  FlatList,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
  SectionListData,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { recentEmojis, addToRecent } from '../utils/emoji';



// ─── Emoji Data (from rn-emoji-keyboard's bundled JSON) ──────────────────────

const { emojisByCategory } = require('rn-emoji-keyboard');

const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  recently_used:  { label: 'Recently Used',      icon: 'time-outline'       },
  smileys_emotion:{ label: 'Smileys & Emotion',  icon: 'happy-outline'      },
  people_body:    { label: 'People & Body',       icon: 'person-outline'     },
  animals_nature: { label: 'Animals & Nature',    icon: 'paw-outline'        },
  food_drink:     { label: 'Food & Drink',        icon: 'restaurant-outline' },
  travel_places:  { label: 'Travel & Places',     icon: 'airplane-outline'   },
  activities:     { label: 'Activities',          icon: 'football-outline'   },
  objects:        { label: 'Objects',             icon: 'bulb-outline'       },
  symbols:        { label: 'Symbols',             icon: 'heart-outline'      },
  flags:          { label: 'Flags',               icon: 'flag-outline'       },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type EmojiRow = string[];
type Section = SectionListData<EmojiRow> & { key: string };

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Emoji Cell ───────────────────────────────────────────────────────────────

interface CellProps { emoji: string; size: number; onPress: (e: string) => void }
const EmojiCell = memo(({ emoji, size, onPress }: CellProps) => {
  return (
    <TouchableOpacity
      style={[styles.cell, { width: size, height: size }]}
      onPress={() => onPress(emoji)}
      activeOpacity={0.65}
    >
      <Text style={{ fontSize: size - 16, color: '#000' }}>{emoji}</Text>
    </TouchableOpacity>
  );
});

// ─── Emoji Row ────────────────────────────────────────────────────────────────

interface RowProps { row: string[]; cols: number; cellSize: number; onPress: (e: string) => void }
const EmojiRowView = memo(({ row, cols, cellSize, onPress }: RowProps) => (
  <View style={styles.row}>
    {row.map(emoji => (
      <EmojiCell key={emoji} emoji={emoji} size={cellSize} onPress={onPress} />
    ))}
    {Array.from({ length: cols - row.length }).map((_, i) => (
      <View key={`pad-${i}`} style={{ width: cellSize, height: cellSize }} />
    ))}
  </View>
));

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  onEmojiSelected: (emoji: string) => void;
  isDark: boolean;
  onSearchStateChange?: (isSearching: boolean) => void;
}

export const EmojiPickerPanel = memo(({ onEmojiSelected, isDark, onSearchStateChange }: Props) => {
  const { width } = useWindowDimensions();
  const COLS = 9;
  const CELL = Math.floor((width - 16) / COLS);

  const listRef = useRef<SectionList<EmojiRow, Section>>(null);
  const flatListRef = useRef<FlatList>(null);
  const [activeTab, setActiveTab] = useState(0);
  const isProgrammaticScroll = useRef(false);
  const targetSectionRef = useRef(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (onSearchStateChange) {
      onSearchStateChange(isSearching);
    }
  }, [isSearching, onSearchStateChange]);

  // Build sections dynamically
  const sectionData = useMemo(() => {
    const result: Section[] = [];
    const flatResults: string[] = [];
    const query = searchQuery.toLowerCase().trim();

    if (recentEmojis.length > 0 && !query) {
      result.push({
        key: 'recently_used',
        title: CATEGORY_CONFIG['recently_used'].label,
        data: chunkArray(recentEmojis, COLS),
      });
    }

    for (const cat of emojisByCategory as any[]) {
      const conf = CATEGORY_CONFIG[cat.title];
      
      let filteredEmojis = cat.data;
      if (query) {
        filteredEmojis = cat.data.filter((e: any) => 
          (e.name && e.name.toLowerCase().includes(query)) || 
          (e.keywords && e.keywords.some((k: string) => k.toLowerCase().includes(query)))
        );
      }
      
      if (filteredEmojis.length > 0) {
        const emojis = filteredEmojis.map((e: any) => e.emoji as string);
        flatResults.push(...emojis);
        result.push({
          key: cat.title,
          title: conf?.label ?? cat.title,
          data: chunkArray(emojis, COLS),
        });
      }
    }
    return { sections: result, flatResults };
  }, [searchQuery]); // rebuilt when search changes

  const { sections, flatResults } = sectionData;

  // Tab list (filter out recently_used if empty)
  const tabs = useMemo(() => sections.map(s => ({
    key: s.key,
    icon: CATEGORY_CONFIG[s.key]?.icon ?? 'ellipse-outline',
  })), [sections]);

  const handleEmojiPress = useCallback((emoji: string) => {
    onEmojiSelected(emoji);
    addToRecent(emoji);
  }, [onEmojiSelected]);

  const handleTabPress = useCallback((index: number) => {
    setActiveTab(index);
    targetSectionRef.current = index;
    isProgrammaticScroll.current = true;
    listRef.current?.scrollToLocation({
      sectionIndex: index,
      itemIndex: 0,
      animated: false,
      viewOffset: 0,
    });
    setTimeout(() => { isProgrammaticScroll.current = false; }, 400);
  }, []);

  const handleScrollToIndexFailed = useCallback((info: any) => {
    setTimeout(() => {
      listRef.current?.scrollToLocation({
        sectionIndex: targetSectionRef.current,
        itemIndex: 0,
        animated: false,
        viewOffset: 0,
      });
    }, 100);
  }, []);

  const renderItem = useCallback(({ item }: { item: EmojiRow }) => (
    <EmojiRowView row={item} cols={COLS} cellSize={CELL} onPress={handleEmojiPress} />
  ), [CELL, handleEmojiPress]);

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: isDark ? '#1d2a35' : '#ffffff' }]}>
      <Text style={[styles.sectionTitle, { color: isDark ? '#8899a6' : '#7a7577' }]}>
        {section.title as string}
      </Text>
    </View>
  ), [isDark]);

  const keyExtractor = useCallback((item: EmojiRow, idx: number) =>
    `row-${idx}-${item[0] ?? 'empty'}`, []);

  const viewConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (isProgrammaticScroll.current || !viewableItems || viewableItems.length === 0) return;
    const topItem = viewableItems.find((item: any) => item.isViewable);
    const topKey = topItem?.section?.key;
    if (!topKey) return;
    
    setActiveTab((prevActive) => {
      const idx = sections.findIndex(s => s.key === topKey);
      return (idx !== -1 && idx !== prevActive) ? idx : prevActive;
    });
  }, [sections]);

  // Colors
  const bg        = isDark ? '#1d2a35' : '#ffffff';
  const tabBg     = bg;
  const activeBg  = isDark ? '#15202b' : '#f2f2f7'; // Matches [id].tsx page bg
  const iconCol   = isDark ? '#8899a6' : '#7a7577';
  const activeCol = isDark ? '#ffffff' : '#1a1718';
  const border    = isDark ? '#253341' : '#e8e4e5';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      
      {/* ── Compact Horizontal Search Results ── */}
      {isSearching && (
        <View style={{ height: 48, borderBottomWidth: 1, borderBottomColor: border, justifyContent: 'center' }}>
          {flatResults.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={flatResults}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item, index) => `${item}-${index}`}
              contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center' }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleEmojiPress(item)} style={{ paddingHorizontal: 6 }}>
                  <Text style={{ fontSize: 28, color: '#000' }}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text style={{ color: iconCol, textAlign: 'center', fontSize: 13 }}>No emojis found</Text>
          )}
        </View>
      )}

      {/* ── Search Bar ── */}
      <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: isSearching ? 12 : 6 }}>
        <View style={{ 
          backgroundColor: activeBg, 
          borderRadius: 16, 
          paddingHorizontal: 12, 
          height: 36, 
          flexDirection: 'row', 
          alignItems: 'center' 
        }}>
          <Ionicons name="search" size={16} color={iconCol} style={{ marginRight: 6 }} />
          <TextInput
            placeholder="Search emojis..."
            placeholderTextColor={iconCol}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearching(true)}
            onBlur={() => {
              if (!searchQuery) setIsSearching(false);
            }}
            style={{ flex: 1, color: activeCol, fontSize: 15, padding: 0 }}
          />
          {isSearching && (
            <TouchableOpacity onPress={() => {
              setSearchQuery('');
              setIsSearching(false);
            }}>
              <Ionicons name="close-circle" size={16} color={iconCol} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!isSearching && (
        <>
          <SectionList
            ref={listRef}
            sections={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled
            viewabilityConfig={viewConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={7}
            removeClippedSubviews
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 56 }}
            keyboardShouldPersistTaps="handled"
          />

          {/* ── Tab Bar ── */}
          <View style={[styles.tabBar, { backgroundColor: tabBg }]}>
            {tabs.map((tab, i) => {
              const active = i === activeTab;
              const iconName = active ? tab.icon.replace('-outline', '') : tab.icon;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, active && { backgroundColor: activeBg }]}
                  onPress={() => handleTabPress(i)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={iconName as any} size={19} color={active ? activeCol : iconCol} />
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 0,
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  tab: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
