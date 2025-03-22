import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { ScaledSheet } from 'react-native-size-matters';
import { Alert, Clipboard, Linking, Platform, ToastAndroid } from 'react-native';

type UserProfile = {
  id: string;
  name: string;
  profile_pic: string | null;
  phone: string;
  location: {
    current_address: string;
    region: string;
    subregion: string;
    latitude: number;
    longitude: number;
  };
  last_seen: string;
  total_requests: number;
  request_streak: number;
  payment_plan: string;
};

export default function CustomerDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, [id]);

  const calculateRequestStreak = (bookings: any[]) => {
    if (!bookings.length) return 0;
    
    // Sort bookings by date in descending order
    const sortedBookings = [...bookings].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    let streak = 1;
    let currentDate = new Date(sortedBookings[0].created_at);

    for (let i = 1; i < sortedBookings.length; i++) {
      const bookingDate = new Date(sortedBookings[i].created_at);
      const daysDifference = Math.floor(
        (currentDate.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDifference <= 30) { // Consider bookings within 30 days as part of streak
        streak++;
        currentDate = bookingDate;
      } else {
        break;
      }
    }

    return streak;
  };

  const getMostUsedPaymentPlan = (bookings: any[]) => {
    if (!bookings.length) return 'N/A';

    const planCounts = bookings.reduce((acc: any, booking: any) => {
      acc[booking.payment_plan] = (acc[booking.payment_plan] || 0) + 1;
      return acc;
    }, {});

    const mostUsedPlan = Object.entries(planCounts).reduce((a: any, b: any) => 
      planCounts[a] > planCounts[b] ? a : b
    )[0];

    return mostUsedPlan === 'half' ? '50:50' : 'Full Payment';
  };

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user?.id) {
        throw new Error('Auth user not found');
      }



   
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', currentUser.user.id)
        .single();

      if (providerError) throw providerError;
      if (!providerData) throw new Error('Provider not found');

 
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (userError) throw userError;

      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', id)
        .eq('provider_id', providerData.id)
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      console.log('Fetched bookings:', bookings);
      console.log('Provider ID from providers table:', providerData.id);
      console.log('User ID:', id);

      const totalRequests = bookings?.length || 0;
      const requestStreak = calculateRequestStreak(bookings || []);
      const commonPaymentPlan = getMostUsedPaymentPlan(bookings || []);

      setProfile({
        ...userData,
        total_requests: totalRequests,
        request_streak: requestStreak,
        payment_plan: commonPaymentPlan
      });
    } catch (error: any) {
      setError(error.message || 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('', message);
    }
  };

  const handleCall = () => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(`${profile?.phone}`, ToastAndroid.LONG);
    } else {
      Alert.alert(
        'Call Customer',
        `${profile?.phone}`,
        [
          {
            text: 'Copy Number',
            onPress: () => {
              Clipboard.setString(profile?.phone || '');
              if (Platform.OS === 'android') {
                ToastAndroid.show('Phone number copied to clipboard', ToastAndroid.SHORT);
              } else {
                Alert.alert('', 'Phone number copied to clipboard');
              }
            },
          },
          {
            text: 'Call',
            onPress: () => {
              Linking.openURL(`tel:${profile?.phone}`);
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    }
  };

  const handleChat = async () => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user?.id) {
        throw new Error('Auth user not found');
      } 

      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select(`
          id,
          user_id,
          users:user_id (
            name
          )
        `)
        .eq('user_id', currentUser.user.id)
        .single();

      if (providerError) throw providerError;
      if (!providerData) throw new Error('Provider not found');

      const providerName = providerData.users[0]?.name;

      const { data: existingChats, error: searchError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('user_id', id)
        .eq('provider_id', providerData.user_id);

      if (searchError) throw searchError;

      let chatId;

      if (existingChats && existingChats.length > 0) {
        chatId = existingChats[0].id;
      } else {
        const { data: newChat, error: createError } = await supabase
          .from('chat_rooms')
          .insert({
            user_id: id,
            provider_id: providerData.user_id,
            user_name: profile?.name,
            provider_name: providerName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message: null,
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) throw createError;
        chatId = newChat?.id;
      }

      if (chatId) {
        router.push(`/provider/chat/${chatId}`);
      }
    } catch (error) {
      console.error('Error handling chat:', error);
      Alert.alert('Error', 'Failed to open chat');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchUserProfile}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getLocationString = () => {
    if (!profile.location) return 'Location not set';
    return profile.location.current_address || `${profile.location.region}, ${profile.location.subregion}`;
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          <Text style={styles.verifiedText}>Verified User</Text>
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{profile.name}</Text>
          <View style={styles.locationContainer}>
            <Text style={styles.locationText}>{getLocationString()}</Text>
          </View>
        </View>

        <Image
          source={{ uri: profile.profile_pic || 'https://via.placeholder.com/150' }}
          style={styles.profileImage}
        />

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <Ionicons name="call" size={20} color="#0066CC" />
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleChat}>
            <Ionicons name="chatbubble-outline" size={20} color="#0066CC" />
            <Text style={styles.actionText}>Chat</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statsItem}>
          <Text style={styles.statsNumber}>{profile.total_requests}</Text>
          <Text style={styles.statsLabel}>Total{'\n'}Requests</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsNumber}>{profile.request_streak}</Text>
          <Text style={styles.statsLabel}>Request{'\n'}Streak</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsNumber}>{profile.payment_plan}</Text>
          <Text style={styles.statsLabel}>Preferred{'\n'}Payment</Text>
        </View>
      </View>

      {/* Report Button */}
      <TouchableOpacity style={styles.reportButton}>
        <Ionicons name="flag-outline" size={20} color="#FF4B55" />
        <Text style={styles.reportText}>Report this user</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: '16@ms',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: '8@ms',
  },
  profileCard: {
    margin: '16@ms',
    padding: '16@ms',
    backgroundColor: '#fff',
    borderRadius: '16@ms',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  verifiedText: {
    marginLeft: '4@ms',
    color: '#4CAF50',
    fontFamily: 'Urbanist-Medium',
  },
  profileInfo: {
    marginBottom: '16@ms',
  },
  userName: {
    fontSize: '24@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
    marginBottom: '4@ms',
  },
  locationContainer: {
    marginBottom: '8@ms',
  },
  locationText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  lastSeen: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
  },
  timeAgo: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#000',
  },
  profileImage: {
    width: '120@ms',
    height: '120@ms',
    borderRadius: '60@ms',
    alignSelf: 'center',
    marginVertical: '16@ms',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: '24@ms',
    marginTop: '16@ms',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5F3FF',
    paddingVertical: '8@ms',
    paddingHorizontal: '16@ms',
    borderRadius: '8@ms',
    gap: '8@ms',
  },
  actionText: {
    color: '#0066CC',
    fontFamily: 'Urbanist-SemiBold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: '16@ms',
    gap: '16@ms',
  },
  statsItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: '16@ms',
    borderRadius: '12@ms',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  statsNumber: {
    fontSize: '24@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
    marginBottom: '4@ms',
  },
  statsLabel: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    textAlign: 'center',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '24@ms',
    marginBottom: '32@ms',
    gap: '8@ms',
  },
  reportText: {
    color: '#FF4B55',
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '14@ms',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: '16@ms',
  },
  errorText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#FF4B55',
    textAlign: 'center',
    marginBottom: '16@ms',
  },
  retryButton: {
    backgroundColor: '#0066CC',
    paddingVertical: '8@ms',
    paddingHorizontal: '16@ms',
    borderRadius: '8@ms',
  },
  retryText: {
    color: '#fff',
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '14@ms',
  },
}); 