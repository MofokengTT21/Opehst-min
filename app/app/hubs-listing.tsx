import { View, Text, ScrollView, TouchableOpacity, useColorScheme, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { database } from '../database';
import withObservables from '@nozbe/with-observables';
import Hub from '../database/models/Hub';
import { createHubApi } from '../services/feed';

const HubsListingBase = ({ hubs }: { hubs: Hub[] }) => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [modalVisible, setModalVisible] = useState(false);
  const [hubName, setHubName] = useState('');
  const [hubDescription, setHubDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Theme tokens
  const canvasBg        = isDark ? '#15202b' : '#f2f2f7';
  const cardBg          = isDark ? '#1d2a35' : '#ffffff';
  const borderColor     = isDark ? '#253341' : '#e8e4e5';
  const textColor       = isDark ? '#ffffff' : '#1a1718';
  const placeholderColor = isDark ? '#8899a6' : '#7a7577';
  const glassmorphicBg  = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';

  const handleCreateHub = async () => {
    if (!hubName.trim()) return;
    setIsLoading(true);
    try {
      await createHubApi(hubName, hubDescription);
      setModalVisible(false);
      setHubName('');
      setHubDescription('');
    } catch (error) {
      console.error(error);
      alert('Failed to create Hub');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: canvasBg }}>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: canvasBg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 14 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back-outline" size={28} color={textColor} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: textColor, letterSpacing: -0.5 }} numberOfLines={1}>
              Hubs
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={28} color={textColor} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 12, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-col gap-4">
          {hubs.map((hObj) => (
            <TouchableOpacity
              key={hObj.id}
              activeOpacity={0.7}
              className="flex-row items-center p-5 rounded-[28px] border border-transparent"
              style={{ backgroundColor: cardBg }}
            >
              <View 
                style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)', borderRadius: 24, overflow: 'hidden' }}
                className="w-12 h-12 items-center justify-center mr-4"
              >
                <Text style={{ color: isDark ? '#ffffff' : '#2e2a2b', fontSize: 20, fontWeight: 'bold' }}>
                  {hObj.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold mb-1" style={{ color: textColor }}>
                  {hObj.name}
                </Text>
                {hObj.description ? (
                  <Text className="text-sm" style={{ color: placeholderColor }}>
                    {hObj.description}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Create Hub Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: textColor }}>New Hub</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close-circle" size={28} color={placeholderColor} />
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="Hub Name (e.g. Finance)"
                placeholderTextColor={placeholderColor}
                value={hubName}
                onChangeText={setHubName}
                style={{ backgroundColor: glassmorphicBg, color: textColor, borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 12 }}
              />

              <TextInput
                placeholder="Description (Optional)"
                placeholderTextColor={placeholderColor}
                value={hubDescription}
                onChangeText={setHubDescription}
                style={{ backgroundColor: glassmorphicBg, color: textColor, borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 24 }}
              />

              <TouchableOpacity
                onPress={handleCreateHub}
                disabled={isLoading || !hubName.trim()}
                style={{ backgroundColor: hubName.trim() ? '#0071e3' : placeholderColor, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Create Hub</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default withObservables([], () => ({
  hubs: database.collections.get<Hub>('hubs').query().observe(),
}))(HubsListingBase);
