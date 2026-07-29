import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const SIZE = 32;

export default function AccountAvatar() {
  const { user } = useAuth();
  const { colors } = useTheme();

  const initial = user?.name?.charAt(0)?.toUpperCase();

  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.wrapper}>
      {user?.avatar ? (
        <Image source={{ uri: user.avatar }} style={[styles.avatar, { backgroundColor: colors.bgInput }]} />
      ) : initial ? (
        <View style={[styles.avatar, styles.fallback, { backgroundColor: colors.primary }]}>
          <Text style={[styles.initial, { color: colors.textOnPrimary }]}>{initial}</Text>
        </View>
      ) : (
        <View style={[styles.avatar, styles.fallback, { backgroundColor: colors.bgInput }]}>
          <FontAwesome6 name="user" size={16} color={colors.textTertiary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginRight: 10,
  },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontSize: 14,
    fontWeight: '700',
  },
});
