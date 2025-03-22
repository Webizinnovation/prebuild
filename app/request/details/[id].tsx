import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, Modal, Pressable } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { Colors } from '../../../constants/Colors';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../../../store/useUserStore';
import { supabase } from '../../../services/supabase';
import { router } from 'expo-router';
import { UserProfile } from '../../../types/index';
import Toast from 'react-native-toast-message';
import { BlurView } from 'expo-blur';
import { sendBookingStatusNotification } from '../../../utils/notifications';
import { createUserNotification } from '../../../utils/notifications';

type BookingStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

interface BookingDetailsType {
  id: string;
  service: string;
  price: number;
  name: string;
  date: string;
  time?: string;
  details?: string;
  status: BookingStatus;
  payment_plan: 'full_upfront' | 'half';
  payment_details: {
    workmanship_fee: number;
    tools_hardware: number;
    vat: number;
  };
  landmark?: string;
  address?: string;
  service_details?: Array<{
    service_name: string;
    details: string;
  }>;
  payment_status?: 'pending' | 'completed';
  additional_services?: string[];
  provider_id?: string;
  provider_accepted?: boolean;
  user_id?: string;
  first_payment_completed?: boolean;
  final_payment_completed?: boolean;
}

interface ProviderDetails {
  id: string;
  services: Record<string, number>;
  users: {
    id: string;
    name: string;
    profile_pic?: string;
    phone?: string;
  };
  booking?: {
    id: string;
    service: string;
    booking_date: string;
    booking_time?: string;
    address?: string;
    amount: number;
    status: BookingStatus;
  };
}

interface PaymentConfirmationDialogProps {
  visible: boolean;
  amount: number;
  isHalfPayment: boolean;
  totalAmount: number;
  isFirstPayment: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const PaymentConfirmationDialog = ({ 
  visible, 
  amount, 
  isHalfPayment, 
  totalAmount,
  isFirstPayment,
  onConfirm, 
  onCancel 
}: PaymentConfirmationDialogProps) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <BlurView intensity={10} style={styles.blurContainer}>
        <View style={styles.dialogContainer}>
          <View style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>Confirm Payment</Text>
            
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Amount to Pay:</Text>
              <Text style={styles.amountValue}>₦{amount.toLocaleString()}</Text>
            </View>

            {isHalfPayment && isFirstPayment && (
              <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                  This is the initial payment (50%). You will need to pay the remaining ₦{Math.floor(totalAmount/2).toLocaleString()} after the service begins.
                </Text>
              </View>
            )}

            {isHalfPayment && !isFirstPayment && (
              <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                  This is the final payment (50%) to complete your service payment.
                </Text>
              </View>
            )}

            <Text style={styles.confirmText}>
              Are you sure you want to proceed with this payment?
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.dialogCancelButton]} 
                onPress={onCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.confirmButton]}
                onPress={onConfirm}
              >
                <Text style={styles.confirmButtonText}>Confirm Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

export default function BookingDetailsScreen() {
  const params = useLocalSearchParams();
  const { profile } = useUserStore();
  const [booking, setBooking] = useState<BookingDetailsType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [providerData, setProviderData] = useState<ProviderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const bookingData = params.data ? JSON.parse(params.data as string) : null;
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const handleChat = async () => {
    if (!profile || !providerData?.users?.id) return;
    
    try {
      const { data: existingChats, error: searchError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('user_id', profile.id)
        .eq('provider_id', providerData.users.id);

      if (searchError) throw searchError;

      let chatId;

      if (existingChats && existingChats.length > 0) {
        chatId = existingChats[0].id;
      } else {
        const { data: newChat, error: createError } = await supabase
          .from('chat_rooms')
          .insert({
            user_id: profile.id,
            provider_id: providerData.users.id,
            user_name: profile.name,
            provider_name: providerData.users.name,
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
        router.push(`/chat/${chatId}`);
      }
    } catch (error: any) {
      Alert.alert('Chat Error', error.message || 'Failed to start chat');
    }
  };

  const fetchProviderData = async () => {
    try {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id,
          service,
          booking_date,
          booking_time,
          address,
          amount,
          status,
          payment_plan,
          provider_id,
          user_id,
          landmark,
          service_details,
          first_payment_completed,
          final_payment_completed
        `)
        .eq('id', params.id)
        .single();

      if (bookingError) throw bookingError;

      if (!booking) {
        throw new Error('Booking not found');
      }

      console.log('Database booking fields:', {
        booking_date: booking.booking_date,
        booking_time: booking.booking_time
      });

      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select(`
          id,
          services,
          users!inner (
            id,
            name,
            profile_pic,
            phone
          )
        `)
        .eq('id', booking.provider_id)
        .single();

      if (providerError) throw providerError;

      if (!provider) {
        throw new Error('Provider not found');
      }

      const transformedData: ProviderDetails = {
        id: provider.id,
        services: provider.services,
        users: {
          id: (provider.users as any).id,
          name: (provider.users as any).name,
          profile_pic: (provider.users as any).profile_pic || undefined,
          phone: (provider.users as any).phone || undefined
        }
      };

      setProviderData(transformedData);

      // Update booking with all fetched data from the database
      setBooking(prev => {
        if (!prev) return null;
        
        // Always use amount from the database for price
        const price = booking.amount || prev.price;
        const servicePrice = transformedData.services?.[booking.service] ?? price;
        
        return {
          ...prev,
          ...booking,
          price: servicePrice,
          payment_plan: booking.payment_plan || prev.payment_plan || 'full_upfront',
          landmark: booking.landmark,
          service_details: booking.service_details,
          first_payment_completed: booking.first_payment_completed || false,
          final_payment_completed: booking.final_payment_completed || false,
          payment_details: {
            workmanship_fee: Math.floor(servicePrice * 0.6),
            tools_hardware: Math.floor(servicePrice * 0.35),
            vat: Math.floor(servicePrice * 0.052),
          },
          // Ensure date fields are properly mapped from the database
          date: booking.booking_date || prev.date,
          time: booking.booking_time || prev.time
        };
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load provider details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!booking && params.data) {
      try {
        const parsedData = JSON.parse(params.data as string);
        
        const payment_plan = parsedData.payment_plan || 'full_upfront';

        const transformedData: BookingDetailsType = {
          ...parsedData,
          id: params.id as string,
          payment_plan: payment_plan,
          payment_details: {
            workmanship_fee: Math.floor((parsedData.price || 0) * 0.6),
            tools_hardware: Math.floor((parsedData.price || 0) * 0.35),
            vat: Math.floor((parsedData.price || 0) * 0.052),
          },
          first_payment_completed: parsedData.first_payment_completed || false,
          final_payment_completed: parsedData.final_payment_completed || false
        };
        
        setBooking(transformedData);

        // Always fetch the latest data from the database to ensure accuracy
        fetchProviderData();
      } catch (error) {
        console.error('Error parsing booking data:', error);
      }
    }
  }, [params.data]);

  useEffect(() => {
    const fetchLatestBookingData = async () => {
      if (!params.id) return;
      
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', params.id)
          .single();
          
        if (error) throw error;
        
        if (data) {
          // Update the booking state with the latest data from the database
          setBooking(prev => {
            if (!prev) return null;
            
            // Preserve existing payment_details if they exist
            const paymentDetails = prev.payment_details || {
              workmanship_fee: Math.floor((data.amount || 0) * 0.6),
              tools_hardware: Math.floor((data.amount || 0) * 0.35),
              vat: Math.floor((data.amount || 0) * 0.052),
            };
            
            return {
              ...prev,
              status: data.status,
              payment_plan: data.payment_plan || prev.payment_plan,
              first_payment_completed: data.first_payment_completed || false,
              final_payment_completed: data.final_payment_completed || false,
              price: data.amount || prev.price, // Use amount from booking data
              payment_details: paymentDetails
            };
          });
        }
      } catch (error) {
        console.error('Error fetching latest booking data:', error);
      }
    };
    
    fetchLatestBookingData();
  }, [params.id]);

  useEffect(() => {
    if (booking && !booking.payment_details.workmanship_fee) {
      const totalPrice = Number(booking.price) || 0;
      
      setBooking(prev => ({
        ...prev!,
        payment_details: {
          workmanship_fee: Math.floor(totalPrice * 0.6),
          tools_hardware: Math.floor(totalPrice * 0.35),
          vat: Math.floor(totalPrice * 0.052),
        }
      }));
    }
  }, [booking]);

  useEffect(() => {
    if (booking) {
      // Debug date values
      console.log('Current date values:', {
        bookingData_date: bookingData?.date,
        booking_date: booking?.date,
        rawData: booking
      });
    }
  }, [booking, bookingData]);

  useEffect(() => {
  }, [bookingData, booking]);

  const handlePaymentConfirm = async () => {
    setShowConfirmation(false);
    await processPayment();
  };

  const processPayment = async () => {
    if (!profile || !booking) return;

    const payment_plan = booking.payment_plan || 'full_upfront';
    
    // Get the accurate payment status from booking state
    const isSecondPayment = payment_plan === 'half' && booking.first_payment_completed === true;
    
    const paymentAmount = payment_plan === 'half' 
      ? Math.floor(booking.price / 2) 
      : booking.price;

    // Get current user's wallet balance using the auth user_id
    const { data: walletData, error: walletError } = await supabase
      .from('wallets')
      .select('balance, user_id')
      .eq('user_id', profile.id)
      .single();

    if (walletError) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not fetch wallet balance. Please try again.',
        position: 'bottom',
        visibilityTime: 4000,
      });
      return;
    }

    // Check if user has sufficient balance
    if ((walletData?.balance || 0) < paymentAmount) {
      Toast.show({
        type: 'error',
        text1: 'Insufficient Balance',
        text2: `You need ₦${paymentAmount.toLocaleString()} to complete this payment. Please top up your wallet.`,
        position: 'bottom',
        visibilityTime: 4000,
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Generate transaction reference
      const transactionRef = `TRX-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          reference: transactionRef,
          amount: paymentAmount,
          type: 'payment',
          status: 'completed',
          user_id: profile.id,
          provider_id: booking.provider_id,
          booking_id: booking.id,
          metadata: {
            payment_type: isSecondPayment ? 'final_payment' : payment_plan === 'half' ? 'first_payment' : 'full_payment',
            provider_name: providerData?.users?.name,
            service: booking.service,
            user_name: profile.name,
            user_id: profile.id
          }
        });

      if (transactionError) throw transactionError;

      // Update user's wallet balance
      const { error: userWalletError } = await supabase
        .from('wallets')
        .update({ 
          balance: (walletData.balance || 0) - paymentAmount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', profile.id);

      if (userWalletError) throw userWalletError;

      // Use RPC to update provider's wallet balance
      const { error: providerWalletError } = await supabase.rpc(
        'increase_wallet_balance',
        { 
          p_user_id: providerData?.users?.id,
          amount: paymentAmount
        }
      );

      if (providerWalletError) {
        console.error('Provider Wallet Error:', providerWalletError);
        throw providerWalletError;
      }

      // Update booking status
      let newStatus: BookingStatus = 'in_progress';
      if (payment_plan === 'full_upfront' || (payment_plan === 'half' && isSecondPayment)) {
        newStatus = 'completed'; // Final payments complete the booking
      }
      
      const updateData: {
        status: BookingStatus;
        updated_at: string;
        first_payment_completed?: boolean;
        final_payment_completed?: boolean;
        price?: number;
      } = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        price: booking.price // Preserve the original price
      };

      // Add the appropriate payment completion flag
      if (payment_plan === 'half') {
        if (isSecondPayment) {
          updateData.final_payment_completed = true;
        } else {
          updateData.first_payment_completed = true;
        }
      } else {
        // For full upfront payment, set both flags
        updateData.first_payment_completed = true;
        updateData.final_payment_completed = true;
      }
      
      const { error: statusError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id);

      if (statusError) throw statusError;

      // Send notification to provider about payment
      if (booking.provider_id) {
        try {
          const notificationTitle = isSecondPayment ? 'Final Payment Received' : 'Payment Received';
          const notificationMessage = isSecondPayment 
            ? `Final payment for ${booking.service} has been received.` 
            : `Payment for ${booking.service} has been received.`;
          
          await createUserNotification(
            booking.provider_id,
            notificationTitle,
            notificationMessage,
            'payment'
          );
        } catch (notifError) {
          console.error('Failed to send notification, but payment was processed:', notifError);
          // Continue with the process even if notification fails
        }
      }

      // Always refetch the latest booking data to ensure UI is accurate
      const { data: updatedBooking, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', booking.id)
        .single();

      if (!bookingError && updatedBooking) {
        // Update the local booking object with the latest data
        setBooking({
          ...booking, 
          ...updatedBooking, 
          price: updatedBooking.amount || booking.price, 
          payment_status: 'completed',
          payment_details: booking.payment_details,
          payment_plan: updatedBooking.payment_plan || booking.payment_plan,
          first_payment_completed: isSecondPayment ? booking.first_payment_completed : true,
          final_payment_completed: isSecondPayment || payment_plan === 'full_upfront'
        });
      }

      setWalletBalance((walletData.balance || 0) - paymentAmount);

      Toast.show({
        type: 'success',
        text1: 'Payment Successful',
        text2: payment_plan === 'half' ? 
          (isSecondPayment ? 'Final payment completed. Your service is now complete.' : 'Initial payment made. You will need to make the final payment after service begins.') :
          'Payment completed successfully.',
        position: 'bottom',
        visibilityTime: 4000,
      });

    } catch (error) {
      console.error('Payment error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to process payment. Please try again.',
        position: 'bottom',
        visibilityTime: 4000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (!profile || !booking) return;

    // Fetch latest wallet balance before showing confirmation
    const { data: walletData, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', profile.id)
      .single();

    if (walletError) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not fetch wallet balance. Please try again.',
        position: 'bottom',
        visibilityTime: 4000,
      });
      return;
    }

    setWalletBalance(walletData?.balance || 0);
    setShowConfirmation(true);
  };

  const handleCancel = async (bookingId: string) => {
    try {
      // Get booking details including payment plan and payment status
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('status, payment_plan, first_payment_completed, provider_id')
        .eq('id', bookingId)
        .single();

      if (bookingError) throw bookingError;

      // Check if this is a half payment booking and first payment is completed
      if (bookingData?.payment_plan === 'half' && bookingData?.first_payment_completed) {
        Toast.show({
          type: 'error',
          text1: 'Cannot Cancel',
          text2: 'You cannot cancel this booking after making the initial payment.',
          position: 'top',
          visibilityTime: 4000,
        });
        return;
      }

      Alert.alert(
        "Cancel Booking",
        "Are you sure you want to cancel this booking?",
        [
          {
            text: "No",
            style: "cancel"
          },
          {
            text: "Yes, Cancel",
            style: "destructive",
            onPress: async () => {
              try {
                setLoadingBookings(prev => ({ ...prev, [bookingId]: true }));
                
                // Add a timestamp to track when the cancellation was requested
                const { error } = await supabase
                  .from('bookings')
                  .update({ 
                    status: 'cancelled',
                    updated_at: new Date().toISOString(),
                    cancelled_at: new Date().toISOString(),
                    cancelled_by: profile?.id,
                    cancellation_reason: 'user_cancelled'
                  })
                  .eq('id', bookingId);

                if (error) throw error;

                // Send notification to provider if they exist
                if (bookingData?.provider_id) {
                  try {
                    await sendBookingStatusNotification(
                      bookingData.provider_id,
                      bookingId,
                      'cancelled',
                      booking?.service || 'Booking'
                    );
                  } catch (notifError) {
                    console.error('Failed to send notification, but booking was cancelled:', notifError);
                    // Continue with the process even if notification fails
                  }
                }

                await fetchProviderData();
                
                Toast.show({
                  type: 'success',
                  text1: 'Success',
                  text2: 'Booking has been cancelled successfully',
                  position: 'top',
                  visibilityTime: 3000,
                });
              } catch (error) {
                console.error('Error:', error);
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: 'Failed to cancel booking. Please try again.',
                  position: 'top',
                  visibilityTime: 4000,
                });
              } finally {
                setLoadingBookings(prev => ({ ...prev, [bookingId]: false }));
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to process cancellation. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    }
  };

  if (!booking) return null;

  const getActivities = (booking: BookingDetailsType) => {
    if (!booking?.service) return [];
    const services = booking.service.split(', ').filter(Boolean);
    return services.map((service, index) => ({
      id: index + 1,
      name: service.trim()
    }));
  };

  const formatDate = (date: string, time?: string) => {
    try {
      // Log the date for debugging
      console.log('Formatting date:', date, typeof date);
      
      if (!date) return 'Date not available';
      
      let dateObj;
      
      // Handle different date formats
      if (typeof date === 'string') {
        if (date.includes('/')) {
          // DD/MM/YYYY format
          const [day, month, year] = date.split('/').map(Number);
          // Ensure the year is realistic - but don't exclude valid future years
          const fixedYear = year < 100 ? 2000 + year : year;
          dateObj = new Date(fixedYear, month - 1, day);
        } else if (date.includes('-')) {
          // YYYY-MM-DD format
          const [year, month, day] = date.split('-').map(Number);
          dateObj = new Date(year, month - 1, day);
        } else if (!isNaN(Date.parse(date))) {
          // Standard date string
          dateObj = new Date(date);
        } else {
          console.log('Invalid date format:', date);
          // Instead of returning error, just return the original string
          return date; 
        }
      } else {
        // Not a string, return a fallback
        return 'Invalid date';
      }
      
      // Only reject the date if it's completely invalid
      if (isNaN(dateObj.getTime())) {
        console.log('Invalid date object:', date);
        // Just return the original string
        return date; 
      }

      // Format the date in a user-friendly way
      try {
        const dateString = dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        if (time) {
          return `${dateString} at ${time}`;
        }

        return dateString;
      } catch (formatError) {
        console.log('Error in date formatting:', formatError);
        // Just return a simple formatted date as fallback
        return `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
      }
    } catch (error) {
      console.log('Error processing date:', date, error);
      // Return the original string instead of an error message
      return String(date);
    }
  };

 

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Booking Details',
          headerShown: true,
        }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchProviderData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : providerData ? (
        <ScrollView style={styles.scrollView}>
          <View style={styles.idBadgeContainer}>
            <View style={styles.idBadge}>
              <MaterialIcons name="confirmation-number" size={16} color={Colors.primary} />
              <Text style={styles.idText}>Booking ID:</Text>
              <Text style={styles.idNumber}>#{booking.id.slice(0, 8)}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Provider</Text>
            <View style={styles.providerHeader}>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{bookingData?.name}</Text>
                {providerData?.users?.phone && (
                  <Text style={styles.providerPhone}>
                    <Ionicons name="call-outline" size={14} color="#666" />
                    {' '}{providerData.users.phone}
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                style={styles.chatButton}
                onPress={handleChat}
              >
                <Ionicons name="chatbubbles" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.bookingDate}>
              {formatDate(booking?.date || bookingData?.date, booking?.time || bookingData?.time)}
            </Text>
            
            {bookingData?.details && (
              <View style={styles.addressContainer}>
                <Text style={styles.addressLabel}>Address</Text>
                <Text style={styles.addressText}>{bookingData.details}</Text>
                {bookingData.landmark && (
                  <>
                    <Text style={styles.landmarkLabel}>Landmark</Text>
                    <Text style={styles.landmarkText}>{bookingData.landmark}</Text>
                  </>
                )}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Details</Text>
            <View style={styles.locationContainer}>
              {getActivities(booking).map((activity, index) => (
                <View key={index} style={styles.serviceDetailItem}>
                  <Text style={styles.serviceName}>{activity.name}</Text>
                  {booking.service_details?.find((detail: { service_name: string; details: string }) => 
                    detail.service_name === activity.name
                  )?.details ? (
                    <Text style={styles.serviceDetails}>
                      {booking.service_details.find((detail: { service_name: string; details: string }) => 
                        detail.service_name === activity.name
                      )?.details}
                    </Text>
                  ) : (
                    <Text style={styles.noDetailsText}>No additional details provided</Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment details</Text>
            
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Workmanship fee (60%)</Text>
              <Text style={styles.paymentValue}>
                ₦{Math.floor((booking?.price || 0) * 0.6).toLocaleString()}
              </Text>
            </View>

            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Tools and hardware (36.6%)</Text>
              <Text style={styles.paymentValue}>
                ₦{Math.floor((booking?.price || 0) * 0.366).toLocaleString()}
              </Text>
            </View>

            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>VAT (3.2%)</Text>
              <Text style={styles.paymentValue}>
                ₦{Math.floor((booking?.price || 0) * 0.032).toLocaleString()}
              </Text>
            </View>

           <View style={[styles.paymentItem, styles.totalItem]}>
    <View>
      <Text style={styles.totalLabel}>Total</Text>
      <Text style={styles.paymentPlan}>
        {booking?.payment_plan === 'half' ? 
          (booking?.first_payment_completed ? '(50% Final Payment)' : '(50% Initial Payment)') 
          : '(Full Payment)'}
      </Text>
    </View>
    <View style={{alignItems: 'flex-end'}}>
              <Text style={styles.totalValue}>₦{(booking?.price || 0).toLocaleString()}</Text>
              {booking?.payment_plan === 'half' && (
        <Text style={styles.paymentAmountText}>
                  Pay Now: ₦{Math.floor((booking?.price || 0) / 2).toLocaleString()}
        </Text>
      )}
    </View>
  </View>
</View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>
            {(bookingData?.status || booking?.status) === 'pending' ? (
              <View style={styles.pendingContainer}>
                <MaterialIcons name="hourglass-empty" size={24} color={Colors.primary} />
                <Text style={styles.pendingText}>Waiting for provider to accept your request</Text>
              </View>
            ) : booking?.final_payment_completed || (booking?.first_payment_completed && booking?.payment_plan === 'full_upfront') ? (
              <View style={styles.completedContainer}>
                <MaterialIcons name="check-circle" size={24} color={Colors.success} />
                <Text style={styles.completedText}>Payment Completed</Text>
              </View>
            ) : booking?.first_payment_completed && booking?.payment_plan === 'half' ? (
              <TouchableOpacity 
                style={styles.paymentButton}
                onPress={handlePayment}
                disabled={isProcessing || booking?.final_payment_completed}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.buttonText}>
                    Proceed to Final Payment (₦{Math.floor((booking?.price || 0) / 2).toLocaleString()})
                  </Text>
                )}
              </TouchableOpacity>
            ) : ((bookingData?.status || booking?.status) === 'accepted' || (bookingData?.status || booking?.status) === 'in_progress') ? (
              <TouchableOpacity 
                style={styles.paymentButton}
                onPress={handlePayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.buttonText}>
                    {booking?.payment_plan === 'half' ? 
                      'Proceed to Initial Payment (₦' + Math.floor((booking?.price || 0) / 2).toLocaleString() + ')' :
                      'Proceed to Payment (₦' + (booking?.price || 0).toLocaleString() + ')'
                    }
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      ) : null}

      <PaymentConfirmationDialog
        visible={showConfirmation}
        amount={booking?.payment_plan === 'half' ? Math.floor((booking?.price || 0) / 2) : booking?.price || 0}
        isHalfPayment={booking?.payment_plan === 'half'}
        totalAmount={booking?.price || 0}
        isFirstPayment={!booking?.first_payment_completed}
        onConfirm={handlePaymentConfirm}
        onCancel={() => setShowConfirmation(false)}
      />
    </SafeAreaView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: '16@ms',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '16@ms',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '8@ms',
    paddingVertical: '4@ms',
  },
  activityNumber: {
    width: '24@ms',
    height: '24@ms',
    borderRadius: '12@ms',
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '12@ms',
  },
  activityNumberText: {
    color: '#fff',
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Bold',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
  },
  activityDetails: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: '4@ms',
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12@ms',
  },
  paymentPlan: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginTop: '2@ms',
  },
  paymentLabel: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  paymentValue: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  totalItem: {
    marginTop: '16@ms',
    paddingTop: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  totalValue: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  rateButton: {
    backgroundColor: Colors.primary,
    margin: '16@ms',
    padding: '16@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  rateButtonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '8@ms',
  },
  providerInfo: {
    flex: 1,
    marginRight: '12@ms',
  },
  providerName: {
    fontSize: '20@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '4@ms',
  },
  providerPhone: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginBottom: '8@ms',
  },
  chatButton: {
    padding: '8@ms',
    borderRadius: '8@ms',
    backgroundColor: '#F0F9FF',
  },
  bookingDate: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  addressContainer: {
    marginTop: '16@ms',
    paddingTop: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addressLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#666',
    marginBottom: '4@ms',
  },
  addressText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
    marginBottom: '16@ms',
  },
  landmarkLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#666',
    marginBottom: '4@ms',
  },
  landmarkText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
  },
  idBadgeContainer: {
    paddingHorizontal: '16@ms',
    paddingTop: '12@ms',
    paddingBottom: '4@ms',
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#F0F9FF',
    paddingVertical: '6@ms',
    paddingHorizontal: '12@ms',
    borderRadius: '20@ms',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  idText: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginLeft: '4@ms',
  },
  idNumber: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
    marginLeft: '4@ms',
  },
  paymentStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: '12@ms',
    borderRadius: '8@ms',
    gap: '8@ms',
  },
  paymentStatusText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.success,
  },
  paymentActionContainer: {
    gap: '16@ms',
  },
  walletInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: '12@ms',
    borderRadius: '8@ms',
  },
  walletLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  walletBalance: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  payButton: {
    backgroundColor: Colors.primary,
    padding: '16@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: '16@ms',
    borderRadius: '8@ms',
    gap: '12@ms',
  },
  pendingText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.primary,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16@s',
  },
  errorText: {
    fontSize: '16@s',
    color: Colors.error,
    textAlign: 'center',
    marginBottom: '16@vs',
    fontFamily: 'Urbanist-Medium',
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: '24@s',
    paddingVertical: '12@vs',
    borderRadius: '8@s',
  },
  retryButtonText: {
    color: "red",
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  dialogCancelButton: {
    backgroundColor: '#F1F5F9',
  },
  paymentButton: {
    backgroundColor: Colors.primary,
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
    marginHorizontal: '16@ms',
    marginBottom: '16@ms',
  },
  buttonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF4',
    padding: '16@ms',
    borderRadius: '8@ms',
    gap: '12@ms',
  },
  completedText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.success,
    flex: 1,
  },
  paymentAmountText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.primary,
    marginTop: '4@ms',
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: '16@ms',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dialogContent: {
    padding: '24@ms',
  },
  dialogTitle: {
    fontSize: '24@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '16@ms',
    textAlign: 'center',
  },
  amountContainer: {
    backgroundColor: '#F8FAFC',
    padding: '16@ms',
    borderRadius: '12@ms',
    marginBottom: '16@ms',
  },
  amountLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginBottom: '4@ms',
  },
  amountValue: {
    fontSize: '28@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  infoContainer: {
    backgroundColor: '#FFF8E1',
    padding: '16@ms',
    borderRadius: '12@ms',
    marginBottom: '16@ms',
  },
  infoText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#B7791F',
    lineHeight: '20@ms',
  },
  confirmText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    textAlign: 'center',
    marginBottom: '24@ms',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: '12@ms',
  },
  button: {
    flex: 1,
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  cancelButtonText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#64748B',
  },
  confirmButtonText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#fff',
  },
  locationContainer: {
    backgroundColor: '#F8FAFC',
    padding: '16@ms',
    borderRadius: '12@ms',
  },
  locationLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#666',
    marginBottom: '4@ms',
  },
  locationText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
    marginBottom: '12@ms',
  },
  serviceDetailItem: {
    marginBottom: '16@ms',
    paddingBottom: '16@ms',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  serviceName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '8@ms',
  },
  serviceDetails: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    lineHeight: '20@ms',
  },
  noDetailsText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#999',
    fontStyle: 'italic',
  },
}); 