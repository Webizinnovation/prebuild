import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform, BackHandler } from 'react-native';
import { Text, Card, Button, TextInput } from 'react-native-paper';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { useRouter } from 'expo-router';
import { ProfileBanner } from '../../components/common/ProfileBanner';
import DrawerModal from '../../components/common/DrawerModal';
import ProviderProfileScreen from '../../components/provider/profile';
import { useFocusEffect } from 'expo-router';
import { UserProfile } from '../../components/user/UserProfile';

export default function ProfileScreen() {
  const { profile } = useUserStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
  });

  useFocusEffect(
    React.useCallback(() => {
      const handleBackPress = () => {
        if (router.canGoBack()) {
          return false;
        }
        // handleLogout();
        return true;
      };

      if (Platform.OS === 'android') {
        BackHandler.addEventListener('hardwareBackPress', handleBackPress);
        return () => BackHandler.removeEventListener('hardwareBackPress', handleBackPress);
      }
    }, [])
  );

  if (profile?.role === 'provider') {
    return <ProviderProfileScreen />;
  }

  if (profile?.role === 'user') {
    return <UserProfile />;
  }

  return null;
}
