import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { ScaledSheet } from 'react-native-size-matters';

const { width } = Dimensions.get('window');

const getServiceButtonSize = () => {
  if (width < 360) { // Small phones
    return {
      width: 70,
      height: 70,
      iconSize: 24,
      textSize: 11,
      gap: 8,
      padding: 8
    };
  } else if (width < 400) { // Medium phones
    return {
      width: 80,
      height: 80,
      iconSize: 26,
      textSize: 12,
      gap: 10,
      padding: 10
    };
  } else { // Large phones
    return {
      width: 90,
      height: 90,
      iconSize: 28,
      textSize: 12,
      gap: 12,
      padding: 12
    };
  }
};

interface ServicesSectionProps {
  onServicePress: (serviceName: string) => void;
  onSeeAllPress: () => void;
}

const services = [
  { id: '1', name: 'Electrician', icon: 'flash' },
  { id: '2', name: 'Catering', icon: 'restaurant' },
  { id: '3', name: 'Laundry', icon: 'shirt' },
  { id: '4', name: 'Plumber', icon: 'construct' },
];

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  onServicePress,
  onSeeAllPress
}) => {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trending Services</Text>
        <TouchableOpacity onPress={onSeeAllPress}>
          <Text style={styles.seeAllText}>See all</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.servicesContainer}>
        <FlatList
          horizontal
          data={services}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.servicesListContent,
            { gap: getServiceButtonSize().gap }
          ]}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.serviceButton,
                {
                  width: getServiceButtonSize().width,
                  height: getServiceButtonSize().height,
                  padding: getServiceButtonSize().padding
                }
              ]}
              onPress={() => onServicePress(item.name)}
            >
              <Ionicons 
                name={item.icon as any} 
                size={getServiceButtonSize().iconSize} 
                color={Colors.primary} 
              />
              <Text style={[
                styles.serviceText,
                { fontSize: getServiceButtonSize().textSize }
              ]}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </>
  );
};

const styles = ScaledSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  seeAllText: {
    color: Colors.primary,
    fontFamily: 'Urbanist-Bold',
  },
  servicesContainer: {
    width: '100%',
    marginVertical: 16,
  },
  servicesListContent: {
    paddingHorizontal: 16,
  },
  serviceButton: {
    backgroundColor: 'rgba(28,126,222,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  serviceText: {
    color: '#666',
    fontFamily: 'Urbanist-Regular',
    marginTop: 8,
    textAlign: 'center',
  },
}); 