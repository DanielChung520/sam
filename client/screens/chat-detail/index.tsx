import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getChatDetail, postMessage } from '@/utils/mockApi';

interface Message {
  id: number;
  senderId: number | 'me';
  text: string;
  time: string;
  type: string;
}

interface ContactInfo {
  id: number;
  name: string;
  avatar: string;
  title: string;
  company: string;
  score: number;
}

export default function ChatDetailScreen() {
  const { contactId, contactName } = useSafeSearchParams<{ contactId: number; contactName: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: c.bg,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary08,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
    headerName: { fontSize: 22, fontWeight: '600', color: c.text, letterSpacing: 0.2 },
    headerAction: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    messageList: { paddingHorizontal: 16, paddingVertical: 12 },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 12,
      maxWidth: '85%',
    },
    messageRowMe: { alignSelf: 'flex-end' },
    msgAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: 8,
      backgroundColor: c.bgSecondary,
    },
    bubble: {
      maxWidth: '100%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 18,
    },
    bubbleOther: {
      backgroundColor: c.bgInputAlt,
      borderBottomLeftRadius: 4,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    bubbleMe: {
      backgroundColor: c.primary,
      borderBottomRightRadius: 4,
    },
    bubbleText: { fontSize: 15, color: c.text, lineHeight: 21 },
    bubbleTextMe: { color: c.textOnPrimary },
    msgTime: { fontSize: 10, color: c.textTertiary, marginTop: 4, alignSelf: 'flex-end' },
    msgTimeMe: { color: 'rgba(255,255,255,0.6)' },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 12,
      paddingTop: 8,
      backgroundColor: c.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderLight,
      gap: 8,
    },
    inputActionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary08,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    inputWrapper: {
      flex: 1,
      backgroundColor: c.bgInputAlt,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      maxHeight: 100,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    textInput: { fontSize: 15, color: c.text, lineHeight: 20, maxHeight: 80 },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    sendBtnDisabled: { backgroundColor: c.border },
  }));

  const fetchChatDetail = useCallback(async () => {
    if (!contactId) return;
    try {
      setLoading(true);
      const json = await getChatDetail(Number(contactId));
      setContact(json.data.contact);
      setMessages(json.data.messages);
    } catch (e) {
      console.error('Failed to fetch chat detail:', e);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useFocusEffect(
    useCallback(() => {
      fetchChatDetail();
    }, [fetchChatDetail])
  );

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    setSending(true);
    try {
      const json = await postMessage(Number(contactId), inputText.trim());
      setMessages((prev) => [...prev, json.data]);
      setInputText('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Screen backgroundColor={colors.bg}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === 'me';
    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        {!isMe && contact && (
          <Image source={{ uri: contact.avatar }} style={styles.msgAvatar} />
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{item.time}</Text>
        </View>
      </View>
    );
  };

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right', 'bottom']}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>{contact?.name || contactName}</Text>
          {contact && <ScoreBadge score={contact.score} />}
        </View>
        <TouchableOpacity style={styles.headerAction}>
          <FontAwesome6 name="ellipsis-vertical" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={styles.inputActionBtn}>
            <FontAwesome6 name="plus" size={18} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="輸入訊息..."
              placeholderTextColor={colors.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            <FontAwesome6 name="paper-plane" size={16} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
