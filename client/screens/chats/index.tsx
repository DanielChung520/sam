import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import AccountAvatar from '@/components/shared/AccountAvatar';
import { USBStatusBadge } from '@/components/shared/USBStatusBadge';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useChannel } from '@/contexts/ChannelContext';
import { FontAwesome6 } from '@expo/vector-icons';
import { getChats } from '@/utils/api';

interface ChatItem {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  score: number;
  channelKey?: string;
  channelName?: string;
  channelColor?: string;
  isPrimary?: boolean;
}

export default function ChatsScreen() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useSafeRouter();
  const { colors } = useTheme();
  const { activeChannel } = useChannel();
  const styles = useThemedStyles((c) => ({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      paddingTop: 16,
      paddingHorizontal: 20,
      paddingBottom: 12,
      backgroundColor: c.bg,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    headerTitle: { fontSize: 22, fontWeight: '600', color: c.text, letterSpacing: 0.2 },
    channelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: c.primary10,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      gap: 6,
      marginBottom: 8,
    },
    channelBadgeText: { fontSize: 12, fontWeight: '600', color: c.primary },
    searchBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary08,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: { paddingHorizontal: 16, paddingBottom: 100 },
    chatCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 16,
      marginBottom: 10,
      shadowColor: c.shadow,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 4,
    },
    avatarContainer: { position: 'relative' },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.bgSecondary,
    },
    unreadBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: c.danger,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    unreadText: { color: c.textOnPrimary, fontSize: 10, fontWeight: '700' },
    chatInfo: { flex: 1, marginLeft: 14 },
    chatHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    chatName: { fontSize: 16, fontWeight: '700', color: c.text, flex: 1 },
    chatTime: { fontSize: 11, color: c.textTertiary, fontWeight: '500' },
    chatBody: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    chatMessage: { fontSize: 13, color: c.textSecondary, flex: 1, marginRight: 8 },
    channelStripe: {
      position: 'absolute',
      right: 0,
      top: 12,
      bottom: 12,
      width: 4,
      borderRadius: 2,
    },
  }));

  const fetchChats = useCallback(async () => {
    try {
      const json = await getChats();
      setChats(json.data);
    } catch (e) {
      console.error('Failed to fetch chats:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [fetchChats])
  );

  const renderChatItem = ({ item }: { item: ChatItem }) => {
    const isPrimary = item.isPrimary === true;
    return (
      <TouchableOpacity
        style={styles.chatCard}
        onPress={() => router.push('/chat-detail', { contactId: item.id, contactName: item.name, channelKey: item.channelKey ?? '' })}
        activeOpacity={0.7}
      >
        {isPrimary && item.channelColor && <View style={[styles.channelStripe, { backgroundColor: item.channelColor }]} />}
        <View style={styles.avatarContainer}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.chatTime}>{item.lastMessageTime}</Text>
        </View>
        <View style={styles.chatBody}>
          <Text style={styles.chatMessage} numberOfLines={1}>{item.lastMessage}</Text>
          <ScoreBadge score={item.score} />
        </View>
      </View>
    </TouchableOpacity>
  );
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

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <AccountAvatar />
          <Text style={styles.headerTitle}>對話</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => router.push('/chat-history')}
            >
              <FontAwesome6 name="clock-rotate-left" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.searchBtn}>
              <FontAwesome6 name="magnifying-glass" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        {activeChannel && (
          <TouchableOpacity
            style={styles.channelBadge}
            onPress={() => router.push('/settings')}
          >
            <FontAwesome6 name="id-card" size={12} color={colors.primary} />
            <Text style={styles.channelBadgeText}>{activeChannel.name}</Text>
            <FontAwesome6 name="chevron-down" size={10} color={colors.primary} />
          </TouchableOpacity>
        )}
        <USBStatusBadge status="connected" />
      </View>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderChatItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
