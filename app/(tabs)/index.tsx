import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Alert,
  TouchableOpacity,
  Text,
  Platform,
  BackHandler,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { Provider } from '../../types';
import * as Location from 'expo-location';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import BannerSlider from '../../components/BannerSlider';
import { ScaledSheet } from 'react-native-size-matters';
import Header from '../../components/Header';
import ProviderHomeScreen from '../../components/provider/ProviderHomeScreen';
import Toast from 'react-native-toast-message';
import { ProviderList } from '../../components/user/home/ProviderList';
import { ServicesSection } from '../../components/user/home/ServicesSection';
import { HeaderSection } from '../../components/user/home/HeaderSection';

// Detect small screens
const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useUserStore();
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    if (!profile?.id) {
      router.replace('/(auth)/login');
    }
  }, [profile]);

  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return providers;
    
    const query = searchQuery.toLowerCase().trim();
    return providers.filter(provider => {
      const name = provider.users?.name?.toLowerCase() || '';
      const services = provider.services.map(s => s.toLowerCase());
      
      return (
        name.includes(query) ||
        services.some(service => service.includes(query))
      );
    });
  }, [providers, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchProviders(),
        getLocation()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation(location);
      setLocationError(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError(true);
    }
  };

  const fetchProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select(`
          *,
          users:user_id (name, email, profile_pic)
        `)
        .eq('availability', true)
        .not('user_id', 'eq', profile?.id || '')
        .range(0, ITEMS_PER_PAGE - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const providersWithDistance = location?.coords 
        ? data.map(provider => ({
            ...provider,
            distance: calculateDistance(
              location.coords.latitude,
              location.coords.longitude,
              provider.location?.latitude || 0,
              provider.location?.longitude || 0
            )
          })).sort((a, b) => a.distance - b.distance)
        : data;

      setProviders(providersWithDistance);
      setPage(0);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreProviders = async () => {
    if (loading) return;
    
    const nextPage = page + 1;
    const startAfter = nextPage * ITEMS_PER_PAGE;
    
    try {
      const { data, error } = await supabase
        .from('providers')
        .select(`
          *,
          users:user_id (name, email, profile_pic)
        `)
        .eq('availability', true)
        .not('user_id', 'eq', profile?.id || '')
        .range(startAfter, startAfter + ITEMS_PER_PAGE - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const newProvidersWithDistance = location?.coords 
        ? data.map(provider => ({
            ...provider,
            distance: calculateDistance(
              location.coords.latitude,
              location.coords.longitude,
              provider.location?.latitude || 0,
              provider.location?.longitude || 0
            )
          })).sort((a, b) => a.distance - b.distance)
        : data;

      setProviders(prev => [...prev, ...newProvidersWithDistance]);
      setPage(nextPage);
    } catch (error) {
      console.error('Error loading more providers:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; 
    return d;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
  };

  useEffect(() => {
    if (profile?.id) {
      fetchProviders();
    }
  }, [profile?.id]);

  useEffect(() => {
    getLocation();
  }, []);

  useFocusEffect(() => {
    const handleBackPress = () => {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              try {
                await supabase.auth.signOut();
                Toast.show({
                  type: 'success',
                  text1: 'Success',
                  text2: 'You have been logged out successfully',
                  position: 'top',
                  visibilityTime: 2000,
                });
                setTimeout(() => {
                  router.replace('/(auth)/login');
                }, 1000);
              } catch (error: any) {
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: error.message || 'Failed to logout. Please try again.',
                  position: 'top',
                });
              }
            },
          },
        ],
        { 
          cancelable: true
        }
      );
      return true; 
    };

    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', handleBackPress);
    }
  });

  if (profile?.role === 'provider') {
    return (
      <ProviderHomeScreen 
        profile={profile}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    );
  }

  const retryLocation = async () => {
    setIsRetrying(true);
    try {
      await getLocation();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleServicePress = (serviceName: string) => {
    router.push(`/services/${serviceName}`);
  };

  const handleSeeAllPress = () => {
    navigation.navigate('services' as never);
    setTimeout(() => {
      useUserStore.setState(state => ({
        ...state,
        selectedOrderTab: 'ALL'
      }));
    }, 100);
  };

  const ListHeaderComponent = (
    <>
      <HeaderSection
        location={location}
        state={state}
        lga={lga}
        setState={setState}
        setLga={setLga}
        getLocation={retryLocation}
        isRetrying={isRetrying}
        locationError={locationError}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <BannerSlider profile={profile} />
      <ServicesSection
        onServicePress={handleServicePress}
        onSeeAllPress={handleSeeAllPress}
      />
      <Text style={styles.sectionTitle}>Providers Nearby</Text>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        profile={profile}
        onUpdateProfilePic={(url) => {
          useUserStore.setState(state => ({
            profile: { ...state.profile!, profile_pic: url }
          }));
        }}
      />
      {!profile?.profile_pic && (
        <TouchableOpacity 
          style={styles.profilePrompt}
          onPress={() => router.push('/profile')}
        >
          <Ionicons 
            name="person-add-outline" 
            size={isSmallDevice ? 20 : 24} 
            color={Colors.primary} 
          />
          <Text style={styles.promptText}>Complete your profile by adding a photo</Text>
          <Ionicons 
            name="chevron-forward" 
            size={isSmallDevice ? 20 : 24} 
            color={Colors.primary} 
          />
        </TouchableOpacity>
      )}
      <ProviderList
        providers={filteredProviders}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onLoadMore={loadMoreProviders}
        onProviderPress={(id) => router.push(`./(provider)/${id}`)}
        searchQuery={searchQuery}
        ListHeaderComponent={ListHeaderComponent}
      />
    </SafeAreaView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  profilePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,126,222,0.1)',
    padding: isSmallDevice ? '8@ms' : '12@ms',
    marginHorizontal: isSmallDevice ? '12@ms' : '16@ms',
    borderRadius: 8,
    marginTop: isSmallDevice ? '6@ms' : '8@ms',
  },
  promptText: {
    color: Colors.primary,
    fontFamily: 'Urbanist-Medium',
    marginHorizontal: isSmallDevice ? '6@ms' : '8@ms',
    fontSize: isSmallDevice ? '12@ms' : '14@ms',
  },
  sectionTitle: {
    fontSize: isSmallDevice ? '16@ms' : '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    paddingHorizontal: isSmallDevice ? '12@ms' : '16@ms',
    marginTop: isSmallDevice ? '12@ms' : '16@ms',
  },
});
