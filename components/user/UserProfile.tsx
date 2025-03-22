import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../store/useUserStore';
import { supabase } from '../../services/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Button } from 'react-native-paper';
import * as Location from 'expo-location';
import DrawerModal from '../../components/common/DrawerModal';
import { UserProfile as UserProfileType } from '../../types';

// Extend UserProfile type locally until the type changes are applied
interface ExtendedUserProfile extends UserProfileType {
  location?: {
    region: string;
    subregion: string;
    current_address?: string;
  } | string;
}

interface Provider {
  id: string;
  name: string;
  profile_pic?: string;
}

export function UserProfile() {
  const router = useRouter();
  const { profile, updateProfile } = useUserStore();
  // Cast profile to extended type
  const extendedProfile = profile as ExtendedUserProfile | null;
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    currentPassword: '',
    newPassword: '',
  });
  const [locationText, setLocationText] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Update location text from profile when component mounts or profile changes
  useEffect(() => {
    if (extendedProfile?.location) {
      if (typeof extendedProfile.location === 'string') {
        // Handle legacy string format
        setLocationText(String(extendedProfile.location));
      } else if (extendedProfile.location.region) {
        // Handle object format with region/subregion
        setLocationText(`${extendedProfile.location.region}${extendedProfile.location.subregion ? ', ' + extendedProfile.location.subregion : ''}`);
      }
    }
  }, [extendedProfile]);

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        setLoading(true);
        const file = result.assets[0];
        const fileExt = file.uri.substring(file.uri.lastIndexOf('.') + 1);
        const fileName = `${extendedProfile?.id}_${Date.now()}.${fileExt}`;
        const filePath = `profiles/${fileName}`;

        // First, try to remove the old profile picture if it exists
        if (extendedProfile?.profile_pic) {
          try {
            await supabase.storage
              .from('users')
              .remove([extendedProfile.profile_pic]);
          } catch (removeError) {
            console.log('Error removing old image:', removeError);
            // Continue even if remove fails
          }
        }

        // Convert image to blob for Supabase storage
        const response = await fetch(file.uri);
        const blob = await response.blob();

        // Upload new image
        const { error: uploadError, data } = await supabase.storage
          .from('profiles')
          .upload(filePath, blob, {
            upsert: true // Enable upsert option
          });

        if (uploadError) throw uploadError;

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);

        // Update profile
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            profile_pic: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', extendedProfile?.id);

        if (updateError) throw updateError;

        // Update local state
        updateProfile({ ...extendedProfile, profile_pic: publicUrl } as any);
        Alert.alert('Success', 'Profile picture updated successfully');
      }
    } catch (error: any) {
      console.error('Error updating profile image:', error);
      Alert.alert(
        'Upload Failed', 
        error.message || 'Failed to update profile image. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);

      // Input validation
      if (!formData.name?.trim()) {
        throw new Error('Name cannot be empty');
      }

      // First verify the current password if trying to change password
      if (formData.newPassword) {
        if (!formData.currentPassword) {
          throw new Error('Current password is required to set a new password');
        }

        // Verify current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: extendedProfile?.email || '',
          password: formData.currentPassword,
        });

        if (signInError) {
          throw new Error('Current password is incorrect');
        }
      }

      // Prepare update data
      const updates = {
        id: extendedProfile?.id,
        name: formData.name.trim(),
        updated_at: new Date().toISOString(),
      };

      // Update profile in database
      const { error: updateError, data } = await supabase
        .from('users')
        .update(updates)
        .eq('id', extendedProfile?.id)
        .select()
        .single();

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw new Error(updateError.message || 'Failed to update profile');
      }

      // If profile update successful and new password provided, update password
      if (formData.newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.newPassword,
        });

        if (passwordError) {
          console.error('Password update error:', passwordError);
          throw new Error('Profile updated but password change failed');
        }
      }

      // Update local state
      if (data) {
        updateProfile({ ...extendedProfile, ...data } as any);
      }

      setIsEditing(false);
      setFormData({
        name: data?.name || extendedProfile?.name || '',
        currentPassword: '',
        newPassword: '',
      });

      Alert.alert('Success', 'Profile updated successfully');

    } catch (error: any) {
      console.error('Profile update error details:', error);
      Alert.alert(
        'Update Failed',
        error.message || 'Please check your connection and try again'
      );
    } finally {
      setLoading(false);
    }
  };

  const getLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Allow location access to update your location');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      if (!position) {
        throw new Error('Could not get location');
      }

      const { latitude, longitude } = position.coords;

      // Get address from coordinates
      const [address] = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      if (!address) {
        throw new Error('Could not get address from location');
      }

      const locationString = `${address.city || ''}, ${address.region || ''}, ${address.country || ''}`.trim();
      if (!locationString) {
        throw new Error('Invalid address format');
      }

      const locationObject = {
        region: address.region || address.country || '',
        subregion: address.city || address.subregion || '',
        current_address: locationString
      };

      // Update profile with new location
      const { error: updateError } = await supabase
        .from('users')
        .update({ location: locationObject })
        .eq('id', extendedProfile?.id);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw new Error('Failed to update location in database');
      }

      // Update local state
      setLocationText(locationString);
      // Use type assertion for the update
      updateProfile({ 
        ...extendedProfile, 
        location: locationObject 
      } as any);
      Alert.alert('Success', 'Location updated successfully');

    } catch (error: any) {
      console.error('Location error details:', error);
      Alert.alert(
        'Error updating location',
        error.message || 'Please check your internet connection and try again'
      );
    } finally {
      setLoading(false);
    }
  };

  // const handleChatPress = async (provider: Provider) => {
  //   try {
  //     // First check if chat exists
  //     const { data: existingChats, error: searchError } = await supabase
  //       .from('chat_rooms')
  //       .select('*')
  //       .eq('user_id', profile?.id)
  //       .eq('provider_id', provider.id);

  //     if (searchError) throw searchError;

  //     let chatId;

  //     if (existingChats && existingChats.length > 0) {
  //       // Use existing chat
  //       chatId = existingChats[0].id;
  //     } else {
  //       // Create new chat room
  //       const { data: newChat, error: createError } = await supabase
  //         .from('chat_rooms')
  //         .insert({
  //           user_id: profile?.id,
  //           provider_id: provider.id,
  //           user_name: profile?.name,
  //           provider_name: provider.name,
  //           user_avatar: profile?.profile_pic,
  //           provider_avatar: provider.profile_pic,
  //           created_at: new Date().toISOString(),
  //           updated_at: new Date().toISOString(),
  //           last_message: null,
  //           last_message_at: new Date().toISOString(),
  //         })
  //         .select()
  //         .single();

  //       if (createError) {
  //         console.error('Chat room creation error:', createError);
  //         throw createError;
  //       }

  //       if (!newChat) {
  //         throw new Error('Failed to create chat room');
  //       }

  //       chatId = newChat.id;
  //     }

  //     // Navigate to chat
  //     if (chatId) {
  //       router.push(`/chat/${chatId}`);
  //     } else {
  //       throw new Error('No chat ID available');
  //     }

  //   } catch (error: any) {
  //     console.error('Error initializing chat:', error);
  //     Alert.alert(
  //       'Chat Error',
  //       error.message || 'Failed to start chat. Please try again.'
  //     );
  //   }
  // };

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
          <Ionicons name="menu-outline" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* Add DrawerModal */}
      <DrawerModal
        isVisible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        profileImageUri={extendedProfile?.profile_pic}
        role={extendedProfile?.role}
      />

      {/* Profile Picture */}
      <View style={styles.profileSection}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: extendedProfile?.profile_pic || 'https://via.placeholder.com/100' }} 
            style={styles.profileImage} 
          />
          <TouchableOpacity style={styles.editImageButton} onPress={handleImagePick}>
            <Ionicons name="pencil" size={16} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{extendedProfile?.name}</Text>
        <TouchableOpacity style={styles.locationContainer} onPress={getLocation}>
          <Ionicons name="location-outline" size={16} color={Colors.primary} />
          <Text style={styles.locationText}>
            {locationText || 'No location set'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Form Fields */}
      <View style={styles.formSection}>
        {/* Email */}
        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color="gray" style={styles.inputIcon} />
          <TextInput 
            value={extendedProfile?.email} 
            editable={false} 
            style={styles.input}
            placeholder="Email"
          />
        </View>
        
        {/* Phone */}
        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={20} color="gray" style={styles.inputIcon} />
          <TextInput 
            value={extendedProfile?.phone} 
            editable={false} 
            style={styles.input}
            placeholder="Phone Number"
          />
        </View>

        {/* Username */}
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="gray" style={styles.inputIcon} />
          <TextInput 
            value={isEditing ? formData.name : extendedProfile?.name}
            onChangeText={text => setFormData(prev => ({ ...prev, name: text }))}
            editable={isEditing}
            style={[styles.input, isEditing && styles.editableInput]}
            placeholder="Username"
          />
        </View>

        {/* Password */}
        {isEditing ? (
          <>
            {/* Current Password */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="gray" style={styles.inputIcon} />
              <TextInput
                secureTextEntry={!passwordVisible}
                value={formData.currentPassword}
                onChangeText={text => setFormData(prev => ({ ...prev, currentPassword: text }))}
                style={[styles.input, { flex: 1 }]}
                placeholder="Current Password"
              />
              <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
                <Ionicons 
                  name={passwordVisible ? "eye-off-outline" : "eye-outline"} 
                  size={20} 
                  color="gray" 
                />
              </TouchableOpacity>
            </View>

            {/* New Password */}
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color="gray" style={styles.inputIcon} />
              <TextInput
                secureTextEntry={!passwordVisible}
                value={formData.newPassword}
                onChangeText={text => setFormData(prev => ({ ...prev, newPassword: text }))}
                style={[styles.input, { flex: 1 }]}
                placeholder="New Password (optional)"
              />
            </View>
          </>
        ) : (
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="gray" style={styles.inputIcon} />
            <TextInput
              secureTextEntry
              value="********"
              editable={false}
              style={styles.input}
              placeholder="Password"
            />
          </View>
        )}

        {/* Edit/Save buttons */}
        <View style={styles.buttonContainer}>
          {isEditing ? (
            <>
              <Button 
                mode="contained" 
                onPress={handleUpdateProfile}
                loading={loading}
                style={styles.saveButton}
                labelStyle={styles.buttonLabel}
              >
                Save Changes
              </Button>
              <Button 
                mode="outlined" 
                onPress={() => {
                  setIsEditing(false);
                  setFormData({
                    name: profile?.name || '',
                    currentPassword: '',
                    newPassword: '',
                  });
                }}
                style={styles.cancelButton}
                labelStyle={styles.buttonLabel}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button 
              mode="contained" 
              onPress={() => setIsEditing(true)}
              style={styles.editButton}
              labelStyle={styles.buttonLabel}
            >
              Edit Profile
            </Button>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    marginVertical: '10@ms',
  },
  contentContainer: {
    paddingHorizontal: '12@ms',
    paddingTop: '16@ms',
    paddingBottom: '30@ms',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16@ms',
    paddingTop: '8@ms',
    paddingHorizontal: '4@ms',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: '20@ms',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: '10@ms',
  },
  profileImage: {
    width: '80@ms',
    height: '80@ms',
    borderRadius: '40@ms',
  },
  editImageButton: {
    position: 'absolute',
    bottom: '0@ms',
    left: '0@ms',
    backgroundColor: Colors.primary,
    padding: '5@ms',
    borderRadius: '12@ms',
    elevation: 2,
  },
  name: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '4@ms',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '4@ms',
    padding: '6@ms',
    borderRadius: '16@ms',
    backgroundColor: Colors.primary + '15',
    maxWidth: '100%',
  },
  locationText: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.primary,
    flexShrink: 1,
  },
  formSection: {
    gap: '10@ms',
    marginTop: '8@ms',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: '8@ms',
    borderRadius: '10@ms',
    borderWidth: 1,
    borderColor: '#eee',
  },
  inputIcon: {
    marginRight: '8@ms',
  },
  input: {
    flex: 1,
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
  },
  editableInput: {
    backgroundColor: 'transparent',
  },
  buttonContainer: {
    gap: '8@ms',
    marginTop: '16@ms',
    marginBottom: '20@ms',
  },
  editButton: {
    backgroundColor: Colors.primary,
    borderRadius: '8@ms',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: '8@ms',
  },
  cancelButton: {
    borderColor: Colors.primary,
    borderRadius: '8@ms',
  },
  buttonLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
  },
}); 