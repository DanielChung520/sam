import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';

interface Message {
  id: number;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    sender: 'ai',
    text: '你好！我是你的 AI 銷售助理。我可以幫你分析客戶互動、生成回覆建議、或回答任何銷售相關問題。',
    time: '09:00',
  },
];

const AI_RESPONSES = [
  '根據本週數據分析，你與 12 位客戶互動。\n\n亮點：\n• 張三（85分）詢問了禮盒，高意向\n• 李四（62分）已讀報價 3 天\n\n建議：\n• 跟進李四報價，附上客戶見證\n• 王五（30分）已沉睡60天，建議發送喚醒訊息',
  '根據你的對話歷史，建議使用以下回覆策略：\n\n1. 先確認對方的需求痛點\n2. 提供具體的解決方案與案例\n3. 設定明確的下一步行動\n\n需要我幫你擬稿嗎？',
  '這週的整體表現不錯！你的回覆速度提升了 15%，客戶滿意度也有所提高。繼續保持！',
];

export default function AIChatScreen() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const responseIndex = useRef(0);
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.info08,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    aiIconSmall: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.info10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: { fontSize: 22, fontWeight: '600', color: c.text, letterSpacing: 0.2 },
    msgList: { paddingHorizontal: 16, paddingVertical: 12 },
    msgRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 14,
      maxWidth: '85%',
    },
    msgRowUser: { alignSelf: 'flex-end' },
    aiAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.info10,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    bubble: {
      maxWidth: '100%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 18,
    },
    bubbleAI: {
      backgroundColor: c.bgInputAlt,
      borderBottomLeftRadius: 4,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    bubbleUser: {
      backgroundColor: c.info,
      borderBottomRightRadius: 4,
    },
    bubbleText: { fontSize: 14, color: c.text, lineHeight: 20 },
    bubbleTextUser: { color: c.textOnPrimary },
    msgTime: { fontSize: 10, color: c.textTertiary, marginTop: 4, alignSelf: 'flex-end' },
    msgTimeUser: { color: 'rgba(255,255,255,0.6)' },
    typingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 8,
      gap: 4,
    },
    typingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.info,
    },
    typingText: { fontSize: 12, color: c.textTertiary, marginLeft: 4 },
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
      backgroundColor: c.info,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    sendBtnDisabled: { backgroundColor: c.border },
  }));

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMsg: Message = {
      id: Date.now(),
      sender: 'user',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const aiMsg: Message = {
        id: Date.now() + 1,
        sender: 'ai',
        text: AI_RESPONSES[responseIndex.current % AI_RESPONSES.length],
        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
      responseIndex.current += 1;
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, 1500);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <FontAwesome6 name="robot" size={16} color={colors.info} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
          <Text style={[styles.msgTime, isUser && styles.msgTimeUser]}>{item.time}</Text>
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
          <View style={styles.aiIconSmall}>
            <FontAwesome6 name="robot" size={14} color={colors.info} />
          </View>
          <Text style={styles.headerTitle}>AI 私人聊天室</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
        />

        {isTyping && (
          <View style={styles.typingIndicator}>
            <View style={styles.typingDot} />
            <View style={[styles.typingDot, { opacity: 0.6 }]} />
            <View style={[styles.typingDot, { opacity: 0.3 }]} />
            <Text style={styles.typingText}>AI 正在思考...</Text>
          </View>
        )}

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="問 AI 任何銷售問題..."
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
            disabled={!inputText.trim()}
          >
            <FontAwesome6 name="paper-plane" size={16} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
