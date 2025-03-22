import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { FlatList, View, StyleSheet, TouchableOpacity, Image, Text, RefreshControl, Animated, Easing } from 'react-native';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { router } from 'expo-router';
import { ChatRoom, ChatParticipant } from '../../types';
import { EmptyChat } from '../common/EmptyChat';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import DrawerModal from '../common/DrawerModal';
import { useChatStore } from '../../store/useChatStore';
import Toast from 'react-native-toast-message';

interface ChatMessage {
  content: string;
  created_at: string;
  sender_id: string;
  sender_type: 'user' | 'provider';
  is_read: boolean;
  type: 'text' | 'image' | 'voice' | 'file';
  file_name?: string;
  duration?: string; // Duration in milliseconds for voice messages
}

interface ChatRoomWithParticipant extends ChatRoom {
  participant: ChatParticipant;
  isOnline: boolean;
  unreadCount?: number;
  lastMessageTime?: string;
  last_message?: string;
  chat_messages: ChatMessage[];
}

export default function ProviderChatList() {
  const [selectedTab, setSelectedTab] = useState<'All' | 'Unread' | 'Read'>('All');
  const [chatRooms, setChatRooms] = useState<ChatRoomWithParticipant[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const { profile } = useUserStore();
  const { setProviderUnreadCount, refreshUnreadCounts } = useChatStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const scaleAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const badgeScaleAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const notificationAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Animation for notification dot - continuous pulse when unread messages exist
  useEffect(() => {
    // Stop any existing animation
    if (notificationAnimRef.current) {
      notificationAnimRef.current.stop();
    }

    if (totalUnread > 0) {
      // Initial attention-grabbing pulse
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Setup continuous subtle pulse animation
      const pulseSequence = Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]);

      // Create a loop
      notificationAnimRef.current = Animated.loop(pulseSequence);
      notificationAnimRef.current.start();
    }

    // Cleanup animation on unmount
    return () => {
      if (notificationAnimRef.current) {
        notificationAnimRef.current.stop();
      }
    };
  }, [totalUnread]);

  // Setup animations for chat items - memoized
  const setupItemAnimations = useCallback((id: string, index: number) => {
    if (!fadeAnims[id]) {
      fadeAnims[id] = new Animated.Value(0);
      scaleAnims[id] = new Animated.Value(1);
      
      Animated.timing(fadeAnims[id], {
        toValue: 1,
        duration: 300,
        delay: index * 100,
        useNativeDriver: true,
      }).start();
    }
    return {
      opacity: fadeAnims[id],
      transform: [{ scale: scaleAnims[id] }]
    };
  }, []);

  // Setup badge animations - memoized
  const setupBadgeAnimation = useCallback((id: string, unreadCount: number = 0) => {
    if (!badgeScaleAnims[id]) {
      badgeScaleAnims[id] = new Animated.Value(1);
    }
    
    if (unreadCount > 0) {
      Animated.sequence([
        Animated.timing(badgeScaleAnims[id], {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(badgeScaleAnims[id], {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
    
    return {
      transform: [{ scale: badgeScaleAnims[id] }]
    };
  }, []);

  const handlePressIn = useCallback((id: string) => {
    Animated.spring(scaleAnims[id], {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressOut = useCallback((id: string) => {
    Animated.spring(scaleAnims[id], {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, []);

  const markMessagesAsRead = useCallback(async (chatId: string) => {
    try {
      console.log(`[ProviderChatList] Marking messages as read for chat ${chatId}`);
      
      // First, get all unread messages for this chat (including those with is_read = null)
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('chat_id', chatId)
        .eq('sender_type', 'user')
        .or('is_read.is.null,is_read.eq.false'); // This handles both null and false values
        
      if (fetchError) {
        console.error('[ProviderChatList] Error fetching unread messages:', fetchError);
        throw fetchError;
      }
      
      if (unreadMessages && unreadMessages.length > 0) {
        console.log(`[ProviderChatList] Found ${unreadMessages.length} unread messages to update`);
        console.log('[ProviderChatList] Message IDs to update:', unreadMessages.map(msg => msg.id));
        
        // Update messages one by one for better error tracking
        let updatedCount = 0;
        for (const msg of unreadMessages) {
          const { error: singleUpdateError } = await supabase
            .from('chat_messages')
            .update({ is_read: true })
            .eq('id', msg.id);
            
          if (singleUpdateError) {
            console.error(`[ProviderChatList] Error updating message ${msg.id}:`, singleUpdateError);
          } else {
            console.log(`[ProviderChatList] Successfully marked message ${msg.id} as read`);
            updatedCount++;
          }
        }
        
        console.log(`[ProviderChatList] Successfully marked ${updatedCount}/${unreadMessages.length} messages as read`);
        
        // Verify the update worked by checking a few messages
        const { data: verifyData, error: verifyError } = await supabase
          .from('chat_messages')
          .select('id, is_read')
          .in('id', unreadMessages.slice(0, 3).map(msg => msg.id));
          
        if (verifyError) {
          console.error('[ProviderChatList] Error verifying update:', verifyError);
        } else {
          console.log('[ProviderChatList] Verification of updated messages:', verifyData);
        }
        
        // Update local state immediately
        setChatRooms(prevRooms => 
          prevRooms.map(room => {
            if (room.id === chatId) {
              return {
                ...room,
                unreadCount: 0
              };
            }
            return room;
          })
        );
        
        // Update both local and global unread counts
        const newTotalUnread = Math.max(0, totalUnread - (chatRooms.find(r => r.id === chatId)?.unreadCount || 0));
        setTotalUnread(newTotalUnread);
        setProviderUnreadCount(newTotalUnread);
      } else {
        console.log('[ProviderChatList] No unread messages found for this chat');
      }
    } catch (error) {
      console.error('[ProviderChatList] Error marking messages as read:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to mark messages as read',
        position: 'top'
      });
    }
  }, [chatRooms, totalUnread]);

  const handleChatPress = useCallback(async (item: ChatRoomWithParticipant) => {
    try {
      // Mark messages as read first
      await markMessagesAsRead(item.id);
      
      // Add a small delay to ensure the database update completes
      setTimeout(() => {
        // Then navigate to the chat room
        router.push(`/provider/chat/${item.id}?userId=${item.user_id}&role=provider`);
      }, 300);
    } catch (error) {
      console.error('Error handling chat press:', error);
      // Navigate anyway even if marking as read fails
      router.push(`/provider/chat/${item.id}?userId=${item.user_id}&role=provider`);
    }
  }, [markMessagesAsRead]);

  const fetchChatRooms = useCallback(async () => {
    try {
      if (!profile?.id) return;
      
      setLoading(true);
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          user:user_id (
            id,
            name,
            profile_pic
          ),
          chat_messages!chat_messages_chat_id_fkey (
            content,
            created_at,
            sender_id,
            sender_type,
            is_read,
            type,
            file_name,
            duration
          )
        `)
        .eq('provider_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedRooms = data.map(room => {
        const lastMessage = room.chat_messages?.[room.chat_messages.length - 1];
        const isUserMessage = lastMessage?.sender_type === 'user';
        const unreadCount = room.chat_messages?.filter(
          (msg: ChatMessage) => msg.sender_type === 'user' && !msg.is_read
        ).length || 0;
        
        // Format the last message content based on message type
        let messageContent = lastMessage?.content || "Start a conversation";
        if (lastMessage?.type === 'image') {
          messageContent = "📷 Image";
          if (lastMessage.file_name) {
            messageContent += `: ${lastMessage.file_name}`;
          }
        } else if (lastMessage?.type === 'file') {
          messageContent = "📎 File";
          if (lastMessage.file_name) {
            messageContent += `: ${lastMessage.file_name}`;
          }
        } else if (lastMessage?.type === 'voice') {
          const duration = lastMessage.duration ? 
            parseInt(lastMessage.duration) / 1000 : // Convert to seconds
            0;
          const minutes = Math.floor(duration / 60);
          const seconds = Math.floor(duration % 60);
          const formattedDuration = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
          messageContent = `🎤 Voice note (${formattedDuration})`;
        }
        
        return {
          ...room,
          participant: room.user,
          isOnline: false,
          unreadCount,
          last_message: isUserMessage ? 
            `${room.user.name}: ${messageContent}` : 
            messageContent,
          lastMessageTime: lastMessage?.created_at ? 
            new Date(lastMessage.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : null
        };
      });

      const totalUnreadMessages = formattedRooms.reduce(
        (sum, room) => sum + (room.unreadCount || 0), 
        0
      );
      setTotalUnread(totalUnreadMessages);
      setProviderUnreadCount(totalUnreadMessages);
      setChatRooms(formattedRooms);
    } catch (error) {
      console.error('Error in fetchChatRooms:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load chat rooms',
        position: 'top'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    
    fetchChatRooms();
    // Call refreshUnreadCounts to ensure the notification dot is accurate
    refreshUnreadCounts('provider', profile.id);
    
    // Subscribe to both chat_rooms and chat_messages changes
    const chatRoomsChannel = supabase
      .channel('provider_chat_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_rooms',
          filter: `provider_id=eq.${profile?.id}`,
        },
        () => {
          if (!refreshing) {
            fetchChatRooms();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=in.(${chatRooms.map(room => room.id).join(',')})`,
        },
        () => {
          if (!refreshing) {
            fetchChatRooms();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatRoomsChannel);
    };
  }, [profile?.id, chatRooms.map(room => room.id).join(',')]);

  // Update badge animations when unread counts change
  useEffect(() => {
    chatRooms.forEach(room => {
      if (room.unreadCount && room.unreadCount > 0) {
        setupBadgeAnimation(room.id, room.unreadCount);
      }
    });
  }, [chatRooms.map(room => room.unreadCount).join(',')]);

  // Memoize filtered chats to prevent unnecessary recalculations
  const filteredChats = useMemo(() => {
    switch (selectedTab) {
      case 'Unread':
        return chatRooms.filter(chat => chat.unreadCount && chat.unreadCount > 0);
      case 'Read':
        return chatRooms.filter(chat => !chat.unreadCount || chat.unreadCount === 0);
      default:
        return chatRooms;
    }
  }, [chatRooms, selectedTab]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <View style={styles.userInfo}>
        <Image 
          source={{ uri: profile?.profile_pic || 'https://via.placeholder.com/150' }}
          style={styles.userAvatar}
        />
        <Text style={styles.username}>Hi, {profile?.name || 'Provider'}</Text>
      </View>
      <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
        <Ionicons name="menu" size={24} color="#000" />
      </TouchableOpacity>
    </View>
  ), [profile?.profile_pic, profile?.name]);

  const renderTab = useCallback((tab: 'All' | 'Unread' | 'Read') => (
    <TouchableOpacity 
      style={[styles.tabButton, selectedTab === tab && styles.selectedTabButton]}
      onPress={() => setSelectedTab(tab)}
    >
      <View style={styles.tabContent}>
        <Text style={[styles.tabText, selectedTab === tab && styles.selectedTabText]}>
          {tab}
        </Text>
        {tab === 'All' && totalUnread > 0 && (
          <Animated.View 
            style={[
              styles.notificationDot,
              { transform: [{ scale: pulseAnim }] }
            ]} 
          />
        )}
      </View>
    </TouchableOpacity>
  ), [selectedTab, totalUnread, pulseAnim]);

  // Memoize the renderChatItem function to prevent recreating for each render
  const renderChatItem = useCallback(({ item, index }: { item: ChatRoomWithParticipant; index: number }) => {
    const animatedStyle = setupItemAnimations(item.id, index);
    const badgeAnimStyle = setupBadgeAnimation(item.id, item.unreadCount);
    
    return (
      <TouchableOpacity
        onPress={() => handleChatPress(item)}
        onPressIn={() => handlePressIn(item.id)}
        onPressOut={() => handlePressOut(item.id)}
        activeOpacity={1}
      >
        <Animated.View style={[styles.chatItem, animatedStyle]}>
          <Image 
            source={{ 
              uri: item.participant?.profile_pic || 'https://via.placeholder.com/150'
            }} 
            style={styles.avatar} 
          />
          <View style={styles.chatDetails}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatName}>{item.participant?.name}</Text>
              <Text style={styles.timeText}>{item.lastMessageTime || "3:40 PM"}</Text>
            </View>
            <View style={styles.messageContainer}>
              <Text numberOfLines={1} style={styles.chatMessage}>
                {item.last_message || "Start a conversation"}
              </Text>
              {item.unreadCount ? (
                <Animated.View style={[
                  styles.unreadBadge,
                  badgeAnimStyle
                ]}>
                  <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                </Animated.View>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  }, [setupItemAnimations, setupBadgeAnimation, handlePressIn, handlePressOut, handleChatPress]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChatRooms();
    setRefreshing(false);
  }, [fetchChatRooms]);

  return (
    <View style={[styles.container, { backgroundColor: '#fff' }]}>
      {renderHeader()}
      <View style={styles.tabsContainer}>
        {renderTab('All')}
        {renderTab('Unread')}
        {renderTab('Read')}
      </View>
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        ListEmptyComponent={<EmptyChat />}
        contentContainerStyle={[
          styles.listContent,
          chatRooms.length === 0 && { flex: 1, justifyContent: 'center' }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        onEndReachedThreshold={0.5}
        getItemLayout={(data, index) => (
          {length: 76, offset: 76 * index, index}
        )}
      />
      <DrawerModal 
        isVisible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        profileImageUri={profile?.profile_pic}
        role="provider"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 20,
    marginRight: 8,
  },
  username: {
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  chatItem: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  chatDetails: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontFamily: "Urbanist-SemiBold",
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  messageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatMessage: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    fontFamily: 'Urbanist-Regular',
  },
  unreadBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Urbanist-Bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  selectedTabButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  tabText: {
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
  },
  selectedTabText: {
    color: '#fff',
  },
  listContent: {
    padding: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    position: 'absolute',
    top: -2,
    right: -12,
    borderWidth: 1,
    borderColor: 'white',
  },
}); 