import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { USBStatusBadge } from '@/components/shared/USBStatusBadge';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WorkspaceScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    content: { paddingBottom: 100 },
    header: { paddingHorizontal: 20, paddingBottom: 16 },
    headerTitle: {
      fontSize: 22,
      fontWeight: '600',
      color: c.text,
      marginBottom: 12,
      letterSpacing: 0.2,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      marginBottom: 16,
      gap: 10,
    },
    statCard: {
      width: '47%',
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 16,
      alignItems: 'center',
      shadowColor: c.shadow,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 3,
    },
    statIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    statValue: { fontSize: 24, fontWeight: '800', marginBottom: 2 },
    statLabel: {
      fontSize: 11,
      color: c.textSecondary,
      fontWeight: '500',
    },
    usbCard: {
      marginHorizontal: 16,
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
      shadowColor: c.shadow,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
    },
    usbHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    usbIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.primary08,
      justifyContent: 'center',
      alignItems: 'center',
    },
    usbTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    usbSubtitle: { fontSize: 12, color: c.primary, fontWeight: '500' },
    usbProgress: { marginBottom: 16 },
    usbProgressBar: {
      height: 6,
      backgroundColor: c.bgInput,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 6,
    },
    usbProgressFill: {
      height: '100%',
      backgroundColor: c.primary,
      borderRadius: 3,
    },
    usbCapacity: { fontSize: 12, color: c.textSecondary },
    usbActions: { flexDirection: 'row', gap: 12 },
    usbActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: c.bgInput,
    },
    usbActionText: { fontSize: 13, fontWeight: '600', color: c.danger },
    usbActionTextSuccess: { fontSize: 13, fontWeight: '600', color: c.primary },
    menuSection: { paddingHorizontal: 16 },
    menuCard: {
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
      gap: 14,
    },
    menuIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuInfo: { flex: 1 },
    menuTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      marginBottom: 2,
    },
    menuSubtitle: { fontSize: 12, color: c.textSecondary },
  }));

  const menuItems = [
    {
      icon: 'gift' as const,
      iconColor: colors.accent,
      iconBg: colors.accent10,
      title: '賀卡/問候庫',
      subtitle: '瀏覽與選取節日賀卡樣板',
      onPress: () => router.push('/greeting-cards'),
    },
    {
      icon: 'robot' as const,
      iconColor: colors.info,
      iconBg: colors.info10,
      title: 'AI 私人聊天室',
      subtitle: '與 AI 助手自由對話分析',
      onPress: () => router.push('/ai-chat'),
    },
    {
      icon: 'newspaper' as const,
      iconColor: colors.sky,
      iconBg: colors.sky10,
      title: '新聞追蹤設置',
      subtitle: '設定關心主題、摘要重點與搜索時間',
      onPress: () => router.push('/news-settings'),
    },
    {
      icon: 'gear' as const,
      iconColor: colors.textSecondary,
      iconBg: colors.bgInput,
      title: '設定',
      subtitle: 'AI 模式、Provider Key、USB 保險箱',
      onPress: () => router.push('/settings'),
    },
  ];

  const statsItems = [
    { label: '好友總數', value: '6', icon: 'user-group' as const, color: colors.primary },
    { label: '本月對話', value: '47', icon: 'comments' as const, color: colors.info },
    { label: '群發任務', value: '3', icon: 'bullhorn' as const, color: colors.accent },
    { label: 'Token 用量', value: '$847', icon: 'coins' as const, color: colors.danger },
  ];

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>工作區</Text>
        <USBStatusBadge status="connected" />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          {statsItems.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: `${item.color}15` }]}>
                <FontAwesome6 name={item.icon} size={16} color={item.color} />
              </View>
              <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.usbCard}>
          <View style={styles.usbHeader}>
            <View style={styles.usbIconWrap}>
              <FontAwesome6 name="shield-halved" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.usbTitle}>USB 保險箱</Text>
              <Text style={styles.usbSubtitle}>SeaweedFS: 連線正常</Text>
            </View>
          </View>
          <View style={styles.usbProgress}>
            <View style={styles.usbProgressBar}>
              <View style={[styles.usbProgressFill, { width: '3.6%' }]} />
            </View>
            <Text style={styles.usbCapacity}>已用 2.3G / 64G</Text>
          </View>
          <View style={styles.usbActions}>
            <TouchableOpacity style={styles.usbActionBtn}>
              <FontAwesome6 name="eject" size={14} color={colors.danger} />
              <Text style={styles.usbActionText}>安全移除</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.usbActionBtn}>
              <FontAwesome6 name="download" size={14} color={colors.primary} />
              <Text style={styles.usbActionTextSuccess}>備份</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.menuCard}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: item.iconBg }]}>
                <FontAwesome6 name={item.icon} size={20} color={item.iconColor} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <FontAwesome6 name="chevron-right" size={14} color={colors.border} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
