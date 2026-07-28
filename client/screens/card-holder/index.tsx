import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';

interface CardSpec {
  id: number;
  name: string;
  company: string;
  title: string;
  phone: string;
  email: string;
  address: string;
  bg: string;
  accent: string;
  initials: string;
}

// 幾個示範名片規格
const CARD_SPECS: CardSpec[] = [
  {
    id: 1,
    name: '王小明',
    company: '創新科技股份有限公司',
    title: '技術長',
    phone: '0912-345-678',
    email: 'ming@innotech.com',
    address: '台北市信義區松仁路 100 號',
    bg: '#0F172A',
    accent: '#10B981',
    initials: '明',
  },
  {
    id: 2,
    name: 'Lisa Chen',
    company: 'Design Studio',
    title: 'Creative Director',
    phone: '0923-456-789',
    email: 'lisa@design.co',
    address: 'Taipei · Taiwan',
    bg: '#FDF2E9',
    accent: '#F97316',
    initials: 'L',
  },
  {
    id: 3,
    name: '陳大華',
    company: '全球貿易集團',
    title: '業務總監',
    phone: '0934-567-890',
    email: 'ta.chen@global.tw',
    address: '高雄市前鎮區中華五路 789 號',
    bg: '#FFFFFF',
    accent: '#6366F1',
    initials: '華',
  },
  {
    id: 4,
    name: 'Sarah Wang',
    company: 'AICONN',
    title: 'AI Solutions Architect',
    phone: '0945-678-901',
    email: 'sarah@aiconn.ai',
    address: 'la.aiconn.ai',
    bg: '#059669',
    accent: '#FFFFFF',
    initials: 'SW',
  },
];

// 已收錄名片
const SAVED_CARDS: CardSpec[] = [
  {
    id: 101,
    name: '張三',
    company: '某某科技股份公司',
    title: '業務經理',
    phone: '0912-345-678',
    email: 'jack@example.com',
    address: '台北市大安區',
    bg: '#FFFFFF',
    accent: '#059669',
    initials: '張',
  },
  {
    id: 102,
    name: '李四',
    company: '創新數位有限公司',
    title: '採購專員',
    phone: '0923-456-789',
    email: 'lee@innodigi.com',
    address: '新北市板橋區',
    bg: '#FFFFFF',
    accent: '#F97316',
    initials: '李',
  },
];

function CardPreview({ card, width = 280 }: { card: CardSpec; width?: number }) {
  const { colors } = useTheme();
  const isLight = card.bg !== '#0F172A' && card.bg !== '#059669';
  const textColor = isLight ? '#1E293B' : '#FFFFFF';
  const subTextColor = isLight ? '#64748B' : 'rgba(255,255,255,0.75)';
  return (
    <View
      style={{
        width,
        height: 160,
        backgroundColor: card.bg,
        borderRadius: 16,
        padding: 18,
        marginRight: 12,
        shadowColor: card.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: card.accent,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '800', color: card.bg === card.accent ? '#FFF' : card.accent }}>
            {card.initials}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              backgroundColor: card.accent,
              opacity: 0.8,
            }}
          />
          <Text
            style={{
              fontSize: 9,
              fontWeight: '600',
              color: subTextColor,
              marginTop: 2,
              letterSpacing: 1,
            }}
          >
            BUSINESS CARD
          </Text>
        </View>
      </View>
      <View>
        <Text style={{ fontSize: 18, fontWeight: '800', color: textColor }}>{card.name}</Text>
        <Text style={{ fontSize: 11, color: subTextColor, marginTop: 1 }}>{card.title}</Text>
        <Text style={{ fontSize: 11, color: subTextColor, marginTop: 6, fontWeight: '600' }}>
          {card.company}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            marginTop: 8,
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 10, color: subTextColor }}>{card.phone}</Text>
          <Text style={{ fontSize: 10, color: subTextColor }}>{card.email}</Text>
        </View>
      </View>
    </View>
  );
}

export default function CardHolderScreen() {
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
    scanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 6,
    },
    scanBtnText: { fontSize: 13, fontWeight: '700', color: c.textOnPrimary },
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
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    sectionHint: { fontSize: 12, color: c.textTertiary, marginBottom: 12 },
    carousel: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    savedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      backgroundColor: c.surface,
      borderRadius: 16,
      marginBottom: 10,
      shadowColor: c.shadow,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    savedAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    savedAvatarText: { fontSize: 18, fontWeight: '800' },
    savedInfo: { flex: 1, marginLeft: 12 },
    savedName: { fontSize: 15, fontWeight: '700', color: c.text },
    savedMeta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    savedPhone: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  }));

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="chevron-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>名片夾</Text>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => router.push('/scan')}
          >
            <FontAwesome6 name="camera" size={14} color={colors.textOnPrimary} />
            <Text style={styles.scanBtnText}>掃描名片</Text>
          </TouchableOpacity>
        </View>

        {/* 名片規格預覽 */}
        <View>
          <View style={[styles.sectionHeader, { paddingHorizontal: 16 }]}>
            <Text style={styles.sectionTitle}>名片規格</Text>
            <Text style={styles.sectionHint}>左右滑動查看範本</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {CARD_SPECS.map((card) => (
              <CardPreview key={card.id} card={card} />
            ))}
          </ScrollView>
        </View>

        {/* 已收錄名片 */}
        <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>已收錄名片</Text>
            <Text style={styles.sectionHint}>{SAVED_CARDS.length} 張</Text>
          </View>
          {SAVED_CARDS.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={styles.savedCard}
              onPress={() => router.push('/friend-detail', { contactId: 1 })}
              activeOpacity={0.7}
            >
              <View style={[styles.savedAvatar, { backgroundColor: card.accent + '20' }]}>
                <Text style={[styles.savedAvatarText, { color: card.accent }]}>
                  {card.initials}
                </Text>
              </View>
              <View style={styles.savedInfo}>
                <Text style={styles.savedName}>{card.name}</Text>
                <Text style={styles.savedMeta}>
                  {card.title} · {card.company}
                </Text>
                <Text style={styles.savedPhone}>{card.phone}</Text>
              </View>
              <FontAwesome6 name="chevron-right" size={14} color={colors.border} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
