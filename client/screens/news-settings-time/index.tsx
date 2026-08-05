import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { getNewsSubscription, saveNewsSubscription } from '@/utils/api';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function NewsSettingsTimeScreen() {
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
      backgroundColor: c.accent08,
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
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    settingLabel: { fontSize: 14, color: c.textSecondary },
    settingValue: { fontSize: 14, fontWeight: '600', color: c.text },
    counter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    counterBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    counterBtnDisabled: { opacity: 0.4 },
    counterValue: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
      minWidth: 24,
      textAlign: 'center',
    },
    counterUnit: { fontSize: 13, color: c.textSecondary, marginLeft: -4 },
    intervalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: c.bgInput,
      borderRadius: 14,
      marginTop: 10,
    },
    intervalInput: {
      flex: 1,
      fontSize: 15,
      color: c.text,
      padding: 0,
    },
    intervalUnit: { fontSize: 13, color: c.textSecondary },
    weekdayRow: {
      flexDirection: 'row',
      gap: 6,
    },
    weekdayBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.bgInput,
      alignItems: 'center',
    },
    weekdayBtnActive: {
      backgroundColor: c.primary,
    },
    weekdayText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    weekdayTextActive: { color: c.textOnPrimary },
    timezoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tzBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tzInput: {
      flex: 1,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.bgInput,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
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

  // 排程類型
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly'>('daily');
  // 每日次數（1-24）
  const [timesPerDay, setTimesPerDay] = useState(1);
  // 每日首次抓取時刻（0-23，local）
  const [startHour, setStartHour] = useState(8);
  // 間隔（小時，僅 timesPerDay > 1 時啟用）
  const [intervalHours, setIntervalHours] = useState('4');
  // 每週選項（0=日, 1=一, ..., 6=六）
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  // 時區
  const [followSystem, setFollowSystem] = useState(true);
  const [tzOffset, setTzOffset] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // 載入既有排程設定
  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getNewsSubscription();
      if (data?.schedule) {
        const s = data.schedule;
        if (s.type === 'daily' || s.type === 'weekly') setScheduleType(s.type);
        if (s.timesPerDay >= 1 && s.timesPerDay <= 24) setTimesPerDay(s.timesPerDay);
        if (s.startHour >= 0 && s.startHour <= 23) setStartHour(s.startHour);
        if (s.intervalHours > 0) setIntervalHours(String(s.intervalHours));
        if (Array.isArray(s.days)) setSelectedDays(s.days);
        if (typeof s.followSystem === 'boolean') setFollowSystem(s.followSystem);
        if (typeof s.tzOffset === 'number') setTzOffset(String(s.tzOffset));
      }
    } catch (e) {
      console.error('Failed to load news schedule:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const toggleDay = (d: number) => {
    setSelectedDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveNewsSubscription({
        schedule: {
          type: scheduleType,
          timesPerDay,
          startHour,
          intervalHours: Math.max(parseInt(intervalHours || '4', 10) || 4, 1),
          days: scheduleType === 'weekly' ? selectedDays : [1, 2, 3, 4, 5],
          followSystem,
          tzOffset: followSystem ? 0 : parseInt(tzOffset || '0', 10) || 0,
        },
      });
      setSaveMsg('已儲存');
    } catch (e) {
      setSaveMsg('儲存失敗，請重試');
      console.error('Failed to save news schedule:', e);
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
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="chevron-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>時間設置</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* 排程類型 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="clock" size={16} color={colors.accent} />
            <Text style={styles.sectionTitle}>排程類型</Text>
          </View>
          <View style={styles.weekdayRow}>
            {(['daily', 'weekly'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.weekdayBtn, scheduleType === t && styles.weekdayBtnActive]}
                onPress={() => setScheduleType(t)}
              >
                <Text style={[styles.weekdayText, scheduleType === t && styles.weekdayTextActive]}>
                  {t === 'daily' ? '每日' : '每週'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 每日次數 */}
        {scheduleType === 'daily' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FontAwesome6 name="rotate" size={16} color={colors.info} />
              <Text style={styles.sectionTitle}>每日抓取次數</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>次數</Text>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={[styles.counterBtn, timesPerDay <= 1 && styles.counterBtnDisabled]}
                  onPress={() => timesPerDay > 1 && setTimesPerDay(timesPerDay - 1)}
                  disabled={timesPerDay <= 1}
                >
                  <FontAwesome6 name="minus" size={12} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{timesPerDay}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => timesPerDay < 24 && setTimesPerDay(timesPerDay + 1)}
                >
                  <FontAwesome6 name="plus" size={12} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.counterUnit}>次/日</Text>
              </View>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>每日首次時間</Text>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={[styles.counterBtn, startHour <= 0 && styles.counterBtnDisabled]}
                  onPress={() => startHour > 0 && setStartHour(startHour - 1)}
                  disabled={startHour <= 0}
                >
                  <FontAwesome6 name="minus" size={12} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{startHour}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => startHour < 23 && setStartHour(startHour + 1)}
                >
                  <FontAwesome6 name="plus" size={12} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.counterUnit}>時</Text>
              </View>
            </View>
            {timesPerDay > 1 && (
              <>
                <View style={styles.intervalRow}>
                  <Text style={styles.intervalUnit}>間隔</Text>
                  <TextInput
                    style={styles.intervalInput}
                    keyboardType="number-pad"
                    value={intervalHours}
                    onChangeText={setIntervalHours}
                    placeholder="4"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Text style={styles.intervalUnit}>小時（從每日首次開始計算）</Text>
                </View>
                <Text style={styles.sectionHint}>
                  每日 {startHour} 時首次抓取，之後每隔 {intervalHours || '?'} 小時自動重抓
                </Text>
              </>
            )}
            {timesPerDay === 1 && (
              <Text style={styles.sectionHint}>每天 {startHour} 時固定抓取一次</Text>
            )}
          </View>
        )}

        {/* 每週選項 */}
        {scheduleType === 'weekly' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FontAwesome6 name="calendar-week" size={16} color={colors.sky} />
              <Text style={styles.sectionTitle}>每週抓取日</Text>
            </View>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((label, idx) => {
                const active = selectedDays.includes(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.weekdayBtn, active && styles.weekdayBtnActive]}
                    onPress={() => toggleDay(idx)}
                  >
                    <Text style={[styles.weekdayText, active && styles.weekdayTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.sectionHint}>已選 {selectedDays.length} 天</Text>
          </View>
        )}

        {/* 時區 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="globe" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>時區</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>跟隨系統</Text>
            <TouchableOpacity
              style={[styles.counterBtn, followSystem && styles.weekdayBtnActive]}
              onPress={() => setFollowSystem(!followSystem)}
            >
              {followSystem && <FontAwesome6 name="check" size={12} color={colors.textOnPrimary} />}
            </TouchableOpacity>
          </View>
          {!followSystem && (
            <View style={styles.timezoneRow}>
              <TouchableOpacity
                style={styles.tzBtn}
                onPress={() => setTzOffset(String(parseInt(tzOffset || '0', 10) - 1))}
              >
                <FontAwesome6 name="minus" size={12} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.tzInput}>
                <Text style={styles.settingValue}>UTC {parseInt(tzOffset || '0', 10) >= 0 ? '+' : ''}{tzOffset || '0'}</Text>
              </View>
              <TouchableOpacity
                style={styles.tzBtn}
                onPress={() => setTzOffset(String(parseInt(tzOffset || '0', 10) + 1))}
              >
                <FontAwesome6 name="plus" size={12} color={colors.text} />
              </TouchableOpacity>
            </View>
          )}
          {followSystem && (
            <Text style={styles.sectionHint}>將使用設備當前時區</Text>
          )}
        </View>

        {/* 儲存按鈕 */}
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
