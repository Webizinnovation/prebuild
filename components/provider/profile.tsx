import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, TouchableOpacity, Platform, BackHandler, RefreshControl } from 'react-native';
import { Text, Button, Portal, Dialog, IconButton, TextInput } from 'react-native-paper';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { Provider } from '../../types';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Colors } from '../../constants/Colors';
import DrawerModal from '../../components/common/DrawerModal';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ScaledSheet } from 'react-native-size-matters';

export default function ProviderProfileScreen() {
  const { profile, isOnline } = useUserStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [providerData, setProviderData] = useState<Provider | null>(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [gallery, setGallery] = useState<{ id: string; image_url: string; }[]>([]);
  const [providerStats, setProviderStats] = useState({
    completedJobs: 0,
    cancelledJobs: 0
  });
  const [activeTab, setActiveTab] = useState<'Gallery' | 'Reviews'>('Gallery');

  const fetchProviderStats = async () => {
    if (!profile?.id) return;
    try {
      // First get provider ID
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      if (providerError) throw providerError;

      // Get completed jobs count
      const { data: completedData, error: completedError } = await supabase
        .from('bookings')
        .select('id')
        .eq('provider_id', providerData.id)
        .eq('status', 'completed');

      if (completedError) throw completedError;

      // Get cancelled jobs count
      const { data: cancelledData, error: cancelledError } = await supabase
        .from('bookings')
        .select('id')
        .eq('provider_id', providerData.id)
        .eq('status', 'cancelled');

      if (cancelledError) throw cancelledError;

      const completedJobs = completedData?.length || 0;
      const cancelledJobs = cancelledData?.length || 0;
      
      setProviderStats({
        completedJobs,
        cancelledJobs
      });
    } catch (error) {
      console.error('Error fetching provider stats:', error);
    }
  };

  const fetchProviderData = async () => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', profile?.id)
        .single();

      if (error) throw error;
      setProviderData(data);
    } catch (error) {
      console.error('Error fetching provider data:', error);
    }
  };

  const fetchGallery = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_gallery')
        .select('*')
        .eq('provider_id', profile?.id);

      if (error) throw error;
      setGallery(data || []);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    }
  };

  const refreshProfileData = async () => {
    setRefreshing(true);
    try {
      // Refresh user status from the store
      useUserStore.getState().refreshOnlineStatus();
      
      await Promise.all([
        fetchProviderStats(),
        fetchProviderData(),
        fetchGallery()
      ]);
    } catch (error) {
      console.error('Error refreshing profile data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProviderStats();
    fetchProviderData();
    fetchGallery();
  }, [profile?.id]);

  useFocusEffect(
    React.useCallback(() => {
      refreshProfileData();
      
      // Set up real-time subscriptions
      const setupSubscriptions = async () => {
        if (!profile?.id) return;

        try {
          const { data: providerData, error } = await supabase
            .from('providers')
            .select('id')
            .eq('user_id', profile.id)
            .single();

          if (error) throw error;

          // Subscribe to bookings changes
          const bookingsChannel = supabase
            .channel('profile-bookings')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'bookings',
                filter: `provider_id=eq.${providerData.id}`,
              },
              () => {
                fetchProviderStats();
              }
            )
            .subscribe();

          return () => {
            bookingsChannel.unsubscribe();
          };
        } catch (error) {
          console.error('Error setting up real-time subscriptions:', error);
        }
      };

      const subscription = setupSubscriptions();
      const intervalId = setInterval(() => {
        useUserStore.getState().refreshOnlineStatus();
      }, 500000); 
      
      return () => {
        clearInterval(intervalId);
        if (subscription) {
          subscription.then(cleanup => {
            if (cleanup) cleanup();
          });
        }
      };
    }, [profile?.id])
  );

  const handleAddService = async () => {
    if (!newService.name || !newService.price) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const updatedServices = [...(providerData?.services || []), newService.name];
      const updatedPricing = {
        ...(providerData?.pricing || {}),
        [newService.name]: parseFloat(newService.price)
      };

      const { error } = await supabase
        .from('providers')
        .update({
          services: updatedServices,
          pricing: updatedPricing
        })
        .eq('user_id', profile?.id);

      if (error) throw error;

      setShowServiceDialog(false);
      setNewService({ name: '', price: '' });
      fetchProviderData();
    } catch (error) {
      console.error('Error adding service:', error);
      Alert.alert('Error', 'Failed to add service');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (Platform.OS === 'ios') {
        router.replace('/(auth)/login');
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      useUserStore.setState({
        profile: null,
        isAuthenticated: false,
        selectedOrderTab: 'YOUR BOOKINGS',
        isLoading: false,
        isOnline: false
      });

      if (Platform.OS === 'android') {
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleRemoveGalleryImage = async (imageId: string) => {
    try {
      const { error } = await supabase
        .from('provider_gallery')
        .delete()
        .eq('id', imageId);

      if (error) throw error;
      fetchGallery();
    } catch (error) {
      console.error('Error removing image:', error);
      Alert.alert('Error', 'Failed to remove image');
    }
  };

  const handleAddGalleryImage = async () => {
    if (gallery.length >= 4) {
      Alert.alert('Limit Reached', 'You can only add up to 4 images');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64FileData = result.assets[0].base64;
        const filePath = `${profile?.id}/${Date.now()}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('gallery')
          .upload(filePath, decode(base64FileData), {
            contentType: 'image/jpeg'
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('gallery')
          .getPublicUrl(filePath);

        const { error: dbError } = await supabase.from('provider_gallery').insert({
          provider_id: profile?.id,
          image_url: publicUrl
        });

        if (dbError) throw dbError;
        fetchGallery();
      }
    } catch (error) {
      console.error('Error adding image:', error);
      Alert.alert('Error', 'Failed to add image');
    }
  };

  const handleProfileImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setLoading(true);
        const base64FileData = result.assets[0].base64;
        
        const filePath = `profile_images/${profile?.id}/${Date.now()}`;

        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(filePath, decode(base64FileData), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from('users')
          .update({ profile_pic: publicUrl })
          .eq('id', profile?.id);

        if (updateError) throw updateError;

        useUserStore.setState(state => ({
          profile: { ...state.profile!, profile_pic: publicUrl }
        }));

        Alert.alert('Success', 'Profile picture updated successfully');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
          <Ionicons name="menu" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
          <Ionicons name="settings-outline" size={24} color="black" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshProfileData}
            colors={['#3498db']}
            tintColor="#3498db"
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCardContainer}>
          <View style={styles.profileCard}>
            <Text style={styles.levelBadge}>
              {providerData?.services?.[0] || 'Electrician'}
            </Text>
            
            <View style={styles.onlineStatusContainer}>
              <View style={[
                styles.onlineBadge, 
                { backgroundColor: isOnline ? '#2ecc71' : '#e74c3c' }
              ]}>
                <Ionicons name="ellipse" size={10} color="#fff" style={styles.onlineIcon} />
                <Text style={styles.onlineText}>{isOnline ? 'Online' : 'Offline'}</Text>
              </View>
            </View>
            
            <View style={styles.profileImageContainer}>
              <TouchableOpacity onPress={handleProfileImageUpload}>
                <Image 
                  source={{ 
                    uri: profile?.profile_pic || 'https://via.placeholder.com/150'
                  }}
                  style={styles.profileImage}
                />
                <View style={styles.editProfileImageOverlay}>
                  <Ionicons name="camera" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>

            <Text style={styles.name}>{profile?.name || ""}</Text>
            <Text style={styles.location}>
              {providerData?.location?.city || ''}{providerData?.location?.city && providerData?.location?.state ? ', ' : ''}{providerData?.location?.state || ''}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => router.push('/(provider)/profile/edit')}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{providerStats.completedJobs}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{providerStats.cancelledJobs}</Text>
            <Text style={styles.statLabel}>Cancelled</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Gallery' && styles.activeTabButton]}
            onPress={() => setActiveTab('Gallery')}
          >
            <Text style={[styles.tabText, activeTab === 'Gallery' && styles.activeTabText]}>Gallery</Text>
            {activeTab === 'Gallery' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Reviews' && styles.activeTabButton]}
            onPress={() => setActiveTab('Reviews')}
          >
            <Text style={[styles.tabText, activeTab === 'Reviews' && styles.activeTabText]}>Reviews</Text>
            {activeTab === 'Reviews' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'Gallery' && (
          <View style={styles.galleryContainer}>
            {gallery.length > 0 ? (
              gallery.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.galleryItem}
                  onLongPress={() => Alert.alert(
                    'Remove Image',
                    'Do you want to remove this image?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', onPress: () => handleRemoveGalleryImage(item.id) }
                    ]
                  )}
                >
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyGalleryContainer}>
                <TouchableOpacity 
                  style={[styles.addGalleryButton, { width: '50%', height: 150 }]}
                  onPress={handleAddGalleryImage}
                >
                  <Ionicons name="add" size={40} color="#777" />
                  <Text style={styles.addGalleryText}>Add Photos to Your Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {gallery.length > 0 && gallery.length < 4 && (
              <TouchableOpacity 
                style={styles.addGalleryButton}
                onPress={handleAddGalleryImage}
              >
                <Ionicons name="add" size={32} color="#777" />
                <Text style={styles.addGalleryText}>Add Photo</Text>
              </TouchableOpacity>
            )}
            
            {gallery.length > 0 && (
              <Text style={styles.galleryHelpText}>
                *Long press on an image to remove it
              </Text>
            )}
          </View>
        )}

        {activeTab === 'Reviews' && (
          <View style={styles.reviewsContainer}>
            <Text style={styles.noContentText}>No reviews yet</Text>
          </View>
        )}

        <Portal>
          <Dialog visible={showServiceDialog} onDismiss={() => setShowServiceDialog(false)}>
            <Dialog.Title>Add New Service</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Service Name"
                value={newService.name}
                onChangeText={(text) => setNewService(prev => ({ ...prev, name: text }))}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Price (₦)"
                value={newService.price}
                onChangeText={(text) => setNewService(prev => ({ ...prev, price: text }))}
                keyboardType="numeric"
                mode="outlined"
                style={styles.input}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowServiceDialog(false)}>Cancel</Button>
              <Button onPress={handleAddService} loading={loading}>Add</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <DrawerModal
          isVisible={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          profileImageUri={profile?.profile_pic}
          items={[
            { key: "Home", icon: "home", route: "/(tabs)" },
            { key: "Orders", icon: "list", route: "/(tabs)/services" },
            { key: "Wallet", icon: "wallet", route: "/(tabs)/wallet" },
            { key: "Notifications", icon: "notifications", route: "/notifications" },
            { key: "Settings", icon: "settings", route: "/settings" },
            { key: "Help & Support", icon: "help-circle", route: "/help" },
          ]}
          role={profile?.role}
        />
      </ScrollView>
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    paddingVertical: '25@s',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '16@s',
    paddingVertical: '12@s',
    backgroundColor: 'white',
  },
  profileCardContainer: {
    alignItems: 'center',
    marginTop: '8@s',
  },
  profileCard: {
    backgroundColor: '#263238',
    borderRadius: '24@s',
    padding: '20@s',
    width: '90%',
    alignItems: 'center',
  },
  levelBadge: {
    color: '#fff',
    fontSize: '12@s',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '4@s',
  },
  onlineStatusContainer: {
    position: 'absolute',
    right: '15@s',
    top: '15@s',
  },
  onlineBadge: {
    paddingHorizontal: '10@s',
    paddingVertical: '5@s',
    borderRadius: '12@s',
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIcon: {
    marginRight: '4@s',
  },
  onlineText: {
    color: '#fff',
    fontSize: '10@s',
    fontFamily: 'Urbanist-Medium',
  },
  profileImageContainer: {
    marginVertical: '10@s',
    position: 'relative',
  },
  profileImage: {
    width: '95@s',
    height: '95@s',
    borderRadius: '40@s',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editProfileImageOverlay: {
    position: 'absolute',
    bottom: '0@s',
    right: '0@s',
    backgroundColor: 'rgba(52, 152, 219, 0.8)',
    width: '26@s',
    height: '26@s',
    borderRadius: '13@s',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    color: '#fff',
    marginTop: '6@s',
  },
  location: {
    color: '#e0e0e0',
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    marginTop: '2@s',
  },
  addPhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: '10@s',
  },
  addPhotosText: {
    marginLeft: '6@s',
    color: '#fff',
    fontFamily: 'Urbanist-Medium',
    fontSize: '12@s',
  },
  editButton: {
    backgroundColor: '#3498db',
    paddingVertical: '8@s',
    paddingHorizontal: '20@s',
    borderRadius: '20@s',
    marginTop: '10@s',
    width: '70%',
    alignItems: 'center',
  },
  editButtonText: {
    color: 'white',
    fontFamily: 'Urbanist-Bold',
    fontSize: '14@s',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '20@s',
    position: 'relative',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: '20@s',
  },
  statNumber: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  statLabel: {
    color: '#777',
    fontSize: '12@s',
    fontFamily: 'Urbanist-Medium',
  },
  divider: {
    width: 1,
    height: '30@s',
    backgroundColor: '#e0e0e0',
  },
  editBioButton: {
    position: 'absolute',
    right: '16@s',
    top: '10@s',
  },
  editBioText: {
    color: '#3498db',
    fontFamily: 'Urbanist-Bold',
    fontSize: '14@s',
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: '24@s',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: '10@s',
    alignItems: 'center',
    position: 'relative',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
  tabText: {
    fontSize: '16@s',
    color: '#777',
    fontFamily: 'Urbanist-Medium',
  },
  activeTabText: {
    color: '#333',
    fontFamily: 'Urbanist-Bold',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: '2@s',
    backgroundColor: '#3498db',
  },
  galleryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: '8@s',
  },
  galleryItem: {
    width: '33%',
    aspectRatio: 1,
    padding: '4@s',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    borderRadius: '8@s',
  },
  reviewsContainer: {
    padding: '16@s',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200@s',
  },
  noContentText: {
    fontSize: '16@s',
    color: '#777',
    fontFamily: 'Urbanist-Medium',
  },
  input: {
    marginBottom: '12@s',
  },
  editForm: {
    padding: '16@s',
  },
  sectionTitle: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    marginVertical: '8@s',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '8@s',
  },
  serviceText: {
    flex: 1,
    fontFamily: 'Urbanist-Medium',
  },
  priceInput: {
    width: '120@s',
    marginHorizontal: '8@s',
  },
  addButton: {
    marginTop: '8@s',
    borderColor: Colors.primary,
  },
  addGalleryButton: {
    width: '33%',
    aspectRatio: 1,
    padding: '4@s',
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    borderRadius: '8@s',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '4@s',
  },
  addGalleryText: {
    color: '#777',
    fontSize: '12@s',
    fontFamily: 'Urbanist-Medium',
    marginTop: '4@s',
  },
  galleryHelpText: {
    width: '100%',
    textAlign: 'center',
    fontSize: '12@s',
    color: '#777',
    fontFamily: 'Urbanist-Regular',
    marginTop: '8@s',
    fontStyle: 'italic',
  },
  emptyGalleryContainer: {
    width: '100%',
    height: '150@s',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordButton: {
    marginTop: '8@s',
    backgroundColor: Colors.primary,
  },
}); 