import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import AccountAvatar from '@/components/shared/AccountAvatar';
import { USBStatusBadge } from '@/components/shared/USBStatusBadge';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { FontAwesome6 } from '@expo/vector-icons';
import { getBroadcasts } from '@/utils/api';

interface Broadcast {
  id: number;
  title: string;
  status: 'completed' | 'sending' | 'scheduled';
  total: number;
  sent: number;
  createdAt: string;
  template: string;
  scheduledAt?: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  completed: { label: '已完成', color: '#059669', bg: 'rgba(5,150,105,0.10)', icon: 'circle-check' },
  sending: { label: '發送中', color: '#F97316', bg: 'rgba(249,115,22,0.10)', icon: 'spinner' },
  scheduled: { label: '已排程', color: '#6366F1', bg: 'rgba(99,102,241,0.10)', icon: 'clock' },
};

export default function BroadcastScreen() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const router = useSafeRouter();
  const { colors } = useTheme();
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
    menuBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menu: {
      position: 'absolute',
      top: 52,
      right: 16,
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingVertical: 6,
      minWidth: 170,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 999,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    menuItemText: { fontSize: 14, color: c.text, fontWeight: '500' },
    listContent: { paddingHorizontal: 16, paddingBottom: 100 },
    broadcastCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 20,
      marginBottom: 12,
      shadowColor: c.shadow,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 4,
    },
    broadcastHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    statusText: { fontSize: 11, fontWeight: '600' },
    dateText: { fontSize: 11, color: c.textTertiary },
    broadcastTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: c.text,
      marginBottom: 6,
    },
    templateText: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 18,
      marginBottom: 14,
    },
    progressSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    progressBar: {
      flex: 1,
      height: 6,
      backgroundColor: c.bgInput,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: c.primary,
      borderRadius: 3,
    },
    progressText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.primary,
      minWidth: 40,
      textAlign: 'right',
    },
    scheduledText: {
      fontSize: 11,
      color: c.info,
      marginTop: 8,
      fontWeight: '500',
    },
    emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyText: { fontSize: 16, fontWeight: '600', color: c.textSecondary },
    emptySubtext: { fontSize: 13, color: c.textTertiary },
  }));

  const fetchBroadcasts = useCallback(async () => {
    try {
      setLoading(true);
      const json = await getBroadcasts();
      setBroadcasts(json.data);
    } catch (e) {
      console.error('Failed to fetch broadcasts:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBroadcasts();
    }, [fetchBroadcasts])
  );

  const renderBroadcast = ({ item }: { item: Broadcast }) => {
    const config = statusConfig[item.status];
    const progress = item.total > 0 ? item.sent / item.total : 0;
    return (
      <View style={styles.broadcastCard}>
        <View style={styles.broadcastHeader}>
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <FontAwesome6 name={config.icon as any} size={10} color={config.color} />
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.dateText}>{item.createdAt}</Text>
        </View>
        <Text style={styles.broadcastTitle}>{item.title}</Text>
        <Text style={styles.templateText} numberOfLines={2}>{item.template}</Text>
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{item.sent}/{item.total}</Text>
        </View>
        {item.scheduledAt && (
          <Text style={styles.scheduledText}>排程: {item.scheduledAt}</Text>
        )}
      </View>
    );
  };

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <AccountAvatar />
          <Text style={styles.headerTitle}>發送</Text>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(!showMenu)}>
            <FontAwesome6 name="ellipsis" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <USBStatusBadge status="connected" />
      </View>

      {showMenu && (
        <View style={styles.menu} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { setShowMenu(false); router.push('/broadcast-holiday'); }}
          >
            <FontAwesome6 name="gift" size={14} color={colors.accent} />
            <Text style={styles.menuItemText}>節日群發</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { setShowMenu(false); router.push('/broadcast-regular'); }}
          >
            <FontAwesome6 name="handshake" size={14} color={colors.sky} />
            <Text style={styles.menuItemText}>定期問安</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { setShowMenu(false); router.push('/broadcast-announce'); }}
          >
            <FontAwesome6 name="bullhorn" size={14} color={colors.danger} />
            <Text style={styles.menuItemText}>公告群發</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={broadcasts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderBroadcast}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <FontAwesome6 name="bullhorn" size={40} color={colors.border} />
              <Text style={styles.emptyText}>尚無群發任務</Text>
              <Text style={styles.emptySubtext}>點擊「新建」建立第一個群發任務</Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}
