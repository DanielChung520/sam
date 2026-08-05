import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SectionList,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';

type FilterRange = 'all' | 'today' | 'week' | 'month' | 'custom';
type MsgType = 'all' | 'text' | 'image' | 'file';

interface HistoryItem {
  id: number;
  date: string; // YYYY-MM-DD
  contactName: string;
  contactAvatar: string;
  snippet: string;
  time: string;
  type: 'text' | 'image' | 'file';
}

const HISTORY: HistoryItem[] = [
  { id: 1, date: '2026-07-28', contactName: '張三', contactAvatar: 'https://i.pravatar.cc/100?img=11', snippet: '關於A產品的報價，再麻煩您確認一下', time: '14:32', type: 'text' },
  { id: 2, date: '2026-07-28', contactName: '我的助理', contactAvatar: 'https://i.pravatar.cc/100?img=8', snippet: '早！今天有 3 位客戶待跟進，需要我幫你擬回覆嗎？', time: '08:30', type: 'text' },
  { id: 3, date: '2026-07-28', contactName: '李四', contactAvatar: 'https://i.pravatar.cc/100?img=5', snippet: '報價單已收到，我再跟主管確認', time: '13:15', type: 'text' },
  { id: 4, date: '2026-07-27', contactName: '陳美玲', contactAvatar: 'https://i.pravatar.cc/100?img=9', snippet: '太棒了！我們下週簽約吧', time: '11:45', type: 'text' },
  { id: 5, date: '2026-07-27', contactName: '王五', contactAvatar: 'https://i.pravatar.cc/100?img=12', snippet: '好的，下次再聊', time: '16:20', type: 'text' },
  { id: 6, date: '2026-07-26', contactName: '黃雅婷', contactAvatar: 'https://i.pravatar.cc/100?img=10', snippet: '方案B看起來不錯，能再詳細說明嗎？', time: '09:18', type: 'text' },
  { id: 7, date: '2026-07-25', contactName: '林大明', contactAvatar: 'https://i.pravatar.cc/100?img=13', snippet: '再聯絡', time: '14:05', type: 'text' },
  { id: 8, date: '2026-07-25', contactName: '陳美玲', contactAvatar: 'https://i.pravatar.cc/100?img=9', snippet: '方案非常滿意！團隊都很喜歡', time: '10:00', type: 'text' },
  { id: 9, date: '2026-07-24', contactName: '我的助理', contactAvatar: 'https://i.pravatar.cc/100?img=8', snippet: '根據本週數據分析，你與 12 位客戶互動', time: '09:00', type: 'text' },
  { id: 10, date: '2026-07-23', contactName: '張三', contactAvatar: 'https://i.pravatar.cc/100?img=11', snippet: '那就在大安區的辦公室吧，到時候見！', time: '14:20', type: 'text' },
];

const RANGE_LABELS: Record<FilterRange, string> = {
  all: '全部',
  today: '今天',
  week: '本週',
  month: '本月',
  custom: '自訂',
};

const TYPE_LABELS: Record<MsgType, { label: string; icon: any }> = {
  all: { label: '全部', icon: 'circle-dot' },
  text: { label: '文字', icon: 'message' },
  image: { label: '圖片', icon: 'image' },
  file: { label: '檔案', icon: 'file' },
};

function formatDateLabel(date: string): string {
  const today = new Date('2026-07-28');
  const d = new Date(date);
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff < 7) return `${diff} 天前`;
  return date;
}

function dateInRange(date: string, range: FilterRange): boolean {
  if (range === 'all') return true;
  const today = new Date('2026-07-28');
  const d = new Date(date);
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (range === 'today') return diff === 0;
  if (range === 'week') return diff < 7;
  if (range === 'month') return diff < 30;
  return true;
}

export default function ChatHistoryScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<FilterRange>('all');
  const [msgType, setMsgType] = useState<MsgType>('all');
  const [selected, setSelected] = useState<number[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);

  const styles = useThemedStyles((c) => ({
    content: { paddingBottom: 100 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 12,
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
    multiBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgInput,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginHorizontal: 16,
      marginBottom: 12,
      gap: 8,
    },
    searchInput: { flex: 1, fontSize: 14, color: c.text, padding: 0 },
    filterRow: { marginBottom: 12 },
    // alignItems: 'flex-start' 防止 horizontal FlatList 膠囊被 stretch 壓扁（RNW scroll content 預設 stretch）
    filterChips: { paddingHorizontal: 16, gap: 8, alignItems: 'flex-start' },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: c.bgInput,
    },
    chipActive: { backgroundColor: c.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    chipTextActive: { color: c.textOnPrimary },
    typeRow: { marginBottom: 16 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
      backgroundColor: c.bg,
    },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: c.textTertiary, letterSpacing: 0.5 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 12,
      marginHorizontal: 16,
      marginBottom: 8,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    itemSelected: { backgroundColor: c.primary10, borderWidth: 1, borderColor: c.primary },
    avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
    itemInfo: { flex: 1 },
    itemTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    itemName: { fontSize: 14, fontWeight: '700', color: c.text },
    itemTime: { fontSize: 11, color: c.textTertiary },
    snippet: { fontSize: 13, color: c.textSecondary },
    typeIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: c.primary10,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 4,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 4,
    },
    checkboxActive: { backgroundColor: c.primary, borderColor: c.primary },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyText: { fontSize: 14, color: c.textTertiary },
    summaryBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: c.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderLight,
    },
    summaryText: { fontSize: 14, color: c.text, fontWeight: '600' },
    summaryActions: { flexDirection: 'row', gap: 12 },
    summaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
    },
    summaryBtnPrimary: { backgroundColor: c.primary },
    summaryBtnText: { fontSize: 13, fontWeight: '600', color: c.textOnPrimary },
  }));

  const filtered = useMemo(() => {
    return HISTORY.filter((h) => {
      if (!dateInRange(h.date, range)) return false;
      if (msgType !== 'all' && h.type !== msgType) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!h.contactName.toLowerCase().includes(q) && !h.snippet.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search, range, msgType]);

  const sections = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    filtered.forEach((h) => {
      if (!map.has(h.date)) map.set(h.date, []);
      map.get(h.date)!.push(h);
    });
    return Array.from(map.entries()).map(([date, data]) => ({
      title: date,
      data,
    }));
  }, [filtered]);

  const toggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>歷史記錄</Text>
        <TouchableOpacity
          style={styles.multiBtn}
          onPress={() => {
            setMultiSelect(!multiSelect);
            setSelected([]);
          }}
        >
          <FontAwesome6
            name={multiSelect ? 'xmark' : 'check-double'}
            size={16}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <FontAwesome6 name="magnifying-glass" size={14} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜尋訊息或聯絡人..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <FontAwesome6 name="xmark" size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Date range chips */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={Object.entries(RANGE_LABELS) as [FilterRange, string][]}
          keyExtractor={([k]) => k}
          contentContainerStyle={styles.filterChips}
          renderItem={({ item: [key, label] }) => (
            <TouchableOpacity
              style={[styles.chip, range === key && styles.chipActive]}
              onPress={() => setRange(key)}
            >
              <Text style={[styles.chipText, range === key && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Message type chips */}
      <View style={[styles.typeRow, { marginBottom: 8 }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={Object.entries(TYPE_LABELS) as [MsgType, typeof TYPE_LABELS['all']][]}
          keyExtractor={([k]) => k}
          contentContainerStyle={styles.filterChips}
          renderItem={({ item: [key, val] }) => (
            <TouchableOpacity
              style={[styles.chip, msgType === key && styles.chipActive]}
              onPress={() => setMsgType(key)}
            >
              <FontAwesome6
                name={val.icon as any}
                size={12}
                color={msgType === key ? colors.textOnPrimary : colors.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.chipText, msgType === key && styles.chipTextActive]}>
                {val.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Section list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: multiSelect ? 80 : 16 }}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{formatDateLabel(section.title)} · {section.title}</Text>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{section.data.length} 則</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          return (
            <TouchableOpacity
              style={[styles.item, isSelected && styles.itemSelected]}
              onPress={() => {
                if (multiSelect) toggleSelect(item.id);
                else router.push('/chat-detail', { contactId: 1 });
              }}
              activeOpacity={0.7}
            >
              {multiSelect ? (
                <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                  {isSelected && <FontAwesome6 name="check" size={12} color={colors.textOnPrimary} />}
                </View>
              ) : (
                <View style={[styles.typeIcon, item.type === 'text' && { backgroundColor: colors.bgInput }]}>
                  <FontAwesome6
                    name={item.type === 'text' ? 'message' : item.type === 'image' ? 'image' : 'file'}
                    size={14}
                    color={colors.primary}
                  />
                </View>
              )}
              <View style={styles.itemInfo}>
                <View style={styles.itemTopRow}>
                  <Text style={styles.itemName}>{item.contactName}</Text>
                  <Text style={styles.itemTime}>{item.time}</Text>
                </View>
                <Text style={styles.snippet} numberOfLines={1}>
                  {item.snippet}
                </Text>
              </View>
              <FontAwesome6 name="chevron-right" size={12} color={colors.border} />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <FontAwesome6 name="magnifying-glass" size={40} color={colors.border} />
            <Text style={styles.emptyText}>沒有符合的歷史記錄</Text>
          </View>
        }
      />

      {/* Multi-select summary bar */}
      {multiSelect && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>已選 {selected.length} 則</Text>
          <View style={styles.summaryActions}>
            <TouchableOpacity
              style={styles.summaryBtn}
              onPress={() => { setSelected([]); setMultiSelect(false); }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.summaryBtn, styles.summaryBtnPrimary]}>
              <FontAwesome6 name="share" size={12} color={colors.textOnPrimary} />
              <Text style={styles.summaryBtnText}>轉發</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Screen>
  );
}
