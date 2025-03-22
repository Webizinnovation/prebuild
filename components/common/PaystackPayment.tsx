import React from 'react';
import { StyleSheet } from 'react-native';
import { Paystack } from 'react-native-paystack-webview';
import { paystackConfig } from '../../services/paystack';

interface PaystackPaymentProps {
  amount: number;
  email: string;
  reference: string;
  onSuccess: (reference: string) => void;
  onCancel: () => void;
}

export function PaystackPayment({ 
  amount, 
  email, 
  reference, 
  onSuccess, 
  onCancel 
}: PaystackPaymentProps) {
  return (
    <Paystack
      paystackKey={paystackConfig.publicKey}
      amount={amount}
      billingEmail={email}
      activityIndicatorColor="green"
      onCancel={onCancel}
      onSuccess={({ transactionRef }) => {
        onSuccess(transactionRef.reference);
      }}
      autoStart={true}
      reference={reference}
      currency={paystackConfig.currency}
      channels={['card', 'bank', 'ussd', 'qr', 'mobile_money']}
    />
  );
} 