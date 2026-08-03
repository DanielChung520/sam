import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getContactDetail, updateContact } from '@/utils/api';

interface ContactDetail {
  id: number;
  name: string;
  title: string;
  nickname: string;
  honorific: string;
  company: string;
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
  const { contactId } = useSafeSearchParams<{ contactId: string }>();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editHonorific, setEditHonorific] = useState('');
  const [saving, setSaving] = useState(false);
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
      const json = await getContactDetail(contactId);
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

  const openEdit = () => {
    if (!contact) return;
    setEditTitle(contact.title ?? '');
    setEditNickname(contact.nickname ?? '');
    setEditHonorific(contact.honorific ?? '');
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!contactId) return;
    setSaving(true);
    try {
      const json = await updateContact(contactId, {
        title: editTitle.trim(),
        nickname: editNickname.trim(),
        honorific: editHonorific.trim(),
      });
      if (json.data) setContact({ ...contact, ...json.data });
      setShowEdit(false);
    } catch (e) {
      console.error('Failed to update contact:', e);
    } finally {
      setSaving(false);
    }
  };

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
          <Text style={styles.profileTitle}>
            {[contact.title, contact.honorific, contact.nickname].filter(Boolean).join(' · ') || (contact.company || '')}
          </Text>
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
          <TouchableOpacity style={styles.actionBtn} onPress={openEdit}>
            <FontAwesome6 name="pen-to-square" size={18} color={colors.accent} />
            <Text style={styles.actionBtnText}>編輯</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <FontAwesome6 name="trash" size={18} color={colors.danger} />
            <Text style={styles.actionBtnTextDanger}>刪除</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 編輯朋友 Modal */}
      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
              編輯朋友
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 16 }}>
              {contact.name} · 設定稱呼（用於祝賀/問安回覆）
            </Text>

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>職稱</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, backgroundColor: colors.surface, marginBottom: 14 }}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="如：總經理、董事長"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>尊稱</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, backgroundColor: colors.surface, marginBottom: 14 }}
              value={editHonorific}
              onChangeText={setEditHonorific}
              placeholder="如：王總、張董"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>暱稱</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, backgroundColor: colors.surface, marginBottom: 20 }}
              value={editNickname}
              onChangeText={setEditNickname}
              placeholder="如：小明"
              placeholderTextColor={colors.textTertiary}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowEdit(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.bgSecondary }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEdit}
                disabled={saving}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.primary }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textOnPrimary }}>儲存</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
