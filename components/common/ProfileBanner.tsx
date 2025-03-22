import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import { useUserStore } from '../../store/useUserStore';

export function ProfileBanner() {
  const { profile } = useUserStore();

  if (!profile) return null;

  return (
    <View style={styles.container}>
      <Avatar.Image
        size={60}
        source={{ uri: profile.profile_pic || 'https://via.placeholder.com/60' }}
      />
      <View style={styles.textContainer}>
        <Text variant="headlineSmall" style={styles.name}>{profile.name}</Text>
        <Text variant="bodyMedium" style={styles.role}>{profile.role}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  textContainer: {
    marginLeft: 16,
  },
  name: {
    fontWeight: 'bold',
  },
  role: {
    textTransform: 'capitalize',
    color: '#666',
  },
}); 