import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Avatar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { ScaledSheet } from 'react-native-size-matters';
import { VoiceNote } from '../common/VoiceNote';
import { Colors } from '../../constants/Colors';

// Define ChatMessage interface if it's not imported from types
interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'voice' | 'file';
  created_at: string;
  file_name?: string;
  duration?: string; // Duration in milliseconds for voice messages
}

interface MessageProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  displayName?: string;
  onImagePress?: (imageUrl: string) => void;
}

function formatMessageTime(dateString: string) {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

const ChatMessageComponent: React.FC<MessageProps> = ({
  message,
  isOwnMessage,
  showAvatar = true,
  displayName = '',
  onImagePress,
}) => {
  const messageTime = formatMessageTime(message.created_at);
  const isVoiceMessage = message.type === 'voice';
  
  // If it's not a voice message, use these backgrounds
  const backgroundColor = isOwnMessage
    ? 'rgb(71, 84, 145)' // Same as voice notes
    : '#FFFFFF';
  
  // Text color depends on message type and sender
  const textColor = isOwnMessage ? '#FFFFFF' : '#000000';

  // Generate avatar color based on sender ID
  const getAvatarColor = (id: string) => {
    const colors = [
      '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
      '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
      '#f1c40f', '#e67e22', '#e74c3c', '#f39c12', '#d35400',
    ];
    // Simple hash function to generate a consistent color for a given ID
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Get initials from display name
  const getInitials = (name: string) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Function to render avatar
  const renderAvatar = () => {
    if (!showAvatar) return null;
    
    return (
      <View style={styles.avatarContainer}>
        <Avatar.Text
          size={32}
          label={getInitials(displayName)}
          color="#FFFFFF"
          style={{ backgroundColor: getAvatarColor(message.sender_id) }}
          labelStyle={styles.avatarLabel}
        />
      </View>
    );
  };

  // Function to render the appropriate content based on message type
  const renderMessageContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <TouchableOpacity
            onPress={() => onImagePress && onImagePress(message.content)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: message.content }}
              style={styles.imageContent}
              resizeMode="cover"
            />
            {message.file_name && (
              <Text style={styles.imageCaption}>{message.file_name}</Text>
            )}
          </TouchableOpacity>
        );
      
      case 'voice':
        // Parse duration if it exists
        const messageDuration = message.duration ? parseInt(message.duration) : 0;
        
        return (
          <VoiceNote
            isOwnMessage={isOwnMessage}
            audioUri={message.content}
            duration={messageDuration}
          />
        );
      
      case 'file':
        return (
          <TouchableOpacity
            style={styles.fileContainer}
            onPress={() => {
              // Open file URL in browser
              // This is a placeholder for file handling
              // You might want to download or preview the file
            }}
          >
            <Ionicons name="document-outline" size={24} color={Colors.primary} />
            <Text style={styles.fileName}>
              {message.file_name || 'Attachment'}
            </Text>
          </TouchableOpacity>
        );
      
      case 'text':
      default:
        return (
          <Text style={[styles.messageText, { color: textColor }]}>{message.content}</Text>
        );
    }
  };

  return (
    <View
      style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
      ]}
    >
      {!isOwnMessage && renderAvatar()}
      
      <View style={[
        styles.messageBubble, 
        isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
        isVoiceMessage ? { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0, padding: 0 } : { backgroundColor }
      ]}>
        {!isOwnMessage && displayName && !isVoiceMessage && (
          <Text style={styles.senderName}>{displayName}</Text>
        )}
        
        {renderMessageContent()}
        
        {!isVoiceMessage && (
          <Text style={[
            styles.messageTime,
            isOwnMessage && styles.ownMessageTime
          ]}>{messageTime}</Text>
        )}
      </View>
    </View>
  );
};

// Using React.memo to prevent unnecessary re-renders
export const ChatMessage = memo(ChatMessageComponent, (prevProps, nextProps) => {
  // Only re-render if the message content changes
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.isOwnMessage === nextProps.isOwnMessage &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.displayName === nextProps.displayName
  );
});

const styles = ScaledSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginVertical: '4@ms',
    paddingHorizontal: '12@ms',
    width: '100%',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: '8@ms',
    alignSelf: 'flex-end',
    marginBottom: '4@ms',
  },
  avatarLabel: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Bold',
  },
  messageBubble: {
    padding: '10@ms',
    maxWidth: '80%',
    minWidth: '100@ms',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  ownMessageBubble: {
    borderRadius: '16@ms',
    borderTopRightRadius: '4@ms',
    marginRight: '8@ms', // Space for the tail effect
  },
  otherMessageBubble: {
    borderRadius: '16@ms',
    borderTopLeftRadius: '4@ms',
    marginLeft: '8@ms', // Space for the tail effect
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  senderName: {
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '12@ms',
    color: Colors.primary,
    marginBottom: '4@ms',
  },
  messageText: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '14@ms',
    lineHeight: '20@ms',
  },
  messageTime: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '10@ms',
    color: '#888',
    alignSelf: 'flex-end',
    marginTop: '4@ms',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  imageContent: {
    width: '200@ms',
    height: '200@ms',
    borderRadius: '8@ms',
    backgroundColor: '#f0f0f0',
  },
  imageCaption: {
    fontFamily: 'Urbanist-Regular',
    fontSize: '12@ms',
    color: '#666',
    marginTop: '4@ms',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: '8@ms',
    padding: '8@ms',
  },
  fileName: {
    fontFamily: 'Urbanist-Medium',
    fontSize: '14@ms',
    color: Colors.primary,
    marginLeft: '8@ms',
    flex: 1,
  },
}); 