import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

type USBStatus = 'connected' | 'disconnected' | 'connecting';

interface Props {
  status: USBStatus;
}

const statusConfig: Record<USBStatus, { icon: string; label: string; color: string; bg: string }> = {
  connected: { icon: 'circle-check', label: 'USB 已連接 \u00B7 地端保護模式', color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  disconnected: { icon: 'circle-xmark', label: 'USB 已拔除 \u00B7 資料雲端零留存', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  connecting: { icon: 'spinner', label: 'USB 連線中\u22EF', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
};

export function USBStatusBadge({ status }: Props) {
  const config = statusConfig[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <FontAwesome6 name={config.icon as any} size={10} color={config.color} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
