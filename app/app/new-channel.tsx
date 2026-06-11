import { View, Text, TextInput, TouchableOpacity, Alert, useColorScheme, Platform, StatusBar, Dimensions, Keyboard, PanResponder } from 'react-native';
import { useState, useRef } from 'react';
import { useRouter, Stack } from 'expo-router';
import { database } from '../database';
import { createChannel } from '../services/feed';
import { ChannelCategory, AccessType, ChannelEventType } from '@opehst/shared';
import { Ionicons } from '@expo/vector-icons';
import { Wrench, AlertTriangle, CheckCircle, Shield, Zap, Activity, Tag, Box } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, useAnimatedStyle, withSpring, withTiming, 
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import { KeyboardAvoidingView } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CATEGORIES: { key: ChannelCategory; label: string; icon: any; semantic: string; desc: string }[] = [
  { key: 'asset', label: 'Asset', icon: 'hardware-chip-outline', semantic: 'jobcard', desc: 'Machinery, tools, or equipment' },
  { key: 'location', label: 'Location', icon: 'location-outline', semantic: 'audit', desc: 'Physical zones or areas' },
  { key: 'process', label: 'Process', icon: 'git-network-outline', semantic: 'kaizen', desc: 'Workflows and operational steps' },
  { key: 'role', label: 'Role', icon: 'person-outline', semantic: 'ophest', desc: 'Job titles or functional teams' },
];

const ACCESS_TYPES: { key: AccessType; label: string; icon: any }[] = [
  { key: 'open', label: 'Open', icon: 'earth-outline' },
  { key: 'approval_required', label: 'Approval Required', icon: 'lock-closed-outline' },
];

const ICON_OPTIONS = [
  { name: 'warning', component: 'warning' },
  { name: 'build', component: 'build' },
  { name: 'search', component: 'search' },
  { name: 'swap-horizontal', component: 'swap-horizontal' },
  { name: 'bulb', component: 'bulb' },
  { name: 'checkmark-circle', component: 'checkmark-circle' },
  { name: 'shield', component: 'shield' },
  { name: 'flash', component: 'flash' },
  { name: 'pulse', component: 'pulse' },
  { name: 'pricetag', component: 'pricetag' },
  { name: 'cube', component: 'cube' },
];

const COLOR_OPTIONS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function NewChannelWizard() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  // Form State
  const [category, setCategory] = useState<ChannelCategory | null>(null);
  const [name, setName] = useState('');
  const [accessType, setAccessType] = useState<AccessType>('open');
  const [description, setDescription] = useState('');
  
  const [eventTypes, setEventTypes] = useState<ChannelEventType[]>([
    { name: 'Hazard', icon: 'warning', color: '#f59e0b' },
    { name: 'Fault', icon: 'build', color: '#ef4444' },
    { name: 'Inspection', icon: 'checkmark-circle', color: '#22c55e' },
    { name: 'Shift Handover', icon: 'swap-horizontal', color: '#06b6d4' },
    { name: 'Idea', icon: 'bulb', color: '#8b5cf6' },
  ]);
  // Event Type Builder State
  const [isEventTypeTrayOpen, setIsEventTypeTrayOpen] = useState(false);
  const trayAnim = useSharedValue(0);
  const [eventTypeDraftName, setEventTypeDraftName] = useState('');
  const [eventTypeDraftIcon, setEventTypeDraftIcon] = useState(ICON_OPTIONS[0].name);
  const [eventTypeDraftColor, setEventTypeDraftColor] = useState(COLOR_OPTIONS[0]);

  const trayOverlayStyle = useAnimatedStyle(() => ({
    opacity: trayAnim.value
  }));

  const traySheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(trayAnim.value, [0, 1], [SCREEN_HEIGHT, 0]) }]
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Wizard State
  const [currentStep, setCurrentStep] = useState(0);
  const pagerRef = useRef<Animated.ScrollView>(null);

  const glassmorphicBg = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const iconColor = isDark ? '#ffffff' : '#2e2a2b';
  const activeIconColor = isDark ? '#ffffff' : '#ffffff';

  const getIconBgColor = (isActive: boolean) => {
    if (isActive) {
      return isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)';
    }
    return 'transparent';
  };

  const goToStep = (step: number) => {
    Keyboard.dismiss();
    setCurrentStep(step);
    pagerRef.current?.scrollTo({ x: step * SCREEN_WIDTH, animated: true });
  };

  const handleNext = () => {
    if (currentStep === 0 && !category) return;
    if (currentStep === 1 && !name.trim()) return;
    
    if (currentStep < 2) {
      goToStep(currentStep + 1);
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (isEventTypeTrayOpen) {
      closeEventTypeTray();
      return;
    }
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const openEventTypeTray = () => {
    setIsEventTypeTrayOpen(true);
    trayAnim.value = withSpring(1, { stiffness: 250, damping: 30, overshootClamping: true });
  };

  const closeEventTypeTray = () => {
    Keyboard.dismiss();
    trayAnim.value = withTiming(0, { duration: 250 });
    setTimeout(() => setIsEventTypeTrayOpen(false), 260);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10 && Math.abs(gestureState.dx) < gestureState.dy;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 40) {
          closeEventTypeTray();
        }
      },
    })
  ).current;

  const handleSave = async () => {
    if (!category || !name.trim() || !description.trim()) {
      Alert.alert('Missing Info', 'Please complete all required fields.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const success = await createChannel(name, description, category, accessType, eventTypes);
      if (success) {
        router.back();
      } else {
        throw new Error('Server returned false');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to create channel.');
      setIsSubmitting(false);
    }
  };

  // Render Step 1: Category
  const renderStep1 = () => (
    <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 24, paddingTop: 32 }}>
      <Text className="text-text-primary text-3xl font-extrabold tracking-tight mb-2">
        What are you adding?
      </Text>
      <Text className="text-text-secondary text-base mb-8 leading-6">
        Select a category to help organize this channel within the system.
      </Text>

      <View className="flex-col gap-4">
        {CATEGORIES.map((cat) => {
          const isActive = category === cat.key;

          return (
            <TouchableOpacity
              key={cat.key}
              activeOpacity={0.7}
              onPress={() => setCategory(cat.key)}
              className={`flex-row items-center p-5 rounded-[28px] border ${isActive ? 'bg-surface-card border-text-primary' : 'bg-surface-card border-transparent'}`}
            >
              <View 
                style={{ backgroundColor: getIconBgColor(isActive), borderRadius: 24, overflow: 'hidden' }}
                className="w-12 h-12 rounded-full items-center justify-center mr-4"
              >
                <Ionicons name={cat.icon} size={24} color={iconColor} />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold mb-1 text-text-primary">
                  {cat.label}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {cat.desc}
                </Text>
              </View>
              <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isActive ? 'border-ophest' : 'border-text-secondary'}`}>
                {isActive && <View className="w-3 h-3 rounded-full bg-ophest" />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Render Step 2: Name & Access
  const renderStep2 = () => (
    <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 24, paddingTop: 32 }}>
      <Text className="text-text-primary text-3xl font-extrabold tracking-tight mb-2">
        Name & Visibility
      </Text>
      <Text className="text-text-secondary text-base mb-8 leading-6">
        Give it a clear, identifiable name and set who can access it.
      </Text>

      <View className="mb-8 border-b" style={{ borderBottomColor: isDark ? '#253341' : '#e8e4e5' }}>
        <TextInput 
          className="text-text-primary text-3xl font-bold py-3 px-1"
          value={name}
          onChangeText={setName}
          placeholder="Name..."
          placeholderTextColor={isDark ? '#8899a6' : '#7a7577'}
          autoFocus={false}
        />
      </View>

      <Text className="text-text-primary text-[15px] font-bold uppercase tracking-wide mb-3">
        Access Type
      </Text>
      <View className="flex-col gap-4">
        {ACCESS_TYPES.map((acc) => {
          const isActive = accessType === acc.key;
          return (
            <TouchableOpacity
              key={acc.key}
              activeOpacity={0.7}
              onPress={() => setAccessType(acc.key)}
              className={`flex-row items-center p-5 rounded-[28px] border ${isActive ? 'bg-surface-card border-text-primary' : 'bg-surface-card border-transparent'}`}
            >
              <View 
                style={{ backgroundColor: getIconBgColor(isActive), borderRadius: 20, overflow: 'hidden' }}
                className="w-10 h-10 rounded-full items-center justify-center mr-4"
              >
                <Ionicons name={acc.icon} size={20} color={iconColor} />
              </View>
              <Text className={`flex-1 text-[17px] ${isActive ? 'font-bold text-text-primary' : 'font-medium text-text-primary'}`}>
                {acc.label}
              </Text>
              {isActive && <Ionicons name="checkmark" size={24} color="#0071e3" />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Render Step 3: Photo & Description
  const renderStep3 = () => (
    <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 24, paddingTop: 32 }}>
      <Text className="text-text-primary text-3xl font-extrabold tracking-tight mb-2">
        Final Details
      </Text>
      <Text className="text-text-secondary text-base mb-8 leading-6">
        Add a descriptive summary and optionally attach a photo.
      </Text>

      <View className="items-center mb-8">
        <TouchableOpacity 
          activeOpacity={0.7}
          className="w-[120px] h-[120px] rounded-[60px] bg-surface-card border-2 border-surface-border items-center justify-center"
        >
          <Ionicons name="camera-outline" size={44} color={isDark ? '#8899a6' : '#7a7577'} />
          <View className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-text-primary border-4 border-surface-background items-center justify-center">
            <Ionicons name="add" size={24} color={isDark ? '#1a1718' : '#ffffff'} />
          </View>
        </TouchableOpacity>
        <Text className="text-text-primary font-semibold mt-3 text-base">
          Add Cover Photo
        </Text>
      </View>

      <Text className="text-text-primary text-[15px] font-bold uppercase tracking-wide mb-3">
        Event Types (Optional)
      </Text>

      {/* Existing Event Types */}
      {eventTypes.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mb-4">
          {eventTypes.map((t, idx) => {
            const iconName = ICON_OPTIONS.find(o => o.name === t.icon)?.name || t.icon || 'pricetag';
            return (
              <View key={idx} style={{ backgroundColor: `${t.color}26`, borderColor: t.color, borderWidth: 1.5 }} className="flex-row items-center px-3 py-1.5 rounded-full">
                <Ionicons name={iconName as any} size={16} color={t.color} style={{ marginRight: 6 }} />
                <Text style={{ color: isDark ? '#ffffff' : '#1a1718', fontWeight: '600' }}>{t.name}</Text>
                <TouchableOpacity onPress={() => setEventTypes(eventTypes.filter((_, i) => i !== idx))} className="ml-2">
                  <Ionicons name="close-circle" size={18} color={t.color} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Event Type Builder Button */}
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={openEventTypeTray}
        className="flex-row items-center justify-center bg-surface-card border border-surface-border rounded-full py-3 mb-8 border-dashed"
      >
        <Ionicons name="add" size={20} color={isDark ? '#ffffff' : '#0071e3'} style={{ marginRight: 6 }} />
        <Text className="text-[16px] font-semibold text-text-primary">Create Event Type</Text>
      </TouchableOpacity>

      <Text className="text-text-primary text-[15px] font-bold uppercase tracking-wide mb-3">
        Description
      </Text>
      <TextInput 
        className="bg-surface-card border border-surface-border text-text-primary rounded-[28px] px-5 pt-4 pb-4 text-[17px] min-h-[140px] mb-12"
        value={description}
        onChangeText={setDescription}
        placeholder="Provide context, specifications, or location details..."
        placeholderTextColor={isDark ? '#8899a6' : '#7a7577'}
        multiline
        textAlignVertical="top"
      />
    </View>
  );

  let canProceed = false;
  let btnLabel = 'Next';
  if (currentStep === 0) canProceed = category !== null;
  else if (currentStep === 1) canProceed = name.trim().length > 0;
  else if (currentStep === 2) {
    canProceed = description.trim().length > 0;
    btnLabel = isSubmitting ? 'Creating...' : 'Create Channel';
  }

  return (
    <View className="flex-1 bg-surface-background">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      {/* ── Exact Matching Header ── */}
      <SafeAreaView edges={['top', 'left', 'right']} className="bg-surface-background z-10">
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
          {[0, 1, 2].map((i) => {
            const segmentAnimStyle = useAnimatedStyle(() => {
              const targetWidth = currentStep >= i ? 100 : 0;
              return {
                width: `${withTiming(targetWidth, { duration: 300 })}%` as any,
              };
            });

            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 3.5,
                  borderRadius: 2,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                }}
              >
                {i < currentStep ? (
                  <View style={{ flex: 1, backgroundColor: '#0071e3' }} />
                ) : i === currentStep ? (
                  <Animated.View
                    style={[{ height: '100%', backgroundColor: '#0071e3' }, segmentAnimStyle]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        <View className="flex-row items-center px-4 pb-3 pt-1">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBack}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={currentStep === 0 ? "close" : "arrow-back-outline"} size={26} color={iconColor} />
          </TouchableOpacity>

          <View className="flex-1 items-center justify-center">
            <Text className="text-[20px] font-bold text-text-primary tracking-tight" numberOfLines={1}>
              {currentStep === 0 ? 'New Channel' : currentStep === 1 ? 'Details' : 'Finalize'}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="ellipsis-horizontal" size={26} color={iconColor} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.ScrollView
          ref={pagerRef as any}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep1()}
          {renderStep2()}
          {renderStep3()}
        </Animated.ScrollView>

        {/* Floating Bottom Action Area */}
        <View className="px-6 pt-4" style={{ paddingBottom: Math.max(insets.bottom + 16, 24) }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleNext}
            disabled={!canProceed || isSubmitting}
            className={`h-14 rounded-full items-center justify-center ${canProceed ? 'bg-text-primary' : 'bg-surface-card'}`}
          >
            <Text style={{ color: canProceed ? (isDark ? '#1a1718' : '#ffffff') : (isDark ? '#8899a6' : '#7a7577') }} className="text-lg font-bold">
              {btnLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Event Type Builder Tray Overlay ── */}
      <Animated.View 
        pointerEvents={isEventTypeTrayOpen ? 'auto' : 'none'}
        style={[{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50,
        }, trayOverlayStyle]}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeEventTypeTray} />
      </Animated.View>

      {/* ── Event Type Builder Tray Bottom Sheet ── */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: isDark ? '#1d2a35' : '#ffffff',
          borderTopLeftRadius: 32, borderTopRightRadius: 32,
          padding: 24, paddingBottom: Math.max(insets.bottom + 24, 24),
          zIndex: 51,
        }, traySheetStyle]}
      >
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: isDark ? '#3b4856' : '#d1d1d6', alignSelf: 'center', marginBottom: 20 }} />

        <View className="mb-6">
          <Text className="text-text-primary text-[22px] font-bold tracking-tight">Create Event Type</Text>
        </View>

        <TextInput 
          className="bg-surface-background border border-surface-border text-text-primary rounded-[24px] px-5 py-4 text-[17px] mb-6 font-semibold"
          value={eventTypeDraftName}
          onChangeText={setEventTypeDraftName}
          placeholder="Event type name..."
          placeholderTextColor={isDark ? '#8899a6' : '#7a7577'}
          autoFocus={isEventTypeTrayOpen}
        />

        <Text className="text-text-secondary text-[13px] font-bold uppercase tracking-wide mb-3">Color</Text>
        <View className="flex-row flex-wrap gap-4 mb-6">
          {COLOR_OPTIONS.map((color) => (
            <TouchableOpacity 
              key={color} 
              onPress={() => setEventTypeDraftColor(color)}
              className={`w-[44px] h-[44px] rounded-full border-4 ${eventTypeDraftColor === color ? 'border-surface-border' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </View>

        <Text className="text-text-secondary text-[13px] font-bold uppercase tracking-wide mb-3">Icon</Text>
        <View className="flex-row flex-wrap gap-4 mb-8">
          {ICON_OPTIONS.map((opt) => {
            const isSelected = eventTypeDraftIcon === opt.name;
            return (
              <TouchableOpacity 
                key={opt.name} 
                onPress={() => setEventTypeDraftIcon(opt.name)}
                style={{ backgroundColor: isSelected ? `${eventTypeDraftColor}26` : (isDark ? '#253341' : '#f2f2f7') }}
                className="w-12 h-12 rounded-full items-center justify-center"
              >
                <Ionicons name={opt.name as any} size={24} color={isSelected ? eventTypeDraftColor : (isDark ? '#8899a6' : '#7a7577')} />
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity 
          onPress={() => {
            if (eventTypeDraftName.trim()) {
              setEventTypes([...eventTypes, { name: eventTypeDraftName.trim(), icon: eventTypeDraftIcon, color: eventTypeDraftColor }]);
              setEventTypeDraftName('');
              closeEventTypeTray();
            }
          }}
          disabled={!eventTypeDraftName.trim()}
          style={{ opacity: eventTypeDraftName.trim() ? 1 : 0.5 }}
          className="bg-text-primary rounded-full py-4 items-center justify-center"
        >
          <Text style={{ color: isDark ? '#1a1718' : '#ffffff' }} className="text-[17px] font-bold">Add Event Type</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
