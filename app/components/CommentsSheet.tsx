import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, useColorScheme, Dimensions,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import Post from '../database/models/Post';
import Comment from '../database/models/Comment';
import { database } from '../database';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatTimeAgo(dateString: number) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const CommentItem = ({ comment }: { comment: Comment }) => {
  const isDark = useColorScheme() === 'dark';
  return (
    <View style={{ flexDirection: 'row', marginBottom: 16 }}>
      <Image
        source={{ uri: `https://i.pravatar.cc/150?u=${encodeURIComponent(comment.authorId)}` }}
        style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: isDark ? '#fff' : '#000' }}>User</Text>
          <Text style={{ fontSize: 13, color: isDark ? '#8899a6' : '#536471', marginLeft: 8 }}>
            {formatTimeAgo(comment.createdAt)}
          </Text>
        </View>
        <Text style={{ fontSize: 15, color: isDark ? '#fff' : '#000', lineHeight: 20 }}>
          {comment.content}
        </Text>
      </View>
    </View>
  );
};

interface Props {
  visible: boolean;
  onClose: () => void;
  post: Post;
  comments: Comment[];
}

const CommentsSheetInner = ({ visible, onClose, post, comments }: Props) => {
  const isDark = useColorScheme() === 'dark';
  const bgColor = isDark ? '#15202b' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';
  const borderColor = isDark ? '#38444d' : '#eff3f4';

  const [text, setText] = useState('');

  const handleSend = async () => {
    if (!text.trim()) return;
    
    const content = text;
    setText('');
    
    // Write to WatermelonDB locally (optimistic)
    // You should also trigger an API call to sync this upstream, handled via a syncQueue ideally
    await database.write(async () => {
      await database.collections.get<Comment>('comments').create(record => {
        record._raw.id = Math.random().toString();
        record.tenantId = post.tenantId;
        record.postId = post.id;
        record.authorId = 'local-user'; // Replace with real auth ID
        record.content = content;
        record.createdAt = Date.now();
        record.updatedAt = Date.now();
      });
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <View style={{ 
          backgroundColor: bgColor, 
          height: SCREEN_HEIGHT * 0.75, 
          borderTopLeftRadius: 24, 
          borderTopRightRadius: 24,
          paddingTop: 12
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? '#38444d' : '#d1d5db' }} />
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: borderColor }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: textColor }}>Replies</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }}>
            {comments.map(c => <CommentItem key={c.id} comment={c} />)}
            {comments.length === 0 && (
              <Text style={{ textAlign: 'center', color: isDark ? '#8899a6' : '#536471', marginTop: 40 }}>
                No replies yet. Be the first!
              </Text>
            )}
          </ScrollView>

          {/* Composer */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            paddingHorizontal: 16, 
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: borderColor,
            backgroundColor: bgColor 
          }}>
            <TextInput
              style={{
                flex: 1,
                minHeight: 40,
                maxHeight: 100,
                backgroundColor: isDark ? '#253341' : '#f0f3f4',
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                color: textColor,
                fontSize: 15
              }}
              placeholder="Post a reply"
              placeholderTextColor={isDark ? '#8899a6' : '#536471'}
              multiline
              value={text}
              onChangeText={setText}
            />
            <TouchableOpacity 
              onPress={handleSend}
              disabled={!text.trim()}
              style={{ 
                marginLeft: 12, 
                width: 36, 
                height: 36, 
                borderRadius: 18, 
                backgroundColor: text.trim() ? '#0071e3' : (isDark ? '#253341' : '#e5e7eb'), 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const enhance = withObservables(['post'], ({ post }: { post: Post }) => ({
  post,
  comments: post.comments.observe()
}));

export const CommentsSheet = enhance(CommentsSheetInner);
