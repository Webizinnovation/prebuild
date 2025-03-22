import React, { useCallback } from 'react';
import { View, TouchableOpacity, Text, Image, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Provider } from '../../../types';
import { Colors } from '../../../constants/Colors';
import { ScaledSheet } from 'react-native-size-matters';

// Check if device has a small screen
const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

interface ProviderListProps {
  providers: Provider[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onProviderPress: (id: string) => void;
  searchQuery: string;
  ListHeaderComponent: React.ReactElement;
}

export const ProviderList: React.FC<ProviderListProps> = ({
  providers,
  loading,
  refreshing,
  onRefresh,
  onLoadMore,
  onProviderPress,
  searchQuery,
  ListHeaderComponent
}) => {
  const renderItem = useCallback(({ item }: { item: Provider }) => (
    <TouchableOpacity 
      style={styles.providerItem}
      onPress={() => onProviderPress(item.id)}
    >
      {item.users?.profile_pic ? (
        <Image
          source={{ uri: item.users.profile_pic }}
          style={styles.providerAvatar}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.providerAvatar, styles.providerAvatarPlaceholder]}>
          <Ionicons name="person" size={isSmallDevice ? 36 : 40} color="#fff" />
        </View>
      )}
      <View style={styles.providerInfo}>
        <Text style={styles.providerName} numberOfLines={1}>{item.users?.name}</Text>
        <View style={styles.serviceContainer}>
          <Ionicons name="briefcase-outline" size={isSmallDevice ? 14 : 16} color="#666" />
          <View style={styles.servicesWrap}>
            {item.services.slice(0, 2).map((service, index) => (
              <View key={index} style={styles.serviceTag}>
                <Text style={styles.serviceTagText} numberOfLines={1}>
                  {service}
                </Text>
              </View>
            ))}
            {item.services.length > 3 && (
              <Text style={styles.moreServices}>
                +{item.services.length - 3}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.distanceContainer}>
          <Ionicons name="location-outline" size={isSmallDevice ? 14 : 16} color="#888" />
          <Text style={styles.providerDistance}>2km away</Text>
        </View>
      </View>
      <View style={styles.ratingContainer}>
        <Ionicons name="star" size={isSmallDevice ? 14 : 16} color={Colors.primary} />
        <Text style={styles.providerRating}>{item.rating.toFixed(1)}</Text>
      </View>
    </TouchableOpacity>
  ), [onProviderPress]);

  const renderEmptyComponent = useCallback(() => {
    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={isSmallDevice ? 56 : 64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Results Found</Text>
          <Text style={styles.emptyText}>
            Try searching with different keywords
          </Text>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.emptyText}>Loading providers...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={isSmallDevice ? 56 : 64} color="#ccc" />
        <Text style={styles.emptyTitle}>No Providers Found</Text>
        <Text style={styles.emptyText}>
          There are no service providers in your area yet
        </Text>
      </View>
    );
  }, [searchQuery, loading]);

  return (
    <FlatList
      data={providers}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={renderEmptyComponent}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      onRefresh={onRefresh}
      refreshing={refreshing}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = ScaledSheet.create({
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: isSmallDevice ? 12 : 16,
    borderRadius: 12,
    marginBottom: isSmallDevice ? 10 : 12,
    marginHorizontal: isSmallDevice ? 12 : 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  providerAvatar: {
    width: isSmallDevice ? 60 : 70,
    height: isSmallDevice ? 60 : 70,
    borderRadius: 10,
    marginRight: isSmallDevice ? 10 : 12,
  },
  providerAvatarPlaceholder: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: isSmallDevice ? 3 : 4,
  },
  providerName: {
    fontSize: isSmallDevice ? 14 : 16,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  serviceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmallDevice ? 4 : 6,
    marginTop: isSmallDevice ? 3 : 4,
  },
  servicesWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isSmallDevice ? 3 : 4,
  },
  serviceTag: {
    backgroundColor: 'rgba(28,126,222,0.1)',
    paddingHorizontal: isSmallDevice ? 6 : 8,
    paddingVertical: isSmallDevice ? 3 : 4,
    borderRadius: 6,
  },
  serviceTagText: {
    fontSize: isSmallDevice ? 10 : 12,
    color: Colors.primary,
    fontFamily: 'Urbanist-Medium',
  },
  moreServices: {
    fontSize: isSmallDevice ? 10 : 12,
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    alignSelf: 'center',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmallDevice ? 4 : 6,
  },
  providerDistance: {
    fontSize: isSmallDevice ? 10 : 12,
    color: '#888',
    fontFamily: 'Urbanist-Medium',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,123,255,0.1)',
    padding: isSmallDevice ? 5 : 6,
    borderRadius: 8,
    gap: isSmallDevice ? 3 : 4,
  },
  providerRating: {
    fontSize: isSmallDevice ? 12 : 14,
    color: Colors.primary,
    fontFamily: 'Urbanist-Regular',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isSmallDevice ? 24 : 32,
    paddingHorizontal: isSmallDevice ? 12 : 16,
  },
  emptyTitle: {
    fontSize: isSmallDevice ? 16 : 18,
    fontFamily: 'Urbanist-Bold',
    marginVertical: isSmallDevice ? 6 : 8,
  },
  emptyText: {
    fontSize: isSmallDevice ? 12 : 14,
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    textAlign: 'center',
  },
}); 