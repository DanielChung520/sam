import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { useEffect, useMemo } from 'react';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const styles = useThemedStyles((c) => ({
    tabBar: {
      backgroundColor: c.tabBarBg,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      borderTopWidth: 0,
      paddingTop: 12,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 8,
    },
  }));

  const tabBarStyle = useMemo(() => {
    const style: Record<string, unknown> = {
      ...styles.tabBar,
      paddingBottom: insets.bottom + 8,
    };
    if (Platform.OS === 'web') {
      style.height = 'auto';
    }
    return style;
  }, [styles.tabBar, insets.bottom]);

  // Imperatively update tab bar style when theme changes
  useEffect(() => {
    navigation.setOptions?.({
      tabBarStyle,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.tabBarInactive,
    });
  }, [navigation, tabBarStyle, colors.primary, colors.tabBarInactive]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="news"
        options={{
          title: '新聞',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <FontAwesome6 name="newspaper" size={20} color={color} />
              {focused && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: '好友',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <FontAwesome6 name="user-group" size={20} color={color} />
              {focused && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '聊天',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconWrap,
                styles.iconWrapChat,
                focused && { backgroundColor: colors.tabActiveBg },
              ]}
            >
              <FontAwesome6
                name="comment-dots"
                size={focused ? 26 : 20}
                color={focused ? colors.textOnPrimary : color}
              />
              {focused && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="broadcast"
        options={{
          title: '發送',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <FontAwesome6 name="paper-plane" size={20} color={color} />
              {focused && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="workspace"
        options={{
          title: '工作區',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <FontAwesome6 name="gear" size={20} color={color} />
              {focused && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  iconWrapChat: {
    width: 48,
    height: 48,
    borderRadius: 20,
  },
});
