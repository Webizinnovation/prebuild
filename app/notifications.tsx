import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { Text, ActivityIndicator, Avatar, Divider } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';
import { useUserStore } from '../store/useUserStore';
import { Notification } from '../types/index';
import { Colors } from '../constants/Colors';

export default function NotificationsScreen() {
  const { profile } = useUserStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', profile!.id)
        .eq('read', false);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
    markAllAsRead();
  }, [fetchNotifications]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'order':
        return <FontAwesome5 name="shopping-bag" size={18} color="#fff" />;
      case 'chat':
        return <Ionicons name="chatbubble" size={18} color="#fff" />;
      case 'payment':
        return <MaterialCommunityIcons name="cash-multiple" size={18} color="#fff" />;
      default:
        return <Ionicons name="notifications" size={18} color="#fff" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'order':
        return ['#4CAF50', '#2E7D32'];
      case 'chat':
        return ['#2196F3', '#1565C0'];
      case 'payment':
        return ['#FF9800', '#EF6C00'];
      default:
        return ['#9C27B0', '#6A1B9A'];
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours === 0) {
        const minutes = Math.floor(diff / (60 * 1000));
        return minutes <= 0 ? 'Just now' : `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }
    

    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    }

    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const EmptyNotifications = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={80} color="#ccc" />
      <Text style={styles.emptyText}>No notifications yet</Text>
      <Text style={styles.emptySubText}>We'll notify you when something important happens</Text>
    </View>
  );

  return (
    <>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      <Stack.Screen 
        options={{
          title: 'Notifications',
          headerShown: true,
          headerRight: () => (
            notifications.length > 0 ? (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => {
                  markAllAsRead();
                  onRefresh();
                }}
              >
                <Text style={styles.clearButtonText}>Mark all as read</Text>
              </TouchableOpacity>
            ) : null
          ),
        }} 
      />
      <FlatList
        data={notifications}
        contentContainerStyle={notifications.length === 0 ? styles.fullScreenContainer : styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.notificationItem}>
            <View style={styles.notificationContent}>
              <LinearGradient 
                colors={getNotificationColor(item.type) as [string, string, ...string[]]}
                style={styles.iconContainer}
              >
                {getNotificationIcon(item.type)}
              </LinearGradient>
              <View style={styles.textContainer}>
                <View style={styles.headerRow}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.timeText}>{formatDate(item.created_at)}</Text>
                </View>
                <Text style={styles.message}>{item.message}</Text>
              </View>
            </View>
            {!item.read && <View style={styles.unreadIndicator} />}
            <Divider style={styles.divider} />
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={EmptyNotifications}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  fullScreenContainer: {
    flexGrow: 1,
  },
  listContainer: {
    paddingBottom: 20,
  },
  notificationItem: {
    backgroundColor: '#fff',
    position: 'relative',
    paddingHorizontal: 16,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  unreadIndicator: {
    position: 'absolute',
    left: 6,
    top: 28,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#555',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  clearButton: {
    marginRight: 16,
  },
  clearButtonText: {
    color: Colors.primary,
    fontSize: 14,
  },
}); 