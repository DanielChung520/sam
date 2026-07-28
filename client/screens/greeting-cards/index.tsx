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
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { getGreetings } from '@/utils/mockApi';

interface Greeting {
  id: number;
  category: string;
  subcategory: string;
  style: string;
  templateText: string;
  tone: string;
}

const CATEGORIES = ['全部', '中秋', '新年', '生日', '開工', '端午', '聖誕'];

export default function GreetingCardsScreen() {
  const [greetings, setGreetings] = useState<Greeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [selectedGreeting, setSelectedGreeting] = useState<Greeting | null>(null);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    categories: { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
    catBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: c.bgInput,
    },
    catBtnActive: { backgroundColor: c.primary },
    catText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    catTextActive: { color: c.textOnPrimary },
    listContent: { paddingHorizontal: 16, paddingBottom: 200 },
    card: {
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
    cardSelected: {
      backgroundColor: c.primary04,
      shadowColor: c.primary,
      shadowOpacity: 0.2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    categoryBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
    },
    categoryText: { fontSize: 11, fontWeight: '600' },
    styleText: { fontSize: 11, color: c.textTertiary },
    templateText: {
      fontSize: 14,
      color: c.text,
      lineHeight: 20,
      marginBottom: 8,
    },
    subcategoryText: { fontSize: 11, color: c.textTertiary },
    previewPanel: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 8,
    },
    previewTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
      marginBottom: 8,
    },
    previewText: {
      fontSize: 14,
      color: c.text,
      lineHeight: 20,
      marginBottom: 16,
      backgroundColor: c.bgInputAlt,
      padding: 14,
      borderRadius: 16,
    },
    previewActions: { flexDirection: 'row', gap: 12 },
    previewBtn: {
      flex: 1,
      flexDirection: 'row',
      paddingVertical: 12,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.bgInput,
    },
    previewBtnPrimary: { backgroundColor: c.primary },
    previewBtnText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    previewBtnTextPrimary: { fontSize: 14, fontWeight: '700', color: c.textOnPrimary },
  }));

  const fetchGreetings = useCallback(async () => {
    try {
      setLoading(true);
      const json = await getGreetings(activeCategory !== '全部' ? activeCategory : undefined);
      setGreetings(json.data);
    } catch (e) {
      console.error('Failed to fetch greetings:', e);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useFocusEffect(
    useCallback(() => {
      fetchGreetings();
    }, [fetchGreetings])
  );

  const renderGreeting = ({ item }: { item: Greeting }) => {
    const isFormal = item.tone === 'formal';
    return (
      <TouchableOpacity
        style={[styles.card, selectedGreeting?.id === item.id && styles.cardSelected]}
        onPress={() => setSelectedGreeting(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: isFormal ? colors.primary10 : colors.accent10 },
            ]}
          >
            <Text style={[styles.categoryText, { color: isFormal ? colors.primary : colors.accent }]}>
              {item.category}
            </Text>
          </View>
          <Text style={styles.styleText}>{item.style}</Text>
        </View>
        <Text style={styles.templateText} numberOfLines={3}>{item.templateText}</Text>
        <Text style={styles.subcategoryText}>{item.subcategory}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>賀卡/問候庫</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.catBtn, activeCategory === item && styles.catBtnActive]}
            onPress={() => setActiveCategory(item)}
          >
            <Text style={[styles.catText, activeCategory === item && styles.catTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={greetings}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGreeting}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {selectedGreeting && (
        <View style={[styles.previewPanel, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.previewTitle}>預覽個人化賀卡</Text>
          <Text style={styles.previewText}>
            張三 業務經理，{selectedGreeting.templateText.replace('{稱呼}', '張經理')}
          </Text>
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.previewBtn} onPress={() => setSelectedGreeting(null)}>
              <Text style={styles.previewBtnText}>更換樣板</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.previewBtn, styles.previewBtnPrimary]}>
              <FontAwesome6 name="paper-plane" size={12} color={colors.textOnPrimary} />
              <Text style={styles.previewBtnTextPrimary}>發送</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Screen>
  );
}
