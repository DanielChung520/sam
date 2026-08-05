import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { getNewsSubscription, saveNewsSubscription } from '@/utils/api';

type SearchFreq = 'realtime' | 'hourly' | 'daily' | 'weekly';

export default function NewsSettingsScreen() {
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
      backgroundColor: c.sky08,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: { fontSize: 22, fontWeight: '600', color: c.text, letterSpacing: 0.2 },
    section: {
      marginHorizontal: 16,
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 14,
      shadowColor: c.shadow,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 4,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    sectionHint: { fontSize: 12, color: c.textTertiary, marginTop: -8, marginBottom: 12 },
    tagsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.primary08,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      gap: 6,
    },
    tagText: { fontSize: 13, fontWeight: '600', color: c.primary },
    tagRemove: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: c.surfaceHover,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addRow: { flexDirection: 'row', gap: 8 },
    addInputWrap: {
      flex: 1,
      backgroundColor: c.bgInput,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    addInput: { fontSize: 14, color: c.text },
    promptWrap: {
      backgroundColor: c.bgInput,
      borderRadius: 14,
      padding: 12,
    },
    promptInput: {
      fontSize: 14,
      color: c.text,
      lineHeight: 20,
      minHeight: 100,
    },
    promptVarsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
    },
    varChip: {
      backgroundColor: c.primary08,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    varChipText: { fontSize: 12, color: c.primary, fontWeight: '600' },
    addBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addBtnDisabled: { backgroundColor: c.border },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    settingLabel: { fontSize: 14, color: c.textSecondary },
    settingValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    settingValue: { fontSize: 14, fontWeight: '600', color: c.text },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: c.bgInput,
      borderRadius: 14,
      padding: 3,
      gap: 2,
    },
    segOption: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 12,
    },
    segOptionActive: {
      backgroundColor: c.bgInputAlt,
      shadowColor: c.shadow,
      shadowOffset: { width: 1, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 2,
    },
    segText: { fontSize: 13, fontWeight: '600', color: c.textTertiary },
    segTextActive: { color: c.primary },
    picker: {
      marginTop: 4,
      backgroundColor: c.bgInput,
      borderRadius: 14,
      padding: 6,
    },
    pickerOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    pickerOptionActive: { backgroundColor: c.primary08 },
    pickerText: { fontSize: 14, color: c.textSecondary },
    pickerTextActive: { color: c.primary, fontWeight: '600' },
    saveBtn: {
      flexDirection: 'row',
      marginHorizontal: 16,
      backgroundColor: c.primary,
      borderRadius: 20,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    saveBtnText: { fontSize: 16, fontWeight: '700', color: c.textOnPrimary },
  }));

  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [summaryLen, setSummaryLen] = useState<'short' | 'medium' | 'full'>('medium');
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [highlightKeywords, setHighlightKeywords] = useState(true);
  const [analysisPrompt, setAnalysisPrompt] = useState(
    '請以銷售助理的角度分析這則新聞對我客戶的潛在影響，並提供三個具體的跟進建議。',
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // 載入既有訂閱設定
  const loadSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getNewsSubscription();
      if (data) {
        if (Array.isArray(data.topics)) setTopics(data.topics);
        if (['short', 'medium', 'full'].includes(data.summaryLen)) setSummaryLen(data.summaryLen);
        if (typeof data.autoSummarize === 'boolean') setAutoSummarize(data.autoSummarize);
        if (typeof data.highlightKeywords === 'boolean') setHighlightKeywords(data.highlightKeywords);
        if (typeof data.analysisPrompt === 'string' && data.analysisPrompt.trim()) setAnalysisPrompt(data.analysisPrompt);
      }
    } catch (e) {
      console.error('Failed to load news subscription:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const addTopic = () => {
    const t = newTopic.trim();
    if (t && !topics.includes(t)) {
      setTopics([...topics, t]);
      setNewTopic('');
    }
  };

  const removeTopic = (topic: string) => {
    setTopics(topics.filter((t) => t !== topic));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveNewsSubscription({
        topics,
        summaryLen,
        autoSummarize,
        highlightKeywords,
        analysisPrompt,
      });
      setSaveMsg('已儲存');
    } catch (e) {
      setSaveMsg('儲存失敗，請重試');
      console.error('Failed to save news subscription:', e);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 2000);
    }
  };

  if (loading) {
    return (
      <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="chevron-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>新聞追蹤設置</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="heart" size={16} color={colors.danger} />
            <Text style={styles.sectionTitle}>關心主題</Text>
          </View>
          <View style={styles.tagsWrap}>
            {topics.map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
                <TouchableOpacity onPress={() => removeTopic(t)} style={styles.tagRemove}>
                  <FontAwesome6 name="xmark" size={10} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={styles.addRow}>
            <View style={styles.addInputWrap}>
              <TextInput
                style={styles.addInput}
                placeholder="新增主題…"
                placeholderTextColor={colors.textTertiary}
                value={newTopic}
                onChangeText={setNewTopic}
                onSubmitEditing={addTopic}
                returnKeyType="done"
              />
            </View>
            <TouchableOpacity
              style={[styles.addBtn, !newTopic.trim() && styles.addBtnDisabled]}
              onPress={addTopic}
              disabled={!newTopic.trim()}
            >
              <FontAwesome6 name="plus" size={12} color={colors.textOnPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="align-left" size={16} color={colors.sky} />
            <Text style={styles.sectionTitle}>摘要重點</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>自動摘要</Text>
            <Switch
              value={autoSummarize}
              onValueChange={setAutoSummarize}
              trackColor={{ false: colors.bgInput, true: colors.primary30 }}
              thumbColor={autoSummarize ? colors.primary : colors.border}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>關鍵字高亮</Text>
            <Switch
              value={highlightKeywords}
              onValueChange={setHighlightKeywords}
              trackColor={{ false: colors.bgInput, true: colors.primary30 }}
              thumbColor={highlightKeywords ? colors.primary : colors.border}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>摘要長度</Text>
            <View style={styles.segmentedControl}>
              {(['short', 'medium', 'full'] as const).map((len) => (
                <TouchableOpacity
                  key={len}
                  style={[styles.segOption, summaryLen === len && styles.segOptionActive]}
                  onPress={() => setSummaryLen(len)}
                >
                  <Text style={[styles.segText, summaryLen === len && styles.segTextActive]}>
                    {len === 'short' ? '簡短' : len === 'medium' ? '中等' : '完整'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 分析 Prompt */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="wand-magic-sparkles" size={16} color={colors.info} />
            <Text style={styles.sectionTitle}>分析 Prompt</Text>
          </View>
          <Text style={styles.sectionHint}>
            自訂 AI 分析新聞時的指示，可使用 {'{標題}'} {'{摘要}'} {'{主題}'} 等變數
          </Text>
          <View style={styles.promptWrap}>
            <TextInput
              style={styles.promptInput}
              value={analysisPrompt}
              onChangeText={setAnalysisPrompt}
              placeholder="例：請以銷售助理角度分析…"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.promptVarsRow}>
            {['{標題}', '{摘要}', '{主題}', '{來源}'].map((v) => (
              <TouchableOpacity
                key={v}
                style={styles.varChip}
                onPress={() => setAnalysisPrompt((p) => `${p}${v}`)}
              >
                <Text style={styles.varChipText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <FontAwesome6 name="floppy-disk" size={16} color={colors.textOnPrimary} />
          <Text style={styles.saveBtnText}>{saving ? '儲存中…' : saveMsg ?? '儲存設定'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}
