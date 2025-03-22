import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Alert, StyleSheet, Modal, Dimensions, Clipboard, Animated, Easing, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { supabase } from '../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../../constants/Colors';
import { Provider } from '../../types/index';
import { useUserStore } from '../../store/useUserStore';  
import Logo from '../../assets/images/Svg/logo1.svg';


interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
  users: {
    name: string;
    profile_pic: string | null;
  };
}

interface ExtendedProvider extends Provider {
  provider_gallery?: {
    id: string;
    provider_id: string;
    image_url: string;
    created_at: string;
  }[];
  reviews?: {
    id: string;
    rating: number;
    comment: string;
    created_at: string;
    user_id: string;
    users: {
      name: string;
      profile_pic: string | null;
    };
  }[];
  completed_jobs?: number;
  cancelled_jobs?: number;
}

interface Providers {
  id: string;
  user_id: string;
  name: string;
  profile_pic?: string;
  users?: {
    name: string;
    profile_pic?: string;
  };
}

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation<any>();
  const [provider, setProvider] = useState<ExtendedProvider | null>(null);
  const [activeTab, setActiveTab] = useState('Gallery');
  const [loading, setLoading] = useState(true);
  const { profile } = useUserStore();
  const [isAvailable, setIsAvailable] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0.3)).current;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchProvider();

    const channel = supabase
      .channel('provider_status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'providers',
          filter: `id=eq.${id}`,
        },
        (payload: any) => {
          setIsAvailable(payload.new.availability);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (provider?.users?.name) {
      navigation.setOptions({
        title: provider.users.name
      });
    }
  }, [provider?.users?.name]);

  useEffect(() => {
    if (loading) {
      const fadeInOut = () => {
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.ease
          }),
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.ease
          })
        ]).start(() => fadeInOut());
      };

      fadeInOut();
      return () => fadeAnim.stopAnimation();
    }
  }, [loading]);

  const fetchProvider = async () => {
    try {
      setLoading(true);
      
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select(`
          *,
          users (
            id,
            name,
            email,
            profile_pic,
            phone
          )
        `)
        .eq('id', id)
        .single();

      if (providerError) throw providerError;

      if (!providerData) {
        throw new Error('Provider not found');
      }

      // Set the availability status from the provider data
      setIsAvailable(providerData.availability);
   
      const { data: galleryData, error: galleryError } = await supabase
        .from('provider_gallery')
        .select('*')
        .eq('provider_id', providerData.user_id);  

      if (galleryError) throw galleryError;

      // Fetch reviews with explicit join path
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          user_id,
          users!reviews_user_id_fkey (
            name,
            profile_pic
          )
        `)
        .eq('provider_id', providerData.user_id)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      // Fetch booking statistics
      const { count: completedCount, error: completedError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerData.id)
        .eq('status', 'completed');

      const { count: cancelledCount, error: cancelledError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerData.id)
        .eq('status', 'cancelled');

      if (completedError) {
        console.error('Completed bookings error:', completedError);
        throw completedError;
      }
      if (cancelledError) {
        console.error('Cancelled bookings error:', cancelledError);
        throw cancelledError;
      }

      console.log('Provider ID:', providerData.id);
      console.log('Booking counts:', { completedCount, cancelledCount });
   
      setProvider({
        ...providerData,
        user: providerData.users,
        provider_gallery: galleryData || [],
        reviews: reviewsData || [],
        completed_jobs: completedCount || 0,
        cancelled_jobs: cancelledCount || 0
      });

      console.log('Provider state:', {
        completed_jobs: completedCount || 0,
        cancelled_jobs: cancelledCount || 0
      });

    } catch (error) {
      console.error('Error in fetchProvider:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async (provider: Provider) => {
    try {
      const { data: existingChats, error: searchError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('user_id', profile?.id)
        .eq('provider_id', provider.user_id);

      if (searchError) throw searchError;

      let chatId;

      if (existingChats && existingChats.length > 0) {
        chatId = existingChats[0].id;
      } else {
        const { data: newChat, error: createError } = await supabase
          .from('chat_rooms')
          .insert({
            user_id: profile?.id,
            provider_id: provider.user_id,
            user_name: profile?.name,
            provider_name: provider.users?.name,
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

  const handleCall = () => {
    setShowCallModal(true);
  };

  const closeCallModal = () => {
    setShowCallModal(false);
  };

  const copyPhoneNumber = () => {
    if (provider?.users?.phone) {
      Clipboard.setString(provider.users.phone);
      setToastMessage('Phone number copied to clipboard');
      setShowToast(true);
      
      setTimeout(() => {
        setShowToast(false);
      }, 2000);
      
      closeCallModal();
    } else {
      Alert.alert('Error', 'No phone number available to copy');
    }
  };

  const handleRequestService = () => {
    if (provider?.id) {
      router.push({
        pathname: "/request/[id]",
        params: {
          id: provider.id,
          service: provider.services[0],
          price: provider.pricing?.[provider.services[0]] || 0
        }
      });
    }
  };

  const openImageViewer = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const closeImageViewer = () => {
    setSelectedImage(null);
  };

  const renderReviews = () => {
    if (!provider?.reviews?.length) {
      return (
        <View style={styles.emptyReviews}>
          <Ionicons name="star-outline" size={40} color="#666" />
          <Text style={styles.emptyText}>No reviews yet</Text>
        </View>
      );
    }

    return (
      <View style={styles.reviewsContainer}>
        {provider.reviews.map((review, index) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Image 
                source={{ uri: review.users.profile_pic || 'https://via.placeholder.com/40' }}
                style={styles.reviewerImage}
              />
              <View style={styles.reviewerInfo}>
                <Text style={styles.reviewerName}>{review.users.name}</Text>
                <Text style={styles.reviewDate}>
                  {new Date(review.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.ratingDisplay}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>{review.rating}</Text>
              </View>
            </View>
            <Text style={styles.reviewComment}>{review.comment}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#fff' 
      }}>
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{
            scale: fadeAnim.interpolate({
              inputRange: [0.3, 1],
              outputRange: [0.9, 1.1]
            })
          }]
        }}>
          <Logo width={100} height={100} />
        </Animated.View>
      </View>
    );
  }
  
  if (!provider) return null;

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.headerRow}>
          <Text style={styles.levelText}>Level {provider.level || 1} {provider.services[0]}</Text>
          <View style={[styles.statusBadge, isAvailable && styles.onlineBadge]}>
            <Text style={styles.statusText}>{isAvailable ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        <View style={styles.profileInfo}>
          <Image 
            source={{ uri: provider.users?.profile_pic || 'https://via.placeholder.com/80' }} 
            style={styles.profileImage} 
          />
          <Text style={styles.name}>{provider.users?.name}</Text>
          <Text style={styles.location}>
            {provider.location?.city}, {provider.location?.state}
          </Text>
        </View>

        {/* Bio Section */}
        {provider.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.bioTitle}>About</Text>
            <Text style={styles.bioText}>{provider.bio}</Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={handleCall} style={styles.iconButton}>
            <Ionicons name="call" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => handleChat(provider)} 
            style={styles.iconButton}
          >
            <Ionicons name="chatbubbles" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.requestButton}
          onPress={handleRequestService}
        >
          <Text style={styles.requestButtonText}>Request Service</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statText}>{provider.completed_jobs || 0} Completed</Text>
        <Text style={styles.statText}>{provider.cancelled_jobs || 0} Cancelled</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity onPress={() => setActiveTab('Gallery')}>
          <Text style={[styles.tabText, activeTab === 'Gallery' && styles.activeTabText]}>
            Gallery
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('Reviews')}>
          <Text style={[styles.tabText, activeTab === 'Reviews' && styles.activeTabText]}>
            Reviews
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'Gallery' ? (
          <View style={styles.galleryGrid}>
            {provider.provider_gallery && provider.provider_gallery.length > 0 ? (
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                {provider.provider_gallery.map((item, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={{
                      width: 100,
                      height: 100,
                      backgroundColor: '#f0f0f0',
                      borderRadius: 8,
                    }}
                    onPress={() => openImageViewer(item.image_url)}
                  >
                    <Image 
                      source={{ uri: item.image_url }} 
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 8,
                      }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyGallery}>
                <Ionicons name="images-outline" size={40} color="#666" />
                <Text style={styles.emptyText}>No gallery images yet</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.reviewsContainer}>
            {provider?.reviews && provider.reviews.length > 0 ? (
              provider.reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Image 
                      source={{ uri: review.users.profile_pic || 'https://via.placeholder.com/40' }}
                      style={styles.reviewerImage}
                    />
                    <View style={styles.reviewerInfo}>
                      <Text style={styles.reviewerName}>{review.users.name}</Text>
                      <Text style={styles.reviewDate}>
                        {new Date(review.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.ratingDisplay}>
                      <Ionicons name="star" size={16} color="#FFD700" />
                      <Text style={styles.ratingText}>{review.rating}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyReviews}>
                <Ionicons name="star-outline" size={40} color="#666" />
                <Text style={styles.emptyText}>No reviews yet</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <Modal
        visible={selectedImage !== null}
        transparent={true}
        onRequestClose={closeImageViewer}
        animationType="fade"
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={closeImageViewer}
        >
          <View style={styles.modalContent}>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={closeImageViewer}
            >
              <Ionicons name="close-circle" size={36} color="white" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showCallModal}
        transparent={true}
        onRequestClose={closeCallModal}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.callModalContent}>
            <View style={styles.callModalHeader}>
              <Text style={styles.callModalTitle}>Contact Details</Text>
              <TouchableOpacity onPress={closeCallModal}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.callModalBody}>
              <Image 
                source={{ uri: provider?.users?.profile_pic || 'https://via.placeholder.com/80' }}
                style={styles.callModalAvatar}
              />
              <Text style={styles.callModalName}>{provider?.users?.name}</Text>
              <Text style={styles.callModalPhone}>{provider?.users?.phone || 'No phone number'}</Text>
            </View>
            
            <View style={styles.callModalActions}>
              <TouchableOpacity 
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: '#f0f0f0',
                  width: '100%',
                  marginTop: 10,
                }}
                onPress={copyPhoneNumber}
              >
                <Ionicons name="copy-outline" size={20} color="#333" />
                <Text style={{
                  marginLeft: 8,
                  fontSize: 16,
                  fontFamily: 'Urbanist-SemiBold',
                  color: '#333',
                }}>Copy Number</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast Notification */}
      {showToast && (
        <View style={{
          position: 'absolute',
          bottom: 50,
          left: 20,
          right: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 14,
          borderRadius: 10,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}>
          <Text style={{
            color: 'white',
            fontSize: 16,
            fontFamily: 'Urbanist-Medium',
          }}>{toastMessage}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    margin: 15,
    backgroundColor: '#263238',
    padding: 20,
    borderRadius: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelText: {
    color: '#A0AEC0',
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
  },
  statusBadge: {
    backgroundColor: '#666',
    padding: 5,
    borderRadius: 15,
  },
  onlineBadge: {
    backgroundColor: '#2ECC71',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Urbanist-Regular',
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: 10,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  name: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Urbanist-Bold',
    marginTop: 5,
  },
  location: {
    color: '#A0AEC0',
    fontSize: 14,
    fontFamily: 'Urbanist-SemiBold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 10,
  },
  iconButton: {
    padding: 10,
  },
  requestButton: {
    backgroundColor: Colors.primary,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  requestButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  statText: {
    fontSize: 16,
    fontFamily: 'Urbanist-Medium',
  },
  viewBioText: {
    fontSize: 16,
    color: Colors.primary,
    fontFamily: 'Urbanist-Bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 10,
  },
  tabText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontFamily: 'Urbanist-Medium',
  },
  activeTabText: {
    color: '#000',
    fontFamily: 'Urbanist-Bold',
  },
  tabContent: {
    padding: 10,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 4,
  },
  galleryImage: {
    width: '32%',
    height: 120,
    margin: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  emptyGallery: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 8,
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    fontSize: 14,
  },
  noContentText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  bioSection: {
    marginTop: 10,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    marginBottom: 12,
  },
  bioTitle: {
    color: '#A0AEC0',
    fontSize: 14,
    fontFamily: 'Urbanist-Bold',
    marginBottom: 5,
  },
  bioText: {
    color: '#E0E0E0',
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    fontFamily: 'Urbanist-Bold',
  },
  testSection: {
    marginBottom: 16,
  },
  gallerySection: {
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 100,
  },
  callModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '80%',
    maxWidth: 320,
    padding: 0,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  callModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  callModalTitle: {
    fontSize: 18,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  callModalBody: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  callModalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  callModalName: {
    fontSize: 20,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: 8,
  },
  callModalPhone: {
    fontSize: 18,
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginBottom: 8,
  },
  callModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 0,
  },
  reviewsContainer: {
    padding: 16,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  reviewDate: {
    fontSize: 12,
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: 2,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 14,
    fontFamily: 'Urbanist-Bold',
    color: '#FFB800',
  },
  reviewComment: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    color: '#333',
    lineHeight: 20,
  },
  emptyReviews: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
}); 