import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FormFieldPlaceholder {
  id: string;
  type: 'text' | 'select' | 'camera';
  label: string;
  placeholder?: string;
  options?: string[];
}

export default function TemplateBuilderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [fields, setFields] = useState<FormFieldPlaceholder[]>([
    {
      id: 'field_1',
      type: 'text',
      label: 'Equipment Name',
      placeholder: 'e.g. CNC Machine A',
    },
    {
      id: 'field_2',
      type: 'select',
      label: 'Severity Level',
      options: ['Low', 'Medium', 'High', 'Critical'],
    }
  ]);

  const [templateName, setTemplateName] = useState('New Maintenance Audit');

  const addField = (type: 'text' | 'select' | 'camera') => {
    const newField: FormFieldPlaceholder = {
      id: `field_${Date.now()}`,
      type,
      label: type === 'text' ? 'New Text Field' : type === 'select' ? 'New Dropdown Field' : 'New Photo Upload',
      placeholder: type === 'text' ? 'Enter text...' : undefined,
      options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    };
    setFields([...fields, newField]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateLabel = (id: string, text: string) => {
    setFields(fields.map(f => f.id === id ? { ...f, label: text } : f));
  };

  const handlePublish = () => {
    if (fields.length === 0) {
      Alert.alert('Empty Template', 'Please add at least one field before publishing.');
      return;
    }
    const schema = {
      templateName,
      createdAt: new Date().toISOString(),
      fields: fields.map(f => ({
        name: f.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        label: f.label,
        type: f.type,
        required: true,
        ...(f.placeholder ? { placeholder: f.placeholder } : {}),
        ...(f.options ? { options: f.options } : {}),
      })),
    };

    Alert.alert(
      'JSON Schema Published',
      JSON.stringify(schema, null, 2),
      [{ text: 'Close', style: 'cancel' }]
    );
  };

  const textPrimaryColor = isDark ? '#ffffff' : '#18181b';
  const textSecondaryColor = isDark ? '#a1a1aa' : '#717172';

  return (
    <View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }} className="flex-1 bg-surface-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-border bg-surface-card">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center bg-surface-background border border-surface-border mr-3"
          >
            <Ionicons name="arrow-back" color={textPrimaryColor} size={20} />
          </TouchableOpacity>
          <Text className="text-text-primary text-xl font-bold">Template Builder</Text>
        </View>

        <TouchableOpacity 
          onPress={handlePublish}
          className="flex-row items-center bg-ophest px-4 py-2 rounded-full"
        >
          <Ionicons name="code-download-outline" color="#ffffff" size={16} />
          <Text className="text-text-brand font-bold text-sm ml-1.5">Publish</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Template Info Card */}
        <View className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm mb-6">
          <Text className="text-text-secondary text-xs uppercase font-bold tracking-wider mb-1">Template Info</Text>
          <TextInput
            value={templateName}
            onChangeText={setTemplateName}
            placeholder="Template Name"
            placeholderTextColor="#a1a1aa"
            className="text-text-primary text-lg font-bold border-b border-surface-border pb-1"
          />
        </View>

        {/* Toolbox Controls */}
        <Text className="text-text-primary text-md font-bold mb-3">Add Form Fields</Text>
        <View className="flex-row flex-wrap mb-6">
          <TouchableOpacity 
            onPress={() => addField('text')}
            className="flex-1 flex-row bg-surface-card border border-surface-border rounded-xl p-3.5 items-center justify-center mr-2 mb-2 shadow-sm"
          >
            <Ionicons name="text-outline" color="#3b82f6" style={{ marginRight: 8 }} size={18} />
            <Text className="text-text-primary font-semibold text-sm">Text Input</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => addField('select')}
            className="flex-1 flex-row bg-surface-card border border-surface-border rounded-xl p-3.5 items-center justify-center ml-2 mb-2 shadow-sm"
          >
            <Ionicons name="list" color="#f59e0b" style={{ marginRight: 8 }} size={18} />
            <Text className="text-text-primary font-semibold text-sm">Dropdown</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row mb-6">
          <TouchableOpacity 
            onPress={() => addField('camera')}
            className="w-full flex-row bg-surface-card border border-surface-border rounded-xl p-3.5 items-center justify-center shadow-sm"
          >
            <Ionicons name="camera-outline" color="#22c55e" style={{ marginRight: 8 }} size={18} />
            <Text className="text-text-primary font-semibold text-sm">Camera Upload</Text>
          </TouchableOpacity>
        </View>

        {/* Live Preview / Layout list */}
        <Text className="text-text-primary text-md font-bold mb-3">Template Preview</Text>
        {fields.length === 0 ? (
          <View className="bg-surface-card border border-dashed border-surface-border rounded-xl p-8 items-center justify-center">
            <Text className="text-text-secondary text-sm text-center">No fields added yet.</Text>
            <Text className="text-text-secondary text-xs text-center mt-1">Tap a button above to add form controls.</Text>
          </View>
        ) : (
          <View className="space-y-4">
            {fields.map((field) => (
              <View 
                key={field.id}
                className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm"
              >
                <View className="flex-row justify-between items-center mb-3">
                  <View className="flex-row items-center flex-1 mr-2">
                    {field.type === 'text' && <Ionicons name="text-outline" color="#3b82f6" style={{ marginRight: 8 }} size={16} />}
                    {field.type === 'select' && <Ionicons name="list" color="#f59e0b" style={{ marginRight: 8 }} size={16} />}
                    {field.type === 'camera' && <Ionicons name="camera-outline" color="#22c55e" style={{ marginRight: 8 }} size={16} />}
                    <TextInput
                      value={field.label}
                      onChangeText={(text) => updateLabel(field.id, text)}
                      placeholder="Field Label"
                      placeholderTextColor="#a1a1aa"
                      className="text-text-primary font-semibold text-sm flex-1 p-0 border-b border-transparent focus:border-surface-border"
                    />
                  </View>
                  <TouchableOpacity 
                    onPress={() => removeField(field.id)}
                    className="w-8 h-8 rounded-full items-center justify-center bg-semantic-breakdown/10 border border-semantic-breakdown/20"
                  >
                    <Ionicons name="trash-outline" color="#ef4444" size={14} />
                  </TouchableOpacity>
                </View>

                {/* Input Placeholder Preview */}
                {field.type === 'text' && (
                  <View className="bg-surface-background border border-surface-border rounded-lg px-3 py-2.5">
                    <Text className="text-text-secondary text-sm">
                      {field.placeholder}
                    </Text>
                  </View>
                )}

                {field.type === 'select' && (
                  <View className="bg-surface-background border border-surface-border rounded-lg px-3 py-2.5 flex-row justify-between items-center">
                    <Text className="text-text-secondary text-sm">
                      Select option...
                    </Text>
                    <Ionicons name="chevron-down" color={textSecondaryColor} size={14} />
                  </View>
                )}

                {field.type === 'camera' && (
                  <View className="bg-surface-background border border-dashed border-surface-border rounded-lg p-6 items-center justify-center">
                    <Ionicons name="camera-outline" color={textSecondaryColor} style={{ marginBottom: 4 }} size={24} />
                    <Text className="text-text-secondary text-xs">
                      Camera upload preview
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
