import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';

const ADD_OPTIONS = [
  { id: 'qr', icon: 'qrcode' as const, label: '行動條碼', desc: '掃描好友的條碼', color: '#059669' },
  { id: 'shake', icon: 'mobile-screen' as const, label: '搖一搖', desc: '同時搖手機即可互加', color: '#F97316' },
  { id: 'id', icon: 'at' as const, label: 'LINE ID', desc: '透過 ID 搜尋', color: '#6366F1' },
  { id: 'link', icon: 'link' as const, label: '邀請連結', desc: '產生專屬邀請網址', color: '#0EA5E9' },
  { id: 'contact', icon: 'address-book' as const, label: '手機聯絡人', desc: '從手機通訊錄加入', color: '#EF4444' },
  { id: 'nearby', icon: 'location-dot' as const, label: '附近的人', desc: '開啟定位加入周遭用戶', color: '#8B5CF6' },
];

const SUGGESTIONS = [
  { id: 1, name: '林志玲', mutual: 3, avatar: 'https://i.pravatar.cc/100?img=1' },
  { id: 2, name: '周杰倫', mutual: 5, avatar: 'https://i.pravatar.cc/100?img=12' },
  { id: 3, name: '蔡依林', mutual: 2, avatar: 'https://i.pravatar.cc/100?img=5' },
  { id: 4, name: '五月天阿信', mutual: 8, avatar: 'https://i.pravatar.cc/100?img=15' },
];

export default function AddFriendScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    content: { paddingBottom: 100 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 16,
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
    headerAction: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    headerActionText: { fontSize: 14, color: c.primary, fontWeight: '600' },
    optionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      gap: 10,
      marginBottom: 24,
    },
    optionCard: {
      width: '47%',
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 18,
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 3,
    },
    optionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    optionLabel: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 4 },
    optionDesc: { fontSize: 12, color: c.textSecondary, lineHeight: 17 },
    section: {
      paddingHorizontal: 16,
      marginBottom: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    sectionMore: { fontSize: 12, color: c.primary, fontWeight: '600' },
    suggestionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 12,
      marginBottom: 8,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    suggestionAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.bgInput,
    },
    suggestionInfo: { flex: 1, marginLeft: 12 },
    suggestionName: { fontSize: 14, fontWeight: '600', color: c.text },
    suggestionMeta: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
    addBtn: {
      backgroundColor: c.primary,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 14,
    },
    addBtnText: { fontSize: 12, fontWeight: '700', color: c.textOnPrimary },
  }));

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="chevron-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>加入好友</Text>
          <TouchableOpacity style={styles.headerAction}>
            <Text style={styles.headerActionText}>搜尋</Text>
          </TouchableOpacity>
        </View>

        {/* 加入方式 grid */}
        <View style={styles.optionGrid}>
          {ADD_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={styles.optionCard}
              onPress={() => {
                if (opt.id === 'qr') router.push('/scan');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIcon, { backgroundColor: opt.color + '20' }]}>
                <FontAwesome6 name={opt.icon} size={22} color={opt.color} />
              </View>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Text style={styles.optionDesc}>{opt.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 可能認識的人 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>可能認識的人</Text>
            <TouchableOpacity>
              <Text style={styles.sectionMore}>查看更多</Text>
            </TouchableOpacity>
          </View>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity key={s.id} style={styles.suggestionCard} activeOpacity={0.7}>
              <View style={[styles.suggestionAvatar, { backgroundColor: s.id === 1 ? '#FBBF24' : s.id === 2 ? '#34D399' : s.id === 3 ? '#F472B6' : '#60A5FA' }]} />
              <View style={styles.suggestionInfo}>
                <Text style={styles.suggestionName}>{s.name}</Text>
                <Text style={styles.suggestionMeta}>{s.mutual} 位共同好友</Text>
              </View>
              <TouchableOpacity style={styles.addBtn}>
                <Text style={styles.addBtnText}>加入</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
