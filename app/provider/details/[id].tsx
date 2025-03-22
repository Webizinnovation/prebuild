import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { ScaledSheet } from 'react-native-size-matters';
import { sendBookingStatusNotification } from '../../../utils/notifications';

type BookingDetails = {
  id: string;
  service: string;
  booking_date: string;
  booking_time: string;
  address: string;
  landmark?: string;
  amount: number;
  status: string;
  payment_plan: 'full_upfront' | 'half';
  activities: string[];
  user_id: string;
  service_details?: Array<{
    service_name: string;
    details: string;
  }>;
  user: {
    id: string;
    name: string;
    profile_pic: string | null;
    phone: string;
  };
};

type BookingPayload = {
  new: {
    status: string;
    [key: string]: any;
  };
};

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [booking, setBooking] = useState<BookingDetails | null>(null);

  useEffect(() => {
    fetchBookingDetails();

    const channel = supabase
      .channel(`booking_${id}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${id}`,
        },
        (payload: BookingPayload) => {
          if (payload.new) {
            setBooking(prev => prev ? {
              ...prev,
              status: payload.new.status,
            } : null);

            if (payload.new.status === 'accepted') {
              Alert.alert(
                'Booking Accepted',
                'You have accepted the request.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchBookingDetails = async () => {
    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id,
          service,
          booking_date,
          booking_time,
          address,
          landmark,
          amount,
          status,
          payment_plan,
          user_id,
          service_details
        `)
        .eq('id', id)
        .single();

      if (bookingError) throw bookingError;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          profile_pic,
          phone
        `)
        .eq('id', bookingData.user_id)
        .single();

      if (userError) throw userError;

      const transformedData: BookingDetails = {
        ...bookingData,
        activities: [bookingData.service],
        user: userData
      };

      setBooking(transformedData);
    } catch (error) {
      console.error('Error fetching booking details:', error);
    }
  };

  const handleAccept = async () => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      if (booking?.user_id) {
        await sendBookingStatusNotification(
          booking.user_id,
          String(id),
          'accepted',
          booking.service
        );
      }

      router.back();
    } catch (error) {
      console.error('Error accepting booking:', error);
      Alert.alert('Error', 'Failed to accept booking');
    }
  };

  const handleReject = async () => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      
      if (booking?.user_id) {
        try {
          await sendBookingStatusNotification(
            booking.user_id,
            String(id),
            'cancelled',
            booking.service
          );
        } catch (notifError) {
          console.error('Failed to send notification, but booking was rejected:', notifError);
          // Continue with the process even if notification fails
        }
      }

      router.back();
    } catch (error) {
      console.error('Error rejecting booking:', error);
      Alert.alert('Error', 'Failed to reject booking');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return '#4CAF50';
      case 'cancelled':
        return '#FF4B55';
      default:
        return '#666';
    }
  };

  if (!booking) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.statusContainer, { borderColor: getStatusColor(booking.status) }]}>
          <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
            Status: {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.customerInfoContainer}>
            <View style={styles.customerDetails}>
              <View style={styles.nameContainer}>
                <Text style={styles.customerName}>{booking.user.name}</Text>
                <TouchableOpacity 
                  style={styles.chatButton}
                  onPress={async () => {
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
                        .eq('user_id', booking.user.id)
                        .eq('provider_id', providerData.user_id);

                      if (searchError) throw searchError;

                      let chatId;

                      if (existingChats && existingChats.length > 0) {
                        chatId = existingChats[0].id;
                      } else {
                        const { data: newChat, error: createError } = await supabase
                          .from('chat_rooms')
                          .insert({
                            user_id: booking.user.id,
                            provider_id: providerData.user_id,
                            user_name: booking.user.name,
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
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={20} color="#0066CC" />
                  <Text style={styles.chatButtonText}>Chat</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.customerPhone}>{booking.user.phone}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push(`/provider/customer/${booking.user.id}`)}
            >
              <Image 
                source={{ 
                  uri: booking.user.profile_pic || 'https://via.placeholder.com/40'
                }}
                style={styles.customerImage}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.serviceHeaderContainer}>
            <Text style={styles.sectionTitle}>Service Details</Text>
             <View style={styles.bookingIdContainer}>
              <Text style={styles.bookingId}>
                PL{typeof id === 'string' ? id.slice(0, 4).toUpperCase() : ''}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date:</Text>
            <Text style={styles.detailValue}>{booking.booking_date}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time:</Text>
            <Text style={styles.detailValue}>{booking.booking_time}</Text>
          </View>
          <TouchableOpacity 
            style={styles.detailRow}
            onPress={() => router.push(`/provider/map/${id}`)}
          >
            <Text style={styles.detailLabel}>Location:</Text>
            <View style={styles.locationContainer}>
              <Text style={styles.detailValue}>{booking.address}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
          </TouchableOpacity>
          {booking.landmark && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Landmark:</Text>
              <Text style={styles.detailValue}>{booking.landmark}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Plan:</Text>
            <Text style={styles.detailValue}>
              {booking.payment_plan === 'half' ? '50% Upfront' : 'Full Payment'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activities Included</Text>
          {booking.activities?.map((activity, index) => (
            <View key={index} style={styles.activityItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>{activity}</Text>
                {booking.service_details?.find(detail => detail.service_name === activity)?.details && (
                  <Text style={styles.activityDetails}>
                    {booking.service_details.find(detail => detail.service_name === activity)?.details}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.paymentContainer}>
            <Text style={styles.paymentLabel}>Total Amount:</Text>
            <Text style={styles.paymentAmount}>
              NGN {booking.amount.toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>

      {booking.status === 'pending' && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.button, styles.acceptButton]}
            onPress={handleAccept}
          >
            <Text style={styles.buttonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.rejectButton]}
            onPress={handleReject}
          >
            <Text style={styles.buttonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: '16@ms',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16@ms',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerTitle: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  content: {
    flex: 1,
    padding: '16@ms',
  },
  section: {
    marginBottom: '24@ms',
  },
  sectionTitle: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
    marginBottom: '12@ms',
  },
  customerInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#000',
    marginBottom: '4@ms',
  },
  customerPhone: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  customerImage: {
    width: '50@ms',
    height: '50@ms',
    borderRadius: '25@ms',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: '8@ms',
  },
  detailLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  detailValue: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#000',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  activityContent: {
    flex: 1,
    marginLeft: '8@ms',
  },
  activityText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#000',
    marginBottom: '4@ms',
  },
  activityDetails: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    lineHeight: '16@ms',
  },
  paymentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: '16@ms',
    borderRadius: '12@ms',
  },
  paymentLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  paymentAmount: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  footer: {
    flexDirection: 'row',
    padding: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    gap: '12@ms',
  },
  button: {
    flex: 1,
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#FF4B55',
  },
  buttonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  statusContainer: {
    margin: '16@ms',
    padding: '12@ms',
    borderRadius: '8@ms',
    borderWidth: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  statusText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
  },
  serviceHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12@ms',
  },
  bookingIdContainer: {
    backgroundColor: '#E5F3FF',
    paddingHorizontal: '12@ms',
    paddingVertical: '4@ms',
    borderRadius: '16@ms',
  },
  bookingId: {
    fontSize: '13@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#0066CC',
  },
  locationContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8@s',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5F3FF',
    paddingVertical: '4@s',
    paddingHorizontal: '8@s',
    borderRadius: '6@s',
    gap: '4@s',
  },
  chatButtonText: {
    color: '#0066CC',
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '12@s',
  },
}); 