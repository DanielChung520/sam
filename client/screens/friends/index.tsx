import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import AccountAvatar from '@/components/shared/AccountAvatar';
import { USBStatusBadge } from '@/components/shared/USBStatusBadge';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { FontAwesome6 } from '@expo/vector-icons';
import { getContacts } from '@/utils/mockApi';

interface Contact {
  id: number;
  name: string;
  company: string;
  title: string;
  score: number;
  tags: string[];
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
}

const TAG_OPTIONS = ['全部', 'VIP', '高意向', '決策者', '沉睡'];

export default function FriendsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const router = useSafeRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      paddingTop: 16,
      paddingHorizontal: 20,
      paddingBottom: 12,
      backgroundColor: c.bg,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerTitle: { fontSize: 22, fontWeight: '600', color: c.text, letterSpacing: 0.2 },
    menuBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menu: {
      position: 'absolute',
      top: 52,
      right: 16,
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingVertical: 6,
      minWidth: 170,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 999,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    menuItemText: { fontSize: 14, color: c.text, fontWeight: '500' },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgInput,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 12,
      gap: 8,
    },
    searchInput: { flex: 1, fontSize: 14, color: c.text },
    tagFilters: { flexDirection: 'row', gap: 8, marginTop: 12 },
    tagFilter: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: c.bgInput,
    },
    tagFilterActive: { backgroundColor: c.primary },
    tagFilterText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    tagFilterTextActive: { color: c.textOnPrimary },
    listContent: { paddingHorizontal: 16, paddingBottom: 100 },
    contactCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 16,
      marginBottom: 10,
      shadowColor: c.shadow,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 4,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: c.bgSecondary,
    },
    contactInfo: { flex: 1, marginLeft: 12 },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    name: { fontSize: 16, fontWeight: '700', color: c.text },
    company: { fontSize: 12, color: c.textSecondary, marginBottom: 6 },
    tagsRow: { flexDirection: 'row', gap: 6 },
    tag: {
      backgroundColor: c.primary08,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    tagText: { fontSize: 10, fontWeight: '600', color: c.primary },
  }));

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const json = await getContacts(
        activeTag !== '全部' ? activeTag : undefined,
        searchQuery || undefined,
      );
      setContacts(json.data);
    } catch (e) {
      console.error('Failed to fetch contacts:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTag, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      fetchContacts();
    }, [fetchContacts])
  );

  const renderContact = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactCard}
      onPress={() => router.push('/friend-detail', { contactId: item.id })}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.contactInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.name}</Text>
          <ScoreBadge score={item.score} />
        </View>
        <Text style={styles.company}>{item.title} · {item.company}</Text>
        <View style={styles.tagsRow}>
          {item.tags.map((tag: string) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
      <FontAwesome6 name="chevron-right" size={14} color={colors.border} />
    </TouchableOpacity>
  );

  return (
    <Screen backgroundColor={colors.bg} safeAreaEdges={['left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <AccountAvatar />
          <Text style={styles.headerTitle}>好友</Text>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(!showMenu)}>
            <FontAwesome6 name="ellipsis" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <USBStatusBadge status="connected" />

        <View style={styles.searchContainer}>
          <FontAwesome6 name="magnifying-glass" size={14} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜尋好友..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          horizontal
          data={TAG_OPTIONS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tagFilter, activeTag === item && styles.tagFilterActive]}
              onPress={() => setActiveTag(item)}
            >
              <Text style={[styles.tagFilterText, activeTag === item && styles.tagFilterTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagFilters}
        />
      </View>

      {showMenu && (
        <View style={styles.menu} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { setShowMenu(false); router.push('/sync-friends'); }}
          >
            <FontAwesome6 name="arrows-rotate" size={14} color={colors.info} />
            <Text style={styles.menuItemText}>同步好友</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { setShowMenu(false); router.push('/add-friend'); }}
          >
            <FontAwesome6 name="user-plus" size={14} color={colors.primary} />
            <Text style={styles.menuItemText}>添加好友</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { setShowMenu(false); router.push('/scan'); }}
          >
            <FontAwesome6 name="qrcode" size={14} color={colors.sky} />
            <Text style={styles.menuItemText}>掃一掃</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { setShowMenu(false); router.push('/card-holder'); }}
          >
            <FontAwesome6 name="address-card" size={14} color={colors.accent} />
            <Text style={styles.menuItemText}>名片夾</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderContact}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
