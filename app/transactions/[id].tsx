import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../services/supabase';

export default function TransactionDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })} at ${date.toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })}`;
  };

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setTransaction(data);
      } catch (error) {
        console.error('Error fetching transaction:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Transaction not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Transaction Details',
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTitleStyle: styles.headerTitle,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          ),
        }} 
      />

      <ScrollView style={styles.scrollView}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons 
              name={transaction.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'} 
              size={40} 
              color={transaction.type === 'deposit' ? 'green' : 'red'} 
            />
            <Text style={styles.type}>
              {transaction.type === 'deposit' ? 'Deposit' : 
               transaction.type === 'payment' ? 'Payment' : 'Withdrawal'}
            </Text>
          </View>

          <Text style={styles.amount}>
            {transaction.type === 'deposit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
          </Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailItem}>
              <Text style={styles.label}>Date & Time</Text>
              <Text style={styles.value}>{formatDate(transaction.created_at)}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.label}>Reference Number</Text>
              <Text style={styles.value}>#{transaction.reference}</Text>
            </View>

            {transaction.type === 'deposit' && (
              <>
                <View style={styles.detailItem}>
                  <Text style={styles.label}>Payment Method</Text>
                  <Text style={styles.value}>
                    {transaction.metadata?.payment_method || 'Paystack'}
                  </Text>
                </View>
                {transaction.metadata?.paystack_response && (
                  <View style={styles.detailItem}>
                    <Text style={styles.label}>Payment Channel</Text>
                    <Text style={styles.value}>
                      {transaction.metadata.paystack_response.channel || 'N/A'}
                    </Text>
                  </View>
                )}
              </>
            )}

            {transaction.type === 'payment' && (
              <>
                {transaction.metadata?.provider_name && (
                  <View style={styles.detailItem}>
                    <Text style={styles.label}>Provider Name</Text>
                    <Text style={styles.value}>{transaction.metadata.provider_name}</Text>
                  </View>
                )}
                {transaction.metadata?.service && (
                  <View style={styles.detailItem}>
                    <Text style={styles.label}>Service</Text>
                    <Text style={styles.value}>{transaction.metadata.service}</Text>
                  </View>
                )}
                {transaction.metadata?.payment_type && (
                  <View style={styles.detailItem}>
                    <Text style={styles.label}>Payment Type</Text>
                    <Text style={styles.value}>
                      {transaction.metadata.payment_type.split('_').map((word: string) => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </Text>
                  </View>
                )}
                {transaction.booking_id && (
                  <View style={styles.detailItem}>
                    <Text style={styles.label}>Booking ID</Text>
                    <Text style={styles.value}>#{transaction.booking_id}</Text>
                  </View>
                )}
              </>
            )}

            {transaction.type === 'withdrawal' && (
              <>
                <View style={styles.detailItem}>
                  <Text style={styles.label}>Bank Name</Text>
                  <Text style={styles.value}>
                    {transaction.metadata?.bank_name || 'N/A'}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.label}>Account Name</Text>
                  <Text style={styles.value}>
                    {transaction.metadata?.account_name || 'N/A'}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.label}>Account Number</Text>
                  <Text style={styles.value}>
                    {transaction.metadata?.account_number || 'N/A'}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.detailItem}>
              <Text style={styles.label}>Status</Text>
              <Text style={[
                styles.value,
                { 
                  color: transaction.status === 'completed' ? 'green' : 
                         transaction.status === 'failed' ? 'red' : 'orange' 
                }
              ]}>
                {transaction.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  scrollView: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: 'red',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16@ms',
    margin: '16@ms',
    padding: '16@ms',
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '16@ms',
  },
  type: {
    fontSize: '24@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginLeft: '12@ms',
  },
  amount: {
    fontSize: '32@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '24@ms',
  },
  detailsContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: '12@ms',
    padding: '16@ms',
  },
  detailItem: {
    marginBottom: '12@ms',
  },
  label: {
    fontSize: '12@ms',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '4@ms',
  },
  value: {
    fontSize: '14@ms',
    color: '#333',
    fontFamily: 'Urbanist-Bold',
  },
}); 