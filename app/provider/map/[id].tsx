import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, Linking } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase';
import { ScaledSheet } from 'react-native-size-matters';

export default function MapViewScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookingDetails();
  }, [id]);

  const fetchBookingDetails = async () => {
    try {
      console.log('Fetching booking details for ID:', id);
      const { data, error } = await supabase
        .from('bookings')
        .select('address')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Fetched booking data:', data);
      console.log('Address to geocode:', data.address);
      
      // Geocode the address using OpenStreetMap Nominatim API
      const encodedAddress = encodeURIComponent(data.address);
      const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}`;
      console.log('Geocoding API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'ServeEz/1.0' // Required by Nominatim's terms of service
        }
      });
      const geocodeData = await response.json();
      console.log('Geocoding API response:', geocodeData);
      
      if (geocodeData && geocodeData.length > 0) {
        const location = geocodeData[0];
        setBooking({
          address: data.address,
          latitude: parseFloat(location.lat),
          longitude: parseFloat(location.lon)
        });
      } else {
        throw new Error('No results found for this address');
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDirections = () => {
    if (booking?.latitude && booking?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`;
      Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading location...</Text>
      </View>
    );
  }

  if (!booking?.latitude || !booking?.longitude) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Could not find location for this address</Text>
      </View>
    );
  }

  if (!booking?.address) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Address not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Location</Text>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: booking.latitude,
          longitude: booking.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        <Marker
          coordinate={{
            latitude: booking.latitude,
            longitude: booking.longitude,
          }}
          title="Booking Location"
          description={booking.address}
        />
      </MapView>

      <View style={styles.bottomContainer}>
        <View style={styles.addressContainer}>
          <Ionicons name="location" size={20} color="#666" />
          <Text style={styles.addressText} numberOfLines={2}>{booking.address}</Text>
        </View>
        <TouchableOpacity 
          style={styles.directionsButton}
          onPress={handleOpenDirections}
        >
          <Ionicons name="navigate" size={20} color="#fff" />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '16@s',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    padding: '8@s',
    marginRight: '8@s',
  },
  headerTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  map: {
    flex: 1,
    width: Dimensions.get('window').width,
  },
  bottomContainer: {
    padding: '16@s',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: '16@s',
    backgroundColor: '#F5F5F5',
    padding: '12@s',
    borderRadius: '8@s',
  },
  addressText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    color: '#333',
    marginLeft: '8@s',
    flex: 1,
    lineHeight: '20@s',
  },
  directionsButton: {
    backgroundColor: '#007BFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12@s',
    borderRadius: '8@s',
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    marginLeft: '8@s',
  },
  loadingText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    textAlign: 'center',
    marginTop: '20@s',
  },
  errorText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Regular',
    color: '#FF4B55',
    textAlign: 'center',
    marginTop: '20@s',
  },
}); 