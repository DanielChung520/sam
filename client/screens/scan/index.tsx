import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';

const SCAN_RESULTS = [
  { id: 1, name: '林志玲', title: '模特兒', avatar: 'https://i.pravatar.cc/100?img=1' },
  { id: 2, name: '五月天阿信', title: '主唱', avatar: 'https://i.pravatar.cc/100?img=15' },
];

const FLASH_MODES = ['auto', 'on', 'off'] as const;
type FlashMode = (typeof FLASH_MODES)[number];

export default function ScanScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [scanLineY, setScanLineY] = useState(0);
  const [flashMode, setFlashMode] = useState<FlashMode>('auto');
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<typeof SCAN_RESULTS[number] | null>(null);

  const styles = useThemedStyles((c) => ({
    content: { flex: 1, backgroundColor: '#000' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: { fontSize: 16, fontWeight: '600', color: '#FFF' },
    headerSpacer: { width: 36 },
    viewfinderWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mask: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    cutout: {
      width: 260,
      height: 260,
      backgroundColor: 'transparent',
    },
    corner: {
      position: 'absolute',
      width: 32,
      height: 32,
      borderColor: '#10B981',
    },
    cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 4 },
    cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 4 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 4 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 4 },
    scanLine: {
      position: 'absolute',
      left: 8,
      right: 8,
      height: 2,
      backgroundColor: '#10B981',
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 8,
    },
    hint: {
      position: 'absolute',
      bottom: 80,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    hintText: { fontSize: 14, color: '#FFF', fontWeight: '500' },
    hintSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingTop: 16,
      paddingBottom: 24,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    bottomBtn: {
      alignItems: 'center',
      gap: 4,
    },
    bottomBtnLabel: { fontSize: 11, color: '#FFF', fontWeight: '500' },
    bottomBtnLabelDim: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
    resultPanel: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    resultAvatar: { width: 56, height: 56, borderRadius: 28 },
    resultInfo: { flex: 1 },
    resultName: { fontSize: 17, fontWeight: '700', color: c.text },
    resultMeta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    addBtn: {
      backgroundColor: c.primary,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 16,
    },
    addBtnText: { fontSize: 14, fontWeight: '700', color: c.textOnPrimary },
  }));

  // Animated scan line
  useEffect(() => {
    if (!scanning) return;
    let dir = 1;
    let y = 0;
    const id = setInterval(() => {
      y += 3 * dir;
      if (y >= 256) dir = -1;
      if (y <= 0) dir = 1;
      setScanLineY(y);
    }, 16);
    return () => clearInterval(id);
  }, [scanning]);

  // Simulate scan success after 3 seconds
  useEffect(() => {
    const id = setTimeout(() => {
      setScanning(false);
      setResult(SCAN_RESULTS[0]);
    }, 3000);
    return () => clearTimeout(id);
  }, []);

  const cycleFlash = () => {
    const idx = FLASH_MODES.indexOf(flashMode);
    setFlashMode(FLASH_MODES[(idx + 1) % FLASH_MODES.length]);
  };

  return (
    <Screen backgroundColor="#000" safeAreaEdges={['top', 'left', 'right']}>
      <View style={styles.content}>
        {/* Camera mock — black bg with viewfinder */}
        <View style={styles.viewfinderWrap}>
          <View style={[styles.mask, { backgroundColor: result ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)' }]} />
          <View style={styles.cutout}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {scanning && <View style={[styles.scanLine, { top: scanLineY }]} />}
          </View>
        </View>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <FontAwesome6 name="xmark" size={18} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>掃一掃</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Hint */}
        {scanning && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>將條碼對準框內</Text>
            <Text style={styles.hintSub}>自動辨識中…</Text>
          </View>
        )}

        {/* Result panel */}
        {result && (
          <View style={styles.resultPanel}>
            <Image source={{ uri: result.avatar }} style={styles.resultAvatar} />
            <View style={styles.resultInfo}>
              <Text style={styles.resultName}>{result.name}</Text>
              <Text style={styles.resultMeta}>{result.title}</Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => router.push('/friend-detail', { contactId: 1 })}
            >
              <Text style={styles.addBtnText}>加入</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom bar */}
        {!result && (
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.bottomBtn} onPress={cycleFlash}>
              <FontAwesome6
                name={flashMode === 'on' ? 'bolt' : flashMode === 'off' ? 'bolt-slash' : 'bolt-lightning'}
                size={20}
                color={flashMode === 'auto' ? '#FFF' : flashMode === 'on' ? '#FBBF24' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={flashMode === 'auto' ? styles.bottomBtnLabel : styles.bottomBtnLabelDim}>
                {flashMode === 'auto' ? '自動' : flashMode === 'on' ? '開啟' : '關閉'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomBtn}
              onPress={() => router.push('/card-holder')}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  borderWidth: 3,
                  borderColor: '#FFF',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: '#FFF',
                  }}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomBtn}>
              <FontAwesome6 name="images" size={20} color="#FFF" />
              <Text style={styles.bottomBtnLabel}>相簿</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Screen>
  );
}
