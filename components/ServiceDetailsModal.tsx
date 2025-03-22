import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';

// Define colors object
const Colors = {
  primary: '#0066CC',
  error: '#FF3B30',
  text: {
    primary: '#000000',
    secondary: '#666666',
    tertiary: '#444444'
  },
  background: {
    primary: '#FFFFFF',
    secondary: '#E5F3FF',
    tertiary: '#E8E8E8'
  }
};

interface ServiceDetailsModalProps {
  isVisible: boolean;
  onClose: () => void;
  booking: {
    id: string;
    booking_id: string;
    customer_name: string;
    service_date: string;
    address: string;
    activities: string[];
    amount: number;
    status: string;
  };
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export default function ServiceDetailsModal({
  isVisible,
  onClose,
  booking,
  onAccept,
  onReject,
}: ServiceDetailsModalProps) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.bookingIdContainer}>
              <Text style={styles.bookingId}>{booking.booking_id}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            <Text style={styles.customerName}>{booking.customer_name}</Text>
            <Text style={styles.dateTime}>{booking.service_date}</Text>
            <Text style={styles.address}>{booking.address}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activities included:</Text>
              {booking.activities.map((activity, index) => (
                <Text key={index} style={styles.activityItem}>
                  {activity}
                </Text>
              ))}
            </View>

            <View style={styles.feeSection}>
              <Text style={styles.feeLabel}>Total service fee:</Text>
              <Text style={styles.feeAmount}>NGN {booking.amount.toLocaleString()}</Text>
            </View>
          </ScrollView>

          {booking.status === 'pending' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => onAccept(booking.id)}
              >
                <Text style={styles.acceptButtonText}>Accept request</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => onReject(booking.id)}
              >
                <Text style={styles.rejectButtonText}>Reject request</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = ScaledSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.background.primary,
    borderRadius: '16@ms',
    width: '90%',
    maxHeight: '80%',
    padding: '20@ms',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16@ms',
  },
  bookingIdContainer: {
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: '12@ms',
    paddingVertical: '4@ms',
    borderRadius: '16@ms',
  },
  bookingId: {
    color: Colors.primary,
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
  },
  closeButton: {
    padding: '4@ms',
  },
  scrollContent: {
    marginBottom: '16@ms',
  },
  customerName: {
    fontSize: '20@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.text.primary,
    marginBottom: '8@ms',
  },
  dateTime: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.text.secondary,
    marginBottom: '8@ms',
  },
  address: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: Colors.text.tertiary,
    marginBottom: '24@ms',
  },
  section: {
    marginBottom: '24@ms',
  },
  sectionTitle: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: Colors.text.primary,
    marginBottom: '12@ms',
  },
  activityItem: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: Colors.text.tertiary,
    marginBottom: '8@ms',
    paddingLeft: '8@ms',
  },
  feeSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.background.tertiary,
    paddingTop: '16@ms',
    marginTop: '8@ms',
  },
  feeLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.text.secondary,
    marginBottom: '4@ms',
  },
  feeAmount: {
    fontSize: '24@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  actionButtons: {
    marginTop: '16@ms',
  },
  acceptButton: {
    backgroundColor: Colors.primary,
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
  },
  rejectButton: {
    backgroundColor: Colors.background.primary,
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  rejectButtonText: {
    color: Colors.error,
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
  },
});
