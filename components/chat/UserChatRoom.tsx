import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, TextInput, FlatList, StyleSheet, TouchableOpacity, Image, Text, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { useLocalSearchParams, router } from 'expo-router';
import { Message, FileUpload } from '../../types/index';
import { ChatMessage } from '../common/ChatMessage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useChatStore } from '../../store/useChatStore';
import Toast from 'react-native-toast-message';
import * as ImageManipulator from 'expo-image-manipulator';
import { VoiceRecorder } from '../common/VoiceRecorder';
import * as FileSystem from 'expo-file-system';

export default function UserChatRoom() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const { profile } = useUserStore();
  const { id: chatRoomId } = useLocalSearchParams();
  const [provider, setProvider] = useState<any>(null);
  const { setUserUnreadCount } = useChatStore();
  const initialMarkReadDone = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showWarning, setShowWarning] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const MESSAGES_PER_PAGE = 20;
  const channelRef = useRef<any>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  // Create a ref for the markMessagesAsRead function to avoid circular dependencies
  const markMessagesAsReadRef = useRef<() => Promise<void>>();

  // Memoize the connection between messages and the flatlist
  const messagesData = useMemo(() => messages, [messages]);

  useEffect(() => {
    fetchMessages();
    fetchProviderDetails();
  
    if (!initialMarkReadDone.current) {
      // Call markMessagesAsRead with a slight delay to ensure messages are loaded first
      setTimeout(() => {
        console.log('[UserChatRoom] Initial marking of messages as read');
        if (markMessagesAsReadRef.current) {
          markMessagesAsReadRef.current();
          initialMarkReadDone.current = true;
        }
      }, 1000);
    }
    
    // Set timeout for warning message
    const warningTimeout = setTimeout(() => {
      setShowWarning(false);
    }, 20000); 
    
    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      clearTimeout(warningTimeout); 
    };
  }, [chatRoomId]);

  const setupRealtimeSubscription = useCallback(() => {
    // Unsubscribe from any existing channels first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create a new subscription
    channelRef.current = supabase
      .channel(`chat_room_${chatRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatRoomId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setMessages(prev => {
              // Check if the message already exists by ID
              const exists = prev.some(msg => msg.id === payload.new.id);
              if (exists) return prev;
              
              // Different matching logic based on message type
              if (payload.new.type === 'text') {
                // For text messages, match on content, sender, and type
                const tempMessages = prev.filter(msg => 
                  msg.id.toString().startsWith('temp-') && 
                  msg.content === payload.new.content &&
                  msg.sender_id === payload.new.sender_id &&
                  msg.type === payload.new.type
                );
                
                if (tempMessages.length > 0) {
                  // Replace the first matching temporary message with the real one
                  return prev.map(msg => 
                    (msg.id === tempMessages[0].id) ? payload.new : msg
                  );
                }
              } else if (['file', 'image', 'voice'].includes(payload.new.type)) {
                // For files, images, and voice notes, match on sender, type, and approximate time
                // Also match on file_name if available
                const tempMessages = prev.filter(msg => {
                  const isTemp = msg.id.toString().startsWith('temp-');
                  const isSameType = msg.type === payload.new.type;
                  const isSameSender = msg.sender_id === payload.new.sender_id;
                  const isRecentTimestamp = Math.abs(
                    new Date(msg.created_at).getTime() - new Date(payload.new.created_at).getTime()
                  ) < 10000; // Within 10 seconds
                  
                  // Additional check for file_name if both have it
                  const hasSameFileName = 
                    msg.file_name && 
                    payload.new.file_name && 
                    payload.new.file_name.includes(msg.file_name.split('_')[0]);
                  
                  return isTemp && isSameType && isSameSender && 
                    (isRecentTimestamp || (hasSameFileName && msg.type === payload.new.type));
                });
                
                if (tempMessages.length > 0) {
                  // Sort by creation time to get the most recent first
                  tempMessages.sort((a, b) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  );
                  
                  // Replace the most recent matching temporary message with the real one
                  return prev.map(msg => 
                    (msg.id === tempMessages[0].id) ? payload.new : msg
                  );
                }
              }
              
              // Add the new message to the beginning of the array
              return [payload.new, ...prev];
            });
            
            if (payload.new.sender_type === 'provider') {
              console.log('[UserChatRoom] Message from provider received, marking messages as read');
              // Call markMessagesAsRead with a small delay to ensure the state is updated
              setTimeout(() => {
                if (markMessagesAsReadRef.current) {
                  markMessagesAsReadRef.current();
                }
              }, 300);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatRoomId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatRoomId}`,
        },
        (payload: any) => {
          if (payload.old && payload.old.id) {
            setMessages(prev => 
              prev.filter(msg => msg.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();
  }, [chatRoomId]);

  const fetchProviderDetails = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_rooms')
      .select(`
        provider:provider_id (
          id,
          name,
          profile_pic,
          providers (services)
        )
      `)
      .eq('id', chatRoomId)
      .single();

    if (!error && data) {
      setProvider(data.provider);
    }
  }, [chatRoomId]);

  const fetchMessages = useCallback(async (loadMore = false) => {
    if (isLoading || (!loadMore && !hasMore)) return;
    
    try {
      setIsLoading(true);
      const currentPage = loadMore ? page + 1 : 0;
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatRoomId)
        .order('created_at', { ascending: false })
        .range(currentPage * MESSAGES_PER_PAGE, (currentPage + 1) * MESSAGES_PER_PAGE - 1);

      if (error) {
        return;
      }

      if (data) {
        setMessages(prev => loadMore ? [...prev, ...data] : data);
        setHasMore(data.length === MESSAGES_PER_PAGE);
        setPage(currentPage);
        
        // Check if there are unread provider messages in the newly loaded data
        const hasUnreadProviderMessages = data.some(
          msg => msg.sender_type === 'provider' && !msg.is_read
        );
        
        if (hasUnreadProviderMessages && !loadMore) {
          // Only auto-mark messages as read on initial load, not when loading more
          console.log('[UserChatRoom] Detected unread messages in newly loaded data');
          setTimeout(() => {
            if (markMessagesAsReadRef.current) {
              markMessagesAsReadRef.current();
            }
          }, 500);
        }
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setIsLoading(false);
    }
  }, [chatRoomId, isLoading, hasMore, page, MESSAGES_PER_PAGE]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchMessages(true);
    }
  }, [isLoading, hasMore, fetchMessages]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !profile?.id) return;

    const tempContent = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const tempCreatedAt = new Date().toISOString();
    
    // Create temporary message for immediate display (for the UI only)
    const tempMessage: Message = {
      id: tempId,
      chat_room_id: chatRoomId as string, // For TypeScript compatibility
      sender_id: profile.id,
      content: tempContent,
      sender_type: 'user',
      type: 'text',
      created_at: tempCreatedAt,
      is_read: false
    };
    
    // Add to messages immediately for better UX
    setMessages(prevMessages => [tempMessage, ...prevMessages]);
    setNewMessage(''); // Clear input field
    
    try {
      // Insert into database using the correct column name: chat_id
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatRoomId,
          sender_id: profile.id,
          content: tempContent,
          sender_type: 'user',
          type: 'text',
          created_at: tempCreatedAt
        });
        
      if (error) {
        // Remove temp message on error
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        throw error;
      }
      
      // Message will be added by the realtime subscription
      // and will replace our temporary message
    } catch (error) {
      // Remove temp message on error
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
      
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send message. Please try again.',
        position: 'bottom'
      });
    }
  }, [newMessage, profile?.id, chatRoomId, supabase]);

  const markMessagesAsRead = useCallback(async () => {
    try {
      if (isMarkingRead) return; 
      setIsMarkingRead(true);
      
      console.log(`[UserChatRoom] Attempting to mark messages as read for chat ${chatRoomId}`);
      
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('chat_id', chatRoomId)
        .eq('sender_type', 'provider')
        .or('is_read.is.null,is_read.eq.false'); 
        
      if (fetchError) {
        console.error('[UserChatRoom] Error fetching unread messages:', fetchError);
        throw fetchError;
      }
      
      if (unreadMessages && unreadMessages.length > 0) {
        console.log(`[UserChatRoom] Found ${unreadMessages.length} unread messages to update`);
        
        // Batch update all messages
        const { error: batchUpdateError } = await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(msg => msg.id));
          
        if (batchUpdateError) {
          console.error('[UserChatRoom] Batch update failed, falling back to individual updates');
          // Fall back to individual updates
          for (const msg of unreadMessages) {
            const { error: singleUpdateError } = await supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', msg.id);
              
            if (singleUpdateError) {
              console.error(`[UserChatRoom] Error updating message ${msg.id}:`, singleUpdateError);
            } else {
              console.log(`[UserChatRoom] Successfully marked message ${msg.id} as read`);
            }
          }
        } else {
          console.log(`[UserChatRoom] Successfully batch updated ${unreadMessages.length} messages`);
        }
        
        // Small delay to ensure updates are processed
        await new Promise(resolve => setTimeout(resolve, 300));
        
        fetchMessages();
        
        // Update user unread count
        const { count: totalUnread } = await supabase
          .from('chat_messages')
          .select('count', { count: 'exact', head: true })
          .eq('sender_type', 'provider')
          .eq('is_read', false);
          
        if (totalUnread !== null) {
          console.log(`[UserChatRoom] Updating user unread count to ${totalUnread}`);
          setUserUnreadCount(totalUnread || 0);
        }
      } else {
        console.log('[UserChatRoom] No unread messages found for this chat');
      }
    } catch (error) {
      console.error('[UserChatRoom] Error marking messages as read:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to mark messages as read',
        position: 'bottom'
      });
    } finally {
      setIsMarkingRead(false);
    }
  }, [isMarkingRead, chatRoomId, fetchMessages]);

  // Store the markMessagesAsRead function in a ref to avoid dependency cycles
  useEffect(() => {
    markMessagesAsReadRef.current = markMessagesAsRead;
  }, [markMessagesAsRead]);

  // Add the detect unread messages effect
  useEffect(() => {
    // Only run if we have messages and not on the initial render
    if (messages.length > 0 && initialMarkReadDone.current) {
      // Check if there are any unread messages from the provider
      const hasUnreadProviderMessages = messages.some(
        msg => msg.sender_type === 'provider' && !msg.is_read
      );
      
      if (hasUnreadProviderMessages) {
        console.log('[UserChatRoom] Detected unread provider messages, marking them as read');
        if (markMessagesAsReadRef.current) {
          markMessagesAsReadRef.current();
        }
      }
    }
  }, [messages.length]);

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'application/msword', 
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        multiple: false
      });

      if (!result.canceled && result.assets[0]) {
        const file: FileUpload = {
          name: result.assets[0].name,
          size: result.assets[0].size,
          mimeType: result.assets[0].mimeType,
          uri: result.assets[0].uri,
          lastModified: result.assets[0].lastModified
        };
        
        // Check if it's an image file that can be compressed
        if (file.mimeType && file.mimeType.startsWith('image/')) {
          const compressedFile = await compressImage(file);
          await uploadFile(compressedFile);
        } else {
          await uploadFile(file);
        }
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick document',
        position: 'bottom'
      });
    }
  }, [profile?.id]);

  // Function to compress images before upload
  const compressImage = async (file: FileUpload): Promise<FileUpload> => {
    try {
      // Skip compression for already small files (less than 300KB)
      if (file.size && file.size < 300 * 1024) return file;
      
      const result = await ImageManipulator.manipulateAsync(
        file.uri,
        [{ resize: { width: 1024 } }], // Resize to max width of 1024
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      // Create a new FileUpload object with compressed data
      return {
        ...file,
        uri: result.uri,
        // Use FileSystem to get file size if needed, or keep original size
        size: file.size,
        mimeType: 'image/jpeg'
      };
    } catch (error) {
      // If compression fails, return original file
      return file;
    }
  };

  const uploadFile = useCallback(async (file: FileUpload) => {
    const fileExt = file.name.split('.').pop() || 'file';
    const fileName = `${chatRoomId}_${Date.now()}.${fileExt}`;
    const isImage = fileExt.toLowerCase().match(/(jpg|jpeg|png|gif)/) ? true : false;
    const tempId = `temp-${Date.now()}`;
    
    // Create a temporary URL for immediate display
    const tempUrl = file.uri;
    
    // Create temporary message for immediate display (for the UI only)
    const tempMessage: Message = {
      id: tempId,
      chat_room_id: chatRoomId as string, // For TypeScript compatibility
      sender_id: profile?.id || '',
      content: tempUrl,
      sender_type: 'user',
      type: isImage ? 'image' : 'file',
      file_name: file.name,
      created_at: new Date().toISOString(),
      is_read: false
    };
    
    // Add to messages immediately for better UX
    setMessages(prevMessages => [tempMessage, ...prevMessages]);
    
    try {
      setIsLoading(true);

      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, {
          uri: file.uri,
          type: file.mimeType || 'application/octet-stream',
          name: file.name
        } as any);

      if (error) {
        // Remove temp message on error
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      // Create message object for database (uses chat_id)
      const { error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatRoomId,
          sender_id: profile?.id,
          content: publicUrl,
          sender_type: 'user',
          type: isImage ? 'image' : 'file',
          file_name: file.name,
          created_at: new Date().toISOString(),
          is_read: false
        });

      if (messageError) {
        // Remove temp message on error
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        throw messageError;
      }

      // Message will be added by the realtime subscription
      // and will replace our temporary message
    } catch (error) {
      // Remove temp message on error
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
      
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to upload file. Please try again.',
        position: 'bottom'
      });
    } finally {
      setIsLoading(false);
    }
  }, [chatRoomId, profile?.id]);

  const handleMessageDelete = useCallback((messageId: string) => {
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
  }, []);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      <View style={styles.providerInfo}>
        <Image 
          source={{ uri: provider?.profile_pic || 'https://via.placeholder.com/150' }}
          style={styles.providerAvatar}
          progressiveRenderingEnabled={true}
          fadeDuration={300}
        />
        <View>
          <Text style={styles.providerName}>{provider?.name}</Text>
          <Text style={styles.providerService}>
            {provider?.providers?.[0]?.services?.[0] || 'Service Provider'}
          </Text>
        </View>
      </View>
      {isMarkingRead && (
        <ActivityIndicator size="small" color="#fff" style={styles.loadingIndicator} />
      )}
    </View>
  ), [provider, isMarkingRead]);

  const renderSecurityWarning = useCallback(() => {
    if (!showWarning) return null;
    
    return (
      <View style={styles.securityWarningContainer}>
        <Ionicons name="shield" size={20} color="#FF9500" style={styles.warningIcon} />
        <Text style={styles.securityWarningText}>
          ⚠️ For your security, please ensure all transactions are completed within the app. 
          Never share payment details or arrange payments outside the platform.
        </Text>
      </View>
    );
  }, [showWarning]);

  // Improve FlatList performance with memoized renderItem
  const renderItem = useCallback(({ item }: { item: Message }) => (
    <ChatMessage 
      message={item}
      isOwnMessage={item.sender_id === profile?.id}
      onMessageDelete={handleMessageDelete}
    />
  ), [profile?.id, handleMessageDelete]);

  // Extract keyExtractor function to prevent re-rendering
  const keyExtractor = useCallback((item: Message, index: number) => 
    `message-${item.id}-${index}`, []);

  // Upload voice recording function
  const uploadVoiceRecording = useCallback(async (audioUri: string, duration: number) => {
    const fileName = `${chatRoomId}_voice_${Date.now()}.m4a`;
    const tempId = `temp-${Date.now()}`;
    
    // Create temporary message for immediate display (for the UI only)
    const tempMessage: Message = {
      id: tempId,
      chat_room_id: chatRoomId as string, // For TypeScript compatibility
      sender_id: profile?.id || '',
      content: audioUri, // Use local URI temporarily
      sender_type: 'user',
      type: 'voice',
      file_name: fileName,
      duration: duration.toString(),
      created_at: new Date().toISOString(),
      is_read: false
    };
    
    // Add to messages immediately for better UX
    setMessages(prevMessages => [tempMessage, ...prevMessages]);
    
    try {
      setIsLoading(true);
      
      // Get file info
      let fileInfo;
      try {
        fileInfo = await FileSystem.getInfoAsync(audioUri);
        
        if (!fileInfo.exists) {
          // Remove temp message if file doesn't exist
          setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
          throw new Error('Recorded audio file not found');
        }
      } catch (error) {
        console.error('File info error:', error);
        // Remove temp message on error
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        throw new Error('Unable to access the recorded audio file');
      }
      
      // Add a small delay to ensure file is fully written
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Upload audio file to Supabase storage
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, {
          uri: audioUri,
          type: 'audio/m4a',
          name: fileName
        } as any);

      if (error) {
        console.error('Supabase storage error:', error);
        // Remove temp message on error
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        throw error;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      // Create database message object (uses chat_id)
      const { error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatRoomId,
          sender_id: profile?.id,
          content: publicUrl,
          sender_type: 'user',
          type: 'voice',
          file_name: fileName,
          duration: duration.toString(),
          created_at: new Date().toISOString(),
          is_read: false
        });

      if (messageError) {
        console.error('Message insert error:', messageError);
        // Remove temp message on error
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        throw messageError;
      }

      // Message will be added by the realtime subscription
      // and will replace our temporary message
    } catch (error) {
      console.error('Voice note upload error:', error);
      // Remove temp message on error
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
      
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send voice note. Please try again.',
        position: 'bottom'
      });
    } finally {
      setIsLoading(false);
      setShowVoiceRecorder(false);
    }
  }, [chatRoomId, profile?.id]);

  // Handle recording complete
  const handleRecordingComplete = useCallback((audioUri: string, duration: number) => {
    uploadVoiceRecording(audioUri, duration);
  }, [uploadVoiceRecording]);

  // Cancel recording
  const handleCancelRecording = useCallback(() => {
    setShowVoiceRecorder(false);
  }, []);

  // Toggle voice recorder
  const toggleVoiceRecorder = useCallback(() => {
    setShowVoiceRecorder(prev => !prev);
  }, []);

  // Memoize the provider details to prevent unnecessary re-renders
  const providerDetails = useMemo(() => ({
    name: provider?.name || 'Provider',
    profile_pic: provider?.profile_pic || 'https://via.placeholder.com/150',
    service: provider?.providers?.[0]?.services?.[0] || 'Service Provider'
  }), [provider]);

  // Memoize the Flatlist configuration for better list performance
  const listConfig = useMemo(() => ({
    initialNumToRender: 8,
    maxToRenderPerBatch: 5,
    windowSize: 5,
    updateCellsBatchingPeriod: 30,
    removeClippedSubviews: true,
    maintainVisibleContentPosition: {
      minIndexForVisible: 0,
      autoscrollToTopThreshold: 10,
    },
    getItemLayout: (data: any, index: number) => ({
      length: 80, // Approximate height of a message item
      offset: 80 * index,
      index,
    }),
  }), []);

  // Input handling optimization
  const handleInputChange = useCallback((text: string) => {
    setNewMessage(text);
  }, []);

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderSecurityWarning()}
      <View style={styles.chatBackground}>
        <FlatList
          ref={flatListRef}
          data={messagesData}
          inverted
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.messagesList}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isLoading && hasMore ? (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.loadingMore} />
          ) : null}
          {...listConfig}
        />
      </View>
      
      {showVoiceRecorder ? (
        <VoiceRecorder 
          onRecordingComplete={handleRecordingComplete}
          onCancel={handleCancelRecording}
        />
      ) : (
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={pickDocument}>
            <Ionicons name="attach" size={24} color="#7c7c7c" />
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <TextInput
              value={newMessage}
              onChangeText={handleInputChange}
              placeholder="Type a message"
              style={styles.input}
              multiline
            />
          </View>
          {newMessage.trim() ? (
            <TouchableOpacity 
              style={styles.sendButton}
              onPress={sendMessage}
              disabled={isLoading}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.micButton}
              onPress={toggleVoiceRecorder}
            >
              <Ionicons 
                name="mic" 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatBackground: {
    flex: 1,
    backgroundColor: '#f5f7fa', 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 30,
    backgroundColor: Colors.primary, 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  backButton: {
    marginRight: 12,
  },
  providerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  providerName: {
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
    color: '#fff',
  },
  providerService: {
    fontSize: 12,
    fontFamily: 'Urbanist-Medium',
    color: 'rgba(255,255,255,0.8)',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f0f0f0',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 25,
    alignItems: 'center',
    marginHorizontal: 8,
    paddingLeft: 12,
  },
  attachButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 5,
    maxHeight: 100,
    fontFamily: 'Urbanist-Medium',
  },
  sendButton: {
    backgroundColor: Colors.primary, 
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  loadingMore: {
    paddingVertical: 20,
  },
  securityWarningContainer: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    borderRadius: 0,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIcon: {
    marginRight: 10,
  },
  securityWarningText: {
    color: '#5D4037',
    fontSize: 13,
    flex: 1,
    fontFamily: 'Urbanist-Medium',
    lineHeight: 18,
  },
  micButton: {
    backgroundColor: Colors.primary, 
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 