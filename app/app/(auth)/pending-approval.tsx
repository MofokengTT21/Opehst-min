import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../services/authContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  FadeIn,
  Easing,
} from 'react-native-reanimated';

export default function PendingApprovalScreen() {
  const { dbUser, userStatus, rejectionReason, logout } = useAuth();
  const router = useRouter();

  const isRejected = userStatus === 'rejected' || !!rejectionReason;

  // Pulse animation for the waiting state
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (!isRejected) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1);
      pulseOpacity.value = withTiming(1);
    }
  }, [isRejected]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handleRetry = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1 bg-surface-background items-center justify-center px-6">

      {/* Pulse ring */}
      <Animated.View entering={FadeIn.duration(600)} className="items-center justify-center mb-10">
        <Animated.View
          style={[pulseStyle, {
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: isRejected ? '#ef444440' : '#0071e330',
            alignItems: 'center',
            justifyContent: 'center',
          }]}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: isRejected ? '#ef4444' : '#0071e3',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 36 }}>{isRejected ? '✕' : '⏳'}</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Status text */}
      <Animated.View entering={FadeIn.duration(600).delay(200)} className="items-center">
        <Text className="text-text-primary text-2xl font-bold text-center tracking-tight">
          {isRejected ? 'Request not approved' : 'Awaiting approval'}
        </Text>
        <Text className="text-text-secondary text-base mt-3 text-center leading-6">
          {isRejected
            ? (rejectionReason || 'Your request to join was not approved.')
            : `Your request to join${dbUser?.name ? ` as ${dbUser.name}` : ''} has been sent to the admin. You'll be notified as soon as they review it.`
          }
        </Text>
      </Animated.View>

      {/* Action buttons */}
      <Animated.View entering={FadeIn.duration(600).delay(400)} className="w-full mt-12 gap-3">
        {isRejected ? (
          <>
            <TouchableOpacity
              id="btn-retry-code"
              className="bg-ophest rounded-2xl items-center justify-center py-4"
              onPress={() => router.replace('/(auth)/join-org' as any)}
              activeOpacity={0.85}
            >
              <Text className="text-text-brand font-bold text-base">Try a different invite code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              id="btn-logout-rejected"
              className="bg-surface-card border border-surface-border rounded-2xl items-center justify-center py-4"
              onPress={handleRetry}
              activeOpacity={0.75}
            >
              <Text className="text-text-primary font-semibold text-base">Sign out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            id="btn-logout-pending"
            className="bg-surface-card border border-surface-border rounded-2xl items-center justify-center py-4"
            onPress={handleRetry}
            activeOpacity={0.75}
          >
            <Text className="text-text-primary font-semibold text-base">Sign out & try again later</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Live indicator */}
      {!isRejected && (
        <Animated.View entering={FadeIn.duration(600).delay(600)} className="mt-8 flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-semantic-audit" />
          <Text className="text-text-secondary text-xs">Listening for approval in real-time</Text>
        </Animated.View>
      )}
    </View>
  );
}
