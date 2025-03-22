import React, { useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Card, Text, Button, Searchbar, Chip, Avatar } from 'react-native-paper';
import { Provider } from '../../types/index';

interface ProviderListProps {
  providers: Provider[];
  onBook: (provider: Provider) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  loading?: boolean;
}

export const ProviderList = ({ providers, onBook, searchQuery, onSearch, loading }: ProviderListProps) => {
  const renderItem = useCallback(({ item }: { item: Provider }) => (
    <ProviderCard provider={item} onSelect={onBook} />
  ), [onBook]);

  const keyExtractor = useCallback((item: Provider) => item.id, []);

  const memoizedProviders = useMemo(() => providers, [providers]);

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search services or handymen..."
        value={searchQuery}
        onChangeText={onSearch}
        style={styles.searchbar}
      />
      
      <FlatList
        data={memoizedProviders}
        refreshing={loading}
        onRefresh={() => onSearch('')}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

interface ProviderCardProps {
  provider: Provider;
  onSelect: (provider: Provider) => void;
}

const ProviderCard = React.memo(({ provider, onSelect }: ProviderCardProps) => {
  const renderRating = (provider: Provider) => {
    return `${provider.rating.toFixed(1)} ⭐ (${provider.reviews_count} reviews)`;
  };

  return (
    <Card style={styles.card}>
      <Card.Title
        title={provider.users?.name || 'Unknown Provider'}
        subtitle={`${provider.location.city}, ${provider.location.state}`}
        left={(props) => (
          <Avatar.Image
            {...props}
            source={{ uri: provider.users?.profile_pic || 'https://via.placeholder.com/40' }}
          />
        )}
      />
      <Card.Content>
        <View style={styles.ratingContainer}>
          <Text variant="bodyLarge" style={styles.rating}>
            {renderRating(provider)}
          </Text>
          <Text variant="bodyMedium">
            {provider.experience} years experience
          </Text>
        </View>

        <View style={styles.servicesContainer}>
          {Object.keys(provider.services).map((service: string, index: number) => (
            <Chip
              key={index}
              style={styles.serviceChip}
              textStyle={styles.serviceText}
            >
              {service}
            </Chip>
          ))}
        </View>

        <View style={styles.pricingContainer}>
          <Text variant="bodyMedium">Starting from:</Text>
          {Object.entries(provider.pricing).map(([service, price]) => (
            <Text key={service} style={styles.price}>
              {service}: ₦{price.toLocaleString()}
            </Text>
          ))}
        </View>
      </Card.Content>
      <Card.Actions>
        <Button 
          mode="contained"
          onPress={() => onSelect(provider)}
        >
          Book Now
        </Button>
      </Card.Actions>
    </Card>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    margin: 16,
    elevation: 2,
  },
  card: {
    margin: 16,
    marginTop: 0,
    elevation: 3,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rating: {
    fontWeight: 'bold',
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  serviceChip: {
    margin: 4,
    backgroundColor: '#E8E8E8',
  },
  serviceText: {
    fontSize: 12,
  },
  pricingContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    paddingTop: 12,
    marginTop: 8,
  },
  price: {
    marginTop: 4,
    color: '#4CAF50',
  },
}); 