import React, { useState, useCallback, memo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking, ActivityIndicator, Modal, Alert } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Colors } from '../../constants/Colors';
import { Message } from '../../types/index';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../services/supabase';
import { VoiceNote } from './VoiceNote';

interface ChatMessageProps {
  message: Message;
  isOwnMessage: boolean;
  senderImage?: string;
  senderName?: string;
  onMessageDelete?: (messageId: string) => void;
}

const formatDate = (date: string) => {
  const messageDate = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (messageDate.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }
};


const getFileIcon = (fileName: string) => {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  
  if (!ext) return 'document-outline';
  
  switch (ext) {
    case 'pdf':
      return 'document-text-outline';
    case 'doc':
    case 'docx':
      return 'document-text-outline';
    case 'xls':
    case 'xlsx':
      return 'grid-outline';
    case 'ppt':
    case 'pptx':
      return 'easel-outline';
    case 'zip':
    case 'rar':
      return 'archive-outline';
    default:
      return 'document-outline';
  }
};

// Memoize the ChatMessage component to prevent unnecessary re-renders
export const ChatMessage = memo(({ message, isOwnMessage, senderImage, senderName, onMessageDelete }: ChatMessageProps) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isImage = message.type === 'image';
  const isFile = message.type === 'file';
  const isVoice = message.type === 'voice';
  
  // Use useCallback for event handlers to prevent recreation on each render
  const handleLongPress = useCallback(() => {
    if (!isOwnMessage || deleting) return;

    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleDelete
        }
      ]
    );
  }, [isOwnMessage, deleting, message.id]);

  const handleDelete = useCallback(async () => {
    if (!message.id || deleting) return;

    try {
      setDeleting(true);

      if ((isFile || isImage) && message.content) {
        try {
          const fileUrl = new URL(message.content);
          const pathParts = fileUrl.pathname.split('/');
          const fileName = pathParts[pathParts.length - 1];
 
          const { error: storageError } = await supabase.storage
            .from('chat-attachments')
            .remove([fileName]);

          if (storageError) {
            console.warn('Storage deletion failed but continuing with message deletion');
          }
        } catch (error) {
          console.warn('File URL parsing failed but continuing with message deletion');
        }
      }
      
      const { error: dbError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', message.id);

      if (dbError) {
        throw dbError;
      }

      if (onMessageDelete) {
        onMessageDelete(message.id);
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Message deleted successfully',
        position: 'bottom'
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete message',
        position: 'bottom'
      });
    } finally {
      setDeleting(false);
    }
  }, [message.id, isFile, isImage, message.content, onMessageDelete, deleting]);

  const handleFilePress = useCallback(async () => {
    if (!message.content) return;

    if (isImage) {
      setShowImageModal(true);
      return;
    }

    try {
      setDownloading(true);
      const fileExt = (message.file_name || message.content).split('.').pop()?.toLowerCase();
      
      const canHandleNatively = ['pdf', 'doc', 'docx', 'txt'].includes(fileExt || '');
      
      if (canHandleNatively) {
        await Linking.openURL(message.content);
      } else {
        const fileName = message.file_name || `downloaded_file.${fileExt}`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        const downloadResumable = FileSystem.createDownloadResumable(
          message.content,
          fileUri,
          {},
          (downloadProgress) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          }
        );

        const result = await downloadResumable.downloadAsync();
        
        if (result?.uri) {
          await Linking.openURL(result.uri);
        } else {
          throw new Error('Download failed');
        }
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not open file. Please try again.',
        position: 'bottom'
      });
    } finally {
      setDownloading(false);
    }
  }, [message.content, message.file_name, isImage]);

  return (
    <View style={[
      styles.messageContainer,
      isOwnMessage ? styles.ownMessage : styles.receivedMessage
    ]}>
      {!isOwnMessage && (
        <Image 
          source={{ uri: senderImage || 'https://via.placeholder.com/40' }}
          style={styles.avatar}
          progressiveRenderingEnabled={true}
          fadeDuration={300}
        />
      )}
      
      <TouchableOpacity 
        style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.receivedBubble,
          isImage && styles.imageBubble,
          isVoice && styles.voiceBubble
        ]}
        onLongPress={!isImage && !isVoice ? handleLongPress : undefined}
        delayLongPress={500}
        disabled={!isOwnMessage || deleting || isImage || isVoice}
      >
        {deleting && !isImage && !isVoice && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}

        {!isOwnMessage && senderName && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}
        
        {!isImage && !isFile && !isVoice && (
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.receivedMessageText
          ]}>
            {message.content}
          </Text>
        )}
        
        {isImage && (
          <TouchableOpacity 
            onPress={handleFilePress}
            onLongPress={isOwnMessage ? handleLongPress : undefined}
            delayLongPress={500}
            style={styles.imageContainer}
            disabled={!isOwnMessage && deleting}
          >
            <Image 
              source={{ uri: message.content }} 
              style={styles.imageContent}
              resizeMode="cover"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
              progressiveRenderingEnabled={true}
              fadeDuration={300}
            />
            {imageLoading && (
              <View style={styles.imageLoadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            )}
            {deleting && (
              <View style={styles.deletingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        )}
        
        {isVoice && (
          <TouchableOpacity
            onLongPress={isOwnMessage ? handleLongPress : undefined}
            delayLongPress={500}
            activeOpacity={1}
            disabled={!isOwnMessage && deleting}
          >
            <VoiceNote 
              isOwnMessage={isOwnMessage}
              audioUri={message.content}
              duration={message.duration ? parseInt(message.duration) : undefined}
            />
            {deleting && (
              <View style={styles.deletingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        )}
        
        {isFile && (
          <TouchableOpacity 
            style={styles.fileContainer}
            onPress={handleFilePress}
            disabled={downloading}
          >
            <View style={[
              styles.fileIconContainer,
              isOwnMessage ? styles.ownFileIcon : styles.receivedFileIcon
            ]}>
              {downloading ? (
                <ActivityIndicator size="small" color={isOwnMessage ? "#075e54" : '#fff'} />
              ) : (
                <Ionicons 
                  name={getFileIcon(message.file_name || '')} 
                  size={24} 
                  color={isOwnMessage ? "#075e54" : '#fff'} 
                />
              )}
            </View>
            <View style={styles.fileDetails}>
              <Text 
                style={[
                  styles.fileName,
                  isOwnMessage ? styles.ownMessageText : styles.receivedMessageText
                ]}
                numberOfLines={2}
              >
                {message.file_name || 'File'}
              </Text>
              <Text 
                style={[
                  styles.fileAction,
                  isOwnMessage ? { color: 'rgba(0,0,0,0.5)' } : { color: 'rgba(255,255,255,0.7)' }
                ]}
              >
                {downloading ? 'Downloading...' : 'Tap to download'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        
        <View style={styles.messageFooter}>
          <Text style={[
            styles.timeText,
            isOwnMessage ? styles.ownTimeText : styles.receivedTimeText
          ]}>
            {new Date(message.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
          {isOwnMessage && (
            <Ionicons 
              name={message.is_read ? "checkmark-done" : "checkmark"} 
              size={14} 
              color={message.is_read ? "#53bdeb" : "#7e7e7e"} 
              style={styles.readStatus}
            />
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={showImageModal}
        transparent={true}
        onRequestClose={() => setShowImageModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowImageModal(false)}
        >
          <Image
            source={{ uri: message.content }}
            style={styles.modalImage}
            resizeMode="contain"
            progressiveRenderingEnabled={true}
            fadeDuration={300}
          />
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setShowImageModal(false)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}, (prevProps, nextProps) => {
  // Memoization comparison function - only re-render if these props changed
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.is_read === nextProps.message.is_read &&
    prevProps.isOwnMessage === nextProps.isOwnMessage
  );
});

const styles = ScaledSheet.create({
  messageContainer: {
    marginVertical: '4@ms',
    maxWidth: '75%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    marginLeft: '60@ms',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    marginRight: '60@ms',
    marginVertical: '4@ms',
  },
  avatar: {
    width: '32@ms',
    height: '32@ms',
    borderRadius: '16@ms',
    marginRight: '8@ms',
  },
  messageBubble: {
    padding: '8@ms',
    borderRadius: '8@ms',
    minWidth: '80@ms',
  },
  ownBubble: {
    backgroundColor: 'rgba(80, 150, 230, 0.1)', // Light theme color for own messages
    borderTopRightRadius: '0@ms',
  },
  receivedBubble: {
    backgroundColor: '#fff', // White background for received messages
    borderTopLeftRadius: '0@ms',
  },
  imageBubble: {
    padding: '3@ms',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  senderName: {
    fontSize: '12@ms',
    color: Colors.primary, // Use theme color
    marginBottom: '4@ms',
    fontFamily: 'Urbanist-Medium',
  },
  messageText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Regular',
    lineHeight: '20@ms',
  },
  ownMessageText: {
    color: '#303030',
  },
  receivedMessageText: {
    color: '#303030',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: '2@ms',
    gap: '4@ms',
  },
  timeText: {
    fontSize: '11@ms',
    fontFamily: 'Urbanist-Regular',
  },
  ownTimeText: {
    color: 'rgba(0,0,0,0.45)',
  },
  receivedTimeText: {
    color: 'rgba(0,0,0,0.45)',
  },
  readStatus: {
    marginLeft: '2@ms',
  },
  imageContent: {
    width: '200@ms',
    height: '200@ms',
    borderRadius: '6@ms',
  },
  imageContainer: {
    position: 'relative',
    width: '200@ms',
    height: '200@ms',
    borderRadius: '6@ms',
    overflow: 'hidden',
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '8@ms',
    minWidth: '180@ms',
  },
  fileIconContainer: {
    width: '40@ms',
    height: '40@ms',
    borderRadius: '20@ms',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '12@ms',
  },
  ownFileIcon: {
    backgroundColor: 'rgba(7,94,84,0.1)', // WhatsApp green with low opacity
  },
  receivedFileIcon: {
    backgroundColor: 'rgba(7,94,84,0.1)',
  },
  fileDetails: {
    flex: 1,
    marginRight: '8@ms',
  },
  fileName: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '4@ms',
  },
  fileAction: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Regular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: '40@ms',
    right: '20@ms',
    padding: '10@ms',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: '20@ms',
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '20@ms',
    zIndex: 1,
  },
  voiceBubble: {
    padding: '3@ms',
    minWidth: '200@ms',
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginVertical: '-1@ms',
  },
}); 