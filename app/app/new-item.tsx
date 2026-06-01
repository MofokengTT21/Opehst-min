import { View, Text, TextInput, TouchableOpacity, Alert, useColorScheme, Platform, StatusBar, Dimensions, Keyboard } from 'react-native';
import { useState, useRef } from 'react';
import { useRouter, Stack } from 'expo-router';
import { database } from '../database';
import { createGroup } from '../services/feed';
import { ItemCategory, AccessType } from '@opehst/shared';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, useAnimatedStyle, withSpring, withTiming, 
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import { KeyboardAvoidingView } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES: { key: ItemCategory; label: string; icon: any; semantic: string; desc: string }[] = [
  { key: 'asset', label: 'Asset', icon: 'hardware-chip-outline', semantic: 'jobcard', desc: 'Machinery, tools, or equipment' },
  { key: 'location', label: 'Location', icon: 'location-outline', semantic: 'audit', desc: 'Physical zones or areas' },
  { key: 'process', label: 'Process', icon: 'git-network-outline', semantic: 'kaizen', desc: 'Workflows and operational steps' },
  { key: 'role', label: 'Role', icon: 'person-outline', semantic: 'ophest', desc: 'Job titles or functional teams' },
];

const ACCESS_TYPES: { key: AccessType; label: string; icon: any }[] = [
  { key: 'open', label: 'Open', icon: 'earth-outline' },
  { key: 'approval_required', label: 'Approval Required', icon: 'shield-half-outline' },
  { key: 'invite_only', label: 'Invite Only', icon: 'lock-closed-outline' },
];

export default function NewItemWizard() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  // Form State
  const [category, setCategory] = useState<ItemCategory | null>(null);
  const [name, setName] = useState('');
  const [accessType, setAccessType] = useState<AccessType>('open');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Wizard State
  const [currentStep, setCurrentStep] = useState(0);
  const pagerRef = useRef<Animated.ScrollView>(null);

  const glassmorphicBg = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const iconColor = isDark ? '#ffffff' : '#2e2a2b';
  const activeIconColor = isDark ? '#ffffff' : '#ffffff';

  const getIconBgColor = (isActive: boolean) => {
    if (isDark) {
      return isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent';
    }
    return '#ffffff';
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
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (!category || !name.trim() || !description.trim()) {
      Alert.alert('Missing Info', 'Please complete all required fields.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const success = await createGroup(name, description, category, accessType);
      if (success) {
        router.back();
      } else {
        throw new Error('Server returned false');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to create item.');
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
        Select a category to help organize this item within the system.
      </Text>

      <View className="flex-col gap-4">
        {CATEGORIES.map((cat) => {
          const isActive = category === cat.key;

          return (
            <TouchableOpacity
              key={cat.key}
              activeOpacity={0.7}
              onPress={() => setCategory(cat.key)}
              className={`flex-row items-center p-5 rounded-[28px] border ${isActive ? 'bg-ophest/10 border-ophest' : 'bg-surface-card border-transparent'}`}
            >
              <View 
                style={{ backgroundColor: getIconBgColor(isActive), borderRadius: 24, overflow: 'hidden' }}
                className="w-12 h-12 rounded-full items-center justify-center mr-4"
              >
                <Ionicons name={cat.icon} size={24} color={isActive ? '#0071e3' : iconColor} />
              </View>
              <View className="flex-1">
                <Text className={`text-lg font-bold mb-1 ${isActive ? 'text-ophest' : 'text-text-primary'}`}>
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

      <View className="mb-8 border-b-2" style={{ borderBottomColor: name.trim() ? '#0071e3' : (isDark ? '#253341' : '#e8e4e5') }}>
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
              className={`flex-row items-center p-5 rounded-[28px] border ${isActive ? 'bg-ophest/10 border-ophest' : 'bg-surface-card border-transparent'}`}
            >
              <View 
                style={{ backgroundColor: getIconBgColor(isActive), borderRadius: 20, overflow: 'hidden' }}
                className="w-10 h-10 rounded-full items-center justify-center mr-4"
              >
                <Ionicons name={acc.icon} size={20} color={isActive ? '#0071e3' : iconColor} />
              </View>
              <Text className={`flex-1 text-[17px] ${isActive ? 'font-semibold text-ophest' : 'font-medium text-text-primary'}`}>
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
          <View className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-ophest border-4 border-surface-background items-center justify-center">
            <Ionicons name="add" size={24} color="#ffffff" />
          </View>
        </TouchableOpacity>
        <Text className="text-ophest font-semibold mt-3 text-base">
          Add Cover Photo
        </Text>
      </View>

      <Text className="text-text-primary text-[15px] font-bold uppercase tracking-wide mb-3">
        Description
      </Text>
      <TextInput 
        className="bg-surface-card border border-surface-border text-text-primary rounded-[28px] px-5 pt-4 pb-4 text-[17px] min-h-[140px]"
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
    btnLabel = isSubmitting ? 'Creating...' : 'Create Item';
  }

  return (
    <View className="flex-1 bg-surface-background">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      {/* ── Exact Matching Header ── */}
      <SafeAreaView edges={['top', 'left', 'right']} className="bg-surface-background z-10">
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
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
                    style={[
                      {
                        height: '100%',
                        backgroundColor: '#0071e3',
                      },
                      segmentAnimStyle
                    ]}
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
              {currentStep === 0 ? 'New Item' : currentStep === 1 ? 'Details' : 'Finalize'}
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
            className={`h-14 rounded-full items-center justify-center ${canProceed ? 'bg-ophest' : 'bg-surface-card'}`}
          >
            <Text className={`text-lg font-bold ${canProceed ? 'text-text-brand' : 'text-text-secondary'}`}>
              {btnLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
