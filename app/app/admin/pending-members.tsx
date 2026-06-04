import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../services/authContext';
import { getFullToken } from '../../services/auth';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

const API_URL = 'http://192.168.1.102:3000/api/auth';

type PendingMember = {
  id: string;
  name: string | null;
  phone: string;
  createdAt: string;
};

export default function PendingMembersScreen() {
  const [members, setMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { session } = useAuth();
  const router = useRouter();

  const fetchMembers = useCallback(async () => {
    try {
      const token = await getFullToken();
      const res = await fetch(`${API_URL}/admin/pending-members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setMembers(data.members);
    } catch (err) {
      console.error('Failed to fetch pending members', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchMembers(); }, [fetchMembers]));

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      const token = await getFullToken();
      const res = await fetch(`${API_URL}/admin/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== userId));
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error);
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = (userId: string, memberName: string | null) => {
    Alert.prompt(
      'Reject Member',
      `Provide a reason for rejecting ${memberName ?? 'this user'}:`,
      async (reason) => {
        if (reason === undefined) return; // Cancelled
        setActionLoading(userId);
        try {
          const token = await getFullToken();
          const res = await fetch(`${API_URL}/admin/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ userId, reason: reason || 'Your request was not approved.' }),
          });
          if (res.ok) {
            setMembers((prev) => prev.filter((m) => m.id !== userId));
          } else {
            const err = await res.json();
            Alert.alert('Error', err.error);
          }
        } catch {
          Alert.alert('Error', 'Network error. Please try again.');
        } finally {
          setActionLoading(null);
        }
      },
      'plain-text'
    );
  };

  const renderMember = ({ item }: { item: PendingMember }) => {
    const isActing = actionLoading === item.id;
    const initials = (item.name ?? item.phone).slice(0, 2).toUpperCase();
    const joined = new Date(item.createdAt).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(250)}
        layout={Layout.springify()}
        className="bg-surface-card rounded-3xl p-4 mb-3 mx-4"
      >
        <View className="flex-row items-center mb-4">
          {/* Avatar */}
          <View
            className="w-12 h-12 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: 'rgba(0, 113, 227, 0.15)' }}
          >
            <Text className="text-ophest font-bold text-base">{initials}</Text>
          </View>

          {/* Info */}
          <View className="flex-1">
            <Text className="text-text-primary font-semibold text-base" numberOfLines={1}>
              {item.name ?? 'No name yet'}
            </Text>
            <Text className="text-text-secondary text-sm">{item.phone}</Text>
            <Text className="text-text-secondary text-xs mt-0.5">Requested {joined}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-2">
          <TouchableOpacity
            id={`btn-approve-${item.id}`}
            className="flex-1 bg-ophest rounded-2xl items-center justify-center py-3"
            onPress={() => handleApprove(item.id)}
            disabled={isActing}
            activeOpacity={0.85}
          >
            {isActing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text className="text-text-brand font-bold text-sm">Approve</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            id={`btn-reject-${item.id}`}
            className="flex-1 bg-surface-background border border-semantic-breakdown rounded-2xl items-center justify-center py-3"
            onPress={() => handleReject(item.id, item.name)}
            disabled={isActing}
            activeOpacity={0.75}
          >
            <Text className="text-semantic-breakdown font-bold text-sm">Reject</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <View className="flex-1 bg-surface-background">
      {/* Header */}
      <View className="pt-16 pb-4 px-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
          <Text className="text-text-primary text-xl font-bold">←</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-text-primary text-xl font-bold">Pending Members</Text>
          <Text className="text-text-secondary text-sm">
            {members.length} awaiting approval
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0071e3" />
        </View>
      ) : members.length === 0 ? (
        <Animated.View entering={FadeIn.duration(500)} className="flex-1 items-center justify-center px-8">
          <Text style={{ fontSize: 48 }}>✅</Text>
          <Text className="text-text-primary text-xl font-bold mt-4 text-center">All caught up!</Text>
          <Text className="text-text-secondary text-base mt-2 text-center leading-6">
            No pending member requests for your organisation.
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={members}
          renderItem={renderMember}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchMembers(); }}
              tintColor="#0071e3"
            />
          }
        />
      )}
    </View>
  );
}
