import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { createBroadcast } from '@/utils/api';

const MAX_RECIPIENTS = 8;
const MAX_LENGTH = 1000;

export default function BroadcastAnnounceScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [content, setContent] = useState('');
  const [scheduleNow, setScheduleNow] = useState(true);
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
      backgroundColor: c.danger + '15',
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
    textAreaWrap: {
      backgroundColor: c.bgInput,
      borderRadius: 14,
      padding: 12,
      minHeight: 160,
      marginBottom: 12,
      position: 'relative',
    },
    textArea: {
      fontSize: 14,
      color: c.text,
      lineHeight: 22,
      minHeight: 140,
      padding: 0,
    },
    charCount: {
      fontSize: 11,
      color: c.textTertiary,
      textAlign: 'right',
      marginTop: 4,
    },
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
    sourceRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    sourceBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 14,
      backgroundColor: c.bgInput,
      alignItems: 'center',
    },
    sourceBtnActive: { backgroundColor: c.danger + '15', borderWidth: 2, borderColor: c.danger },
    sourceBtnText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    sourceBtnTextActive: { color: c.danger },
    previewBox: {
      backgroundColor: c.bgInput,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    previewTitle: { fontSize: 12, color: c.textTertiary, fontWeight: '600' },
    previewContent: { fontSize: 14, color: c.text, lineHeight: 22 },
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

  const toggleId = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const canNext = () => {
    if (step === 1) return selectedIds.length > 0 && selectedIds.length <= MAX_RECIPIENTS;
    if (step === 2) return content.trim().length > 0;
    if (step === 3) return parseInt(intervalSec || '0', 10) >= 30;
    return true;
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const title = content.slice(0, 20) + (content.length > 20 ? '…' : '');
      await createBroadcast({
        title: `公告 · ${title}`,
        contactIds: selectedIds,
        template: content,
      });
      Alert.alert('成功', '公告群發已建立！', [{ text: '確定', onPress: () => router.back() }]);
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
          <Text style={styles.headerTitle}>公告群發</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.warning}>
          <FontAwesome6 name="circle-info" size={16} color={colors.gold} />
          <Text style={styles.warningText}>
            公告將一次發送給所有選取好友，建議每次 ≤ {MAX_RECIPIENTS} 人
          </Text>
        </View>

        <View style={styles.stepIndicator}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>{s}</Text>
              </View>
              <Text style={[styles.stepLabel, step >= s && styles.stepLabelActive]}>
                {s === 1 ? '對象' : s === 2 ? '內容' : s === 3 ? '時間' : '確認'}
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

        {/* Step 2: Content */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>公告內容</Text>
            <View style={styles.textAreaWrap}>
              <TextInput
                style={styles.textArea}
                value={content}
                onChangeText={(t) => t.length <= MAX_LENGTH && setContent(t)}
                placeholder="輸入或貼上公告內容..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />
            </View>
            <Text style={styles.charCount}>{content.length} / {MAX_LENGTH} 字</Text>

            {content.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>預覽</Text>
                <View style={styles.previewBox}>
                  <View style={styles.previewHeader}>
                    <FontAwesome6 name="bullhorn" size={12} color={colors.danger} />
                    <Text style={styles.previewTitle}>公告訊息</Text>
                  </View>
                  <Text style={styles.previewContent}>{content}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Step 3: Time */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>發送時間</Text>
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
            <Text style={styles.sectionTitle}>確認發送</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>好友人數</Text>
                <Text style={styles.summaryValue}>{selectedIds.length} 人</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>字數</Text>
                <Text style={styles.summaryValue}>{content.length} / {MAX_LENGTH}</Text>
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
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>內容預覽</Text>
            <View style={styles.previewBox}>
              <Text style={styles.previewContent}>{content}</Text>
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
              <Text style={styles.nextBtnText}>{creating ? '建立中…' : '確認發送'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
