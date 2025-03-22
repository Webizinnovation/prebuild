import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';
import { decode } from 'base64-arraybuffer';
import { Colors } from '../constants/Colors';
import { UserProfile } from '../types';

interface HeaderProps {
  profile: UserProfile | null;
  onUpdateProfilePic?: (url: string) => void;
}

export default function Header({ profile, onUpdateProfilePic }: HeaderProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchUnreadCount = async () => {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('read', false);
        
        setUnreadCount(count || 0);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const pickImage = async () => {
    if (!profile?.id) return;
    
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64FileData = result.assets[0].base64;
        const filePath = `${profile.id}/profile-${Date.now()}.jpg`;

        const { error: uploadError, data } = await supabase.storage
          .from('profiles')
          .upload(filePath, decode(base64FileData), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);

        if (onUpdateProfilePic) {
          onUpdateProfilePic(publicUrl);
        }

        await supabase
          .from('users')
          .update({ profile_pic: publicUrl })
          .eq('id', profile.id);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    }
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.profileContainer}
        onPress={pickImage}
      >
        <Image
          source={{ uri: profile?.profile_pic || 'https://via.placeholder.com/50' }}
          style={styles.profilePic}
        />
      </TouchableOpacity>
      <View style={styles.userInfo}>
        <View style={styles.nameContainer}>
          <Text style={styles.greeting}>Hi, </Text>
          <Text style={styles.username}>{profile?.name || 'User'}</Text>
        </View>
        <Text style={styles.role}>
          {profile?.role === 'provider' ? 'Provider' : 'User'}
        </Text>
      </View>
      <View>
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#333" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileContainer: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 18,
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  username: {
    fontSize: 22,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  role: {
    fontSize: 14,
    color: Colors.primary,
    fontFamily: 'Urbanist-Medium',
    marginTop: 2,
  },
  notificationButton: {
    padding: 8,
  },
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4B55',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Urbanist-Bold',
  },
}); 