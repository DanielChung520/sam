import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';

type ReplyMode = 'semi' | 'full' | 'offline_only';

const MODE_LABELS: Record<ReplyMode, string> = {
  semi: '半自動 · 需審核',
  full: '全自動 · 高信任',
  offline_only: '僅離線 · AI 代回',
};

export default function SettingsScreen() {
  const [replyMode, setReplyMode] = useState<ReplyMode>('semi');
  const [showModePicker, setShowModePicker] = useState(false);
  const { themeMode, setThemeMode } = useTheme();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [personaStyle, setPersonaStyle] = useState('習慣用繁體、加「辛苦了」、常用貼圖、對長輩用敬語');
  const [providerKey] = useState('sk-sam-••••7890');
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
      backgroundColor: c.primary08,
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
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    settingLabel: { fontSize: 14, color: c.textSecondary },
    settingValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    settingValue: { fontSize: 14, fontWeight: '600', color: c.text },
    changeText: { fontSize: 13, fontWeight: '600', color: c.primary },
    modePicker: {
      marginTop: 8,
      backgroundColor: c.bgInput,
      borderRadius: 16,
      padding: 8,
    },
    modeOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
    },
    modeOptionActive: { backgroundColor: c.primary08 },
    modeOptionText: { fontSize: 14, color: c.textSecondary },
    modeOptionTextActive: { color: c.primary, fontWeight: '600' },
    styleText: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 19,
      flex: 1,
    },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    editBtnText: { fontSize: 13, fontWeight: '600', color: c.primary },
    keyText: {
      fontSize: 14,
      color: c.text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    tokenValue: { fontSize: 20, fontWeight: '800', color: c.gold },
    tokenActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    tokenActionBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: c.bgInput,
    },
    tokenActionBtnPrimary: { backgroundColor: c.primary },
    tokenActionText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    tokenActionTextPrimary: { fontSize: 13, fontWeight: '700', color: c.textOnPrimary },
  }));

  const themeLabel = themeMode === 'light' ? '淺色' : themeMode === 'dark' ? '深色' : '跟隨系統';

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="chevron-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>設定</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Theme */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="circle-half-stroke" size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>主題</Text>
          </View>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowThemePicker(!showThemePicker)}
          >
            <Text style={styles.settingLabel}>目前主題</Text>
            <View style={styles.settingValueRow}>
              <Text style={styles.settingValue}>{themeLabel}</Text>
              <Text style={styles.changeText}>變更</Text>
            </View>
          </TouchableOpacity>
          {showThemePicker && (
            <View style={styles.modePicker}>
              {([
                { value: 'system', label: '跟隨系統', icon: 'mobile-screen-button' },
                { value: 'light', label: '淺色', icon: 'sun' },
                { value: 'dark', label: '深色', icon: 'moon' },
              ] as const).map(({ value, label, icon }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.modeOption, themeMode === value && styles.modeOptionActive]}
                  onPress={() => {
                    setThemeMode(value as ThemeMode);
                    setShowThemePicker(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <FontAwesome6 name={icon} size={14} color={themeMode === value ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.modeOptionText, themeMode === value && styles.modeOptionTextActive]}>
                      {label}
                    </Text>
                  </View>
                  {themeMode === value && <FontAwesome6 name="check" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* AI Reply Mode */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="robot" size={16} color={colors.info} />
            <Text style={styles.sectionTitle}>AI 回覆模式</Text>
          </View>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowModePicker(!showModePicker)}
          >
            <Text style={styles.settingLabel}>目前模式</Text>
            <View style={styles.settingValueRow}>
              <Text style={styles.settingValue}>{MODE_LABELS[replyMode]}</Text>
              <Text style={styles.changeText}>變更</Text>
            </View>
          </TouchableOpacity>
          {showModePicker && (
            <View style={styles.modePicker}>
              {(Object.keys(MODE_LABELS) as ReplyMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modeOption, replyMode === mode && styles.modeOptionActive]}
                  onPress={() => {
                    setReplyMode(mode);
                    setShowModePicker(false);
                  }}
                >
                  <Text style={[styles.modeOptionText, replyMode === mode && styles.modeOptionTextActive]}>
                    {MODE_LABELS[mode]}
                  </Text>
                  {replyMode === mode && <FontAwesome6 name="check" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Personal Style */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="palette" size={16} color={colors.accent} />
            <Text style={styles.sectionTitle}>個人對話風格</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.styleText}>{personaStyle}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <FontAwesome6 name="pen" size={12} color={colors.primary} />
            <Text style={styles.editBtnText}>編輯</Text>
          </TouchableOpacity>
        </View>

        {/* Provider Key */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="key" size={16} color={colors.danger} />
            <Text style={styles.sectionTitle}>Provider Key</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.keyText}>{providerKey}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <FontAwesome6 name="rotate" size={12} color={colors.primary} />
            <Text style={styles.editBtnText}>更換金鑰</Text>
          </TouchableOpacity>
        </View>

        {/* Token Usage */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="coins" size={16} color={colors.gold} />
            <Text style={styles.sectionTitle}>Token 用量</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>本月已用</Text>
            <Text style={styles.tokenValue}>NT$ 847</Text>
          </View>
          <View style={styles.tokenActions}>
            <TouchableOpacity style={styles.tokenActionBtn}>
              <Text style={styles.tokenActionText}>查看明細</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tokenActionBtn, styles.tokenActionBtnPrimary]}>
              <Text style={styles.tokenActionTextPrimary}>儲值</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
