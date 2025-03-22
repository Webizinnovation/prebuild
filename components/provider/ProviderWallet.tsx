import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  ImageBackground,
  FlatList,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Wallet } from '../../types';
import { WalletTransaction } from '../../types/wallet';
import { useUserStore } from '../../store/useUserStore';
import { supabase } from '../../services/supabase';
import { useRouter } from 'expo-router';
import DrawerModal from '../common/DrawerModal';
import Toast from 'react-native-toast-message';

export function ProviderWallet() {
  const { profile } = useUserStore();
  const router = useRouter();

  // State variables
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<WalletTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<WalletTransaction | null>(null);
  const [lastTransactionTimestamp, setLastTransactionTimestamp] = useState<number>(Date.now());

  const withdrawScaleAnim = React.useRef(new Animated.Value(1)).current;

  // Fetch wallet data
  const fetchWalletData = useCallback(async () => {
    if (!profile?.id) return;
    
    setRefreshing(true);

    try {
      // Fetch wallet balance
      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (walletData) {
        setWallet(walletData);
      }

      await fetchTransactions();
      
      setLastTransactionTimestamp(Date.now());
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data');
    } finally {
      setRefreshing(false);
    }
  }, [profile?.id]);

  // Filter transactions based on selected tab
  const filterTransactions = (transactions: WalletTransaction[], tab: string) => {
    if (!transactions) return [];
    
    switch (tab) {
      case 'all':
        // Show all transactions
        return transactions;
      case 'earnings':
        // Show only payment transactions
        return transactions.filter(t => t.type === 'payment' || t.type === 'booking_payment');
      case 'withdrawals':
        // Show only withdrawal transactions
        return transactions.filter(t => t.type === 'withdrawal');
      default:
        return transactions;
    }
  };

  // Fetch transactions
  const fetchTransactions = async () => {
    if (!profile?.id) return;
    
    try {
      // First get the provider's ID from the providers table
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      if (providerError) throw providerError;

      if (!providerData?.id) {
        console.error('No provider found for user');
        return;
      }

      // Then fetch transactions using the provider's ID and user's ID for withdrawals
      const { data: transactionsData, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`provider_id.eq.${providerData.id},and(user_id.eq.${profile.id},type.eq.withdrawal)`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (transactionsData) {
        setTransactions(transactionsData);
        setFilteredTransactions(filterTransactions(transactionsData, selectedTab));
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      Alert.alert('Error', 'Failed to load transaction data');
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  // Monitor tab changes
  useEffect(() => {
    if (transactions.length > 0) {
      setFilteredTransactions(filterTransactions(transactions, selectedTab));
    }
  }, [selectedTab, transactions]);

  // Subscribe to real-time updates for incoming payments
  useEffect(() => {
    if (!profile?.id) return;

    const setupSubscription = async () => {
      // Get provider ID first
      const { data: providerData } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      if (!providerData?.id) return;

      const channel = supabase
        .channel('wallet_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `provider_id=eq.${providerData.id}`,
          },
          async (payload: any) => {
            console.log('New transaction:', payload);
            
            // Update wallet balance
            await fetchWalletData();
            
            // Show notification
            Toast.show({
              type: 'success',
              text1: 'Payment Received',
              text2: `₦${payload.new.amount.toLocaleString()} has been added to your wallet`,
              position: 'top',
              visibilityTime: 4000,
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupSubscription();
  }, [profile?.id]);

  const handleWithdrawPress = () => {
    // if (!wallet?.balance || wallet.balance <= 0) return;  // commenting out the balance check
    router.push('/payment/withdraw');
  };

  const handlePressIn = () => {
    Animated.spring(withdrawScaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(withdrawScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleMenuPress = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  const handleItemPress = (itemKey: string) => {
    setIsDrawerOpen(false);
    if (itemKey === 'Switch to User Account') {
    } else if (itemKey === 'Transactions history') {
      router.push('/transactions');
    }
  };

  const todayEarnings = transactions
    .filter(t => 
      (t.type === 'payment' || t.type === 'booking_payment') && 
      new Date(t.created_at).toDateString() === new Date().toDateString()
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const monthEarnings = transactions
    .filter(t => 
      (t.type === 'payment' || t.type === 'booking_payment') && 
      new Date(t.created_at).getMonth() === new Date().getMonth()
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const handleTransactionPress = (transaction: WalletTransaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionModal(true);
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

  const renderTransaction = ({ item: transaction }: { item: WalletTransaction }) => {
    // Determine transaction type display
    const getTransactionTypeDisplay = () => {
      switch (transaction.type) {
        case 'payment':
        case 'booking_payment':
          return `Payment from ${transaction.metadata?.user_name || 'Customer'}`;
        case 'withdrawal':
          return `Withdrawal to ${transaction.metadata?.account_name || 'Bank'}`;
        default:
          return transaction.type;
      }
    };

    // Determine if it's an incoming payment
    const isIncomingPayment = transaction.type === 'payment' || transaction.type === 'booking_payment';

    return (
      <TouchableOpacity 
        key={transaction.id} 
        style={styles.transactionItem}
        onPress={() => {
          setSelectedTransaction(transaction);
          setShowTransactionModal(true);
        }}
      >
        <Ionicons 
          name={isIncomingPayment ? 'arrow-down' : 'arrow-up'} 
          size={20} 
          color={isIncomingPayment ? 'green' : 'red'} 
        />
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionName}>
            {getTransactionTypeDisplay()}
          </Text>
          <Text style={styles.transactionDate}>
            {new Date(transaction.created_at).toLocaleDateString()}
          </Text>
          {transaction.type === 'withdrawal' ? (
            <Text style={styles.bookingReference}>
              Ref: #{transaction.reference || 'N/A'}
            </Text>
          ) : (
            transaction.metadata?.user_name && (
              <Text style={styles.bookingReference}>
                Customer: {transaction.metadata.user_name}
              </Text>
            )
          )}
        </View>
        <Text style={[
          styles.transactionAmount,
          isIncomingPayment ? styles.earning : styles.withdrawal
        ]}>
          {isIncomingPayment ? '+' : '-'}₦{transaction.amount.toLocaleString()}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTransactionModal = () => {
    if (!selectedTransaction) return null;

    const isIncomingPayment = selectedTransaction.type === 'payment' || selectedTransaction.type === 'booking_payment';

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showTransactionModal}
        onRequestClose={() => setShowTransactionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction Details</Text>
              <TouchableOpacity 
                onPress={() => setShowTransactionModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Ionicons 
                  name={isIncomingPayment ? 'arrow-down-circle' : 'arrow-up-circle'} 
                  size={40} 
                  color={isIncomingPayment ? 'green' : 'red'} 
                  style={styles.modalIcon}
                />
                <Text style={styles.transactionType}>
                  {isIncomingPayment ? 'Payment Received' : 'Withdrawal'}
                </Text>
              </View>

              <Text style={[styles.amountLarge, { color: isIncomingPayment ? 'green' : 'red' }]}>
                {isIncomingPayment ? '+' : '-'}₦{selectedTransaction.amount.toLocaleString()}
              </Text>

              <View style={styles.detailsContainer}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Date & Time</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedTransaction.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Reference Number</Text>
                  <Text style={styles.detailValue}>#{selectedTransaction.reference || selectedTransaction.id}</Text>
                </View>

                {isIncomingPayment ? (
                  <>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Customer Name</Text>
                      <Text style={styles.detailValue}>
                        {selectedTransaction.metadata?.user_name || 'N/A'}
                      </Text>
                    </View>
                    {selectedTransaction.metadata?.booking_id && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Booking ID</Text>
                        <Text style={styles.detailValue}>
                          #{selectedTransaction.metadata.booking_id}
                        </Text>
                      </View>
                    )}
                    {selectedTransaction.metadata?.service && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Service</Text>
                        <Text style={styles.detailValue}>
                          {selectedTransaction.metadata.service}
                        </Text>
                      </View>
                    )}
                    {selectedTransaction.metadata?.payment_type && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Payment Type</Text>
                        <Text style={styles.detailValue}>
                          {selectedTransaction.metadata.payment_type.split('_').map(
                            word => word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Account Name</Text>
                      <Text style={styles.detailValue}>
                        {selectedTransaction.metadata?.account_name || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Bank Name</Text>
                      <Text style={styles.detailValue}>
                        {selectedTransaction.metadata?.bank_name || 'N/A'}
                      </Text>
                    </View>
                  </>
                )}

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={[
                    styles.detailValue,
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

  const renderHeader = () => {
    return (
      <View>
        {/* Header with profile info */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image 
              source={{ uri: profile?.profile_pic || 'https://via.placeholder.com/40' }}
              style={styles.profilePic}
            />
            <Text style={styles.greeting}>Hi, {profile?.name}</Text>
          </View>
          <TouchableOpacity onPress={handleMenuPress}>
            <Ionicons name="menu-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>
        
        {/* Balance Card */}
        <ImageBackground
          source={require('../../assets/images/Mask group.png')}
          style={styles.balanceCard}
          imageStyle={styles.backgroundImageStyle}
        >
          <Text style={styles.balanceTitle}>Available Balance</Text>
          <Text style={styles.balanceAmount}>₦{wallet?.balance?.toLocaleString() || '0.00'}</Text>
          <View style={styles.buttonRow}>
            <Animated.View style={{ transform: [{ scale: withdrawScaleAnim }] }}>
              <TouchableOpacity
                style={[
                  styles.withdrawButton,
                  // (!wallet?.balance || wallet.balance <= 0) && styles.disabledButton  // 
                ]}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleWithdrawPress}
                activeOpacity={0.8}
              >
                <>
                  <Ionicons name="arrow-up-circle" size={20} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Withdraw to Bank</Text>
                </>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ImageBackground>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Today's Earnings</Text>
              <Text style={styles.statAmount}>₦{todayEarnings.toLocaleString()}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>This Month</Text>
              <Text style={styles.statAmount}>₦{monthEarnings.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabsContainer}>
          {['all', 'earnings', 'withdrawals'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedTab === tab && styles.activeTab]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transactions Header */}
        <View style={styles.transactionsHeader}>
          <Text style={styles.transactionsTitle}>Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/transactions/all')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.flatList}
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        onRefresh={fetchWalletData}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Transactions</Text>
            <Text style={styles.emptyText}>
              {selectedTab === 'earnings' 
                ? 'You haven\'t received any payments yet'
                : selectedTab === 'withdrawals'
                ? 'You haven\'t made any withdrawals yet'
                : 'Your transaction history will appear here'}
            </Text>
          </View>
        }
      />

      {renderTransactionModal()}
      <Toast />
      
      <DrawerModal
        isVisible={isDrawerOpen}
        onClose={handleMenuPress}
        items={[
          { key: "Home" },
          { key: "Bookings" },
          { key: "Notifications" },
          { key: "Transactions history" },
          { key: "Switch to User Account", color: "orange" },
          { key: "Edit Profile" },
          { key: "Settings" },
          { key: "Help" },
        ]}
        profileImageUri={profile?.profile_pic}
        onItemPress={handleItemPress}
        role='provider'
      />
    </View>
  );
}

const styles = ScaledSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f9f9f9',
    paddingTop: '16@ms',
  },
  flatList: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: '16@ms',
    paddingBottom: '16@ms',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: '16@ms',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePic: {
    width: '40@ms',
    height: '40@ms',
    borderRadius: '20@ms',
    marginRight: '12@ms',
  },
  greeting: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  balanceCard: {
    width: 'auto',
    height: '210@ms',
    backgroundColor: '#263238',
    borderRadius: '16@ms',
    padding: '16@ms',
    marginBottom: '16@ms',
  },
  backgroundImageStyle: {
    borderRadius: '16@ms',
  },
  balanceTitle: {
    color: '#A9BCCF',
    fontSize: '14.56@ms',
    fontFamily: 'Urbanist-SemiBold',
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: '44@ms',
    fontFamily: 'Urbanist-Regular',
    marginVertical: '8@ms',
  },
  buttonRow: {
    flexDirection: 'row',
    paddingVertical: '40@ms',
    justifyContent: 'center',
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: '12@ms',
    paddingHorizontal: '25@ms',
    borderRadius: '8@ms',
    width: '180@ms',
    height: '45@ms',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: '8@ms',
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Urbanist-Bold',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12@ms',
    padding: '18@ms',
    marginBottom: '16@ms',
    elevation: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '14@ms',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  statAmount: {
    fontSize: '24@ms',
    color: '#333',
    fontFamily: 'Urbanist-Bold',
    marginTop: '4@ms',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: '16@ms',
  },
  tab: {
    flex: 1,
    paddingVertical: '8@ms',
    alignItems: 'center',
    borderRadius: '8@ms',
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: '14@ms',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontFamily: 'Urbanist-Bold',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  transactionsTitle: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: '12@ms',
    color: Colors.primary,
    fontFamily: 'Urbanist-SemiBold',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: '12@ms',
    padding: '12@ms',
    marginBottom: '8@ms',
    elevation: 3,
  },
  transactionDetails: {
    flex: 1,
    marginLeft: '12@ms',
  },
  transactionName: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  transactionDate: {
    fontSize: '12@ms',
    color: '#777',
    fontFamily: 'Urbanist-Medium',
    marginTop: '4@ms',
  },
  transactionAmount: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
  },
  withdrawal: {
    color: '#dc3545',
  },
  earning: {
    color: Colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32@ms',
  },
  emptyTitle: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginTop: '16@ms',
  },
  emptyText: {
    fontSize: '14@ms',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    textAlign: 'center',
    marginTop: '8@ms',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  bookingReference: {
    fontSize: '12@ms',
    color: Colors.primary,
    fontFamily: 'Urbanist-Medium',
    marginTop: '4@ms',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: '20@ms',
    borderTopRightRadius: '20@ms',
    padding: '16@ms',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '16@ms',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  closeButton: {
    padding: '4@ms',
  },
  modalBody: {
    paddingVertical: '16@ms',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '16@ms',
  },
  modalIcon: {
    marginRight: '12@ms',
  },
  transactionType: {
    fontSize: '20@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  amountLarge: {
    fontSize: '32@ms',
    fontFamily: 'Urbanist-Bold',
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
  detailLabel: {
    fontSize: '12@ms',
    color: '#666',
    fontFamily: 'Urbanist-Medium',
    marginBottom: '4@ms',
  },
  detailValue: {
    fontSize: '14@ms',
    color: '#333',
    fontFamily: 'Urbanist-Bold',
  },
});