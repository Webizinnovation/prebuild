import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Colors } from "../constants/Colors";
import { ScaledSheet } from "react-native-size-matters";

// Check if device has a small screen
const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

interface LocationPickerProps {
  location: Location.LocationObject | null;
  state: string;
  lga: string;
  setState: (value: string) => void;
  setLga: (value: string) => void;
  getLocation: () => void;
  isRetrying?: boolean;
  locationError?: boolean;
}

const locations = [
  { label: "Current Location", value: "current," },
  { label: "Lagos, Ikeja", value: "Lagos,Ikeja" },
  { label: "Lagos, Lekki", value: "Lagos,Lekki" },
  { label: "Abuja, Galadimawa", value: "Abuja,Galadimawa" },
  { label: "Port Harcourt", value: "Port Harcourt," },
  { label: "Kano", value: "Kano," },
];

export default function LocationPicker({
  location,
  state,
  lga,
  setState,
  setLga,
  getLocation,
  isRetrying,
  locationError
}: LocationPickerProps) {
  return (
    <View style={styles.locationPicker}>
      <View style={styles.locationTextContainer}>
        <Ionicons name="location-outline" size={isSmallDevice ? 20 : 24} color="#fff" />
        <Text style={styles.locationText}>
          {locationError 
            ? 'Location unavailable' 
            : (!location 
                ? 'Getting location...' 
                : state && lga 
                  ? `${state}, ${lga}` 
                  : 'Location found but address unavailable'
              )
          }
        </Text>
      </View>
      <TouchableOpacity 
        style={styles.selectorContainer}
        onPress={getLocation}
        disabled={isRetrying}
      >
        <Ionicons 
          name={locationError ? "refresh" : "locate"} 
          size={isSmallDevice ? 16 : 18} 
          color={Colors.primary}
          style={isRetrying && styles.rotating}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = ScaledSheet.create({
  locationPicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#263238",
    borderRadius: 20,
    padding: isSmallDevice ? 10 : 13,
    marginVertical: isSmallDevice ? 8 : 10,
    marginHorizontal: 16,
  },
  locationTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  locationText: {
    color: "#fff",
    fontSize: isSmallDevice ? 14 : 16,
    fontFamily: "Urbanist-SemiBold",
    marginLeft: 8,
  },
  selectorContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: isSmallDevice ? 7 : 8.5,
    width: isSmallDevice ? 33 : 37,
    height: isSmallDevice ? 27 : 30,
    justifyContent: "center",
    alignItems: "center",
  },
  rotating: {
    opacity: 0.5,
  },
}); 