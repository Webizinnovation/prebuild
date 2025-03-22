import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

interface ChatInputProps {
  onSend: (message: string) => void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          style={styles.input}
          multiline
          maxLength={500}
          placeholderTextColor="#999"
        />
      </View>
      <TouchableOpacity 
        style={[styles.sendButton, !message.trim() && styles.disabledButton]}
        onPress={handleSend}
        disabled={!message.trim()}
      >
        <Text style={styles.iconContainer}>
          <Ionicons name="send" size={24} color="white" />
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: '16@ms',
    paddingVertical: '12@ms',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: '12@ms',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f5f5f5',
    borderRadius: '24@ms',
    paddingVertical: '8@ms',
    paddingHorizontal: '12@ms',
    maxHeight: '120@ms',
  },
  input: {
    flex: 1,
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#333',
    paddingHorizontal: '8@ms',
    minHeight: '24@ms',
  },
  button: {
    padding: '4@ms',
  },
  sendButton: {
    backgroundColor: Colors.primary,
    width: '48@ms',
    height: '48@ms',
    borderRadius: '24@ms',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  disabledButton: {
    opacity: 0.5,
  },
  iconContainer: {
    // Add any necessary styles for the icon container
  },
}); 