import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Avatar, Text, Badge, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { UserProfile, Notification } from '../../types';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { decode } from 'base64-arraybuffer';

export function ProfileHeader() {
  const [unreadCount, setUnreadCount] = useState(0);
  const { profile, updateProfile } = useUserStore();

  if (!profile) return null;

  useEffect(() => {
    fetchUnreadNotifications();
    subscribeToNotifications();
  }, []);

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        // Upload directly using base64
        const filePath = `${profile.id}/profile.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(filePath, decode(result.assets[0].base64), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);

        // Update user profile
        await updateProfile({ ...profile, profile_pic: data.publicUrl });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    }
  };

  const fetchUnreadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', profile.id)
        .eq('read', false);

      if (error) throw error;
      setUnreadCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const subscribeToNotifications = () => {
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchUnreadNotifications();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleNotificationsPress = () => {
    router.push('/notifications');
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
      <TouchableOpacity onPress={handleImagePick}>
        <Avatar.Image
          size={40}
          source={{ uri: profile?.profile_pic || 'https://via.placeholder.com/40' }}
        />
      </TouchableOpacity>
      <View style={styles.textContainer}>
        <Text variant="titleMedium">Welcome,</Text>
        <Text variant="titleLarge" style={styles.name}>{profile?.name}</Text>
      </View>
      </View>

      <View style={styles.rightSection}>
        <TouchableOpacity 
          style={styles.notificationContainer}
          onPress={handleNotificationsPress}
        >
          <IconButton
            icon="bell"
            size={24}
            onPress={handleNotificationsPress}
          />
          {unreadCount > 0 && (
            <Badge
              size={20}
              style={styles.badge}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: 12,
  },
  name: {
    fontWeight: 'bold',
  },
  notificationContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4444',
  },
}); 