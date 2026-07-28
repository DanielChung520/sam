import { useMemo } from 'react';
import { StyleSheet, type ViewStyle, type TextStyle, type ImageStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { ColorTokens } from '@/theme/colors';

type NamedStyle<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

type ThemedStyles<T extends NamedStyle<T>> = (colors: ColorTokens) => T;

export function useThemedStyles<T extends NamedStyle<T>>(makeStyles: ThemedStyles<T>): T {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(makeStyles(colors)), [colors, makeStyles]);
}
