import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, Modal, TouchableWithoutFeedback, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { ScaledSheet } from 'react-native-size-matters';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import SearchBar from '../../components/SearchBar';
import { Colors } from '../../constants/Colors';

type DatabaseProvider = {
  id: string;
  user_id: string;
  services: string[];
  bio: string | null;
  pricing: { [key: string]: number };
  availability: boolean;
  bank_details: {
    account_number: string;
    bank_name: string;
  };
  completed_jobs: number;
  experience: number;
  level: number;
  location: {
    city: string;
    state: string;
  };
  rating: number;
  reviews_count: number;
  total_earnings: number;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
  users: {
    id: string;
    name: string;
    profile_pic: string | null;
  };
};

type Provider = DatabaseProvider & {
  distance: number;
};

export default function ServiceProvidersScreen() {
  const { name } = useLocalSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    sortBy: 'distance', // 'distance', 'price_low', 'price_high'
    priceRange: { min: 0, max: 100000 },
    maxDistance: 50 // in KM
  });

  useEffect(() => {
    fetchProviders();
  }, [name]);

  useEffect(() => {
    let filtered = [...providers];
    
    // Apply search query filter
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(provider => 
        provider.users?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply price range filter
    filtered = filtered.filter(provider => {
      const price = provider.pricing?.[name?.toString().trim() + ' '] || 0;
      return price >= filters.priceRange.min && price <= filters.priceRange.max;
    });

    // Apply distance filter
    filtered = filtered.filter(provider => 
      provider.distance <= filters.maxDistance
    );

    // Apply sorting
    filtered.sort((a, b) => {
      const priceA = a.pricing?.[name?.toString().trim() + ' '] || 0;
      const priceB = b.pricing?.[name?.toString().trim() + ' '] || 0;

      switch (filters.sortBy) {
        case 'price_low':
          return priceA - priceB;
        case 'price_high':
          return priceB - priceA;
        case 'distance':
        default:
          return a.distance - b.distance;
      }
    });

    setFilteredProviders(filtered);
  }, [searchQuery, providers, filters]);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      console.log('Service name type:', typeof name, 'value:', name);

      const { data, error } = await supabase
        .from('providers')
        .select(`
          id,
          user_id,
          services,
          bio,
          pricing,
          availability,
          bank_details,
          completed_jobs,
          experience,
          level,
          location,
          rating,
          reviews_count,
          total_earnings,
          wallet_balance,
          created_at,
          updated_at,
          users!inner (
            id,
            name,
            profile_pic
          )
        `)
        .eq('availability', true)
        .not('users', 'is', null);

      console.log('All providers:', data);

      const searchService = name?.toString().toLowerCase().trim();
      console.log('Searching for service:', searchService);
      
      const filteredData = data?.filter(provider => {
        if (!provider.services || !Array.isArray(provider.services)) {
          return false;
        }
        
        // Normalize and compare services
        const normalizedServices = provider.services.map(service => 
          service.toLowerCase().trim()
        );
        const hasService = normalizedServices.includes(searchService);
        
        console.log('Provider services:', normalizedServices);
        console.log('Provider matches service:', hasService);
        
        const hasUser = provider.users && 
          typeof provider.users === 'object' &&
          'id' in provider.users &&
          'name' in provider.users;
        
        return hasService && hasUser;
      });

      console.log('Filtered providers:', filteredData);

      if (error) throw error;

      if (filteredData) {
        const providersWithDistance = filteredData.map(provider => {
          const users = provider.users as unknown as { id: string; name: string; profile_pic: string | null };
          
          const typedProvider: DatabaseProvider = {
            id: provider.id,
            user_id: provider.user_id,
            services: provider.services,
            bio: provider.bio,
            pricing: provider.pricing,
            availability: provider.availability,
            bank_details: provider.bank_details,
            completed_jobs: provider.completed_jobs,
            experience: provider.experience,
            level: provider.level,
            location: provider.location,
            rating: provider.rating,
            reviews_count: provider.reviews_count,
            total_earnings: provider.total_earnings,
            wallet_balance: provider.wallet_balance,
            created_at: provider.created_at,
            updated_at: provider.updated_at,
            users: users
          };
          
          return {
            ...typedProvider,
            distance: Math.floor(Math.random() * 20),
          };
        });
        
        console.log('Final providers data:', providersWithDistance);
        setProviders(providersWithDistance);
      } else {
        setProviders([]);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
      setProviders([]); 
    } finally {
      setLoading(false);
    }
  };

  const renderProvider = ({ item }: { item: Provider }) => {
    if (!item.users) {
      return null;
    }

    return (
      <View style={styles.providerCard}>
        <View style={styles.providerInfo}>
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <View style={styles.distanceContainer}>
                <Ionicons name="location" size={14} color="#FF4B55" />
                <Text style={styles.distanceText}>
                  {item.distance <= 9 ? 'Closest to you' : `${item.distance}KM AWAY`}
                </Text>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.priceText}>
                  {item.pricing && name 
                    ? `₦${item.pricing[name.toString().trim() + ' ']?.toLocaleString() || 'Price on request'}`
                    : 'Price on request'
                  }
                </Text>
              </View>
            </View>
            <Text style={styles.providerName}>{item.users?.name || 'Unknown Provider'}</Text>
            <Text style={styles.bioText} numberOfLines={2}>
              {item.bio || "I make use of advanced professional tools for ease and accurate results"}
            </Text>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.viewButton} 
              onPress={() => router.push(`/(provider)/${item.id}`)}
            >
              <Text style={styles.viewButtonText}>View more</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.requestButton} 
              onPress={() => router.push({
                pathname: "/request/[id]",
                params: {
                  id: item.id,
                  service: name.toString().trim() + ' ',
                  price: item.pricing?.[name.toString().trim() + ' '] || 0
                }
              })}
            >
              <Text style={styles.requestButtonText}>Make request</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Image
          source={{ uri: item.users.profile_pic || 'https://via.placeholder.com/150' }}
          style={styles.providerImage}
        />
      </View>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Providers Found</Text>
      <Text style={styles.emptyText}>
        There are no {name} providers available at the moment
      </Text>
    </View>
  );

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchQuery('');
    }
  };

  const toggleFilterModal = () => {
    setShowFilterModal(!showFilterModal);
  };

  const handleOutsidePress = () => {
    if (showSearch) {
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent
      animationType="slide"
      onRequestClose={toggleFilterModal}
    >
      <TouchableWithoutFeedback onPress={toggleFilterModal}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter & Sort</Text>
                <TouchableOpacity onPress={toggleFilterModal} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Sort By</Text>
                <View style={styles.sortOptions}>
                  {[
                    { id: 'distance', label: 'Distance', icon: 'location-outline' },
                    { id: 'price_low', label: 'Price: Low to High', icon: 'trending-up-outline' },
                    { id: 'price_high', label: 'Price: High to Low', icon: 'trending-down-outline' }
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.sortButton,
                        filters.sortBy === option.id && styles.activeSortButton
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, sortBy: option.id }))}
                    >
                      <Ionicons 
                        name={option.icon as any} 
                        size={20} 
                        color={filters.sortBy === option.id ? '#fff' : '#666'} 
                      />
                      <Text style={[
                        styles.sortButtonText,
                        filters.sortBy === option.id && styles.activeSortButtonText
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Maximum Distance</Text>
                <View style={styles.distanceOptions}>
                  {[5, 10, 25, 50].map((distance) => (
                    <TouchableOpacity
                      key={distance}
                      style={[
                        styles.distanceButton,
                        filters.maxDistance === distance && styles.activeDistanceButton
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, maxDistance: distance }))}
                    >
                      <Text style={[
                        styles.distanceButtonText,
                        filters.maxDistance === distance && styles.activeDistanceButtonText
                      ]}>
                        {distance} KM
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Price Range</Text>
                <View style={styles.priceInputContainer}>
                  <View style={styles.priceInput}>
                    <Text style={styles.currencySymbol}>₦</Text>
                    <TextInput
                      style={styles.input}
                      value={filters.priceRange.min.toString()}
                      onChangeText={(value) => setFilters(prev => ({
                        ...prev,
                        priceRange: { ...prev.priceRange, min: parseInt(value) || 0 }
                      }))}
                      keyboardType="numeric"
                      placeholder="Min"
                    />
                  </View>
                  <Text style={styles.priceSeparator}>to</Text>
                  <View style={styles.priceInput}>
                    <Text style={styles.currencySymbol}>₦</Text>
                    <TextInput
                      style={styles.input}
                      value={filters.priceRange.max.toString()}
                      onChangeText={(value) => setFilters(prev => ({
                        ...prev,
                        priceRange: { ...prev.priceRange, max: parseInt(value) || 0 }
                      }))}
                      keyboardType="numeric"
                      placeholder="Max"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={styles.resetButton}
                  onPress={() => setFilters({
                    sortBy: 'distance',
                    priceRange: { min: 0, max: 100000 },
                    maxDistance: 50
                  })}
                >
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.applyButton}
                  onPress={toggleFilterModal}
                >
                  <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  return (
    <TouchableWithoutFeedback onPress={handleOutsidePress}>
      <View style={styles.container}>
        <View style={styles.headerBackground}>
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1a1a1a" stopOpacity="0.9" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0.85" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#grad)" />
          </Svg>
          <View style={[
            styles.headerContent,
            { paddingBottom: showSearch ? 8 : 16 }
          ]}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSearch}>
                  <Ionicons name="search" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerButton} onPress={toggleFilterModal}>
                  <Ionicons name="options-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            {showSearch ? (
              <TouchableWithoutFeedback>
                <View>
                  <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search providers by name or bio..."
                  />
                </View>
              </TouchableWithoutFeedback>
            ) : (
              <>
                <Text style={styles.headerTitle}>{name}</Text>
                <View style={styles.titleUnderline} />
                <Text style={styles.subtitle}>
                  Get help from professionals to fix all home and office appliances
                </Text>
              </>
            )}
          </View>
        </View>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066CC" />
            <Text style={styles.loadingText}>Loading providers...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProviders}
            renderItem={renderProvider}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyComponent}
          />
        )}
        {renderFilterModal()}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerBackground: {
    height: '180@vs',
    backgroundColor: '#0066CC', 
  },
  headerContent: {
    flex: 1,
    paddingTop: '16@vs',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: '16@s',
  },
  headerRight: {
    flexDirection: 'row',
    gap: '16@s',
  },
  headerButton: {
    padding: '8@s',
  },
  headerTitle: {
    fontSize: '28@s',
    fontFamily: 'Urbanist-Bold',
    color: '#fff',
    marginTop: '16@vs',
    marginLeft: '24@s',
  },
  titleUnderline: {
    height: '2@vs',
    width: '40@s',
    backgroundColor: '#FF6B00',
    marginLeft: '24@s',
    marginTop: '8@vs',
    borderRadius: '1@vs',
  },
  subtitle: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    color: '#fff',
    marginTop: '8@vs',
    marginLeft: '24@s',
    opacity: 0.8,
  },
  listContainer: {
    padding: '16@s',
  },
  providerCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: '16@s',
    marginBottom: '12@s',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
    position: 'relative',
    height: '140@s',
  },
  providerImage: {
    width: '120@s',
    height: '140@s',
    position: 'absolute',
    left: 0,
  },
  providerInfo: {
    flex: 1,
    marginLeft: '130@s',
    paddingVertical: '12@s',
    paddingRight: '12@s',
    justifyContent: 'space-between',
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4@s',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: '10@s',
    fontFamily: 'Urbanist-Medium',
    color: '#FF4B55',
    marginLeft: '4@s',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#FF6B00',
  },
  providerName: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
    marginBottom: '2@s',
  },
  bioText: {
    fontSize: '12@s',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    lineHeight: '16@s',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: '8@s',
    paddingTop: '8@s',
  },
  viewButton: {
    backgroundColor: '#E5F3FF',
    paddingVertical: '6@s',
    paddingHorizontal: '16@s',
    borderRadius: '6@s',
  },
  viewButtonText: {
    color: '#0066CC',
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '12@s',
  },
  requestButton: {
    backgroundColor: '#0066CC',
    paddingVertical: '6@s',
    paddingHorizontal: '16@s',
    borderRadius: '6@s',
  },
  requestButtonText: {
    color: '#fff',
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '12@s',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: '16@s',
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '32@vs',
    paddingHorizontal: '16@s',
  },
  emptyTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    marginVertical: '8@vs',
  },
  emptyText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: '24@s',
    borderTopRightRadius: '24@s',
    padding: '24@s',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24@s',
  },
  modalTitle: {
    fontSize: '24@s',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  closeButton: {
    padding: '4@s',
  },
  filterSection: {
    marginBottom: '24@s',
  },
  filterLabel: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '16@s',
  },
  sortOptions: {
    gap: '12@s',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '12@s',
    borderRadius: '12@s',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: '8@s',
  },
  activeSortButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sortButtonText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#666',
  },
  activeSortButtonText: {
    color: '#fff',
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '8@s',
  },
  distanceButton: {
    paddingVertical: '10@s',
    paddingHorizontal: '20@s',
    borderRadius: '10@s',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F8F9FA',
  },
  activeDistanceButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  distanceButtonText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#666',
  },
  activeDistanceButtonText: {
    color: '#fff',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12@s',
  },
  priceInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: '12@s',
    paddingHorizontal: '12@s',
    paddingVertical: '8@s',
    backgroundColor: '#F8F9FA',
  },
  currencySymbol: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#666',
    marginRight: '4@s',
  },
  input: {
    flex: 1,
    fontSize: '16@s',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
  },
  priceSeparator: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  resetButton: {
    flex: 1,
    paddingVertical: '16@s',
    borderRadius: '12@s',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  resetButtonText: {
    color: '#666',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  applyButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    paddingVertical: '16@s',
    borderRadius: '12@s',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
}); 