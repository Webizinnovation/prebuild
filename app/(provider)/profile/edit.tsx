import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Text, Button, TextInput, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { supabase } from '../../../services/supabase';
import { useUserStore } from '../../../store/useUserStore';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Colors } from '../../../constants/Colors';
import { ScaledSheet } from 'react-native-size-matters';
import { Provider } from '../../../types';

// Services list from UserServices.tsx
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
  "Driver",
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

export default function EditProfileScreen() {
  const { profile } = useUserStore();
  const router = useRouter();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [providerData, setProviderData] = useState<Provider | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [newService, setNewService] = useState({ name: '', price: '' });
  
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    bio: '',
    experience: '',
    services: [] as string[],
    pricing: {} as Record<string, number>,
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    navigation.setOptions({
      title: 'Edit Profile'
    });
  }, []);

  const fetchProviderData = async () => {
    try {
      setLoading(true);
      if (!profile?.id) {
        throw new Error("User profile ID is missing");
      }
      
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (error) throw error;
      setProviderData(data);
      
      setFormData(prev => ({
        ...prev,
        bio: data.bio || '',
        experience: data.experience?.toString() || '',
        services: data.services || [],
        pricing: data.pricing || {},
      }));
    } catch (error) {
      console.error('Error fetching provider data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderData();
  }, [profile?.id]);

  const handleAddService = () => {
    if (!newService.name || !newService.price) {
      Alert.alert('Error', 'Please fill in both service name and price');
      return;
    }

    const updatedServices = [...formData.services, newService.name];
    const updatedPricing = {
      ...formData.pricing,
      [newService.name]: parseFloat(newService.price) || 0
    };

    setFormData(prev => ({
      ...prev,
      services: updatedServices,
      pricing: updatedPricing
    }));

    setNewService({ name: '', price: '' });
    setShowAddService(false);
  };

  const handleRemoveService = (service: string, index: number) => {
    const { [service]: _, ...newPricing } = formData.pricing;
    const newServices = formData.services.filter((_, i) => i !== index);
    
    setFormData(prev => ({
      ...prev,
      services: newServices,
      pricing: newPricing
    }));
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

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      
      const { error: userError } = await supabase
        .from('users')
        .update({
          name: formData.name,
          phone: formData.phone,
        })
        .eq('id', profile?.id);

      if (userError) throw userError;

      const { error: providerError } = await supabase
        .from('providers')
        .update({
          bio: formData.bio,
          experience: parseInt(formData.experience) || 0,
          services: formData.services,
          pricing: formData.pricing,
        })
        .eq('user_id', profile?.id);

      if (providerError) throw providerError;

      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      Alert.alert('Success', 'Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Error updating password:', error);
      Alert.alert('Error', 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !providerData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Profile Image Section */}
          <View style={styles.imageSection}>
            <TouchableOpacity 
              style={styles.profileImageContainer}
              onPress={handleProfileImageUpload}
            >
              <Image 
                source={{ 
                  uri: profile?.profile_pic || 'https://via.placeholder.com/150'
                }}
                style={styles.profileImage}
              />
              <View style={styles.editProfileImageOverlay}>
                <Ionicons name="camera" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </View>

          {/* Personal Information Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <TextInput
              label="Full Name"
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              mode="outlined"
              style={styles.input}
              outlineColor="#ddd"
              activeOutlineColor={Colors.primary}
            />
            
            <TextInput
              label="Phone Number"
              value={formData.phone}
              onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
              outlineColor="#ddd"
              activeOutlineColor={Colors.primary}
            />
            
            <TextInput
              label="Email Address"
              value={formData.email}
              mode="outlined"
              style={styles.input}
              disabled
              outlineColor="#ddd"
            />
            
            <TextInput
              label="Bio"
              value={formData.bio}
              onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.textArea}
              outlineColor="#ddd"
              activeOutlineColor={Colors.primary}
            />
            
            <TextInput
              label="Years of Experience"
              value={formData.experience}
              onChangeText={(text) => setFormData(prev => ({ ...prev, experience: text }))}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              outlineColor="#ddd"
              activeOutlineColor={Colors.primary}
            />
          </View>

          {/* Services & Pricing Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Services & Pricing</Text>
            
            {formData.services.length === 0 && (
              <View style={styles.emptyServices}>
                <Text style={styles.emptyServicesText}>No services added yet</Text>
              </View>
            )}
            
            {formData.services.map((service, index) => (
              <View key={index} style={styles.serviceCard}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service}</Text>
                  <Text style={styles.servicePrice}>₦{formData.pricing[service]?.toLocaleString()}</Text>
                </View>
                <View style={styles.serviceActions}>
                  <IconButton
                    icon="pencil"
                    size={20}
                    iconColor={Colors.primary}
                    onPress={() => {
                      setNewService({ 
                        name: service, 
                        price: formData.pricing[service]?.toString() || ''
                      });
                      setShowAddService(true);
                    }}
                  />
                  <IconButton
                    icon="delete"
                    size={20}
                    iconColor="#e74c3c"
                    onPress={() => handleRemoveService(service, index)}
                  />
                </View>
              </View>
            ))}
            
            {showAddService ? (
              <View style={styles.addServiceForm}>
                  <TouchableOpacity
                    onPress={() => setShowServiceModal(true)}
                    activeOpacity={0.7}
                  >
                <TextInput
                      label="Service"
                      value={newService.name || ""}
                  mode="outlined"
                  style={styles.serviceInput}
                  outlineColor="#ddd"
                  activeOutlineColor={Colors.primary}
                      editable={false}
                      right={<TextInput.Icon icon="menu-down" onPress={() => setShowServiceModal(true)} />}
                      placeholder="Select a service"
                />
                  </TouchableOpacity>
                <TextInput
                  label="Price (₦)"
                  value={newService.price}
                  onChangeText={(text) => setNewService(prev => ({ ...prev, price: text }))}
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.serviceInput}
                  outlineColor="#ddd"
                  activeOutlineColor={Colors.primary}
                />
                <View style={styles.serviceButtonRow}>
                  <Button 
                    mode="outlined" 
                    onPress={() => {
                      setShowAddService(false);
                      setNewService({ name: '', price: '' });
                    }}
                    style={[styles.serviceButton, styles.cancelButton]}
                  >
                    Cancel
                  </Button>
                  <Button 
                    mode="contained" 
                    onPress={handleAddService}
                    style={styles.serviceButton}
                  >
                    Save
                  </Button>
                </View>
              </View>
            ) : (
              <Button 
                mode="outlined" 
                icon="plus" 
                onPress={() => {
                  setNewService({ name: '', price: '' });
                  setShowAddService(true);
                }}
                style={styles.addButton}
              >
                Add Service
              </Button>
            )}
          </View>

          {/* Password Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            
            <TextInput
              label="Current Password"
              value={passwordData.currentPassword}
              onChangeText={(text) => setPasswordData(prev => ({ ...prev, currentPassword: text }))}
              mode="outlined"
              style={styles.input}
              secureTextEntry
              outlineColor="#ddd"
              activeOutlineColor={Colors.primary}
            />
            
            <TextInput
              label="New Password"
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
              mode="outlined"
              style={styles.input}
              secureTextEntry
              outlineColor="#ddd"
              activeOutlineColor={Colors.primary}
            />
            
            <TextInput
              label="Confirm New Password"
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
              mode="outlined"
              style={styles.input}
              secureTextEntry
              outlineColor="#ddd"
              activeOutlineColor={Colors.primary}
            />
            
            <Button 
              mode="contained" 
              onPress={handleUpdatePassword} 
              style={styles.passwordButton}
              loading={loading}
            >
              Update Password
            </Button>
          </View>

          {/* Save Button */}
          <Button 
            mode="contained" 
            onPress={handleUpdateProfile} 
            style={styles.saveButton}
            loading={loading}
          >
            Save Changes
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
      
      {/* Service Selection Modal */}
      <Modal
        visible={showServiceModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalView}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select a Service</Text>
            <TouchableOpacity onPress={() => setShowServiceModal(false)}>
              <AntDesign name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search services..."
              placeholderTextColor="#999"
              value={serviceSearch}
              onChangeText={setServiceSearch}
            />
          </View>
          <ScrollView style={styles.modalScrollView}>
            {services
              .filter(service => 
                service.toLowerCase().includes(serviceSearch.toLowerCase())
              )
              .map((service) => (
                <TouchableOpacity
                  key={service}
                  style={styles.modalItem}
                  onPress={() => {
                    setNewService(prev => ({ ...prev, name: service }));
                    setShowServiceModal(false);
                    setServiceSearch('');
                  }}
                >
                  <Text style={styles.modalItemText}>{service}</Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: '16@s',
  },
  imageSection: {
    alignItems: 'center',
    marginVertical: '16@s',
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: '120@s',
    height: '120@s',
    borderRadius: '60@s',
    borderWidth: 3,
    borderColor: '#fff',
  },
  editProfileImageOverlay: {
    position: 'absolute',
    bottom: '0@s',
    right: '0@s',
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
    width: '36@s',
    height: '36@s',
    borderRadius: '18@s',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    marginTop: '8@s',
    color: Colors.primary,
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '14@s',
  },
  sectionContainer: {
    backgroundColor: '#fff',
    borderRadius: '12@s',
    padding: '16@s',
    marginBottom: '16@s',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '16@s',
    color: '#333',
  },
  input: {
    marginBottom: '16@s',
    backgroundColor: '#fff',
  },
  textArea: {
    marginBottom: '16@s',
    backgroundColor: '#fff',
    minHeight: '100@s',
  },
  emptyServices: {
    padding: '20@s',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
    borderRadius: '8@s',
    marginBottom: '16@s',
  },
  emptyServicesText: {
    color: '#999',
    fontFamily: 'Urbanist-Medium',
    fontSize: '14@s',
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12@s',
    backgroundColor: '#f9f9f9',
    borderRadius: '8@s',
    marginBottom: '8@s',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '16@s',
    color: '#333',
  },
  servicePrice: {
    fontFamily: 'Urbanist-Medium',
    fontSize: '14@s',
    color: '#666',
  },
  serviceActions: {
    flexDirection: 'row',
  },
  addServiceForm: {
    backgroundColor: '#f9f9f9',
    padding: '12@s',
    borderRadius: '8@s',
    marginBottom: '16@s',
  },
  serviceInput: {
    marginBottom: '8@s',
    backgroundColor: '#fff',
  },
  serviceButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: '8@s',
  },
  serviceButton: {
    marginLeft: '8@s',
  },
  cancelButton: {
    borderColor: '#ddd',
  },
  addButton: {
    marginTop: '8@s',
    borderColor: Colors.primary,
  },
  passwordButton: {
    marginTop: '8@s',
    backgroundColor: Colors.primary,
  },
  saveButton: {
    marginTop: '16@s',
    marginBottom: '32@s',
    backgroundColor: Colors.primary,
    paddingVertical: '6@s',
  },
  serviceDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12@s',
    backgroundColor: '#f9f9f9',
    borderRadius: '8@s',
    marginBottom: '8@s',
  },
  serviceDropdownText: {
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '16@s',
    color: '#333',
  },
  modalView: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16@s',
    backgroundColor: '#fff',
    borderTopLeftRadius: '16@s',
    borderTopRightRadius: '16@s',
  },
  modalTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  searchContainer: {
    padding: '8@s',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    padding: '6@s',
    borderRadius: '8@s',
    fontSize: '14@s',
    height: '36@s',
  },
  modalScrollView: {
    backgroundColor: '#fff',
    maxHeight: '400@s',
  },
  modalItem: {
    padding: '16@s',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  modalItemText: {
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '16@s',
    color: '#333',
  },
  inputContainer: {
    marginBottom: '16@s',
  },
  inputLabel: {
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '16@s',
    color: '#333',
  },
  serviceInputDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12@s',
    backgroundColor: '#f9f9f9',
    borderRadius: '8@s',
    marginBottom: '8@s',
  },
  placeholderText: {
    color: '#999',
  },
  serviceDropdownInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12@s',
    backgroundColor: '#f9f9f9',
    borderRadius: '8@s',
    marginBottom: '8@s',
  },
  serviceInputContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outlinedInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: '8@s',
    padding: '12@s',
  },
  outlinedInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
}); 