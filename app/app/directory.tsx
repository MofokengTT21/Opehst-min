import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ComponentProps, useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { database } from '../database';
import Item from '../database/models/Item';
import Group from '../database/models/Group';

export default function DirectoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    const itemsSub = database.collections.get<Item>('items').query().observe().subscribe(setItems);
    const groupsSub = database.collections.get<Group>('groups').query().observe().subscribe(setGroups);
    return () => {
      itemsSub.unsubscribe();
      groupsSub.unsubscribe();
    };
  }, []);

  const handleCreateNewItem = () => {
    router.push('/new-item');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.actionSection}>
        <TouchableOpacity style={styles.actionRow}>
          <View style={[styles.iconContainer, { backgroundColor: '#f3e8ff' }]}>
            <Ionicons name="people" size={24} color="#7e22ce" />
          </View>
          <Text style={styles.actionText}>New Group</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={handleCreateNewItem}>
          <View style={[styles.iconContainer, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="add-circle" size={24} color="#15803d" />
          </View>
          <Text style={styles.actionText}>New Item</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Groups</Text>
        {groups.map((group) => (
          <TouchableOpacity key={group.id} style={styles.listItem} onPress={() => router.push(`/item/${group.id}`)}>
            <View style={[styles.avatar, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="people" size={20} color="#334155" />
            </View>
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{group.name}</Text>
              <Text style={styles.itemDesc} numberOfLines={1}>{group.description}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Items Directory</Text>
        {items.map((item) => {
          let avatarIcon: ComponentProps<typeof Ionicons>['name'] = 'ellipse';
          let avatarBg = '#e2e8f0';
          if (item.category === 'asset') { avatarIcon = 'cog'; avatarBg = '#fee2e2'; }
          else if (item.category === 'location') { avatarIcon = 'location'; avatarBg = '#e0f2fe'; }
          else if (item.category === 'process') { avatarIcon = 'git-network'; avatarBg = '#fef3c7'; }
          else if (item.category === 'role') { avatarIcon = 'person'; avatarBg = '#dcfce7'; }

          return (
            <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => router.push(`/item/${item.id}`)}>
              <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                <Ionicons name={avatarIcon} size={20} color="#334155" />
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
              </View>
              {item.accessType === 'approval_required' && (
                <Ionicons name="lock-closed" size={16} color="#94a3b8" style={{ marginLeft: 8 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  actionSection: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  iconContainer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  actionText: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  listSection: { paddingVertical: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 8 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  itemDetails: { flex: 1, justifyContent: 'center' },
  itemName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  itemDesc: { fontSize: 14, color: '#64748b', marginTop: 2 },
});
