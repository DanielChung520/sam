import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';

const SYNC_STEPS = [
  { icon: 'link', label: '連接 LINE 伺服器' },
  { icon: 'user-group', label: '抓取好友列表' },
  { icon: 'arrows-rotate', label: '同步 CRM 標籤' },
  { icon: 'check', label: '完成' },
];

export default function SyncFriendsScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [progress, setProgress] = useState(0);

  const styles = useThemedStyles((c) => ({
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 16,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.info08,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: { fontSize: 22, fontWeight: '600', color: c.text, letterSpacing: 0.2 },
    spinnerWrap: {
      alignItems: 'center',
      marginBottom: 32,
    },
    spinner: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.primary08,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: { fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 8 },
    subtitle: { fontSize: 14, color: c.textSecondary, marginBottom: 32, textAlign: 'center' },
    progressBar: {
      width: '100%',
      height: 6,
      backgroundColor: c.bgInput,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 32,
    },
    progressFill: { height: '100%', backgroundColor: c.primary, borderRadius: 3 },
    steps: { width: '100%', gap: 12 },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      backgroundColor: c.surface,
      borderRadius: 14,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 1,
    },
    stepActive: { backgroundColor: c.primary08 },
    stepDone: { opacity: 0.6 },
    stepIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepIconActive: { backgroundColor: c.primary },
    stepIconDone: { backgroundColor: c.primary },
    stepText: { fontSize: 14, color: c.textSecondary, fontWeight: '500' },
    stepTextActive: { color: c.text, fontWeight: '600' },
    completeWrap: { alignItems: 'center', gap: 12 },
    completeIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    completeTitle: { fontSize: 20, fontWeight: '700', color: c.text },
    completeSub: { fontSize: 14, color: c.textSecondary },
    completeBtn: {
      marginTop: 24,
      backgroundColor: c.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 20,
    },
    completeBtnText: { fontSize: 15, fontWeight: '700', color: c.textOnPrimary },
  }));

  useEffect(() => {
    const totalMs = 3000;
    const tickMs = 60;
    const totalTicks = Math.ceil(totalMs / tickMs);
    const stepTicks = Math.floor(totalTicks / SYNC_STEPS.length);
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      setProgress(Math.min(t / totalTicks, 1));
      if (t >= totalTicks) clearInterval(id);
    }, tickMs);
    return () => clearInterval(id);
  }, []);

  const currentStep = Math.min(
    Math.floor(progress * SYNC_STEPS.length),
    SYNC_STEPS.length - 1,
  );
  const isDone = progress >= 1;

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>同步好友</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        {!isDone ? (
          <>
            <View style={styles.spinnerWrap}>
              <View style={styles.spinner}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            </View>
            <Text style={styles.title}>正在同步好友…</Text>
            <Text style={styles.subtitle}>
              從 LINE 抓取好友資料並比對 CRM 標籤{'\n'}請稍候，預計 3 秒
            </Text>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>

            <View style={styles.steps}>
              {SYNC_STEPS.map((s, i) => {
                const isActive = i === currentStep;
                const isCompleted = i < currentStep;
                return (
                  <View
                    key={i}
                    style={[
                      styles.step,
                      isActive && styles.stepActive,
                      isCompleted && styles.stepDone,
                    ]}
                  >
                    <View
                      style={[
                        styles.stepIcon,
                        (isActive || isCompleted) && styles.stepIconActive,
                      ]}
                    >
                      {isCompleted ? (
                        <FontAwesome6 name="check" size={14} color={colors.textOnPrimary} />
                      ) : (
                        <FontAwesome6
                          name={s.icon as any}
                          size={14}
                          color={isActive ? colors.textOnPrimary : colors.textSecondary}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepText,
                        (isActive || isCompleted) && styles.stepTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                    {isActive && (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.completeWrap}>
            <View style={styles.completeIcon}>
              <FontAwesome6 name="check" size={40} color={colors.textOnPrimary} />
            </View>
            <Text style={styles.completeTitle}>同步完成</Text>
            <Text style={styles.completeSub}>共更新 6 位好友的 CRM 標籤</Text>
            <TouchableOpacity style={styles.completeBtn} onPress={() => router.back()}>
              <Text style={styles.completeBtnText}>完成</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Screen>
  );
}
