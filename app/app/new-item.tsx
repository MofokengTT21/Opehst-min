import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import { ItemCategory, AccessType } from '@opehst/shared';
import { Ionicons } from '@expo/vector-icons';

export default function NewItemScreen() {
  const router = useRouter();
  const { addItem } = useStore();
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ItemCategory>('asset');
  const [scadaId, setScadaId] = useState('');
  const [description, setDescription] = useState('');
  const [accessType, setAccessType] = useState<AccessType>('open');

  const handleSave = () => {
    if (!name.trim() || !description.trim()) {
      Alert.alert('Missing fields', 'Please provide a name and description.');
      return;
    }

    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      category,
      scada_id: scadaId || undefined,
      description,
      access_type: accessType,
      status: 'running' as const,
      created_at: new Date().toISOString(),
    };

    addItem(newItem);
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-surface-background" contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="camera" size={32} color="#94a3b8" />
        </View>
        <Text style={styles.avatarText}>Add Photo</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Item Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Arc 4, Loading Bay B" />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.chipRow}>
          {(['asset', 'location', 'process', 'role'] as ItemCategory[]).map((cat) => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.chip, category === cat && styles.chipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>SCADA / Sensor ID (Optional)</Text>
        <TextInput style={styles.input} value={scadaId} onChangeText={setScadaId} placeholder="e.g. plc_node_23" />
        <Text style={styles.helperText}>Links this item to automated machine telemetry.</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Access Type</Text>
        <View style={styles.chipRow}>
          {(['open', 'approval_required', 'invite_only'] as AccessType[]).map((acc) => (
            <TouchableOpacity 
              key={acc} 
              style={[styles.chip, accessType === acc && styles.chipActive]}
              onPress={() => setAccessType(acc)}
            >
              <Text style={[styles.chipText, accessType === acc && styles.chipTextActive]}>
                {acc.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          value={description} 
          onChangeText={setDescription} 
          placeholder="What is this item?" 
          multiline 
          numberOfLines={3} 
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Create Item</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { color: '#0ea5e9', fontWeight: '600' },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#0f172a' },
  textArea: { height: 80, textAlignVertical: 'top' },
  helperText: { fontSize: 12, color: '#64748b', marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#e0f2fe', borderColor: '#38bdf8' },
  chipText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  chipTextActive: { color: '#0369a1', fontWeight: '600' },
  saveButton: { backgroundColor: '#075e54', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
