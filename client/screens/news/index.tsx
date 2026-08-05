import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import AccountAvatar from '@/components/shared/AccountAvatar';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { getNews, getNewsSubscription, saveNewsSubscription, triggerNewsFetch, type NewsItem } from '@/utils/api';
export default function NewsScreen() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('全部');
  const [tabs, setTabs] = useState<string[]>(['全部']);
  const [showMenu, setShowMenu] = useState(false);
  const [pushToOwner, setPushToOwner] = useState(false);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 14, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
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
      minWidth: 160,
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
    // alignItems: 'flex-start' 防止 horizontal FlatList 膠囊被 stretch 壓扁（RNW scroll content 預設 stretch）
    tabs: { paddingHorizontal: 16, gap: 8, marginBottom: 16, alignItems: 'flex-start' },
    tabBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: c.bgInput,
    },
    tabBtnActive: { backgroundColor: c.sky },
    tabText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    tabTextActive: { color: c.textOnPrimary },
    listContent: { paddingHorizontal: 16, paddingBottom: 100 },
    newsCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 12,
      shadowColor: c.shadow,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 4,
    },
    newsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    categoryBadge: {
      backgroundColor: c.sky10,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
    },
    categoryText: { fontSize: 11, fontWeight: '600', color: c.sky },
    sourceText: { fontSize: 11, color: c.textTertiary },
    newsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      marginBottom: 8,
      lineHeight: 22,
    },
    newsSummary: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 19,
    },
  }));

  const tabsRef = useRef<string[]>(['全部']);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      const isTopic = activeTab !== '全部' && tabsRef.current.includes(activeTab);
      const json = await getNews(isTopic ? undefined : activeTab, isTopic ? activeTab : undefined);
      setNews(json.data);
    } catch (e) {
      console.error('Failed to fetch news:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchTabs = useCallback(async () => {
    try {
      const { data } = await getNewsSubscription();
      const topics = Array.isArray(data?.topics) ? data.topics : [];
      const next = ['全部', ...topics];
      tabsRef.current = next;
      setTabs((prev) =>
        prev.length === next.length && prev.every((t, i) => t === next[i]) ? prev : next
      );
      if (typeof data?.pushToOwner === 'boolean') setPushToOwner(data.pushToOwner);
    } catch (e) {
      console.error('Failed to load news tabs:', e);
    }
  }, []);

  // 發送主身：每次抓取後將最新新聞推播到主身帳號
  const togglePushToOwner = useCallback(async (value: boolean) => {
    setPushToOwner(value);
    setShowMenu(false);
    try {
      await saveNewsSubscription({ pushToOwner: value });
    } catch (e) {
      console.error('Failed to save pushToOwner:', e);
      setPushToOwner(!value);
    }
  }, []);

  // 即時更新：觸發 server 抓取最新新聞 → 輪詢直到完成 → 重新載入列表
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setShowMenu(false);
    setRefreshing(true);
    try {
      await triggerNewsFetch();
      // server 背景抓取需數十秒，每 3 秒輪詢一次，最多等 90 秒
      let done = false;
      for (let i = 0; i < 30 && !done; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const json = await getNewsSubscription();
          const lastRun = json.data?.lastRunAt ?? 0;
          const isTopic = activeTab !== '全部' && tabsRef.current.includes(activeTab);
          const list = await getNews(isTopic ? undefined : activeTab, isTopic ? activeTab : undefined);
          if (lastRun > 0 && Date.now() - lastRun < 15000) {
            setNews(list.data);
            done = true;
          } else if (list.data.length > 0) {
            setNews(list.data);
          }
        } catch {
          // 輪詢失敗繼續下一輪
        }
      }
    } catch (e) {
      console.error('Failed to trigger news refresh:', e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchTabs();
      fetchNews();
    }, [fetchTabs, fetchNews])
  );

  const renderNews = ({ item }: { item: NewsItem }) => (
    <TouchableOpacity style={styles.newsCard} activeOpacity={0.7}>
      <View style={styles.newsHeader}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{item.topic || item.category}</Text>
        </View>
        <Text style={styles.sourceText}>{item.source} · {item.time}</Text>
      </View>
      <Text style={styles.newsTitle}>{item.title}</Text>
      <Text style={styles.newsSummary} numberOfLines={3}>{item.summary}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <AccountAvatar />
        <Text style={styles.headerTitle}>新聞追蹤</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {refreshing && <ActivityIndicator size="small" color={colors.sky} />}
          <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(!showMenu)}>
            <FontAwesome6 name="ellipsis" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {showMenu && (
        <View style={styles.menu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleRefresh}
          >
            <FontAwesome6 name="arrows-rotate" size={14} color={colors.sky} />
            <Text style={styles.menuItemText}>{refreshing ? '更新中...' : '即時更新'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { setShowMenu(false); router.push('/news-settings?focus=topics'); }}
          >
            <FontAwesome6 name="heart" size={14} color={colors.danger} />
            <Text style={styles.menuItemText}>關注設置</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { setShowMenu(false); router.push('/news-settings-time'); }}
          >
            <FontAwesome6 name="clock" size={14} color={colors.accent} />
            <Text style={styles.menuItemText}>時間設置</Text>
          </TouchableOpacity>
          <View style={styles.menuItem}>
            <FontAwesome6 name="paper-plane" size={14} color={colors.sky} />
            <Text style={styles.menuItemText}>發送主身</Text>
            <Switch
              value={pushToOwner}
              onValueChange={togglePushToOwner}
              trackColor={{ false: colors.bgInput, true: colors.sky }}
              thumbColor={colors.surface}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        </View>
      )}

      <FlatList
        horizontal
        data={tabs}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === item && styles.tabBtnActive]}
            onPress={() => setActiveTab(item)}
          >
            <Text style={[styles.tabText, activeTab === item && styles.tabTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.sky} />
        </View>
      ) : news.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>
            還沒有新聞資料。\n請先到「關注設置」加入主題，再點右上角重新整理。
          </Text>
        </View>
      ) : (
        <FlatList
          data={news}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderNews}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
