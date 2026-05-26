import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Image, Pressable, Animated, PanResponder, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import { database } from '../database';
import Log from '../database/models/Log';
import Attachment from '../database/models/Attachment';
import { SyncClient } from '../services/localsend/SyncClient';
import { Ionicons } from '@expo/vector-icons';

type TagOption = {
  label: string;
  emoji: string;
  bg: string;
  border: string;
  text: string;
  activeBg: string;
};

const TAG_OPTIONS: TagOption[] = [
  { label: 'Breakdown', emoji: '🛠️', bg: '#fef2f2', border: '#fee2e2', text: '#ef4444', activeBg: '#fee2e2' },
  { label: 'Handover', emoji: '👷', bg: '#f5f3ff', border: '#e0e7ff', text: '#6366f1', activeBg: '#e0e7ff' },
  { label: 'Hazard', emoji: '⚠️', bg: '#fffbeb', border: '#fef3c7', text: '#f59e0b', activeBg: '#fef3c7' },
  { label: '5S Check', emoji: '✅', bg: '#f0fdf4', border: '#dcfce7', text: '#22c55e', activeBg: '#dcfce7' },
];

const MOCK_GALLERY = [
  { uri: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80', label: 'Panel' },
  { uri: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80', label: 'Site View' },
  { uri: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=600&auto=format&fit=crop&q=80', label: 'Monitor' },
  { uri: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80', label: 'Welding' },
  { uri: 'https://images.unsplash.com/photo-1535557142533-b5e1cc6e2a5d?w=600&auto=format&fit=crop&q=80', label: 'Gearbox' }
];

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function ComposeLogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, type, initialText, openCamera, openVoice } = useLocalSearchParams();
  const { addPost } = useStore();

  const [subject, setSubject] = useState('');
  const [content, setContent] = useState(typeof initialText === 'string' ? initialText : '');
  const [selectedTag, setSelectedTag] = useState<TagOption | null>(null);

  // Attachments State
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [locationText, setLocationText] = useState<string | null>(null);

  // Camera Overlay States
  const [showCameraOverlay, setShowCameraOverlay] = useState(false);
  const [cameraStep, setCameraStep] = useState<'capture' | 'caption'>('capture');
  const [selectedCameraImage, setSelectedCameraImage] = useState<string | null>(null);
  const [tempCaption, setTempCaption] = useState('');

  // Animated vertical translation of the bottom sheet
  const [animatedTranslateY] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const [containerHeight, setContainerHeight] = useState(SCREEN_HEIGHT);

  // Mount animation: slide from bottom to 0 (natural position based on content)
  useEffect(() => {
    Animated.spring(animatedTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [animatedTranslateY]);

  const snapTo = useCallback((toValue: number) => {
    Animated.spring(animatedTranslateY, {
      toValue,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [animatedTranslateY]);

  const dismissModal = useCallback(() => {
    Animated.timing(animatedTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    });
  }, [animatedTranslateY, router]);

  // PanResponder to track swipe gesture on the drag handle area
  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);

  useEffect(() => {
    setPanResponder(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {},
        onPanResponderMove: (evt, gestureState) => {
          let newTranslateY = gestureState.dy;
          if (newTranslateY < 0) {
            // Elastic resistance above top boundary (0)
            newTranslateY = newTranslateY * 0.15;
          }
          animatedTranslateY.setValue(newTranslateY);
        },
        onPanResponderRelease: (evt, gestureState) => {
          const dy = gestureState.dy;
          const vy = gestureState.vy;

          if (vy > 0.5 || dy > 100) {
            dismissModal();
          } else {
            snapTo(0);
          }
        }
      })
    );
  }, [animatedTranslateY, dismissModal, snapTo]);

  const targetId = typeof id === 'string' ? id : id?.[0] || '';
  const targetType = ((type === 'item' || type === 'group') ? type : 'item') as 'item' | 'group';

  const handlePost = useCallback(async () => {
    if (!subject.trim()) {
      Alert.alert('Missing Subject', 'Please write a subject or issue headline.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Missing Details', 'Please provide details or a message body.');
      return;
    }

    try {
      // Mock UI-First post creation using Zustand store
      const newPost = {
        id: Math.random().toString(36).substr(2, 9),
        target_id: targetId,
        target_type: targetType,
        author_name: 'Me',
        subject: subject.trim(),
        content: content.trim(),
        tag: selectedTag ? `${selectedTag.emoji} ${selectedTag.label}` : undefined,
        is_scada_alert: false,
        created_at: new Date().toISOString(),
      };

      addPost(newPost);
      
      dismissModal();
    } catch (e) {
      console.error('Failed to post log:', e);
      Alert.alert('Error', 'Could not save log locally.');
    }
  }, [subject, content, selectedTag, photoUri, photoCaption, voiceUri, locationText, targetId, targetType, dismissModal]);

  const handleAttachPhoto = useCallback(() => {
    setSelectedCameraImage(null);
    setTempCaption('');
    setCameraStep('capture');
    setShowCameraOverlay(true);
  }, []);

  const handleAttachVoice = useCallback(() => {
    setVoiceUri(prev => prev ? null : 'mock-voice-recording-014.mp3');
  }, []);

  const handleAttachLocation = useCallback(() => {
    setLocationText(prev => prev ? null : '📍 Section 4, Bearing Assembly Line');
  }, []);

  const handleCapturePhoto = () => {
    setSelectedCameraImage(MOCK_GALLERY[0].uri);
    setTempCaption('');
    setCameraStep('caption');
  };

  const handleConfirmPhoto = () => {
    setPhotoUri(selectedCameraImage);
    setPhotoCaption(tempCaption);
    setShowCameraOverlay(false);
  };


  // Handle camera/voice shortcuts from the feed screen
  useEffect(() => {
    let active = true;
    if (openCamera === 'true') {
      const timer = setTimeout(() => {
        if (active) handleAttachPhoto();
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    } else if (openVoice === 'true') {
      const timer = setTimeout(() => {
        if (active) handleAttachVoice();
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [openCamera, openVoice, handleAttachPhoto, handleAttachVoice]);

  const hasText = content.trim().length > 0 || subject.trim().length > 0;

  const handleRightCirclePress = useCallback(() => {
    if (hasText) {
      handlePost();
    } else {
      handleAttachVoice();
    }
  }, [hasText, handlePost, handleAttachVoice]);

  // Interpolated backdrop opacity based on vertical slide position
  const backdropOpacity = animatedTranslateY.interpolate({
    inputRange: [0, SCREEN_HEIGHT],
    outputRange: [0.4, 0],
    extrapolate: 'clamp',
  });

  const renderCameraOverlay = () => {
    if (!showCameraOverlay) return null;

    if (cameraStep === 'capture') {
      return (
        <View style={[StyleSheet.absoluteFill, styles.cameraOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => setShowCameraOverlay(false)} style={styles.cameraHeaderBtn}>
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.cameraHeaderTitle}>Camera Viewfinder</Text>
            <View style={{ width: 32 }} />
          </View>

          <View style={styles.cameraViewport}>
            <Image 
              source={{ uri: MOCK_GALLERY[0].uri }} 
              style={styles.cameraLiveFeed} 
            />
            <View style={styles.cameraGridLines}>
              <View style={styles.gridHorizontal} />
              <View style={styles.gridVertical} />
              <View style={styles.cameraReticle} />
            </View>
            <View style={styles.cameraIndicatorRow}>
              <View style={styles.cameraRecDot} />
              <Text style={styles.cameraRecText}>LIVE FEED ACTIVE</Text>
            </View>
            <Text style={styles.cameraSpecsText}>ISO 400  •  1080p 60fps  •  F2.8</Text>
          </View>

          <View style={styles.cameraBottomArea}>
            <View style={styles.galleryContainer}>
              <Text style={styles.galleryTitle}>Select from Gallery</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryScroll}>
                {MOCK_GALLERY.map((item, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={styles.galleryItem}
                    onPress={() => {
                      setSelectedCameraImage(item.uri);
                      setTempCaption('');
                      setCameraStep('caption');
                    }}
                  >
                    <Image source={{ uri: item.uri }} style={styles.galleryImage} />
                    <View style={styles.galleryLabelBg}>
                      <Text style={styles.galleryLabelText}>{item.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.shutterRow}>
              <View style={{ width: 44 }} />
              <TouchableOpacity style={styles.shutterBtn} onPress={handleCapturePhoto}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
              <View style={{ width: 44 }} />
            </View>
          </View>
        </View>
      );
    }

    return (
      <KeyboardAvoidingView 
        style={[StyleSheet.absoluteFill, styles.cameraOverlay]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.cameraHeader, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => setCameraStep('capture')} style={styles.cameraHeaderBtn}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.cameraHeaderTitle}>Photo Preview</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.previewImageContainer}>
          {selectedCameraImage && (
            <Image source={{ uri: selectedCameraImage }} style={styles.previewFullScreenImage} resizeMode="contain" />
          )}
        </View>

        <View style={[styles.captionContainer, { paddingBottom: Platform.OS === 'android' ? 16 : insets.bottom + 8 }]}>
          <View style={styles.captionInputWrapper}>
            <Ionicons name="image-outline" size={20} color="#94a3b8" style={styles.captionIcon} />
            <TextInput
              style={styles.captionInput}
              value={tempCaption}
              onChangeText={setTempCaption}
              placeholder="Add a caption..."
              placeholderTextColor="#94a3b8"
              maxLength={120}
              autoFocus
            />
          </View>
          <TouchableOpacity style={styles.captionConfirmBtn} onPress={handleConfirmPhoto}>
            <Ionicons name="checkmark" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  };

  return (
    <View style={styles.overlay} onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}>
      {/* Animated backdrop, dimming updates dynamically with sheet position */}
      <Animated.View 
        style={[
          styles.backdrop, 
          { 
            backgroundColor: 'black',
            opacity: backdropOpacity 
          }
        ]} 
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissModal} />
      </Animated.View>

      <Animated.View 
        style={[
          styles.sheet, 
          { 
            maxHeight: containerHeight * 0.9, // occupies 90% height max
            transform: [{ translateY: animatedTranslateY }],
          }
        ]}
      >
        <KeyboardAvoidingView
          style={{ flexShrink: 1, paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Swipe gesture handle area */}
          <View style={styles.dragHandleArea} {...(panResponder?.panHandlers || {})}>
            <View style={styles.dragHandle} />
          </View>

          {/* Scrollable Form Content */}
          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
            {/* Subject Field */}
            <View style={styles.subjectInputGroup}>
              <TextInput
                style={styles.subjectInput}
                value={subject}
                onChangeText={setSubject}
                placeholder="Subject / Issue Headline"
                placeholderTextColor="#94a3b8"
                maxLength={80}
              />
            </View>

            {/* Quick Tags Section */}
            <View style={styles.tagsSection}>
              <Text style={styles.sectionLabel}>Classify this update</Text>
              <View style={styles.tagsContainer}>
                {TAG_OPTIONS.map((tag) => {
                  const isSelected = selectedTag?.label === tag.label;
                  return (
                    <TouchableOpacity
                      key={tag.label}
                      activeOpacity={0.8}
                      style={[
                        styles.tagPill,
                        { backgroundColor: tag.bg, borderColor: tag.border },
                        isSelected && { backgroundColor: tag.activeBg, borderWidth: 2, borderColor: tag.text }
                      ]}
                      onPress={() => setSelectedTag(isSelected ? null : tag)}
                    >
                      <Text style={[styles.tagEmoji]}>{tag.emoji}</Text>
                      <Text style={[styles.tagLabel, { color: tag.text }, isSelected && { fontWeight: '700' }]}>
                        {tag.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Attached Assets Preview Section */}
            {(photoUri || voiceUri || locationText) && (
              <View style={styles.attachmentsSection}>
                <Text style={styles.sectionLabel}>Attachments</Text>
                
                {/* Photo Preview */}
                {photoUri && (
                  <View style={styles.photoPreviewCard}>
                    <Image source={{ uri: photoUri }} style={styles.photoPreviewImage} />
                    <View style={styles.photoInfo}>
                      <Text style={styles.attachmentName}>log_photo.jpg</Text>
                      <Text style={styles.attachmentDesc} numberOfLines={1}>
                        {photoCaption ? photoCaption : 'Industrial Machinery Inspection'}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.removeAttachBtn} 
                      onPress={() => {
                        setPhotoUri(null);
                        setPhotoCaption('');
                      }}
                    >
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Voice Note Preview */}
                {voiceUri && (
                  <View style={styles.voicePreviewCard}>
                    <View style={styles.voiceIconBg}>
                      <Ionicons name="mic" size={20} color="#075e54" />
                    </View>
                    <View style={styles.voiceWaveformContainer}>
                      <Text style={styles.voiceTitle}>Voice Note</Text>
                      <Text style={styles.voiceDuration}>0:14 • Ready to upload</Text>
                    </View>
                    <TouchableOpacity style={styles.removeAttachBtn} onPress={() => setVoiceUri(null)}>
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Location Preview */}
                {locationText && (
                  <View style={styles.locationPreviewCard}>
                    <Ionicons name="location" size={20} color="#ea580c" />
                    <Text style={styles.locationLabelText} numberOfLines={1}>
                      {locationText}
                    </Text>
                    <TouchableOpacity style={styles.removeAttachBtn} onPress={() => setLocationText(null)}>
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* WhatsApp-Style Composer Box at bottom */}
          <View style={[
            styles.composerContainer, 
            { 
              paddingBottom: Platform.OS === 'android' ? 12 : 8,
            }
          ]}>
            <TouchableOpacity style={styles.composerIconBtn} onPress={handleAttachLocation}>
              <Ionicons name={locationText ? "location" : "location-outline"} size={26} color={locationText ? "#ea580c" : "#0f172a"} />
            </TouchableOpacity>

            <View style={styles.composerInputWrapper}>
              <TextInput
                style={styles.bodyInput}
                value={content}
                onChangeText={setContent}
                placeholder="Provide details, actions taken..."
                placeholderTextColor="#94a3b8"
                multiline
                maxLength={1000}
              />
              <TouchableOpacity style={styles.composerInsideIcon} onPress={handleAttachPhoto}>
                <Ionicons name={photoUri ? "camera" : "camera-outline"} size={24} color={photoUri ? "#075e54" : "#64748b"} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[
                styles.composerMicBtn, 
                hasText ? styles.composerSendBtnActive : (voiceUri && styles.composerMicBtnActive)
              ]} 
              onPress={handleRightCirclePress}
            >
              <Ionicons 
                name={hasText ? "send" : "mic"} 
                size={20} 
                color="#ffffff" 
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Full-Screen Camera Simulator & Caption Overlay */}
      {renderCameraOverlay()}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 24,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  dragHandleArea: {
    width: '100%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#cbd5e1',
  },
  formScroll: {
    flexShrink: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  subjectInputGroup: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 4,
  },
  subjectInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    paddingVertical: 4,
  },
  tagsSection: {
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  tagEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  tagLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  attachmentsSection: {
    marginTop: 4,
    gap: 10,
  },
  photoPreviewCard: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    alignItems: 'center',
    paddingRight: 8,
  },
  photoPreviewImage: {
    width: 60,
    height: 60,
  },
  photoInfo: {
    flex: 1,
    paddingHorizontal: 12,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  attachmentDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  voicePreviewCard: {
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 12,
    alignItems: 'center',
  },
  voiceIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  voiceWaveformContainer: {
    flex: 1,
  },
  voiceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#14532d',
  },
  voiceDuration: {
    fontSize: 12,
    color: '#166534',
    marginTop: 1,
  },
  locationPreviewCard: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffedd5',
    padding: 12,
    alignItems: 'center',
  },
  locationLabelText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#7c2d12',
    marginLeft: 8,
  },
  removeAttachBtn: {
    padding: 4,
  },
  
  // WhatsApp-style composer container
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#f0f2f5',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  composerIconBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 8,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  bodyInput: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
    paddingVertical: 8,
    paddingRight: 8,
    lineHeight: 20,
  },
  composerInsideIcon: {
    paddingBottom: 8,
    paddingHorizontal: 6,
  },
  composerMicBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#075e54',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    marginBottom: 1,
  },
  composerMicBtnActive: {
    backgroundColor: '#128c7e',
  },
  composerSendBtnActive: {
    backgroundColor: '#0a66c2', // Use LinkedIn Blue when there is text to send
  },

  // Camera Overlay Styling
  cameraOverlay: {
    backgroundColor: '#000000',
    zIndex: 1000,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#000000',
  },
  cameraHeaderBtn: {
    padding: 8,
  },
  cameraHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  cameraViewport: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    position: 'relative',
    overflow: 'hidden',
  },
  cameraLiveFeed: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  cameraGridLines: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridHorizontal: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    position: 'absolute',
  },
  gridVertical: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    position: 'absolute',
  },
  cameraReticle: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderColor: '#22c55e',
    borderRadius: 32,
    opacity: 0.6,
  },
  cameraIndicatorRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cameraRecDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  cameraRecText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cameraSpecsText: {
    position: 'absolute',
    bottom: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cameraBottomArea: {
    backgroundColor: '#000000',
    paddingVertical: 16,
  },
  galleryContainer: {
    marginBottom: 16,
  },
  galleryTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  galleryScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  galleryItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#334155',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  galleryLabelBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  galleryLabelText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  shutterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
  },
  previewImageContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewFullScreenImage: {
    width: '100%',
    height: '100%',
  },
  captionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  captionInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 24,
    paddingHorizontal: 16,
    marginRight: 12,
    height: 48,
  },
  captionIcon: {
    marginRight: 8,
  },
  captionInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: 8,
  },
  captionConfirmBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#075e54',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
