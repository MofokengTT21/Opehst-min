import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, useColorScheme } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface FormSchemaItem {
  name: string;
  label: string;
  type: 'text' | 'select' | 'camera';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

// Schemas mapped to specific route IDs
const SCHEMAS: Record<string, { title: string; subtitle: string; color: string; iconColor: string; icon: any; fields: FormSchemaItem[] }> = {
  'breakdown': {
    title: 'Breakdown Report',
    subtitle: 'Report a critical equipment breakdown immediately',
    color: 'border-semantic-breakdown text-semantic-breakdown bg-semantic-breakdown/10',
    iconColor: '#ef4444',
    icon: 'warning' as const,
    fields: [
      {
        name: 'equipmentName',
        label: 'Equipment Name',
        type: 'text',
        required: true,
        placeholder: 'e.g. CNC Lathe CNC-04',
      },
      {
        name: 'severity',
        label: 'Severity Level',
        type: 'select',
        required: true,
        options: ['Low', 'Medium', 'High', 'Critical'],
      },
      {
        name: 'description',
        label: 'Error & Failure Description',
        type: 'text',
        required: true,
        placeholder: 'Describe symptoms, alarms, or visual indicators...',
      },
      {
        name: 'photo',
        label: 'Breakdown Evidence Photo',
        type: 'camera',
        required: false,
      }
    ],
  },
  'job-card': {
    title: 'New Job Card',
    subtitle: 'Issue a work card for maintenance scheduling',
    color: 'border-semantic-jobcard text-semantic-jobcard bg-semantic-jobcard/10',
    iconColor: '#3b82f6',
    icon: 'construct' as const,
    fields: [
      {
        name: 'jobTitle',
        label: 'Job Title / Work Scope',
        type: 'text',
        required: true,
        placeholder: 'e.g. Hydro-pump Seal Replacement',
      },
      {
        name: 'workCenter',
        label: 'Work Center / Line',
        type: 'select',
        required: true,
        options: ['Mechanical Shop', 'Electrical Lab', 'Line A Assembly', 'Warehouse'],
      },
      {
        name: 'duration',
        label: 'Estimated Duration (Hours)',
        type: 'text',
        required: true,
        placeholder: 'e.g. 2.5',
      },
      {
        name: 'photo',
        label: 'Safety Cleared Sign-off Photo',
        type: 'camera',
        required: false,
      }
    ],
  },
  '5s-audit': {
    title: '5S Audit Checklist',
    subtitle: 'Conduct weekly workspace housekeeping audit',
    color: 'border-semantic-audit text-semantic-audit bg-semantic-audit/10',
    iconColor: '#22c55e',
    icon: 'checkmark-circle' as const,
    fields: [
      {
        name: 'areaUnderReview',
        label: 'Area Under Review',
        type: 'text',
        required: true,
        placeholder: 'e.g. Zone B Tool Bench',
      },
      {
        name: 'sortScore',
        label: 'Sort Score (1S)',
        type: 'select',
        required: true,
        options: ['1 - Poor', '2 - Fair', '3 - Good', '4 - Excellent'],
      },
      {
        name: 'setInOrderScore',
        label: 'Set in Order Score (2S)',
        type: 'select',
        required: true,
        options: ['1 - Poor', '2 - Fair', '3 - Good', '4 - Excellent'],
      },
      {
        name: 'auditPhoto',
        label: 'Workspace Photo Verification',
        type: 'camera',
        required: true,
      }
    ],
  },
  'kaizen': {
    title: 'Submit Kaizen Idea',
    subtitle: 'Propose continuous improvement ideas',
    color: 'border-semantic-kaizen text-semantic-kaizen bg-semantic-kaizen/10',
    iconColor: '#f59e0b',
    icon: 'bulb' as const,
    fields: [
      {
        name: 'problem',
        label: 'Problem Area Observed',
        type: 'text',
        required: true,
        placeholder: 'What is the waste or issue?',
      },
      {
        name: 'solution',
        label: 'Proposed Improvement Idea',
        type: 'text',
        required: true,
        placeholder: 'Describe your idea for improvement...',
      },
      {
        name: 'impact',
        label: 'Expected Primary Impact Area',
        type: 'select',
        required: true,
        options: ['Safety', 'Quality', 'Cost Saving', 'Lead Time', 'Efficiency'],
      },
      {
        name: 'beforePhoto',
        label: 'Before Condition Photo',
        type: 'camera',
        required: false,
      }
    ],
  },
};

export default function DynamicFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const textPrimaryColor = isDark ? '#ffffff' : '#18181b';
  const textSecondaryColor = isDark ? '#a1a1aa' : '#717172';

  // Retrieve current schema or fall back to a default
  const config = (id && SCHEMAS[id]) ? SCHEMAS[id] : {
    title: `Dynamic Form: ${id || 'Form'}`,
    subtitle: 'Standard reporting template',
    color: 'border-surface-border text-text-primary bg-surface-card',
    iconColor: textPrimaryColor,
    icon: 'document-text' as const,
    fields: [
      {
        name: 'equipmentName',
        label: 'Equipment Name',
        type: 'text' as const,
        required: true,
        placeholder: 'Enter equipment code',
      },
      {
        name: 'severity',
        label: 'Severity Level',
        type: 'select' as const,
        required: true,
        options: ['Low', 'Medium', 'High'],
      },
      {
        name: 'photo',
        label: 'Attachment Photo',
        type: 'camera' as const,
        required: false,
      }
    ]
  };

  const { control, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = (data: any) => {
    Alert.alert(
      'Form Validated & Submitted Successfully',
      JSON.stringify(data, null, 2),
      [{ text: 'Great', style: 'default' }]
    );
  };

  return (
    <View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }} className="flex-1 bg-surface-background">
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 border-b border-surface-border bg-surface-card shadow-sm">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center bg-surface-background border border-surface-border mr-3"
        >
          <Ionicons name="arrow-back" color={textPrimaryColor} size={20} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-text-primary text-xl font-bold">{config.title}</Text>
          <Text className="text-text-secondary text-xs">{config.subtitle}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 py-5" contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Schema Information Banner */}
        <View className={`border rounded-xl p-3 mb-6 flex-row items-center ${config.color}`}>
          <Ionicons name={config.icon} size={20} color={config.iconColor} style={{ marginRight: 8 }} />
          <Text className="font-semibold text-xs flex-1">
            Dynamic Scheme Context: {id ? `ophest://dynamic-form/${id}` : 'Default template'}
          </Text>
        </View>

        {/* Dynamic Fields Loop */}
        <View className="space-y-5">
          {config.fields.map((field) => {
            return (
              <View key={field.name} className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
                {field.type === 'text' && (
                  <Controller
                    control={control}
                    name={field.name}
                    rules={{ required: field.required ? `${field.label} is required` : false }}
                    render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                      <View>
                        <Text className="text-text-secondary text-sm font-semibold mb-2">
                          {field.label} {field.required && <Text className="text-semantic-breakdown">*</Text>}
                        </Text>
                        <TextInput
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value || ''}
                          placeholder={field.placeholder}
                          placeholderTextColor="#a1a1aa"
                          className="bg-surface-background border border-surface-border text-text-primary rounded-xl px-4 py-3 text-base focus:border-ophest"
                        />
                        {error && <Text className="text-semantic-breakdown text-xs mt-1.5 font-medium">{error.message}</Text>}
                      </View>
                    )}
                  />
                )}

                {field.type === 'select' && (
                  <Controller
                    control={control}
                    name={field.name}
                    rules={{ required: field.required ? `${field.label} is required` : false }}
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <View>
                        <Text className="text-text-secondary text-sm font-semibold mb-2">
                          {field.label} {field.required && <Text className="text-semantic-breakdown">*</Text>}
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                          {field.options?.map((opt) => {
                            const isSelected = value === opt;
                            return (
                              <TouchableOpacity
                                key={opt}
                                activeOpacity={0.8}
                                onPress={() => onChange(opt)}
                                className={`px-4 py-2.5 rounded-xl border ${
                                  isSelected 
                                    ? 'bg-ophest border-ophest shadow-sm' 
                                    : 'bg-surface-background border-surface-border'
                                }`}
                              >
                                <Text className={`font-semibold text-xs ${isSelected ? 'text-text-brand' : 'text-text-primary'}`}>
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {error && <Text className="text-semantic-breakdown text-xs mt-1.5 font-medium">{error.message}</Text>}
                      </View>
                    )}
                  />
                )}

                {field.type === 'camera' && (
                  <Controller
                    control={control}
                    name={field.name}
                    rules={{ required: field.required ? `${field.label} is required` : false }}
                    render={({ field: { onChange, value }, fieldState: { error } }) => {
                      const triggerCamera = () => {
                        const mockPhotoUri = `https://picsum.photos/400/300?random=${Date.now()}`;
                        onChange(mockPhotoUri);
                        Alert.alert('Camera Capture', 'Mock photo captured from camera module.');
                      };

                      const clearPhoto = () => {
                        onChange(null);
                      };

                      return (
                        <View>
                          <Text className="text-text-secondary text-sm font-semibold mb-2">
                            {field.label} {field.required && <Text className="text-semantic-breakdown">*</Text>}
                          </Text>
                          {value ? (
                            <View className="bg-surface-background border border-surface-border rounded-xl p-3 items-center">
                              <View className="w-full h-40 bg-zinc-950 rounded-lg items-center justify-center relative overflow-hidden mb-2">
                                <Ionicons name="camera" color="#ffffff" style={{ marginBottom: 4 }} size={32} />
                                <Text className="text-white/60 text-xs">Evidence Image Captured</Text>
                              </View>
                              <TouchableOpacity
                                onPress={clearPhoto}
                                className="w-full bg-semantic-breakdown/10 border border-semantic-breakdown/20 py-2.5 rounded-xl"
                              >
                                <Text className="text-semantic-breakdown font-bold text-xs text-center">Delete Attachment</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={triggerCamera}
                              className="bg-surface-background border border-dashed border-surface-border rounded-xl p-8 items-center justify-center"
                            >
                              <Ionicons name="camera-outline" color={textSecondaryColor} style={{ marginBottom: 8 }} size={32} />
                              <Text className="text-text-primary font-bold text-sm">Activate Camera Module</Text>
                              <Text className="text-text-secondary text-xs mt-1">Tap to simulate photo upload</Text>
                            </TouchableOpacity>
                          )}
                          {error && <Text className="text-semantic-breakdown text-xs mt-1.5 font-medium">{error.message}</Text>}
                        </View>
                      );
                    }}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Submit Action (10% Scarce Brand Accent) */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSubmit(onSubmit)}
          className="bg-ophest rounded-full items-center justify-center py-4 px-6 shadow-md mt-8"
        >
          <Text className="text-text-brand font-bold text-base">Submit Report</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
