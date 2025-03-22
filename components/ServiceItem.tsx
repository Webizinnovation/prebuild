import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { ServiceItem as ServiceItemType } from '../types/index';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface ServiceItemProps {
  service: ServiceItemType;
  onSelect: () => void;
  onAgreedAmountChange: (amount: string) => void;
  onServiceDetailsChange: (details: string) => void;
}

export const ServiceItem = ({ 
  service, 
  onSelect, 
  onAgreedAmountChange,
  onServiceDetailsChange 
}: ServiceItemProps) => {
  return (
    <View style={[styles.container, service.selected && styles.selected]}>
      <TouchableOpacity 
        style={styles.mainContent}
        onPress={onSelect}
      >
        <View style={styles.serviceInfo}>
          <Text style={styles.name}>{service.name}</Text>
          <Text style={styles.price}>₦{service.price.toLocaleString()}</Text>
        </View>
        <View style={[styles.checkbox, service.selected && styles.checkboxSelected]}>
          {service.selected && <MaterialIcons name="check" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>

      {service.selected && (
        <View style={styles.detailsContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter agreed amount (optional)"
            keyboardType="phone-pad"
            value={service.agreedAmount?.toString() || ''}
            onChangeText={onAgreedAmountChange}
          />
          <TextInput
            style={[styles.input, styles.detailsInput]}
            placeholder="Enter service details (optional)"
            multiline
            numberOfLines={3}
            value={service.serviceDetails || ''}
            onChangeText={onServiceDetailsChange}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selected: {
    borderColor: '#00456C',
    backgroundColor: '#F0F9FF',
  },
  name: {
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
  },
  price: {
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  serviceInfo: {
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  detailsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
  },
  detailsInput: {
    height: 100,
    textAlignVertical: 'top',
  },
}); 