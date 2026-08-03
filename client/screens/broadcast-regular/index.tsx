import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { createBroadcast } from '@/utils/api';

type GreetingPeriod = 'morning' | 'noon' | 'evening';
type Frequency = 'daily' | 'weekly' | 'custom';

const PERIOD_LABELS: Record<GreetingPeriod, { label: string; emoji: string; default: string }> = {
  morning: { label: '早安', emoji: '🌅', default: '{稱呼}早安！今天有什麼我可以幫你的嗎？祝你有美好的一天！' },
  noon: { label: '午安', emoji: '☀️', default: '{稱呼}午安！記得吃午餐、休息一下，下午繼續加油！' },
  evening: { label: '晚安', emoji: '🌙', default: '{稱呼}晚安！今天辛苦了，好好休息，明天見！' },
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MAX_RECIPIENTS = 8;

export default function BroadcastRegularScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [period, setPeriod] = useState<GreetingPeriod>('morning');
  const [prompt, setPrompt] = useState(PERIOD_LABELS.morning.default);
  const [useHonorific, setUseHonorific] = useState(true);
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [dailyTime, setDailyTime] = useState('09:00');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [weeklyTime, setWeeklyTime] = useState('09:00');
  const [customDate, setCustomDate] = useState('01');
  const [customTime, setCustomTime] = useState('09:00');
  const [intervalSec, setIntervalSec] = useState('60');
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
      backgroundColor: c.sky08,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: { fontSize: 22, fontWeight: '600', color: c.text, letterSpacing: 0.2 },
    warning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.warning + '15',
      padding: 10,
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 16,
    },
    warningText: { flex: 1, fontSize: 12, color: c.text, lineHeight: 17 },
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
    counter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: c.bgInput,
      borderRadius: 14,
      marginBottom: 16,
    },
    counterText: { fontSize: 13, color: c.textSecondary },
    counterValue: { fontSize: 14, fontWeight: '700', color: c.text },
    periodRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    periodBtn: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.surface,
      alignItems: 'center',
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    periodBtnActive: { backgroundColor: c.sky10, borderWidth: 2, borderColor: c.sky },
    periodEmoji: { fontSize: 28, marginBottom: 4 },
    periodLabel: { fontSize: 13, fontWeight: '600', color: c.text },
    textAreaWrap: {
      backgroundColor: c.bgInput,
      borderRadius: 14,
      padding: 12,
      minHeight: 100,
      marginBottom: 12,
    },
    textArea: { fontSize: 14, color: c.text, lineHeight: 20, minHeight: 80 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    switchLabel: { fontSize: 14, color: c.text },
    varRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    varChip: {
      backgroundColor: c.primary10,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    varChipText: { fontSize: 12, color: c.primary, fontWeight: '600' },
    freqRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    freqBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 14,
      backgroundColor: c.bgInput,
      alignItems: 'center',
    },
    freqBtnActive: { backgroundColor: c.primary10, borderWidth: 2, borderColor: c.primary },
    freqBtnText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    freqBtnTextActive: { color: c.primary },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgInput,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
    },
    timeInput: { flex: 1, fontSize: 15, color: c.text, padding: 0 },
    timeUnit: { fontSize: 13, color: c.textSecondary },
    weekdayRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
    weekdayBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.bgInput,
      alignItems: 'center',
    },
    weekdayBtnActive: { backgroundColor: c.primary },
    weekdayText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    weekdayTextActive: { color: c.textOnPrimary },
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
  }));

  const pickPeriod = (p: GreetingPeriod) => {
    setPeriod(p);
    setPrompt(PERIOD_LABELS[p].default);
  };

  const toggleId = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleWeekday = (d: number) => {
    setWeeklyDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  };

  const canNext = () => {
    if (step === 1) return selectedIds.length > 0 && selectedIds.length <= MAX_RECIPIENTS;
    if (step === 2) return prompt.trim().length > 0;
    if (step === 3) return parseInt(intervalSec || '0', 10) >= 30;
    return true;
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const periodLabel = PERIOD_LABELS[period].label;
      await createBroadcast({
        title: `定期問安 · ${periodLabel}`,
        contactIds: selectedIds,
        template: prompt,
      });
      Alert.alert('成功', '定期問安已建立！', [{ text: '確定', onPress: () => router.back() }]);
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
          <Text style={styles.headerTitle}>定期問安</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.warning}>
          <FontAwesome6 name="circle-info" size={16} color={colors.gold} />
          <Text style={styles.warningText}>
            定期發送問候，建議每次 ≤ {MAX_RECIPIENTS} 人、間隔 ≥ 30 秒
          </Text>
        </View>

        <View style={styles.stepIndicator}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>{s}</Text>
              </View>
              <Text style={[styles.stepLabel, step >= s && styles.stepLabelActive]}>
                {s === 1 ? '對象' : s === 2 ? '問候' : s === 3 ? '時間' : '確認'}
              </Text>
            </View>
          ))}
        </View>

        {/* Step 1: Recipients */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>選擇好友</Text>
            <View style={styles.counter}>
              <Text style={styles.counterText}>已選</Text>
              <Text style={[styles.counterValue, { color: selectedIds.length > MAX_RECIPIENTS ? colors.danger : colors.primary }]}>
                {selectedIds.length} / {MAX_RECIPIENTS} 人
              </Text>
            </View>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                paddingHorizontal: 14,
                backgroundColor: colors.bgInput,
                borderRadius: 14,
                marginBottom: 10,
              }}
              onPress={() => {
                if (selectedIds.length >= [1, 2, 3, 4, 5, 6].length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds([1, 2, 3, 4, 5, 6].slice(0, MAX_RECIPIENTS));
                }
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                {selectedIds.length >= [1, 2, 3, 4, 5, 6].length ? '取消全選' : '全選'}
              </Text>
              <FontAwesome6
                name={selectedIds.length >= [1, 2, 3, 4, 5, 6].length ? 'square-check' : 'square'}
                size={16}
                color={selectedIds.length >= [1, 2, 3, 4, 5, 6].length ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
            {[1, 2, 3, 4, 5, 6].map((id) => {
              const isSelected = selectedIds.includes(id);
              const disabled = !isSelected && selectedIds.length >= MAX_RECIPIENTS;
              return (
                <TouchableOpacity
                  key={id}
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
                  onPress={() => !disabled && toggleId(id)}
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
                  <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>
                    好友 #{id}（{['張三', '李四', '王五', '陳美玲', '林大明', '黃雅婷'][id - 1]}）
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Step 2: Greeting type + prompt */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>問候類型</Text>
            <View style={styles.periodRow}>
              {(Object.keys(PERIOD_LABELS) as GreetingPeriod[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                  onPress={() => pickPeriod(p)}
                >
                  <Text style={styles.periodEmoji}>{PERIOD_LABELS[p].emoji}</Text>
                  <Text style={styles.periodLabel}>{PERIOD_LABELS[p].label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>問候 Prompt</Text>
            <View style={styles.textAreaWrap}>
              <TextInput
                style={styles.textArea}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.varRow}>
              {['{稱呼}', '{暱稱}', '{職稱}', '{公司}'].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={styles.varChip}
                  onPress={() => setPrompt((p) => `${p}${v}`)}
                >
                  <Text style={styles.varChipText}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>替換為尊稱</Text>
              </View>
              <Switch
                value={useHonorific}
                onValueChange={setUseHonorific}
                trackColor={{ false: colors.bgInput, true: colors.primary30 }}
                thumbColor={useHonorific ? colors.primary : colors.border}
              />
            </View>
          </View>
        )}

        {/* Step 3: Frequency */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>發送頻率</Text>
            <View style={styles.freqRow}>
              {(['daily', 'weekly', 'custom'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.freqBtn, frequency === f && styles.freqBtnActive]}
                  onPress={() => setFrequency(f)}
                >
                  <Text style={[styles.freqBtnText, frequency === f && styles.freqBtnTextActive]}>
                    {f === 'daily' ? '每日' : f === 'weekly' ? '每週' : '自訂'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {frequency === 'daily' && (
              <View style={styles.timeRow}>
                <FontAwesome6 name="clock" size={14} color={colors.textSecondary} />
                <TextInput
                  style={styles.timeInput}
                  value={dailyTime}
                  onChangeText={setDailyTime}
                  placeholder="09:00"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.timeUnit}>（每日固定時間）</Text>
              </View>
            )}

            {frequency === 'weekly' && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>選擇週天</Text>
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((label, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.weekdayBtn, weeklyDays.includes(idx) && styles.weekdayBtnActive]}
                      onPress={() => toggleWeekday(idx)}
                    >
                      <Text style={[styles.weekdayText, weeklyDays.includes(idx) && styles.weekdayTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.timeRow}>
                  <FontAwesome6 name="clock" size={14} color={colors.textSecondary} />
                  <TextInput
                    style={styles.timeInput}
                    value={weeklyTime}
                    onChangeText={setWeeklyTime}
                    placeholder="09:00"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Text style={styles.timeUnit}>（已選 {weeklyDays.length} 天）</Text>
                </View>
              </>
            )}

            {frequency === 'custom' && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>自訂排程</Text>
                <View style={styles.timeRow}>
                  <FontAwesome6 name="calendar" size={14} color={colors.textSecondary} />
                  <Text style={[styles.timeUnit, { color: colors.textSecondary }]}>每月</Text>
                  <TextInput
                    style={[styles.timeInput, { flex: 0, minWidth: 40 }]}
                    value={customDate}
                    onChangeText={setCustomDate}
                    keyboardType="number-pad"
                  />
                  <Text style={styles.timeUnit}>號</Text>
                </View>
                <View style={styles.timeRow}>
                  <FontAwesome6 name="clock" size={14} color={colors.textSecondary} />
                  <TextInput
                    style={styles.timeInput}
                    value={customTime}
                    onChangeText={setCustomTime}
                  />
                  <Text style={styles.timeUnit}>發送</Text>
                </View>
              </>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>間隔時長</Text>
            <View style={styles.timeRow}>
              <TextInput
                style={styles.timeInput}
                value={intervalSec}
                onChangeText={setIntervalSec}
                keyboardType="number-pad"
              />
              <Text style={styles.timeUnit}>秒（每則間隔）</Text>
            </View>
          </View>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>確認建立</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>問候類型</Text>
                <Text style={styles.summaryValue}>{PERIOD_LABELS[period].emoji} {PERIOD_LABELS[period].label}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>好友人數</Text>
                <Text style={styles.summaryValue}>{selectedIds.length} 人</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>頻率</Text>
                <Text style={styles.summaryValue}>
                  {frequency === 'daily' && `每日 ${dailyTime}`}
                  {frequency === 'weekly' && `每週 ${weeklyDays.map((d) => WEEKDAYS[d]).join('/')} ${weeklyTime}`}
                  {frequency === 'custom' && `每月 ${customDate} 號 ${customTime}`}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>間隔</Text>
                <Text style={styles.summaryValue}>{intervalSec} 秒</Text>
              </View>
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>問候語預覽</Text>
            <View style={[styles.textAreaWrap, { minHeight: 80 }]}>
              <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22 }}>{prompt}</Text>
            </View>
          </View>
        )}

        <View style={styles.btnRow}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtnStep} onPress={() => setStep(step - 1)}>
              <Text style={styles.backBtnStepText}>上一步</Text>
            </TouchableOpacity>
          )}
          {step < 4 ? (
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
              <Text style={styles.nextBtnText}>{creating ? '建立中…' : '確認建立'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
