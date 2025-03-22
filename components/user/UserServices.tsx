import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, Image, Modal, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { verticalScale } from 'react-native-size-matters';
import SearchBar from '../SearchBar';
import BookingCard from '../BookingCard';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { useRouter } from 'expo-router';
import { sendBookingStatusNotification } from '../../utils/notifications';
import Toast from 'react-native-toast-message';
import { UserServicesStyles } from '../../utils/styles';
type MainTab = 'ALL' | 'YOUR BOOKINGS' | 'FAVORITES';
type BookingStatus = 'InProgress' | 'Completed' | 'Cancelled';

const services = [
  "Appliances",
  "Refrigerator Services",
  "Mechanics",
  "Barbers",
  "Brick Layers",
  "Carpentry Services",
  "Laundry",
  "Car Washers",
  "Catering",
  "Shipping Services",
  "Electrician",
  "Fumigation Services",
  "Generator Services",
  "Hairstylist",
  "Movers",
  "Home Interior Designers",
  "Make-Up Artist",
  "Nail Technician",
  "Painter",
  "Phone Repairers",
  "Photographer",
  "Plumber",
  "POP",
  "Tiller",
  "Video Editor",
  "Welder",
];

type Booking = {
  id: string;
  service: string;
  booking_date: string;
  booking_time: string;
  address: string;
  amount: number;
  status: string;
  provider: {
    id: string;
    services: string[];
    users: {
      name: string;
      profile_pic: string | null;
    };
  };
  provider_id: string;
  payment_plan?: string;
  first_payment_completed?: boolean;
};

type BookingsState = {
  inProgress: Booking[];
  completed: Booking[];
  cancelled: Booking[];
};


type BookingStatusMap = {
  InProgress: 'inProgress';
  Completed: 'completed';
  Cancelled: 'cancelled';
};

type Provider = {
  id: string;
  services: string[];
  users: {
    name: string;
    profile_pic: string | null;
  };
};

type BookingData = {
  status: string;
  payment_plan: string;
  first_payment_completed: boolean;
  user_id: string;
  provider_id: string;
};

// Memoized version of the BookingCard component to prevent unnecessary rerenders
const MemoizedBookingCard = memo(BookingCard);

// Memoized version of the SearchBar component
const MemoizedSearchBar = memo(SearchBar);

export default function UserServices() {
  const { profile } = useUserStore();
  const [selectedMainTab, setSelectedMainTab] = useState<MainTab>(
    useUserStore.getState().selectedOrderTab
  );
  const [selectedTab, setSelectedTab] = useState<BookingStatus>('InProgress');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookings, setBookings] = useState<BookingsState>({
    inProgress: [],
    completed: [],
    cancelled: []
  });
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState<{ [key: string]: boolean }>({});
  const router = useRouter();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<string | null>(null);
  const [selectedProviderForReview, setSelectedProviderForReview] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!profile || !profile.id) {
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          service,
          booking_date,
          booking_time,
          address,
          amount,
          status,
          provider_id,
          payment_plan,
          first_payment_completed,
          provider:providers!bookings_provider_id_fkey (
            id,
            services,
            users!providers_user_id_fkey (
              name,
              profile_pic
            )
          )
        `)
        .eq('user_id', profile?.id);

      if (error) throw error;

      const transformedData = data.map(item => {
        const providerData = item.provider as unknown as Provider;
        return {
          id: item.id,
          service: item.service,
          booking_date: item.booking_date,
          booking_time: item.booking_time,
          address: item.address,
          amount: item.amount,
          status: item.status,
          provider_id: item.provider_id,
          provider: {
            id: providerData.id,
            services: providerData.services,
            users: {
              name: providerData.users.name,
              profile_pic: providerData.users.profile_pic
            }
          },
          payment_plan: item.payment_plan,
          first_payment_completed: item.first_payment_completed
        };
      });

      setBookings({
        inProgress: transformedData.filter(booking => 
          ['pending', 'in_progress', 'accepted'].includes(booking.status)
        ),
        completed: transformedData.filter(booking => booking.status === 'completed'),
        cancelled: transformedData.filter(booking => booking.status === 'cancelled')
      });
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  }, [profile?.id]);

  const fetchFavorites = useCallback(async () => {
    if (!profile || !profile.id) {
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          id,
          providers!provider_id (
            id,
            services,
            location,
            users (
              name,
              profile_pic
            )
          )
        `)
        .eq('user_id', profile?.id);

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (selectedMainTab === 'YOUR BOOKINGS') {
      fetchBookings();
    } else if (selectedMainTab === 'FAVORITES') {
      fetchFavorites();
    }
  }, [selectedMainTab, fetchBookings, fetchFavorites]);

 
  useEffect(() => {
    fetchBookings();
    fetchFavorites();
    
    const bookingsSubscription = supabase
      .channel('bookings-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${profile?.id}` },
        (payload) => {
          console.log('Booking change detected:', payload);
          fetchBookings(); 
        }
      )
      .subscribe();
      
    const favoritesSubscription = supabase
      .channel('favorites-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${profile?.id}` },
        (payload) => {
          console.log('Favorites change detected:', payload);
          fetchFavorites(); 
        }
      )
      .subscribe();
      
    return () => {
      bookingsSubscription.unsubscribe();
      favoritesSubscription.unsubscribe();
    };
  }, [profile?.id, fetchBookings, fetchFavorites]);

  const refreshData = useCallback(() => {
    if (selectedMainTab === 'YOUR BOOKINGS') {
      fetchBookings();
    } else if (selectedMainTab === 'FAVORITES') {
      fetchFavorites();
    }
  }, [selectedMainTab, fetchBookings, fetchFavorites]);

  const handleCancel = useCallback(async (bookingId: string) => {
    try {
      console.log('Starting cancellation for booking:', bookingId); 
      
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('status, payment_plan, first_payment_completed, user_id, provider_id')
        .eq('id', bookingId)
        .single() as { data: BookingData | null; error: any };

      if (bookingError) {
        console.error('Error fetching booking:', bookingError); 
        throw bookingError;
      }

      console.log('Booking data:', bookingData); 

      if (bookingData?.user_id !== profile?.id) {
        Toast.show({
          type: 'error',
          text1: 'Unauthorized',
          text2: 'You do not have permission to cancel this booking.',
          position: 'top',
          visibilityTime: 4000,
        });
        return;
      }

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

      if (bookingData?.status === 'in_progress') {
        setSelectedBookingForCancel(bookingId);
        setShowCancelReasonModal(true);
      } else {
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

                  if (bookingData?.provider_id) {
                    try {
                      await sendBookingStatusNotification(
                        bookingData.provider_id,
                        bookingId,
                        'cancelled',
                        'Booking Cancelled'
                      );
                    } catch (notifError) {
                      console.error('Failed to send notification, but booking was cancelled:', notifError);
                    }
                  }

                  await fetchBookings();
                  
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
      }
    } catch (error) {
      console.error('Error showing alert:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to process cancellation. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    }
  }, [profile?.id, fetchBookings]);

  const handleCancelWithReason = useCallback(async () => {
    if (!cancelReason.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please provide a reason for cancellation.',
        position: 'top',
        visibilityTime: 4000,
      });
      return;
    }

    try {
      if (!selectedBookingForCancel) return;
      
      setLoadingBookings(prev => ({ ...prev, [selectedBookingForCancel as string]: true }));
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          cancelled_at: new Date().toISOString(),
          cancelled_by: profile?.id,
          cancellation_reason: cancelReason.trim()
        })
        .eq('id', selectedBookingForCancel);

      if (error) throw error;

      const { data: bookingData } = await supabase
        .from('bookings')
        .select('provider_id')
        .eq('id', selectedBookingForCancel)
        .single();

      if (bookingData?.provider_id) {
        try {
          await sendBookingStatusNotification(
            bookingData.provider_id,
            selectedBookingForCancel,
            'cancelled',
            'Booking Cancelled'
          );
        } catch (notifError) {
          console.error('Failed to send notification, but booking was cancelled:', notifError);
        }
      }

      await fetchBookings();
      
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
    }
  }, [cancelReason, selectedBookingForCancel, profile?.id, fetchBookings]);

  const handleFavorite = useCallback(async (providerId: string) => {
    try {
      const { error } = await supabase
        .from('favorites')
        .insert([{ user_id: profile?.id, provider_id: providerId }]);

      if (error) throw error;
      fetchFavorites();
    } catch (error) {
      console.error('Error adding to favorites:', error);
    }
  }, [profile?.id, fetchFavorites]);

  const handleReport = useCallback(async (providerId: string, bookingId: string) => {
    setSelectedProviderId(providerId);
    setSelectedBookingId(bookingId);
    setShowReportModal(true);
  }, []);

  const submitReport = useCallback(async () => {
    if (!reportReason.trim() || !reportDescription.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all fields',
        position: 'top'
      });
      return;
    }

    setIsSubmittingReport(true);
    try {
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('user_id')
        .eq('id', selectedProviderId)
        .single();

      if (providerError) throw providerError;

      const { error } = await supabase
        .from('reports')
        .insert([{ 
          reporter_id: profile?.id,
          reported_id: providerData.user_id,
          booking_id: selectedBookingId,
          report_type: 'user_report',
          reason: reportReason,
          description: reportDescription,
          status: 'pending'
        }]);

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Report submitted successfully',
        position: 'top'
      });
      
      setShowReportModal(false);
      setReportReason('');
      setReportDescription('');
      setSelectedBookingId(null);
      setSelectedProviderId(null);
    } catch (error) {
      console.error('Error submitting report:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit report. Please try again.',
        position: 'top'
      });
    } finally {
      setIsSubmittingReport(false);
    }
  }, [reportReason, reportDescription, selectedBookingId, selectedProviderId, profile?.id]);

  const handlePayment = useCallback(async (bookingId: string) => {
    try {
      const booking = [...bookings.inProgress, ...bookings.completed, ...bookings.cancelled]
        .find(b => b.id === bookingId);
      
      if (!booking) {
        throw new Error('Booking not found');
      }

      const routeData = {
        provider_id: booking.provider_id,
        service: booking.service,
        date: booking.booking_date,
        time: booking.booking_time,
        status: booking.status,
        price: booking.amount,
        address: booking.address,
        code: booking.id,
        name: booking.provider.users.name,
        payment_plan: booking.payment_plan,
        amount: booking.amount,
        details: booking.address
      };

      router.push({
        pathname: "/request/details/[id]",
        params: {
          id: booking.id,
          data: JSON.stringify(routeData)
        }
      });
    } catch (error) {
      console.error('Error navigating to payment screen:', error);
      Alert.alert('Error', 'Failed to navigate to payment screen');
    }
  }, [bookings, router]);

  const handleReview = useCallback(async (providerId: string, bookingId: string) => {
    setSelectedProviderForReview(providerId);
    setSelectedBookingForReview(bookingId);
    setShowReviewModal(true);
  }, []);

  const submitReview = useCallback(async () => {
    if (!reviewRating) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select a rating',
        position: 'top'
      });
      return;
    }

    setIsSubmittingReview(true);
    try {
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('user_id')
        .eq('id', selectedProviderForReview)
        .single();

      if (providerError) throw providerError;

      const { error } = await supabase
        .from('reviews')
        .insert([{
          booking_id: selectedBookingForReview,
          provider_id: providerData.user_id, 
          user_id: profile?.id,
          rating: reviewRating,
          comment: reviewComment,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: 'Review submitted',
        text2: 'Thank you for your feedback!',
        position: 'top',
        visibilityTime: 3000,
      });

      setShowReviewModal(false);
      setReviewRating(0);
      setReviewComment('');
      setSelectedBookingForReview(null);
      setSelectedProviderForReview(null);

    } catch (error) {
      console.error('Error submitting review:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit review. Please try again.',
        position: 'top'
      });
    } finally {
      setIsSubmittingReview(false);
    }
  }, [reviewRating, reviewComment, selectedBookingForReview, selectedProviderForReview, profile?.id]);

  const handleRemoveFavorite = useCallback(async (providerId: string) => {
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', profile?.id)
        .eq('provider_id', providerId);

      if (error) throw error;
      fetchFavorites();
      setSelectedFavoriteId(null);
    } catch (error) {
      console.error('Error removing from favorites:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to remove from favorites',
        position: 'top'
      });
    }
  }, [profile?.id, fetchFavorites]);

  // The getItemLayout optimization for FlatList
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: verticalScale(230),
    offset: verticalScale(230) * index,
    index,
  }), []);
  
  const statusMap: BookingStatusMap = {
    'InProgress': 'inProgress',
    'Completed': 'completed',
    'Cancelled': 'cancelled'
  };

  const bookingArray = useMemo(() => 
    bookings[statusMap[selectedTab] as keyof BookingsState],
    [bookings, selectedTab]
  );

  const filteredData = useMemo(() => {
    if (selectedMainTab === 'FAVORITES') return favorites;
    
    if (!searchQuery.trim()) return bookingArray;
    
    const query = searchQuery.toLowerCase().trim();
    return bookingArray.filter((item: Booking) => {
      const providerName = item.provider?.users?.name?.toLowerCase() || '';
      const service = item.service?.toLowerCase() || '';
      
      return providerName.includes(query) || service.includes(query);
    });
  }, [selectedMainTab, bookingArray, favorites, searchQuery]);

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    
    const query = searchQuery.toLowerCase().trim();
    return services.filter(service => 
      service.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const renderService = useCallback(({ item }: { item: string }) => (
    <TouchableOpacity style={UserServicesStyles.serviceButton} onPress={() => router.push(`/services/${item}`)}>
      <Text style={UserServicesStyles.serviceText}>{item}</Text>
    </TouchableOpacity>
  ), [router]);

  const renderBooking = useCallback(({ item }: { item: Booking }) => {
    if (!item.provider.users) {
      return null;
    }

    if (selectedTab === 'Cancelled') {
      return (
        <View style={[UserServicesStyles.container, UserServicesStyles.cancelledCard]}>
          <View style={UserServicesStyles.cancelledHeader}>
            <Text style={UserServicesStyles.cancelledDate}>{new Date(item.booking_date).toLocaleDateString()}</Text>
            <View style={[UserServicesStyles.statusContainer, { backgroundColor: '#F5F5F5' }]}>
              <Text style={[UserServicesStyles.statusText, { color: '#666' }]}>#{item.id.slice(0, 8)}</Text>
            </View>
          </View>
          <View style={UserServicesStyles.providerInfoContainer}>
            <Image
              source={{ uri: item.provider.users.profile_pic || 'https://via.placeholder.com/150' }}
              style={UserServicesStyles.cancelledProviderImage}
            />
            <View style={UserServicesStyles.providerDetails}>
             <Text style={UserServicesStyles.providerName}>{item.provider.users.name}</Text>
              <View style={UserServicesStyles.rightColumn}>
                <Text style={[UserServicesStyles.serviceText, { color: '#666', marginTop: 4 }]}>
                  {Array.isArray(item.provider.services) 
                    ? item.provider.services.length > 2
                      ? `${item.provider.services.slice(0, 2).join(', ')} +${item.provider.services.length - 2}`
                      : item.provider.services.join(', ')
                    : item.service}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity 
            style={UserServicesStyles.reportButton}
            onPress={() => handleReport(item.provider.id, item.id)}
          >
            <Text style={UserServicesStyles.reportButtonText}>Report this server</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <MemoizedBookingCard
        item={{
          category: item.service,
          price: item.amount,
          image: item.provider.users.profile_pic || undefined,
          name: item.provider.users.name,
          date: new Date(item.booking_date).toLocaleDateString(),
          time: item.booking_time,
          service: item.service, 
          code: item.id,
          details: item.address,
          skill: Array.isArray(item.provider.services) ? item.provider.services[0] : item.provider.services,
          provider_id: item.provider_id,
          status: item.status,
          payment_plan: item.payment_plan,
          first_payment_completed: item.first_payment_completed
        }}
        type={selectedTab}
        onCancel={() => handleCancel(item.id)}
        onFavorite={() => handleFavorite(item.provider.id)}
        onReport={() => handleReport(item.provider.id, item.id)}
        onReview={(provider_id, booking_id) => handleReview(provider_id, booking_id)}
        loading={loadingBookings[item.id]}
        showPayButton={item.status === 'accepted'}
        onPay={() => handlePayment(item.id)}
      />
    );
  }, [selectedTab, handleCancel, handleFavorite, handleReport, handleReview, handlePayment, loadingBookings]);

  const renderFavoriteProvider = useCallback(({ item }: { item: any }) => {
    const provider = item.providers;
    const isMenuVisible = selectedFavoriteId === item.id;

    return (
      <TouchableOpacity 
        style={UserServicesStyles.favoriteProviderCard}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: provider.users.profile_pic || 'https://via.placeholder.com/300' }}
          style={UserServicesStyles.favoriteProviderImage}
        />
        <View style={UserServicesStyles.favoriteProviderInfo}>
          <Text style={UserServicesStyles.favoriteProviderName}>{provider.users.name}</Text>
          <Text style={UserServicesStyles.favoriteProviderService}>
            {provider.services && provider.services[0]}
          </Text>
          <View style={UserServicesStyles.locationContainer}>
            <Ionicons name="location" size={12} color="#666" />
            <Text style={UserServicesStyles.locationText}>
              {typeof provider.location === 'object' 
                ? `${provider.location.city || ''}, ${provider.location.state || ''}`
                : provider.location || 'Location not specified'}
            </Text>
          </View>
          <View style={UserServicesStyles.levelContainer}>
            <Ionicons name="shield-checkmark" size={12} color="#007BFF" />
            <Text style={UserServicesStyles.levelText}>Level 1 Server</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={UserServicesStyles.moreButton}
          onPress={() => setSelectedFavoriteId(isMenuVisible ? null : item.id)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#666" />
        </TouchableOpacity>
        {isMenuVisible && (
          <View style={UserServicesStyles.optionsMenu}>
            <TouchableOpacity 
              style={UserServicesStyles.optionButton}
              onPress={() => {
                setSelectedFavoriteId(null);
                router.push(`/services/${provider.services[0]}`);
              }}
            >
              <Text style={UserServicesStyles.optionText}>Book Again</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[UserServicesStyles.optionButton, UserServicesStyles.removeButton]}
              onPress={() => handleRemoveFavorite(provider.id)}
            >
              <Text style={[UserServicesStyles.optionText, UserServicesStyles.removeText]}>Remove from Favorites</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedFavoriteId, router, handleRemoveFavorite]);

  // Define modal rendering functions
  const renderReportModal = useCallback(() => (
    <Modal
      visible={showReportModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowReportModal(false)}
    >
      <View style={UserServicesStyles.modalOverlay}>
        <View style={UserServicesStyles.reportModalContent}>
          <View style={UserServicesStyles.reportModalHeader}>
            <Text style={UserServicesStyles.reportModalTitle}>Report Provider</Text>
            <TouchableOpacity 
              onPress={() => setShowReportModal(false)}
              style={UserServicesStyles.closeButton}
              disabled={isSubmittingReport}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={UserServicesStyles.reportForm}>
            <View style={UserServicesStyles.inputContainer}>
              <Text style={UserServicesStyles.inputLabel}>Reason for Report</Text>
              <TextInput
                style={UserServicesStyles.reasonInput}
                value={reportReason}
                onChangeText={setReportReason}
                placeholder="Enter reason for report"
                placeholderTextColor="#666"
                editable={!isSubmittingReport}
              />
            </View>

            <View style={UserServicesStyles.inputContainer}>
              <Text style={UserServicesStyles.inputLabel}>Description</Text>
              <TextInput
                style={UserServicesStyles.descriptionInput}
                value={reportDescription}
                onChangeText={setReportDescription}
                placeholder="Provide more details about the issue"
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isSubmittingReport}
              />
            </View>

            <TouchableOpacity 
              style={[UserServicesStyles.submitReportButton, isSubmittingReport && UserServicesStyles.submitReportButtonDisabled]}
              onPress={submitReport}
              disabled={isSubmittingReport}
            >
              {isSubmittingReport ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={UserServicesStyles.submitReportButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  ), [showReportModal, reportReason, reportDescription, isSubmittingReport, submitReport]);

  const renderReviewModal = useCallback(() => (
    <Modal
      visible={showReviewModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowReviewModal(false)}
    >
      <View style={UserServicesStyles.modalOverlay}>
        <View style={UserServicesStyles.reviewModalContent}>
          <View style={UserServicesStyles.reviewModalHeader}>
            <Text style={UserServicesStyles.reviewModalTitle}>Write a Review</Text>
            <TouchableOpacity 
              onPress={() => setShowReviewModal(false)}
              style={UserServicesStyles.closeButton}
              disabled={isSubmittingReview}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={UserServicesStyles.reviewForm}>
            <View style={UserServicesStyles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setReviewRating(star)}
                  disabled={isSubmittingReview}
                >
                  <Ionicons
                    name={star <= reviewRating ? "star" : "star-outline"}
                    size={30}
                    color="#FFD700"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={UserServicesStyles.inputContainer}>
              <Text style={UserServicesStyles.inputLabel}>Your Review</Text>
              <TextInput
                style={UserServicesStyles.reviewInput}
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="Write your review here..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isSubmittingReview}
              />
            </View>

            <TouchableOpacity 
              style={[UserServicesStyles.submitReviewButton, isSubmittingReview && UserServicesStyles.submitReviewButtonDisabled]}
              onPress={submitReview}
              disabled={isSubmittingReview}
            >
              {isSubmittingReview ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={UserServicesStyles.submitReviewButtonText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  ), [showReviewModal, reviewRating, reviewComment, isSubmittingReview, submitReview]);

  const renderCancelReasonModal = useCallback(() => (
    <Modal
      visible={showCancelReasonModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCancelReasonModal(false)}
    >
      <View style={UserServicesStyles.modalOverlay}>
        <View style={UserServicesStyles.cancelModalContent}>
          <View style={UserServicesStyles.cancelModalHeader}>
            <Text style={UserServicesStyles.cancelModalTitle}>Cancel Booking</Text>
            <TouchableOpacity 
              onPress={() => setShowCancelReasonModal(false)}
              style={UserServicesStyles.closeButton}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={UserServicesStyles.cancelForm}>
            <View style={UserServicesStyles.inputContainer}>
              <Text style={UserServicesStyles.inputLabel}>Why are you cancelling this booking?</Text>
              <TextInput
                style={UserServicesStyles.cancelReasonInput}
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="Enter your reason here..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
              />
            </View>

            <TouchableOpacity 
              style={[UserServicesStyles.cancelButton, loadingBookings[selectedBookingForCancel || ''] && UserServicesStyles.cancelButtonDisabled]}
              onPress={handleCancelWithReason}
              disabled={loadingBookings[selectedBookingForCancel || '']}
            >
              {loadingBookings[selectedBookingForCancel || ''] ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={UserServicesStyles.cancelButtonText}>Cancel Booking</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  ), [showCancelReasonModal, cancelReason, selectedBookingForCancel, loadingBookings, handleCancelWithReason]);

  // Create memoized renderers for modals to prevent rerenders  
  const reportModalContent = renderReportModal;
  const reviewModalContent = renderReviewModal;
  const cancelReasonModalContent = renderCancelReasonModal;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (selectedMainTab === 'YOUR BOOKINGS') {
      fetchBookings().then(() => setRefreshing(false));
    } else if (selectedMainTab === 'FAVORITES') {
      fetchFavorites().then(() => setRefreshing(false));
    } else {
      setRefreshing(false);
    }
  }, [selectedMainTab, fetchBookings, fetchFavorites]);

  // Create memoized renderers for empty state components
  const renderEmptyBookingList = useCallback(() => (
    <View style={UserServicesStyles.emptyContainer}>
      <Ionicons name="calendar-outline" size={64} color="#ccc" />
      <Text style={UserServicesStyles.emptyTitle}>No Bookings Yet</Text>
      <Text style={UserServicesStyles.emptyText}>
        Your {selectedTab.toLowerCase()} bookings will appear here
      </Text>
    </View>
  ), [selectedTab]);

  const renderEmptyFavoriteList = useCallback(() => (
    <View style={UserServicesStyles.emptyContainer}>
      <Ionicons name="heart-outline" size={64} color="#ccc" />
      <Text style={UserServicesStyles.emptyTitle}>No Favorites Yet</Text>
      <Text style={UserServicesStyles.emptyText}>
        Providers you add to favorites will appear here
      </Text>
    </View>
  ), []);

  const renderEmptyServiceList = useCallback(() => (
    <View style={UserServicesStyles.emptyContainer}>
      <Ionicons name="search-outline" size={64} color="#ccc" />
      <Text style={UserServicesStyles.emptyTitle}>No Results Found</Text>
      <Text style={UserServicesStyles.emptyText}>
        Try searching with different keywords
      </Text>
    </View>
  ), []);

  return (
    <View style={UserServicesStyles.container}>
      <MemoizedSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={
          selectedMainTab === 'ALL' 
            ? "Search for a service..." 
            : selectedMainTab === 'YOUR BOOKINGS'
            ? "Search your bookings..."
            : "Search favorites..."
        }
      />

      <View style={UserServicesStyles.mainTabs}>
        {['ALL', 'YOUR BOOKINGS', 'FAVORITES'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              UserServicesStyles.mainTabButton,
              selectedMainTab === tab && UserServicesStyles.selectedMainTab,
            ]}
            onPress={() => {
              setSelectedMainTab(tab as MainTab);
              // Immediately refresh data when tab changes
              if (tab === 'YOUR BOOKINGS') {
                fetchBookings();
              } else if (tab === 'FAVORITES') {
                fetchFavorites();
              }
            }}
          >
            <Text
              style={[
                UserServicesStyles.mainTabText,
                selectedMainTab === tab && UserServicesStyles.selectedMainTabText,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedMainTab === 'ALL' ? (
        <FlatList
          key="all"
          data={filteredServices}
          keyExtractor={(item) => item}
          renderItem={renderService}
          contentContainerStyle={UserServicesStyles.servicesContainer}
          ListEmptyComponent={renderEmptyServiceList}
          initialNumToRender={10}
          maxToRenderPerBatch={20}
          windowSize={5}
          removeClippedSubviews={true}
        />
      ) : selectedMainTab === 'YOUR BOOKINGS' ? (
        <>
          <View style={UserServicesStyles.bookingTabs}>
            {(['InProgress', 'Completed', 'Cancelled'] as BookingStatus[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  UserServicesStyles.bookingTabButton,
                  selectedTab === tab && UserServicesStyles.selectedBookingTab
                ]}
                onPress={() => setSelectedTab(tab)}
              >
                <Text
                  style={[
                    UserServicesStyles.bookingTabText,
                    selectedTab === tab && UserServicesStyles.selectedBookingTabText
                  ]}
                >
                  {tab.replace(/([A-Z])/g, ' $1').trim()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <FlatList
            key="bookings"
            data={filteredData}
            renderItem={renderBooking}
            keyExtractor={(item) => item.id}
            contentContainerStyle={UserServicesStyles.bookingContainer}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={renderEmptyBookingList}
            getItemLayout={getItemLayout}
            initialNumToRender={5}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
          />
        </>
      ) : (
        <FlatList
          key="favorites"
          data={filteredData}
          renderItem={renderFavoriteProvider}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={UserServicesStyles.favoriteColumnWrapper}
          contentContainerStyle={UserServicesStyles.favoritesContainer}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={renderEmptyFavoriteList}
          initialNumToRender={6}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}
      {reportModalContent()}
      {reviewModalContent()}
      {cancelReasonModalContent()}
    </View>
  );
}

