import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import LocationPicker from '../../LocationPicker';
import SearchBar from '../../SearchBar';

// Check if device has a small screen
const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

interface HeaderSectionProps {
  location: any;
  state: string;
  lga: string;
  setState: (state: string) => void;
  setLga: (lga: string) => void;
  getLocation: () => void;
  isRetrying: boolean;
  locationError: boolean;
  searchQuery: string;
  onSearchChange: (text: string) => void;
}

export const HeaderSection: React.FC<HeaderSectionProps> = ({
  location,
  state,
  lga,
  setState,
  setLga,
  getLocation,
  isRetrying,
  locationError,
  searchQuery,
  onSearchChange
}) => {
  return (
    <View style={styles.container}>
      <LocationPicker
        location={location}
        state={state}
        lga={lga}
        setState={setState}
        setLga={setLga}
        getLocation={getLocation}
        isRetrying={isRetrying}
        locationError={locationError}
      />
      <SearchBar
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder="Search by service or provider name..."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: isSmallDevice ? 4 : 8,
    paddingBottom: isSmallDevice ? 2 : 4,
  }
}); 