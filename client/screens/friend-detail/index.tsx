import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
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
import { getContactDetail } from '@/utils/mockApi';

interface ContactDetail {
  id: number;
  name: string;
  company: string;
  title: string;
  phone: string;
  email: string;
  address: string;
  score: number;
  tags: string[];
  avatar: string;
  messageCount7d: number;
  replySeconds: number;
  proactiveCount: number;
  turnCount: number;
}

export default function FriendDetailScreen() {
  const { contactId } = useSafeSearchParams<{ contactId: number }>();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { paddingBottom: 100 },
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
      backgroundColor: c.primary08,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: { fontSize: 22, fontWeight: '600', color: c.text, letterSpacing: 0.2 },
    profileCard: {
      marginHorizontal: 16,
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      shadowColor: c.shadow,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
      marginBottom: 16,
    },
    profileAvatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: c.bgSecondary,
      marginBottom: 12,
    },
    profileName: {
      fontSize: 22,
      fontWeight: '800',
      color: c.text,
      marginBottom: 4,
    },
    profileTitle: {
      fontSize: 14,
      color: c.textSecondary,
      marginBottom: 12,
    },
    profileBadges: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    tagPill: {
      backgroundColor: c.primary10,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    tagPillText: { fontSize: 12, fontWeight: '600', color: c.primary },
    statsCard: {
      marginHorizontal: 16,
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 20,
      shadowColor: c.shadow,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      marginBottom: 16,
    },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statValue: {
      fontSize: 24,
      fontWeight: '800',
      color: c.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 11,
      color: c.textSecondary,
      fontWeight: '500',
    },
    infoCard: {
      marginHorizontal: 16,
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 20,
      shadowColor: c.shadow,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 12,
    },
    infoIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.primary08,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoText: { fontSize: 14, color: c.text, flex: 1 },
    actionsRow: { flexDirection: 'row', marginHorizontal: 16, gap: 12 },
    actionBtn: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 20,
      paddingVertical: 16,
      alignItems: 'center',
      gap: 6,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 3,
    },
    actionBtnText: { fontSize: 13, fontWeight: '600', color: c.primary },
    actionBtnTextDanger: { fontSize: 13, fontWeight: '600', color: c.danger },
  }));

  const fetchDetail = useCallback(async () => {
    if (!contactId) return;
    try {
      setLoading(true);
      const json = await getContactDetail(Number(contactId));
      setContact(json.data);
    } catch (e) {
      console.error('Failed to fetch contact detail:', e);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useFocusEffect(
    useCallback(() => {
      fetchDetail();
    }, [fetchDetail])
  );

  if (loading || !contact) {
    return (
      <Screen backgroundColor={colors.bg}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const replyMinutes = Math.round(contact.replySeconds / 60);

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="chevron-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>好友詳情</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.profileCard}>
          <Image source={{ uri: contact.avatar }} style={styles.profileAvatar} />
          <Text style={styles.profileName}>{contact.name}</Text>
          <Text style={styles.profileTitle}>{contact.title} · {contact.company}</Text>
          <View style={styles.profileBadges}>
            <ScoreBadge score={contact.score} />
            {contact.tags.map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagPillText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>互動數據</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{contact.messageCount7d}</Text>
              <Text style={styles.statLabel}>7日訊息</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{replyMinutes}m</Text>
              <Text style={styles.statLabel}>平均回覆</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{contact.proactiveCount}</Text>
              <Text style={styles.statLabel}>主動發訊</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{contact.turnCount}</Text>
              <Text style={styles.statLabel}>對話輪數</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>聯絡資訊</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <FontAwesome6 name="phone" size={14} color={colors.primary} />
            </View>
            <Text style={styles.infoText}>{contact.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <FontAwesome6 name="envelope" size={14} color={colors.primary} />
            </View>
            <Text style={styles.infoText}>{contact.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <FontAwesome6 name="location-dot" size={14} color={colors.primary} />
            </View>
            <Text style={styles.infoText}>{contact.address}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/chat-detail', { contactId: contact.id, contactName: contact.name })}
          >
            <FontAwesome6 name="comment-dots" size={18} color={colors.primary} />
            <Text style={styles.actionBtnText}>對話</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <FontAwesome6 name="pen-to-square" size={18} color={colors.accent} />
            <Text style={styles.actionBtnText}>編輯</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <FontAwesome6 name="trash" size={18} color={colors.danger} />
            <Text style={styles.actionBtnTextDanger}>刪除</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}
