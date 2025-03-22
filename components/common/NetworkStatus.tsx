import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { ScaledSheet } from 'react-native-size-matters';
import { Colors } from '../../constants/Colors';

export function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <Modal transparent visible={isOffline} animationType="fade">
      <View style={styles.container}>
        <View style={styles.content}>
          <Ionicons name="cloud-offline" size={64} color={Colors.primary} />
          <Text style={styles.title}>No Internet Connection</Text>
          <Text style={styles.message}>
            Please check your internet connection and try again
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => NetInfo.fetch()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16@ms',
  },
  content: {
    backgroundColor: 'white',
    borderRadius: '16@ms',
    padding: '24@ms',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: '20@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginTop: '16@ms',
    marginBottom: '8@ms',
  },
  message: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    textAlign: 'center',
    marginBottom: '24@ms',
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: '24@ms',
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
  },
  retryText: {
    color: 'white',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
}); 