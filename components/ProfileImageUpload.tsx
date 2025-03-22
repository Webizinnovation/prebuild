import React from 'react';
import { TouchableOpacity, Image, StyleSheet, Alert, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';
import { decode } from 'base64-arraybuffer';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface ProfileImageUploadProps {
  imageUri?: string | null;
  size?: number;
  onUpload: (url: string) => void;
}

export default function ProfileImageUpload({ 
  imageUri, 
  size = 60,
  onUpload 
}: ProfileImageUploadProps) {
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64FileData = result.assets[0].base64;
        
        // Create unique file path
        const filePath = `public/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        
        // Upload image
        const { error: uploadError } = await supabase.storage
          .from('profiles')  // Replace with your bucket name
          .upload(filePath, decode(base64FileData), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);

        onUpload(publicUrl);
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    }
  };

  return (
    <TouchableOpacity onPress={pickImage} style={[styles.container, { width: size, height: size }]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, { width: size, height: size }]}
        />
      ) : (
        <View style={[styles.placeholderContainer, { width: size, height: size }]}>
          <Ionicons name="person" size={size * 0.6} color="rgba(255,255,255,0.8)" />
        </View>
      )}
      <View style={styles.editIconContainer}>
        <FontAwesome name="pencil" size={12} color="white" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    overflow: 'visible',
    position: 'relative',
  },
  image: {
    borderRadius: 999,
  },
  placeholderContainer: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: Colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
}); 