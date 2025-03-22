import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from "@expo/vector-icons";

export const EmptyChat = () => (
  <View style={styles.emptyContainer}>
    <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
    <Text style={styles.emptyTitle}>No Messages Yet</Text>
    <Text style={styles.emptyText}>
      Your conversations will appear here when you start chatting
    </Text>
  </View>
);

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
}); 