import React from 'react';
import { View, TextInput, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

// Check if device has a small screen
const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChangeText, placeholder }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={isSmallDevice ? 18 : 20} color="#666" />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#666"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: isSmallDevice ? 8 : 10,
    marginHorizontal: 16,
    marginVertical: isSmallDevice ? 6 : 8,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: isSmallDevice ? 14 : 16,
    fontFamily: 'Urbanist-Medium',
    color: '#333',
  },
}); 