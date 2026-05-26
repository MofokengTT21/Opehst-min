import React from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, useColorScheme } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  interpolate, 
  Extrapolate 
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function FloatingActionMenu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const isOpen = useSharedValue(false);
  const openProgress = useSharedValue(0);

  const toggleMenu = () => {
    const nextState = !isOpen.value;
    isOpen.value = nextState;
    openProgress.value = nextState 
      ? withSpring(1, { damping: 15, stiffness: 120 }) 
      : withSpring(0, { damping: 15, stiffness: 120 });
  };

  const closeMenu = () => {
    isOpen.value = false;
    openProgress.value = withSpring(0, { damping: 15, stiffness: 120 });
  };

  const handleNavigate = (route: string) => {
    closeMenu();
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  // Backdrop animated styles (fades in)
  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: openProgress.value,
    };
  });

  // Main button rotation animation
  const fabStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${openProgress.value * 45}deg` },
        { scale: interpolate(openProgress.value, [0, 1], [1, 0.9]) }
      ],
    };
  });

  const textPrimaryColor = isDark ? '#ffffff' : '#18181b';

  // Menu items list (ordered top to bottom: Create New Form, Log Breakdown, New Job Card, Start 5S, Submit Kaizen)
  const menuItems = [
    {
      label: 'Create New Form Template',
      route: '/builder',
      icon: 'settings' as const,
      bgColor: 'bg-surface-card border border-surface-border',
      iconColor: textPrimaryColor,
      textColor: 'text-text-primary',
      isAdmin: true,
    },
    {
      label: 'Log Breakdown',
      route: '/dynamic-form/breakdown',
      icon: 'alert-circle' as const,
      bgColor: 'bg-semantic-breakdown',
      iconColor: '#ffffff',
      textColor: 'text-text-primary',
    },
    {
      label: 'New Job Card',
      route: '/dynamic-form/job-card',
      icon: 'construct' as const,
      bgColor: 'bg-semantic-jobcard',
      iconColor: '#ffffff',
      textColor: 'text-text-primary',
    },
    {
      label: 'Start 5S Checklist',
      route: '/dynamic-form/5s-audit',
      icon: 'checkmark-circle' as const,
      bgColor: 'bg-semantic-audit',
      iconColor: '#ffffff',
      textColor: 'text-text-primary',
    },
    {
      label: 'Submit Kaizen Idea',
      route: '/dynamic-form/kaizen',
      icon: 'bulb' as const,
      bgColor: 'bg-semantic-kaizen',
      iconColor: '#ffffff',
      textColor: 'text-text-primary',
    },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" className="z-50">
      {/* Backdrop Overlay */}
      <AnimatedPressable
        pointerEvents={isOpen.value ? 'auto' : 'none'}
        onPress={closeMenu}
        style={[StyleSheet.absoluteFill, backdropStyle]}
        className="bg-black/60"
      />

      {/* Menu Items Container */}
      <View 
        pointerEvents="box-none" 
        style={{ right: 24, bottom: 24 + insets.bottom }}
        className="absolute items-end"
      >
        <View pointerEvents="box-none" className="items-end mb-4 space-y-4">
          {menuItems.map((item, index) => {
            const itemStyle = useAnimatedStyle(() => {
              const reverseIndex = menuItems.length - 1 - index;
              const start = reverseIndex * 0.08;
              const end = start + 0.6;
              const progress = interpolate(
                openProgress.value,
                [start, end],
                [0, 1],
                Extrapolate.CLAMP
              );

              return {
                opacity: progress,
                transform: [
                  { translateY: interpolate(progress, [0, 1], [30, 0]) },
                  { scale: interpolate(progress, [0, 1], [0.8, 1]) }
                ],
              };
            });

            return (
              <Animated.View
                key={item.route}
                style={itemStyle}
                pointerEvents={isOpen.value ? 'auto' : 'none'}
                className="flex-row items-center justify-end"
              >
                {/* Text Label */}
                <View className="bg-surface-card border border-surface-border px-3 py-1.5 rounded-lg mr-3 shadow-sm">
                  <Text className={`${item.textColor} font-semibold text-sm`}>
                    {item.label}
                  </Text>
                </View>

                {/* Circular Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleNavigate(item.route)}
                  className={`w-12 h-12 rounded-full items-center justify-center shadow-md ${item.bgColor}`}
                >
                  <Ionicons name={item.icon} color={item.iconColor} size={20} />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Primary FAB Button (the Plus button) */}
        <Animated.View style={fabStyle} className="shadow-lg">
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={toggleMenu}
            className="w-14 h-14 rounded-full bg-ophest items-center justify-center"
          >
            <Ionicons name="add" color="#ffffff" size={28} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
