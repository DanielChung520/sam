import React, { useState, useCallback } from 'react';
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
import { createBroadcast } from '@/utils/mockApi';

const MOCK_CONTACTS = [
  { id: 1, name: '張三', score: 85 },
  { id: 2, name: '李四', score: 62 },
  { id: 3, name: '王五', score: 30 },
  { id: 4, name: '陳美玲', score: 92 },
  { id: 5, name: '林大明', score: 8 },
  { id: 6, name: '黃雅婷', score: 55 },
];

export default function BroadcastCreateScreen() {
  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [template, setTemplate] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
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
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      marginBottom: 24,
      gap: 20,
    },
    stepItem: { alignItems: 'center', gap: 4 },
    stepDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepDotActive: { backgroundColor: c.primary },
    stepDotText: { fontSize: 12, fontWeight: '700', color: c.textTertiary },
    stepDotTextActive: { color: c.textOnPrimary },
    stepLabel: { fontSize: 10, color: c.textTertiary, fontWeight: '500' },
    stepLabelActive: { color: c.primary, fontWeight: '600' },
    stepContent: { paddingHorizontal: 20 },
    selectHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      marginBottom: 12,
    },
    selectAllText: { fontSize: 13, fontWeight: '600', color: c.primary },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 8,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
      gap: 12,
    },
    contactItemSelected: { backgroundColor: c.primary06 },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxActive: { backgroundColor: c.primary, borderColor: c.primary },
    contactName: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
    contactScore: { fontSize: 13, color: c.accent, fontWeight: '600' },
    inputWrap: {
      backgroundColor: c.bgInput,
      borderRadius: 16,
      padding: 14,
    },
    titleInput: { fontSize: 15, color: c.text },
    hintText: { fontSize: 12, color: c.textTertiary, marginBottom: 8 },
    textAreaWrap: {
      backgroundColor: c.bgInput,
      borderRadius: 16,
      padding: 14,
      minHeight: 120,
    },
    textArea: { fontSize: 14, color: c.text, lineHeight: 20 },
    btnRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
    nextBtn: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 20,
      paddingVertical: 16,
      alignItems: 'center',
    },
    nextBtnDisabled: { backgroundColor: c.border },
    nextBtnText: { fontSize: 15, fontWeight: '700', color: c.textOnPrimary },
    backStepBtn: {
      flex: 1,
      backgroundColor: c.bgInput,
      borderRadius: 20,
      paddingVertical: 16,
      alignItems: 'center',
    },
    backStepText: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
    previewCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      shadowColor: c.shadow,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
    },
    previewLabel: {
      fontSize: 12,
      color: c.textSecondary,
      marginBottom: 8,
      fontWeight: '500',
    },
    previewText: { fontSize: 15, color: c.text, lineHeight: 22 },
    summaryCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 20,
      shadowColor: c.shadow,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderLight,
    },
    summaryLabel: { fontSize: 14, color: c.textSecondary },
    summaryValue: { fontSize: 14, fontWeight: '600', color: c.text },
    confirmBtn: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 20,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    confirmBtnText: { fontSize: 15, fontWeight: '700', color: c.textOnPrimary },
  }));

  const toggleContact = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === MOCK_CONTACTS.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(MOCK_CONTACTS.map((c) => c.id));
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !template.trim() || selectedIds.length === 0) {
      Alert.alert('提示', '請填寫完整資訊');
      return;
    }
    setCreating(true);
    try {
      await createBroadcast({ title, contactIds: selectedIds, template });
      Alert.alert('成功', '群發任務已建立！', [{ text: '確定', onPress: () => router.back() }]);
    } catch (e) {
      console.error('Failed to create broadcast:', e);
      Alert.alert('錯誤', '建立失敗，請稍後再試');
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
          <Text style={styles.headerTitle}>新建群發</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.stepIndicator}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>{s}</Text>
              </View>
              <Text style={[styles.stepLabel, step >= s && styles.stepLabelActive]}>
                {s === 1 ? '選擇對象' : s === 2 ? '編輯內容' : '確認'}
              </Text>
            </View>
          ))}
        </View>

        {step === 1 && (
          <View style={styles.stepContent}>
            <View style={styles.selectHeader}>
              <Text style={styles.sectionTitle}>選擇發送對象</Text>
              <TouchableOpacity onPress={selectAll}>
                <Text style={styles.selectAllText}>
                  {selectedIds.length === MOCK_CONTACTS.length ? '取消全選' : '全選'}
                </Text>
              </TouchableOpacity>
            </View>
            {MOCK_CONTACTS.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.contactItem, selectedIds.includes(c.id) && styles.contactItemSelected]}
                onPress={() => toggleContact(c.id)}
              >
                <View style={[styles.checkbox, selectedIds.includes(c.id) && styles.checkboxActive]}>
                  {selectedIds.includes(c.id) && (
                    <FontAwesome6 name="check" size={12} color={colors.textOnPrimary} />
                  )}
                </View>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactScore}>{c.score} 分</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.nextBtn, selectedIds.length === 0 && styles.nextBtnDisabled]}
              onPress={() => setStep(2)}
              disabled={selectedIds.length === 0}
            >
              <Text style={styles.nextBtnText}>下一步 ({selectedIds.length} 人)</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>群發標題</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.titleInput}
                placeholder="例：中秋節問候"
                placeholderTextColor={colors.textTertiary}
                value={title}
                onChangeText={setTitle}
              />
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>訊息模板</Text>
            <Text style={styles.hintText}>使用 {'{稱呼}'} 自動替換為好友姓名</Text>
            <View style={styles.textAreaWrap}>
              <TextInput
                style={styles.textArea}
                placeholder="例：{稱呼}您好，中秋佳節將至，祝您月圓人團圓！"
                placeholderTextColor={colors.textTertiary}
                value={template}
                onChangeText={setTemplate}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backStepBtn} onPress={() => setStep(1)}>
                <Text style={styles.backStepText}>上一步</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, !template.trim() && styles.nextBtnDisabled]}
                onPress={() => setStep(3)}
                disabled={!template.trim()}
              >
                <Text style={styles.nextBtnText}>預覽</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>預覽個人化範例</Text>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>收件人：{MOCK_CONTACTS.find((c) => c.id === selectedIds[0])?.name}</Text>
              <Text style={styles.previewText}>
                {template.replace(/\{稱呼\}/g, MOCK_CONTACTS.find((c) => c.id === selectedIds[0])?.name || '')}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>發送對象</Text>
                <Text style={styles.summaryValue}>{selectedIds.length} 人</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>預計間隔</Text>
                <Text style={styles.summaryValue}>3-7 分鐘</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>預計耗時</Text>
                <Text style={styles.summaryValue}>約 {Math.ceil(selectedIds.length * 5)} 分鐘</Text>
              </View>
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backStepBtn} onPress={() => setStep(2)}>
                <Text style={styles.backStepText}>修改模板</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, creating && styles.nextBtnDisabled]}
                onPress={handleCreate}
                disabled={creating}
              >
                <Text style={styles.confirmBtnText}>確認發送</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
