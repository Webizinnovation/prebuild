import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { TextInput } from 'react-native-paper';
import { useUserStore } from '../../store/useUserStore';
import { validateBankAccount, createTransferRecipient, initiateTransfer, verifyTransfer } from '../../services/bank';
import { logTransactionError, updateTransactionStatus } from '../../utils/errorHandling';
import { supabase } from '../../services/supabase';
import Logo from '../../assets/images/Svg/logo2svg.svg';
import Toast from 'react-native-toast-message';

interface Bank {
  id: string;
  name: string;
  code: string;
  logo: string;
}

const NIGERIAN_BANKS: Bank[] = [
  { 
    id: '1', 
    name: 'Access Bank', 
    code: '044',
    logo: 'https://nigerianbanks.xyz/logo/access-bank.png',
  },
  { 
    id: '2', 
    name: 'GTBank', 
    code: '058',
    logo: 'https://nigerianbanks.xyz/logo/guaranty-trust-bank.png',
  },
  { 
    id: '3', 
    name: 'First Bank', 
    code: '011',
    logo: 'https://nigerianbanks.xyz/logo/first-bank-of-nigeria.png',
  },
  { 
    id: '4', 
    name: 'UBA', 
    code: '033',
    logo: 'https://nigerianbanks.xyz/logo/united-bank-for-africa.png',
  },
  { 
    id: '5', 
    name: 'Zenith Bank', 
    code: '057',
    logo: 'https://nigerianbanks.xyz/logo/zenith-bank.png',
  },
  {
    id: '6',
    name: 'OPay',
    code: '999992',
    logo: 'https://nigerianbanks.xyz/logo/paycom.png',
  },
  {
    id: '7',
    name: "PalmPay",
    code: "999991",
    logo: "https://nigerianbanks.xyz/logo/palmpay.png"
  },
  {
    id: '8',
    name: "Moniepoint MFB",
    code: "50515",
    logo: "https://nigerianbanks.xyz/logo/moniepoint-mfb-ng.png"
  },
  {
    id: '9',
    name: "Fidelity Bank",
    code: "070",
    logo: "https://nigerianbanks.xyz/logo/fidelity-bank.png"
  },
  {
    id: '10',
    name: "Keystone Bank",
    code: "082",
    logo: "https://nigerianbanks.xyz/logo/keystone-bank.png"
  },
  {
    id: '11',
    name: "Access Bank (Diamond)",
    code: "063",
    logo: "https://nigerianbanks.xyz/logo/access-bank-diamond.png"
  }
];

export default function WithdrawScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { profile, refreshProfile } = useUserStore();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountName, setAccountName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [wallet, setWallet] = useState<any>(null);

  useEffect(() => {
    if (params.amount) {
      setWithdrawAmount(params.amount as string);
    }
    fetchWallet();
  }, [params]);

  const fetchWallet = async () => {
    if (!profile?.id) return;

    try {
      const { data: walletData, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (error) throw error;
      setWallet(walletData);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  const validateAccountNumber = async (accNumber: string) => {
    if (accNumber.length === 10 && selectedBank) {
      setIsValidating(true);
      try {
        const response = await validateBankAccount(accNumber, selectedBank.code);
        if (response.status && response.data) {
          setAccountName(response.data.account_name);
        } else {
          Alert.alert('Validation Error', response.message);
          setAccountName('');
        }
      } catch (error) {
        console.error('Error validating account:', error);
        Alert.alert('Error', 'Failed to validate account number');
        setAccountName('');
      } finally {
        setIsValidating(false);
      }
    }
  };


  const verifyTransferStatus = async (reference: string, transactionId: string) => {
    try {
      const verificationResponse = await verifyTransfer(reference);
      
      if (!verificationResponse.status || !verificationResponse.data) {
        throw new Error('Transfer verification failed');
      }

      const transferStatus = verificationResponse.data.status;
      const transactionStatus = 
        transferStatus === 'success' ? 'completed' :
        transferStatus === 'failed' ? 'failed' :
        transferStatus === 'reversed' ? 'failed' : 'processing';

      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('metadata')
        .eq('id', transactionId)
        .single();

      await supabase
        .from('transactions')
        .update({
          status: transactionStatus,
          metadata: {
            ...existingTransaction?.metadata,
            verified_at: new Date().toISOString(),
            transfer_status: transferStatus,
            paystack_response: verificationResponse.data
          }
        })
        .eq('id', transactionId);

      return { status: transactionStatus, response: verificationResponse.data };
    } catch (error) {
      console.error('Error verifying transfer:', error);
      throw error;
    }
  };

  const handleWithdrawSubmit = async () => {
    if (!withdrawAmount || Number(withdrawAmount) < 10) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Amount',
        text2: 'Minimum withdrawal amount is ₦10',
        position: 'bottom'
      });
      return;
    }

    if (!accountNumber || !selectedBank || !accountName) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Details',
        text2: 'Please provide all bank account details',
        position: 'bottom'
      });
      return;
    }

    if (!wallet?.balance || Number(withdrawAmount) > wallet.balance) {
      Toast.show({
        type: 'error',
        text1: 'Insufficient Balance',
        text2: 'You do not have enough balance for this withdrawal',
        position: 'bottom'
      });
      return;
    }

    let transactionRecord: any = null;
    const transactionRef = `WD-${Date.now()}`;
    
    try {
      setWithdrawing(true);

      // 1. Create transfer recipient
      const recipientResponse = await createTransferRecipient(
        accountName,
        accountNumber,
        selectedBank.code
      );

      if (!recipientResponse.status || !recipientResponse.data) {
        throw new Error(recipientResponse.message || 'Failed to create transfer recipient');
      }

      // 2. Create transaction record first
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: profile?.id,
          amount: Number(withdrawAmount),
          type: 'withdrawal',
          status: 'pending',
          sender_type: profile?.role || 'user',
          reference: transactionRef,
          metadata: {
            bank_name: selectedBank.name,
            account_number: accountNumber,
            account_name: accountName,
            recipient_code: recipientResponse.data.recipient_code,
            recipient_response: recipientResponse.data
          }
        })
        .select()
        .single();

      if (transactionError) throw transactionError;
      transactionRecord = transaction;

      // 3. Initiate transfer
      const transferResponse = await initiateTransfer(
        Number(withdrawAmount),
        recipientResponse.data.recipient_code,
        transactionRef
      );

      if (!transferResponse.status) {
        throw new Error(transferResponse.message || 'Failed to initiate transfer');
      }

      // 4. Verify transfer status
      const { status: transferStatus, response: verificationData } = 
        await verifyTransferStatus(transactionRef, transaction.id);

      if (transferStatus === 'failed') {
        throw new Error('Transfer failed: ' + verificationData.reason);
      }

      if (transferStatus === 'processing') {
        Toast.show({
          type: 'info',
          text1: 'Processing',
          text2: 'Your withdrawal is being processed. This may take a few minutes.',
          position: 'bottom',
          visibilityTime: 4000
        });
        
        setTimeout(() => {
          router.back();
        }, 2000);
        return;
      }

      // If we get here, the transfer was successful
      // 5. Decrease wallet balance
      const { error: walletError } = await supabase.rpc('decrease_wallet_balance', {
        amount: Number(withdrawAmount),
        p_user_id: profile?.id
      });

      if (walletError) {
        throw walletError;
      }

      // 6. Refresh user profile to get updated balance
      await refreshProfile();
      
      Toast.show({
        type: 'success',
        text1: 'Withdrawal Successful',
        text2: `₦${withdrawAmount} will be credited to your account shortly.`,
        position: 'bottom',
        visibilityTime: 4000
      });
      
      setTimeout(() => {
        router.back();
      }, 2000);

    } catch (error: any) {
      // Determine the stage of failure based on error message
      const errorStage: 'initialization' | 'processing' | 'verification' | 'wallet_update' = 
        (error.message?.includes?.('recipient') ? 'initialization' :
        error.message?.includes?.('transfer') ? 'processing' :
        error.message?.includes?.('wallet') ? 'wallet_update' : 'processing');

      logTransactionError({
        type: 'withdrawal',
        stage: errorStage,
        error,
        details: {
          amount: Number(withdrawAmount),
          reference: transactionRef,
          userId: profile?.id
        }
      });

      // Update transaction status if we created one
      if (transactionRecord?.id) {
        await supabase
          .from('transactions')
          .update({
            status: 'failed',
            metadata: {
              ...transactionRecord.metadata,
              error: {
                stage: errorStage,
                message: error.message || 'Unknown error',
                timestamp: new Date().toISOString()
              }
            }
          })
          .eq('id', transactionRecord.id);
      }

      Toast.show({
        type: 'error',
        text1: 'Withdrawal Failed',
        text2: error.message || 'Failed to process withdrawal',
        position: 'bottom'
      });
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Withdraw Funds',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Logo width={120} height={120} />
            </View>

            {withdrawing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.processingText}>Processing your withdrawal...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.title}>Withdraw to Bank Account</Text>
                <Text style={styles.subtitle}>Enter amount and bank details</Text>

                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>₦</Text>
                  <TextInput
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                    keyboardType="phone-pad"
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor="#666"
                    mode="flat"
                    underlineColor="transparent"
                  />
                </View>

                <Text style={styles.sectionTitle}>Select Bank</Text>
                <View style={styles.banksGrid}>
                  {NIGERIAN_BANKS.map((bank) => (
                    <TouchableOpacity
                      key={bank.id}
                      style={[
                        styles.bankCard,
                        selectedBank?.id === bank.id && styles.bankCardSelected
                      ]}
                      onPress={() => setSelectedBank(bank)}
                    >
                      <Image 
                        source={{ uri: bank.logo }} 
                        style={styles.bankLogo}
                        resizeMode="contain"
                      />
                      <Text style={[
                        styles.bankName,
                        selectedBank?.id === bank.id && styles.bankNameSelected
                      ]}>
                        {bank.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.accountContainer}>
                  <Text style={styles.inputLabel}>Account Number</Text>
                  <TextInput
                    value={accountNumber}
                    onChangeText={(text) => {
                      setAccountNumber(text);
                      if (text.length === 10) {
                        validateAccountNumber(text);
                      }
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    mode="outlined"
                    style={styles.accountInput}
                    placeholder="Enter 10-digit account number"
                  />
                </View>

                {isValidating && (
                  <View style={styles.validationStatus}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.validationText}>Validating account...</Text>
                  </View>
                )}

                {accountName && (
                  <View style={styles.accountNameContainer}>
                    <Ionicons name="checkmark-circle" size={20} color="green" />
                    <Text style={styles.accountName}>{accountName}</Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={[
                    styles.withdrawButton,
                    (!withdrawAmount || !accountNumber || !selectedBank || !accountName || loading) && 
                    styles.disabledButton
                  ]}
                  onPress={handleWithdrawSubmit}
                  disabled={!withdrawAmount || !accountNumber || !selectedBank || !accountName || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.withdrawButtonText}>
                      Withdraw Funds
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
      
      <Toast />
    </SafeAreaView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: '8@s',
  },
  scrollContent: {
    flexGrow: 1,
    padding: '16@s',
  },
  keyboardAvoidingView: {
    flex: 1,
    minHeight: '100%',
  },
  content: {
    width: '100%',
    paddingTop: '24@s',
    paddingBottom: '32@s',
  },
  title: {
    fontSize: '24@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '8@s',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '16@s',
    color: '#666',
    marginBottom: '32@s',
    textAlign: 'center',
    fontFamily: 'Urbanist-SemiBold',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '24@s',
    width: '100%',
  },
  currencySymbol: {
    fontSize: '32@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginRight: '8@s',
  },
  amountInput: {
    flex: 1,
    fontSize: '32@s',
    fontFamily: 'Urbanist-Bold',
    backgroundColor: 'transparent',
    height: '70@vs',
    paddingHorizontal: '12@s',
  },
  sectionTitle: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    alignSelf: 'flex-start',
    marginBottom: '16@s',
  },
  banksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '8@s',
    marginBottom: '24@s',
  },
  bankCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: '12@s',
    padding: '12@s',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: '8@s',
  },
  bankCardSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: Colors.primary,
  },
  bankLogo: {
    width: '24@s',
    height: '24@s',
    marginRight: '8@s',
  },
  bankName: {
    flex: 1,
    fontSize: '14@s',
    color: '#666',
    fontFamily: 'Urbanist-SemiBold',
  },
  bankNameSelected: {
    color: Colors.primary,
    fontFamily: 'Urbanist-Bold',
  },
  accountContainer: {
    width: '100%',
    marginBottom: '16@s',
  },
  inputLabel: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
    marginBottom: '8@s',
  },
  accountInput: {
    backgroundColor: 'transparent',
    fontFamily: 'Urbanist-Bold',
  },
  validationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: '12@s',
    borderRadius: '8@s',
    marginBottom: '16@s',
  },
  validationText: {
    marginLeft: '8@s',
    fontSize: '14@s',
    color: Colors.primary,
  },
  accountNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: '12@s',
    borderRadius: '8@s',
    marginBottom: '24@s',
  },
  accountName: {
    marginLeft: '8@s',
    fontSize: '16@s',
    color: 'green',
    fontFamily: 'Urbanist-Bold',
  },
  withdrawButton: {
    backgroundColor: Colors.primary,
    width: '100%',
    paddingVertical: '16@s',
    borderRadius: '12@s',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '16@s',
  },
  disabledButton: {
    opacity: 0.6,
  },
  withdrawButtonText: {
    color: 'white',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: '50@vs',
  },
  processingText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#666',
    marginTop: '16@s',
    textAlign: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: '24@s',
  },
}); 