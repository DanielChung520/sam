import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

interface Props {
  score: number;
}

function getBadge(score: number): { icon: string; label: string; color: string; bg: string } {
  if (score >= 80) return { icon: 'HH', label: '高熱度', color: '#EF4444', bg: 'rgba(239,68,68,0.10)' };
  if (score >= 50) return { icon: 'H', label: '中等', color: '#F97316', bg: 'rgba(249,115,22,0.10)' };
  if (score >= 10) return { icon: 'L', label: '低', color: '#059669', bg: 'rgba(5,150,105,0.10)' };
  return { icon: 'Z', label: '沉睡', color: '#94A3B8', bg: 'rgba(148,163,184,0.10)' };
}

export function ScoreBadge({ score }: Props) {
  const badge = getBadge(score);
  return (
    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
      <FontAwesome6
        name={score >= 80 ? 'fire-flame-curved' : score >= 50 ? 'fire' : score >= 10 ? 'seedling' : 'moon'}
        size={10}
        color={badge.color}
      />
      <Text style={[styles.score, { color: badge.color }]}>{score}</Text>
      <Text style={[styles.label, { color: badge.color }]}>{badge.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  score: {
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});
