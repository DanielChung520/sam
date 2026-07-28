import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { createBroadcast } from '@/utils/mockApi';

const HOLIDAYS = [
  { id: 'mid-autumn', label: '中秋', emoji: '🥮' },
  { id: 'new-year', label: '新年', emoji: '🎊' },
  { id: 'birthday', label: '生日', emoji: '🎂' },
  { id: 'work-start', label: '開工', emoji: '💼' },
  { id: 'dragon-boat', label: '端午', emoji: '🐲' },
  { id: 'christmas', label: '聖誕', emoji: '🎄' },
];

const TAGS = ['全部', 'VIP', '高意向', '決策者', '沉睡', '中等'];

const CONTACTS = [
  { id: 1, name: '張三', title: '業務經理', company: '某某科技股份公司', tag: 'VIP', honorific: '張經理', nick: '三哥' },
  { id: 2, name: '李四', title: '採購專員', company: '創新數位有限公司', tag: '高意向', honorific: '李專員', nick: '小四' },
  { id: 3, name: '王五', title: '總經理', company: '鼎盛集團', tag: '決策者', honorific: '王總', nick: '五哥' },
  { id: 4, name: '陳美玲', title: '創辦人', company: '美玲設計工作室', tag: 'VIP', honorific: '陳創辦人', nick: '美玲姐' },
  { id: 5, name: '林大明', title: '副總經理', company: '大地建設', tag: '沉睡', honorific: '林副總', nick: '大明' },
  { id: 6, name: '黃雅婷', title: '行銷總監', company: '雅致行銷顧問', tag: '中等', honorific: '黃總監', nick: '雅婷' },
];

interface PersonalGreeting {
  contactId: number;
  greeting: string;
}

const MAX_RECIPIENTS = 8;

// 多種 AI 生成的祝福語模板（根據節日 + 場景變化）
const AI_TEMPLATES: Record<string, ((h: string, n: string, t: string) => string)[]> = {
  'mid-autumn': [
    (h, n, t) => `${h}，中秋月圓人團圓，${n}過去這一年帶領${t}團隊辛苦了，敬祝闔家平安、業績長紅！`,
    (h, n, t) => `嗨 ${h}，月到中秋分外明，${n}這段時間對我們的支持點滴在心頭，願佳節愉快、好運月來月多。`,
    (h, n, t) => `${h}您好，中秋是收穫的季節，感謝${n}一直以來對我們的信任與合作，祝您闔家團圓、事業更上一層樓。`,
    (h, n, t) => `${h}，秋風送爽明月圓，${n}在${t}工作之餘也別忘了與家人共享溫馨時光，敬祝中秋愉快。`,
  ],
  'new-year': [
    (h, n, t) => `${h}，新年新氣象！${n}這一年來帶領${t}團隊的付出我們都看在眼裡，敬祝新的一年鴻圖大展、萬事如意！`,
    (h, n, t) => `親愛的 ${h}，揮別過去精彩的一年，${n}在${t}的崗位上繼續發光發熱，2026 一起再創高峰！`,
    (h, n, t) => `${h}您好，回首過往${n}與我們攜手走過精彩歲月，新的一年願好運旺旺來、訂單接不完。`,
    (h, n, t) => `${h}，辭舊迎新之際，感謝${n}一直以來的支持，新的一年祝福您闔家幸福、事事順心。`,
  ],
  'birthday': [
    (h, n, t) => `${h}，${n}生日快樂！感謝您一直以來在${t}崗位上給我們的支持與信任，願您新的一歲事事順心、健康平安。`,
    (h, n, t) => `嗨 ${h}，${n}的生日我們記得呢！祝您生日快樂、事業順利、闔家幸福美滿 🎂`,
    (h, n, t) => `${h}您好，特別的日子送上我們的祝福，${n}在${t}的工作表現令人敬佩，新的一歲願心想事成。`,
    (h, n, t) => `${h}，${n}生日快樂！您是我們珍貴的合作夥伴，願這一年充滿健康、快樂與豐盛的收穫。`,
  ],
  'work-start': [
    (h, n, t) => `${h}，開工大吉！${n}與團隊在${t}的新年度一定會精彩可期，祝福您鴻圖大展、訂單滿載！`,
    (h, n, t) => `親愛的 ${h}，新春開工之際，${n}帶領${t}再啟新程，期待 2026 與您攜手創造更多可能。`,
    (h, n, t) => `${h}您好，金開工銀開工事事皆興，${n}在${t}的崗位上繼續發揮所長，祝福您新的一年心想事成。`,
    (h, n, t) => `${h}，開工大吉！${n}過去一年的努力值得掌聲，新的一年願您與團隊更上一層樓。`,
  ],
  'dragon-boat': [
    (h, n, t) => `${h}，端午安康！${n}在${t}工作之餘也別忘了吃顆粽子、划個龍舟，祝福您闔家平安。`,
    (h, n, t) => `${h}您好，粽葉飄香時節，感謝${n}一直以來的支持，願佳節愉快、好運連連。`,
    (h, n, t) => `嗨 ${h}，端午節是傳承也是團聚，${n}在${t}的辛勞我們銘記在心，祝福您佳節愉快。`,
    (h, n, t) => `${h}，五月五慶端陽，${n}在${t}的工作表現有目共睹，祝福您身體健康、闔家平安。`,
  ],
  'christmas': [
    (h, n, t) => `${h}，Merry Christmas！${n}這一年在${t}的努力與合作是我們最好的禮物，祝福您佳節愉快、新年蒙福。`,
    (h, n, t) => `${h}您好，歲末年終，感謝${n}一直以來的支持，祝福您聖誕快樂、2026 一切順心。`,
    (h, n, t) => `嗨 ${h}，聖誕是分享愛與感謝的季節，${n}在${t}的付出令我們感動，願您佳節溫馨愉快。`,
    (h, n, t) => `${h}，平安夜裡感謝有您，${n}與${t}團隊的合作是我們 2026 最好的起點，祝福聖誕快樂。`,
  ],
};

export default function BroadcastHolidayScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [step, setStep] = useState(1);
  const [holiday, setHoliday] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState('全部');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [greetings, setGreetings] = useState<PersonalGreeting[]>([]);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [useHonorific, setUseHonorific] = useState(true);
  const [useNick, setUseNick] = useState(false);
  const [imageSource, setImageSource] = useState<'official' | 'upload'>('official');
  const [cardTemplate, setCardTemplate] = useState<number>(1);
  const [intervalSec, setIntervalSec] = useState('10');
  const [scheduleNow, setScheduleNow] = useState(true);
  const [creating, setCreating] = useState(false);

  const styles = useThemedStyles((c) => ({
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
      backgroundColor: c.accent08,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: { fontSize: 22, fontWeight: '600', color: c.text, letterSpacing: 0.2 },
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      marginBottom: 20,
      gap: 16,
    },
    stepItem: { alignItems: 'center', gap: 4 },
    stepDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepDotActive: { backgroundColor: c.primary },
    stepDotText: { fontSize: 11, fontWeight: '700', color: c.textTertiary },
    stepDotTextActive: { color: c.textOnPrimary },
    stepLabel: { fontSize: 10, color: c.textTertiary, fontWeight: '500' },
    stepLabelActive: { color: c.primary, fontWeight: '600' },
    stepContent: { paddingHorizontal: 20 },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      marginBottom: 12,
    },
    warning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.warning + '15',
      padding: 10,
      borderRadius: 12,
      marginBottom: 16,
    },
    warningText: { flex: 1, fontSize: 12, color: c.text, lineHeight: 17 },
    holidayGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 20,
    },
    holidayCard: {
      width: '30%',
      aspectRatio: 1,
      backgroundColor: c.surface,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    holidayCardActive: {
      backgroundColor: c.primary10,
      borderWidth: 2,
      borderColor: c.primary,
    },
    holidayEmoji: { fontSize: 28, marginBottom: 4 },
    holidayLabel: { fontSize: 12, fontWeight: '600', color: c.text },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
    tagChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.bgInput,
    },
    tagChipActive: { backgroundColor: c.primary },
    tagChipText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    tagChipTextActive: { color: c.textOnPrimary },
    counter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: c.bgInput,
      borderRadius: 14,
      marginBottom: 10,
    },
    counterText: { fontSize: 13, color: c.textSecondary },
    counterValue: { fontSize: 14, fontWeight: '700', color: c.text },
    selectAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: c.bgInput,
      borderRadius: 14,
      marginBottom: 10,
    },
    selectAllText: { fontSize: 13, fontWeight: '600', color: c.text },
    aiBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.primary,
      paddingVertical: 16,
      borderRadius: 16,
      marginBottom: 12,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    aiBtnText: { fontSize: 15, fontWeight: '700', color: c.textOnPrimary },
    aiHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.info10,
      padding: 10,
      borderRadius: 12,
      marginBottom: 16,
    },
    aiHintText: { flex: 1, fontSize: 12, color: c.text, lineHeight: 17 },
    greetingCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    greetingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    greetingAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    greetingAvatarText: { fontSize: 14, fontWeight: '700', color: c.primary },
    greetingInfo: { flex: 1 },
    greetingName: { fontSize: 13, fontWeight: '700', color: c.text },
    greetingHonorific: { fontSize: 11, color: c.textTertiary, marginTop: 1 },
    regenBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    greetingText: { fontSize: 14, color: c.text, lineHeight: 22 },
    greetingInput: {
      backgroundColor: c.bgInput,
      borderRadius: 10,
      padding: 10,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    emptyState: { alignItems: 'center', paddingTop: 40, gap: 12 },
    emptyText: { fontSize: 14, color: c.textTertiary },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    switchLabel: { fontSize: 14, color: c.text },
    switchHint: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
    sourceRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    sourceBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 14,
      backgroundColor: c.bgInput,
      alignItems: 'center',
    },
    sourceBtnActive: {
      backgroundColor: c.primary10,
      borderWidth: 2,
      borderColor: c.primary,
    },
    sourceBtnText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    sourceBtnTextActive: { color: c.primary },
    sourceNote: { fontSize: 11, color: c.textTertiary, marginTop: 4, textAlign: 'center' },
    cardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    },
    cardOption: {
      width: '30%',
      aspectRatio: 1,
      backgroundColor: c.surface,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    cardOptionActive: { borderColor: c.primary, backgroundColor: c.primary10 },
    cardEmoji: { fontSize: 32 },
    cardName: { fontSize: 11, color: c.text, marginTop: 4 },
    intervalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgInput,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
    },
    intervalInput: { flex: 1, fontSize: 15, color: c.text, padding: 0 },
    intervalUnit: { fontSize: 13, color: c.textSecondary },
    btnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
    nextBtn: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 20,
      paddingVertical: 16,
      alignItems: 'center',
    },
    nextBtnDisabled: { backgroundColor: c.border },
    nextBtnText: { fontSize: 15, fontWeight: '700', color: c.textOnPrimary },
    backBtnStep: {
      flex: 1,
      backgroundColor: c.bgInput,
      borderRadius: 20,
      paddingVertical: 16,
      alignItems: 'center',
    },
    backBtnStepText: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
    summaryCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    summaryLabel: { fontSize: 13, color: c.textSecondary },
    summaryValue: { fontSize: 13, fontWeight: '600', color: c.text },
  }));

  const pickHoliday = (id: string) => {
    setHoliday(id);
    setGreetings([]);
  };

  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
    // 移除已取消選的祝福語
    setGreetings((prev) => prev.filter((g) => g.contactId !== id));
  };

  const generateAIGreetings = useCallback(async () => {
    if (!holiday || selectedIds.length === 0) return;
    setGenerating(true);
    // 模擬 AI 推理時間
    await new Promise((r) => setTimeout(r, 1200));
    const templates = AI_TEMPLATES[holiday] || [];
    const newGreetings: PersonalGreeting[] = selectedIds.map((cid) => {
      const contact = CONTACTS.find((c) => c.id === cid);
      if (!contact) return { contactId: cid, greeting: '' };
      const h = useHonorific ? contact.honorific : contact.name;
      const n = contact.nick;
      const t = contact.title;
      const tmpl = templates[Math.floor(Math.random() * templates.length)];
      return { contactId: cid, greeting: tmpl(h, n, t) };
    });
    setGreetings(newGreetings);
    setGenerating(false);
  }, [holiday, selectedIds, useHonorific]);

  const regenerateOne = (contactId: number) => {
    if (!holiday) return;
    const templates = AI_TEMPLATES[holiday] || [];
    const contact = CONTACTS.find((c) => c.id === contactId);
    if (!contact) return;
    const h = useHonorific ? contact.honorific : contact.name;
    const tmpl = templates[Math.floor(Math.random() * templates.length)];
    setGreetings((prev) =>
      prev.map((g) =>
        g.contactId === contactId ? { ...g, greeting: tmpl(h, contact.nick, contact.title) } : g
      )
    );
  };

  const canNext = () => {
    if (step === 1) return !!holiday;
    if (step === 2) return selectedIds.length > 0 && selectedIds.length <= MAX_RECIPIENTS;
    if (step === 3) return greetings.length === selectedIds.length && greetings.length > 0;
    if (step === 4) return parseInt(intervalSec || '0', 10) >= 30;
    return true;
  };

  const handleCreate = async () => {
    if (greetings.length === 0) {
      Alert.alert('提示', '請先 AI 生成祝福語');
      return;
    }
    setCreating(true);
    try {
      const holidayLabel = HOLIDAYS.find((h) => h.id === holiday)?.label || '';
      // 將所有 AI 生成的祝福語合併為模板（簡化存儲）
      const template = greetings.map((g) => {
        const c = CONTACTS.find((x) => x.id === g.contactId);
        return `[${c?.name}]: ${g.greeting}`;
      }).join('\n');
      await createBroadcast({
        title: `${holidayLabel}祝福 · AI 個人化`,
        contactIds: selectedIds,
        template,
      });
      Alert.alert('成功', `已為 ${selectedIds.length} 位好友生成個人化祝福`, [
        { text: '確定', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('錯誤', '建立失敗');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="chevron-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>節日群發</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.warning}>
          <FontAwesome6 name="circle-info" size={16} color={colors.gold} />
          <Text style={styles.warningText}>
            AI 會依每位好友的稱呼、暱稱、職稱自動生成不同祝福語
          </Text>
        </View>

        <View style={styles.stepIndicator}>
          {[1, 2, 3, 4, 5].map((s) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>{s}</Text>
              </View>
              <Text style={[styles.stepLabel, step >= s && styles.stepLabelActive]}>
                {s === 1 ? '節日' : s === 2 ? '對象' : s === 3 ? 'AI' : s === 4 ? '圖片' : '確認'}
              </Text>
            </View>
          ))}
        </View>

        {/* Step 1: Holiday */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>選擇節日</Text>
            <View style={styles.holidayGrid}>
              {HOLIDAYS.map((h) => (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.holidayCard, holiday === h.id && styles.holidayCardActive]}
                  onPress={() => pickHoliday(h.id)}
                >
                  <Text style={styles.holidayEmoji}>{h.emoji}</Text>
                  <Text style={styles.holidayLabel}>{h.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Recipients */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>選擇好友</Text>
            <View style={styles.tagRow}>
              {TAGS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tagChip, filterTag === t && styles.tagChipActive]}
                  onPress={() => setFilterTag(t)}
                >
                  <Text style={[styles.tagChipText, filterTag === t && styles.tagChipTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.counter}>
              <Text style={styles.counterText}>已選</Text>
              <Text style={[styles.counterValue, { color: selectedIds.length > MAX_RECIPIENTS ? colors.danger : colors.primary }]}>
                {selectedIds.length} / {MAX_RECIPIENTS} 人
              </Text>
            </View>
            <TouchableOpacity
              style={styles.selectAllBtn}
              onPress={() => {
                if (selectedIds.length >= CONTACTS.length) {
                  setSelectedIds([]);
                  setGreetings([]);
                } else {
                  setSelectedIds(CONTACTS.slice(0, MAX_RECIPIENTS).map((c) => c.id));
                }
              }}
            >
              <Text style={styles.selectAllText}>
                {selectedIds.length >= CONTACTS.length ? '取消全選' : '全選'}
              </Text>
              <FontAwesome6
                name={selectedIds.length >= CONTACTS.length ? 'square-check' : 'square'}
                size={16}
                color={selectedIds.length >= CONTACTS.length ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
            {CONTACTS.map((contact) => {
              const isSelected = selectedIds.includes(contact.id);
              const disabled = !isSelected && selectedIds.length >= MAX_RECIPIENTS;
              return (
                <TouchableOpacity
                  key={contact.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    backgroundColor: isSelected ? colors.primary10 : colors.surface,
                    borderRadius: 14,
                    marginBottom: 8,
                    opacity: disabled ? 0.4 : 1,
                    gap: 12,
                  }}
                  onPress={() => toggleId(contact.id)}
                  disabled={disabled}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {isSelected && <FontAwesome6 name="check" size={12} color={colors.textOnPrimary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: colors.text, fontWeight: '600' }}>
                      {contact.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
                      {contact.title} · {contact.company}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                    {contact.honorific}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Step 3: AI generation */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>AI 生成祝福語</Text>
            <View style={styles.aiHint}>
              <FontAwesome6 name="wand-magic-sparkles" size={14} color={colors.info} />
              <Text style={styles.aiHintText}>
                將根據每位好友的尊稱、暱稱、職稱自動生成，{selectedIds.length} 則
              </Text>
            </View>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>使用尊稱</Text>
                <Text style={styles.switchHint}>張三 業務經理 → 張經理</Text>
              </View>
              <TouchableOpacity
                onPress={() => setUseHonorific(!useHonorific)}
                style={[
                  styles.checkbox,
                  { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
                  useHonorific && { backgroundColor: colors.primary, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
                ]}
              >
                {useHonorific && <FontAwesome6 name="check" size={12} color={colors.textOnPrimary} />}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.aiBtn}
              onPress={generateAIGreetings}
              disabled={generating || selectedIds.length === 0}
            >
              {generating ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <FontAwesome6 name="wand-magic-sparkles" size={16} color={colors.textOnPrimary} />
              )}
              <Text style={styles.aiBtnText}>
                {generating ? 'AI 推理中…' : greetings.length > 0 ? '重新生成全部' : '✨ AI 自動生成祝福語'}
              </Text>
            </TouchableOpacity>

            {greetings.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>個人化預覽（{greetings.length}）</Text>
                {greetings.map((g) => {
                  const c = CONTACTS.find((x) => x.id === g.contactId);
                  if (!c) return null;
                  return (
                    <View key={g.contactId} style={styles.greetingCard}>
                      <View style={styles.greetingHeader}>
                        <View style={styles.greetingAvatar}>
                          <Text style={styles.greetingAvatarText}>{c.name.charAt(0)}</Text>
                        </View>
                        <View style={styles.greetingInfo}>
                          <Text style={styles.greetingName}>{c.name} · {c.title}</Text>
                          <Text style={styles.greetingHonorific}>
                            尊稱 {c.honorific} · 暱稱 {c.nick}
                          </Text>
                        </View>
<TouchableOpacity
                              style={styles.regenBtn}
                              onPress={() => regenerateOne(g.contactId)}
                            >
                              <FontAwesome6 name="arrows-rotate" size={12} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.regenBtn}
                              onPress={() => {
                                setEditingId(g.contactId);
                                setEditValue(g.greeting);
                              }}
                            >
                              <FontAwesome6 name="pen" size={11} color={colors.primary} />
                            </TouchableOpacity>
                      </View>
                      {editingId === g.contactId ? (
                        <TextInput
                          style={[styles.greetingText, styles.greetingInput]}
                          value={editValue}
                          onChangeText={setEditValue}
                          multiline
                          autoFocus
                          onBlur={() => {
                            setGreetings((prev) =>
                              prev.map((x) =>
                                x.contactId === g.contactId ? { ...x, greeting: editValue } : x
                              )
                            );
                            setEditingId(null);
                          }}
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            setEditingId(g.contactId);
                            setEditValue(g.greeting);
                          }}
                        >
                          <Text style={styles.greetingText}>{g.greeting}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </>
            ) : !generating && (
              <View style={styles.emptyState}>
                <FontAwesome6 name="wand-magic-sparkles" size={36} color={colors.border} />
                <Text style={styles.emptyText}>點上方按鈕讓 AI 為每位好友生成祝福</Text>
              </View>
            )}
          </View>
        )}

        {/* Step 4: Image */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>圖片來源</Text>
            <View style={styles.sourceRow}>
              <TouchableOpacity
                style={[styles.sourceBtn, imageSource === 'official' && styles.sourceBtnActive]}
                onPress={() => setImageSource('official')}
              >
                <FontAwesome6 name="store" size={18} color={imageSource === 'official' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.sourceBtnText, imageSource === 'official' && styles.sourceBtnTextActive]}>
                  官網訂購
                </Text>
                <Text style={styles.sourceNote}>可列印尊稱/暱稱/職稱</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sourceBtn, imageSource === 'upload' && styles.sourceBtnActive]}
                onPress={() => setImageSource('upload')}
              >
                <FontAwesome6 name="upload" size={18} color={imageSource === 'upload' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.sourceBtnText, imageSource === 'upload' && styles.sourceBtnTextActive]}>
                  自己上傳
                </Text>
                <Text style={styles.sourceNote}>從相簿或拍照上傳</Text>
              </TouchableOpacity>
            </View>
            {imageSource === 'official' && (
              <View style={styles.cardGrid}>
                {[1, 2, 3, 4, 5].map((id) => {
                  const card = [
                    { id: 1, name: '典雅花藝', emoji: '🌸' },
                    { id: 2, name: '商務簡約', emoji: '💼' },
                    { id: 3, name: '可愛插畫', emoji: '🎨' },
                    { id: 4, name: '中式傳統', emoji: '🏮' },
                    { id: 5, name: '節慶金箔', emoji: '✨' },
                  ][id - 1];
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.cardOption, cardTemplate === id && styles.cardOptionActive]}
                      onPress={() => setCardTemplate(id)}
                    >
                      <Text style={styles.cardEmoji}>{card.emoji}</Text>
                      <Text style={styles.cardName}>{card.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>發送時間</Text>
            <View style={styles.sourceRow}>
              <TouchableOpacity
                style={[styles.sourceBtn, scheduleNow && styles.sourceBtnActive]}
                onPress={() => setScheduleNow(true)}
              >
                <Text style={[styles.sourceBtnText, scheduleNow && styles.sourceBtnTextActive]}>立即發送</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sourceBtn, !scheduleNow && styles.sourceBtnActive]}
                onPress={() => setScheduleNow(false)}
              >
                <Text style={[styles.sourceBtnText, !scheduleNow && styles.sourceBtnTextActive]}>預約時間</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>間隔時長</Text>
            <View style={styles.intervalRow}>
              <TextInput
                style={styles.intervalInput}
                value={intervalSec}
                onChangeText={setIntervalSec}
                keyboardType="number-pad"
              />
              <Text style={styles.intervalUnit}>秒（每則間隔）</Text>
            </View>
          </View>
        )}

        {/* Step 5: Confirm */}
        {step === 5 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>確認發送</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>節日</Text>
                <Text style={styles.summaryValue}>{HOLIDAYS.find((h) => h.id === holiday)?.label}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>好友人數</Text>
                <Text style={styles.summaryValue}>{selectedIds.length} 人</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>AI 個人化</Text>
                <Text style={styles.summaryValue}>{greetings.length} 則</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>圖片來源</Text>
                <Text style={styles.summaryValue}>{imageSource === 'official' ? '官網訂購' : '自己上傳'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>發送時間</Text>
                <Text style={styles.summaryValue}>{scheduleNow ? '立即發送' : '預約時間'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>間隔</Text>
                <Text style={styles.summaryValue}>{intervalSec} 秒</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.btnRow}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtnStep} onPress={() => setStep(step - 1)}>
              <Text style={styles.backBtnStepText}>上一步</Text>
            </TouchableOpacity>
          )}
          {step < 5 ? (
            <TouchableOpacity
              style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled]}
              onPress={() => canNext() && setStep(step + 1)}
              disabled={!canNext()}
            >
              <Text style={styles.nextBtnText}>下一步</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, creating && styles.nextBtnDisabled]}
              onPress={handleCreate}
              disabled={creating}
            >
              <Text style={styles.nextBtnText}>{creating ? '建立中…' : '確認發送'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
