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
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { TextInput } from 'react-native-paper';
import { useUserStore } from '../../store/useUserStore';
import { initializeTransaction, initializePayment, verifyTransaction } from '../../services/paystack';
import { supabase } from '../../services/supabase';
import * as Linking from 'expo-linking';
import Logo from '../../assets/images/Svg/logo2svg.svg';
import { logTransactionError, updateTransactionStatus } from '../../utils/errorHandling';
import Toast from 'react-native-toast-message';

export default function DepositScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { profile, refreshProfile } = useUserStore();
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactionReference, setTransactionReference] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  

  useEffect(() => {
    if (params.amount) {
      setDepositAmount(params.amount as string);
    }
  }, [params]);

  // Add a listener for deep links to handle Paystack callback
  useEffect(() => {
    // Setup deep linking listener
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened via a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [transactionReference]);

  // Handle deep link when user is redirected back from Paystack
  const handleDeepLink = async ({ url }: { url: string }) => {
    if (url.includes('payment') && transactionReference) {
      await verifyAndUpdateWallet(transactionReference);
    }
  };

  // Verify transaction and update wallet balance
  const verifyAndUpdateWallet = async (reference: string) => {
    let transactionData: any = null;
    try {
      setVerifying(true);
      
      // Get transaction record
      const { data: transaction, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .single();
        
      if (fetchError) throw fetchError;
      transactionData = transaction;

      // Verify the transaction with Paystack and get detailed response
      const verificationResponse = await verifyTransaction(reference);
      
      if (!verificationResponse || !verificationResponse.data) {
        throw new Error('Transaction verification failed');
      }

      // Get status from Paystack response
      const paystackStatus = verificationResponse.data.status;
      const transactionStatus = paystackStatus === 'success' ? 'completed' : 
                               paystackStatus === 'failed' ? 'failed' : 'pending';

      if (transactionStatus === 'failed') {
        throw new Error('Payment was not successful');
      }

      if (transactionStatus === 'pending') {
        Toast.show({
          type: 'info',
          text1: 'Transaction Pending',
          text2: 'Your payment is still being processed. Please check back later.',
          position: 'bottom',
          visibilityTime: 4000
        });
        return;
      }

      // If we get here, the transaction was successful
      // Update wallet balance using RPC function
      const { error: walletError } = await supabase.rpc('increase_wallet_balance', {
        amount: Number(depositAmount),
        p_user_id: profile?.id
      });

      if (walletError) {
        throw walletError;
      }

      // Update transaction status to completed with Paystack response data
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: transactionStatus,
          sender_type: 'user',
          metadata: {
            ...transactionData.metadata,
            verified_at: new Date().toISOString(),
            payment_status: paystackStatus,
            paystack_response: {
              status: paystackStatus,
              gateway_response: verificationResponse.data.gateway_response,
              channel: verificationResponse.data.channel,
              currency: verificationResponse.data.currency,
              ip_address: verificationResponse.data.ip_address,
              transaction_date: verificationResponse.data.transaction_date
            }
          }
        })
        .eq('id', transactionData.id);

      if (updateError) {
        console.error('Error updating transaction status:', updateError);
        throw new Error('Failed to update transaction status');
      }

      await refreshProfile();
      
      Toast.show({
        type: 'success',
        text1: 'Deposit Successful',
        text2: `Your wallet has been credited with ₦${depositAmount}`,
        position: 'bottom',
        visibilityTime: 4000
      });
      
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (error: any) {
      // Determine the stage of failure
      const errorStage: 'verification' | 'wallet_update' = 
        error.message?.includes?.('verification') ? 'verification' : 'wallet_update';
        
      logTransactionError({
        type: 'deposit',
        stage: errorStage,
        error,
        details: {
          amount: Number(depositAmount),
          reference,
          userId: profile?.id
        }
      });

      if (transactionData?.id) {
        // Update transaction status to failed with error details
        await supabase
          .from('transactions')
          .update({
            status: 'failed',
            metadata: {
              ...transactionData.metadata,
              error: {
                message: error.message || 'Unknown error',
                timestamp: new Date().toISOString()
              }
            }
          })
          .eq('id', transactionData.id);
      }

      Toast.show({
        type: 'error',
        text1: 'Verification Error',
        text2: 'Failed to verify transaction. Please contact support if your account was debited.',
        position: 'bottom'
      });
    } finally {
      setVerifying(false);
      setTransactionReference(null);
    }
  };

  const handleDepositSubmit = async () => {
    if (!depositAmount || Number(depositAmount) < 100) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Amount',
        text2: 'Minimum deposit amount is ₦100',
        position: 'bottom'
      });
      return;
    }

    let transactionData: any = null;
    
    try {
      setLoading(true);

      const transaction = await initializeTransaction(
        Number(depositAmount),
        profile?.email || '',
        { 
          user_id: profile?.id,
          sender_type: 'user'
        }
      );
      
      transactionData = transaction;
      setTransactionReference(transaction.reference);

      // Update transaction status to pending
      const { error: statusError } = await supabase
        .from('transactions')
        .update({
          status: 'pending',
          sender_type: 'user'
        })
        .eq('reference', transaction.reference);

      if (statusError) {
        console.error('Error updating transaction status:', statusError);
      }

      const paymentUrl = await initializePayment({
        email: profile?.email || '',
        amount: transaction.amount, 
        reference: transaction.reference,
        metadata: {
          user_id: profile?.id,
          sender_type: 'user'
        }
      });
      
      const supported = await Linking.canOpenURL(paymentUrl);
      if (!supported) {
        throw new Error('Cannot open payment page');
      }
      
      Toast.show({
        type: 'info',
        text1: 'Redirecting to Payment',
        text2: 'Please complete your payment on the Paystack page',
        position: 'bottom',
        visibilityTime: 3000
      });
      
      await Linking.openURL(paymentUrl);
    } catch (error: any) {
      logTransactionError({
        type: 'deposit',
        stage: 'initialization',
        error,
        details: {
          amount: Number(depositAmount),
          reference: transactionData?.reference,
          userId: profile?.id
        }
      });

      // Update reference if we have one
      if (transactionData?.reference) {
        await supabase
          .from('transactions')
          .update({
            status: 'failed',
            metadata: {
              error: error.message || 'Unknown error',
              timestamp: new Date().toISOString()
            }
          })
          .eq('reference', transactionData.reference);
      }

      Toast.show({
        type: 'error',
        text1: 'Deposit Failed',
        text2: error.message || 'Failed to initialize payment',
        position: 'bottom'
      });
    } finally {
      setLoading(false);
    }
  };


  const checkTransactionStatus = async () => {
    if (!transactionReference) {
      Toast.show({
        type: 'error',
        text1: 'No Transaction',
        text2: 'No ongoing transaction to verify',
        position: 'bottom'
      });
      return;
    }

    await verifyAndUpdateWallet(transactionReference);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Fund Wallet',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          ),
        }}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Logo width={120} height={120} />
            </View>

            {verifying ? (
              <View style={styles.verifyingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.verifyingText}>Verifying your payment...</Text>
              </View>
            ) : transactionReference ? (
              <View style={styles.transactionPendingContainer}>
                <Ionicons name="hourglass-outline" size={60} color={Colors.primary} />
                <Text style={styles.pendingTitle}>Payment In Progress</Text>
                <Text style={styles.pendingText}>
                  We're waiting for confirmation from Paystack. This may take a moment.
                </Text>
                <TouchableOpacity 
                  style={styles.checkStatusButton}
                  onPress={checkTransactionStatus}
                >
                  <Text style={styles.checkStatusText}>Check Status</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    setTransactionReference(null);
                    router.back();
                  }}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.title}>Add Money to Your Wallet</Text>
                <Text style={styles.subtitle}>Enter the amount you want to deposit</Text>

                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>₦</Text>
                  <TextInput
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    keyboardType="phone-pad"
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor="#666"
                    mode="flat"
                    underlineColor="transparent"
                  />
                </View>

                <View style={styles.quickAmounts}>
                  {[1000, 2000, 5000, 10000].map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[
                        styles.quickAmount,
                        depositAmount === amount.toString() && styles.selectedAmount
                      ]}
                      onPress={() => setDepositAmount(amount.toString())}
                    >
                      <Text style={[
                        styles.quickAmountText,
                        depositAmount === amount.toString() && styles.selectedAmountText
                      ]}>
                        ₦{amount.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.paymentInfo}>
                  <Ionicons name="information-circle-outline" size={20} color="#666" />
                  <Text style={styles.paymentInfoText}>
                    You'll be redirected to Paystack to complete your payment securely.
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[
                    styles.depositButton,
                    (!depositAmount || loading) && styles.disabledButton
                  ]}
                  onPress={handleDepositSubmit}
                  disabled={!depositAmount || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.depositButtonText}>
                      Proceed to Payment
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: '16@s',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: '24@s',
  },
  title: {
    fontSize: '24@s',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '8@s',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#666',
    marginBottom: '32@s',
    textAlign: 'center',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '24@s',
    width: '100%',
    fontFamily: 'Urbanist-Bold',
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
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: '32@s',
  },
  quickAmount: {
    width: '48%',
    paddingVertical: '16@s',
    paddingHorizontal: '12@s',
    backgroundColor: '#f0f0f0',
    borderRadius: '12@s',
    marginBottom: '12@s',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAmount: {
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  quickAmountText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
  },
  selectedAmountText: {
    color: Colors.primary,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: '12@s',
    borderRadius: '8@s',
    marginBottom: '24@s',
    width: '100%',
  },
  paymentInfoText: {
    fontSize: '14@s',
    color: '#666',
    marginLeft: '8@s',
    fontFamily: 'Urbanist-Medium',
    flex: 1,
  },
  depositButton: {
    backgroundColor: Colors.primary,
    width: '100%',
    paddingVertical: '16@s',
    borderRadius: '12@s',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '24@s',
  },
  disabledButton: {
    opacity: 0.6,
  },
  depositButtonText: {
    color: 'white',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  verifyingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: '50@vs',
  },
  verifyingText: {
    fontSize: '16@s',
    color: '#666',
    marginTop: '16@s',
    textAlign: 'center',
  },
  transactionPendingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: '50@vs',
  },
  pendingTitle: {
    fontSize: '22@s',
    fontFamily: 'Urbanist-Bold',
    marginTop: '16@s',
    marginBottom: '8@s',
    textAlign: 'center',
    color: '#333',
  },
  pendingText: {
    fontSize: '14@s',
    color: '#666',
    marginBottom: '32@s',
    textAlign: 'center',
    paddingHorizontal: '20@s',
  },
  checkStatusButton: {
    backgroundColor: Colors.primary,
    paddingVertical: '14@s',
    paddingHorizontal: '24@s',
    borderRadius: '12@s',
    marginBottom: '16@s',
    width: '80%',
    alignItems: 'center',
  },
  checkStatusText: {
    color: 'white',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: '14@s',
    paddingHorizontal: '24@s',
    borderRadius: '12@s',
    width: '80%',
    alignItems: 'center',
  },
  cancelText: {
    color: '#666',
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
  },
  logoContainer: {
    marginBottom: '24@s',
  },
}); 