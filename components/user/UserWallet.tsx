import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  ImageBackground,
  Image,
  Alert,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../store/useUserStore';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../services/supabase';
import { UserWalletStyles } from '../../utils/styles';
interface UserWalletProps {
  initialBalance?: number;
  pendingPayments?: any[];
  onPayNow?: (paymentId: string) => Promise<void>;
  onMenuPress?: () => void;
}

export function UserWallet({ 
  initialBalance = 0,
  pendingPayments = [],
  onPayNow = async () => {},
  onMenuPress,
}: UserWalletProps) {
  const { profile } = useUserStore();
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [loadingWithdraw, setLoadingWithdraw] = useState(false);
  const depositScaleAnim = React.useRef(new Animated.Value(1)).current;
  const withdrawScaleAnim = React.useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [lastTransactionTimestamp, setLastTransactionTimestamp] = useState(Date.now());

  const handlePressIn = (
    anim: Animated.Value,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    setLoading(true);
    Animated.spring(anim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (
    anim: Animated.Value,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
    }).start(() => setLoading(false));
  };

  const handleDeposit = () => {
    router.push('/payment/deposit');
  };

  const handleWithdrawPress = () => {
    router.push('/payment/withdraw');
  };

  const fetchWalletAndTransactions = async () => {
    try {
      setRefreshing(true);
      
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', profile?.id)
        .single();

      if (wallet) {
        setBalance(wallet.balance);
      }

      await fetchTransactions();
      
      setLastTransactionTimestamp(Date.now());
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchWalletAndTransactions();
      return () => {};
    }, [])
  );

  useEffect(() => {
    fetchWalletAndTransactions();

    const transactionsSubscription = supabase
      .channel('transactions-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'transactions',
          filter: `user_id=eq.${profile?.id}`
        }, 
        () => {
          fetchWalletAndTransactions();
        }
      )
      .subscribe();

    return () => {
      transactionsSubscription.unsubscribe();
    };
  }, [profile?.id]);

  const onRefresh = async () => {
    await fetchWalletAndTransactions();
  };

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

  const handleTransactionPress = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsModalVisible(true);
  };

  const renderTransactionModal = () => {
    if (!selectedTransaction) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={UserWalletStyles.modalOverlay}>
          <View style={UserWalletStyles.modalContent}>
            <View style={UserWalletStyles.modalHeader}>
              <Text style={UserWalletStyles.modalTitle}>Transaction Details</Text>
              <TouchableOpacity 
                onPress={() => setIsModalVisible(false)}
                style={UserWalletStyles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={UserWalletStyles.modalBody}>
              <View style={UserWalletStyles.detailRow}>
                <Ionicons 
                  name={selectedTransaction.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'} 
                  size={40} 
                  color={selectedTransaction.type === 'deposit' ? 'green' : 'red'} 
                  style={UserWalletStyles.modalIcon}
                />
                <Text style={UserWalletStyles.transactionType}>
                  {selectedTransaction.type === 'deposit' ? 'Deposit' : 'Payment'}
                </Text>
              </View>

              <Text style={UserWalletStyles.amountLarge}>
                {selectedTransaction.type === 'deposit' ? '+' : '-'}₦{selectedTransaction.amount.toLocaleString()}
              </Text>

              <View style={UserWalletStyles.detailsContainer}>
                <View style={UserWalletStyles.detailItem}>
                  <Text style={UserWalletStyles.detailLabel}>Date & Time</Text>
                  <Text style={UserWalletStyles.detailValue}>{formatDate(selectedTransaction.created_at)}</Text>
                </View>

                <View style={UserWalletStyles.detailItem}>
                  <Text style={UserWalletStyles.detailLabel}>Reference Number</Text>
                  <Text style={UserWalletStyles.detailValue}>#{selectedTransaction.reference}</Text>
                </View>

                {selectedTransaction.type === 'deposit' && (
                  <>
                    <View style={UserWalletStyles.detailItem}>
                      <Text style={UserWalletStyles.detailLabel}>Payment Method</Text>
                      <Text style={UserWalletStyles.detailValue}>
                        {selectedTransaction.metadata?.payment_method || 'Paystack'}
                      </Text>
                    </View>
                    {selectedTransaction.metadata?.paystack_response && (
                      <View style={UserWalletStyles.detailItem}>
                        <Text style={UserWalletStyles.detailLabel}>Payment Channel</Text>
                        <Text style={UserWalletStyles.detailValue}>
                          {selectedTransaction.metadata.paystack_response.channel || 'N/A'}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {selectedTransaction.type === 'payment' && (
                  <>
                    {selectedTransaction.metadata?.provider_name && (
                      <View style={UserWalletStyles.detailItem}>
                        <Text style={UserWalletStyles.detailLabel}>Provider Name</Text>
                        <Text style={UserWalletStyles.detailValue}>
                          {selectedTransaction.metadata.provider_name}
                        </Text>
                      </View>
                    )}
                    {selectedTransaction.metadata?.service && (
                      <View style={UserWalletStyles.detailItem}>
                        <Text style={UserWalletStyles.detailLabel}>Service</Text>
                        <Text style={UserWalletStyles.detailValue}>
                          {selectedTransaction.metadata.service}
                        </Text>
                      </View>
                    )}
                    {selectedTransaction.metadata?.payment_type && (
                      <View style={UserWalletStyles.detailItem}>
                        <Text style={UserWalletStyles.detailLabel}>Payment Type</Text>
                        <Text style={UserWalletStyles.detailValue}>
                          {selectedTransaction.metadata.payment_type.split('_').map((word: string) => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                        </Text>
                      </View>
                    )}
                    {selectedTransaction.booking_id && (
                      <View style={UserWalletStyles.detailItem}>
                        <Text style={UserWalletStyles.detailLabel}>Booking ID</Text>
                        <Text style={UserWalletStyles.detailValue}>
                          #{selectedTransaction.booking_id}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {selectedTransaction.type === 'withdrawal' && (
                  <>
                    <View style=  {UserWalletStyles.detailItem}>
                      <Text style={UserWalletStyles.detailLabel}>Bank Name</Text>
                      <Text style={UserWalletStyles.detailValue}>
                        {selectedTransaction.metadata?.bank_name || 'N/A'}
                      </Text>
                    </View>
                    <View style={UserWalletStyles.detailItem}>
                      <Text style={UserWalletStyles.detailLabel}>Account Name</Text>
                      <Text style={UserWalletStyles.detailValue}>
                        {selectedTransaction.metadata?.account_name || 'N/A'}
                      </Text>
                    </View>
                    <View style={UserWalletStyles.detailItem}>
                      <Text style={UserWalletStyles.detailLabel}>Account Number</Text>
                      <Text style={UserWalletStyles.detailValue}>
                        {selectedTransaction.metadata?.account_number || 'N/A'}
                      </Text>
                    </View>
                  </>
                )}

                <View style={UserWalletStyles.detailItem}>
                  <Text style={UserWalletStyles.detailLabel}>Status</Text>
                  <Text style={[
                    UserWalletStyles.detailValue,
                    { 
                      color: selectedTransaction.status === 'completed' ? 'green' : 
                             selectedTransaction.status === 'failed' ? 'red' : 'orange' 
                    }
                  ]}>
                    {selectedTransaction.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderTransactionsList = () => {
    if (!transactions || transactions.length === 0) {
      return (
        <View style={UserWalletStyles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#ccc" />
          <Text style={UserWalletStyles.emptyTitle}>No Transactions Yet</Text>
          <Text style={UserWalletStyles.emptyText}>
            Your transaction history will appear here once you make or receive payments
          </Text>
        </View>
      );
    }
    
    return (
      <>
        <View style={UserWalletStyles.transactionsHeader}>
          <Text style={UserWalletStyles.transactionsTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/transactions/all')}>
            <Text style={UserWalletStyles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={UserWalletStyles.transactionsList}>
          {transactions.map((transaction) => (
            <TouchableOpacity 
              key={transaction.id} 
              style={UserWalletStyles.transactionItem}
              onPress={() => handleTransactionPress(transaction)}
            >
              <Ionicons 
                name={transaction.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'} 
                size={24} 
                color={transaction.type === 'deposit' ? 'green' : 'red'} 
              />
              <View style={UserWalletStyles.transactionDetails}>
                <Text style={UserWalletStyles.transactionName}>
                  {transaction.type === 'deposit' 
                    ? `Deposit via ${transaction.metadata?.payment_method || 'Paystack'}`
                    : transaction.metadata?.provider_name 
                      ? `Transfer to ${transaction.metadata.provider_name}`
                      : `Transfer to ${transaction.metadata?.bank_name || 'Bank'}${
                        transaction.metadata?.account_name ? ` - ${transaction.metadata.account_name}` : ''
                      }`
                  }
                </Text>
                <Text style={UserWalletStyles.transactionDate}>
                  {formatDate(transaction.created_at)}
                </Text>
              </View>
              <Text style={[
                UserWalletStyles.transactionAmount,
                { color: transaction.type === 'deposit' ? 'green' : 'red' }
              ]}>
                {transaction.type === 'deposit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  };

  return (
    <>
      <ScrollView 
        style={UserWalletStyles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={UserWalletStyles.headerContainer}>
          <View style={UserWalletStyles.imageUploadContainer}>
            <Image
              source={{
                uri: profile?.profile_pic || 'https://via.placeholder.com/50',
              }}
              style={UserWalletStyles.profileImage}
            />
            <Text style={UserWalletStyles.greeting}>Hi, {profile?.name || 'User'}</Text>
          </View>
          <TouchableOpacity onPress={onMenuPress}>
            <Ionicons name="menu" size={24} color="black" />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <ImageBackground
          source={require('../../assets/images/Mask group.png')}
          style={UserWalletStyles.balanceCard}
          imageStyle={UserWalletStyles.backgroundImageStyle}
        >
          <Text style={UserWalletStyles.balanceTitle}>Available Balance</Text>
          <Text style={UserWalletStyles.balanceAmount}>₦{balance.toLocaleString()}.05</Text>
          <View style={UserWalletStyles.actionButtons}>
            <Animated.View style={{ transform: [{ scale: depositScaleAnim }] }}>
              <TouchableOpacity
                style={[UserWalletStyles.actionButton, UserWalletStyles.depositButton]}
                onPress={handleDeposit}
                disabled={loadingDeposit}
                onPressIn={() => handlePressIn(depositScaleAnim, setLoadingDeposit)}
                onPressOut={() => handlePressOut(depositScaleAnim, setLoadingDeposit)}
              >
                {loadingDeposit ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="arrow-down-circle-outline" size={24} color="white" />
                    <Text style={UserWalletStyles.actionButtonText}>Deposit</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: withdrawScaleAnim }] }}>
              <TouchableOpacity
                style={[UserWalletStyles.actionButton, UserWalletStyles.withdrawButton]}
                onPress={handleWithdrawPress}
                disabled={loadingWithdraw}
                onPressIn={() => handlePressIn(withdrawScaleAnim, setLoadingWithdraw)}
                onPressOut={() => handlePressOut(withdrawScaleAnim, setLoadingWithdraw)}
              >
                {loadingWithdraw ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="arrow-up-circle-outline" size={24} color="white" />
                    <Text style={UserWalletStyles.actionButtonText}>Withdraw</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ImageBackground>

        {/* Payroll Section */}
        {pendingPayments.length > 0 && (
          <View style={UserWalletStyles.payrollContainer}>
            <View style={UserWalletStyles.pallroll}>
              <Text style={UserWalletStyles.payrollTitle}>Your Payroll:</Text>
              <Text style={UserWalletStyles.payrollServers}>{pendingPayments.length} server waiting</Text>
            </View>

            {pendingPayments.map((payment) => (
              <View key={payment.id} style={UserWalletStyles.payrollDetails}>
                <MaterialIcons name="person" size={24} color={Colors.primary} style={UserWalletStyles.payrollIcon} />
                <View style={UserWalletStyles.payrollTextContainer}>
                  <Text style={UserWalletStyles.payrollName}>{payment.provider.users.name}</Text>
                  <Text style={UserWalletStyles.payrollAmount}>₦{payment.amount} Due {payment.due}</Text>
                </View>
                <TouchableOpacity 
                  style={UserWalletStyles.payNowButton}
                  onPress={() => onPayNow(payment.id)}
                >
                  <Text style={UserWalletStyles.payNowText}>Pay Now</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Transactions Section */}
        <View style={UserWalletStyles.transactionsContainer}>
          {renderTransactionsList()}
        </View>
      </ScrollView>

      {renderTransactionModal()}
    </>
  );
}
