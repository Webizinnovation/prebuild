import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';


const PAYSTACK_PUBLIC_KEY = 'pk_test_5f84a2e7381dba5615d50065bdaea11552246c5e';
const PAYSTACK_SECRET_KEY = 'sk_test_49ea20a4b1c065cc0e9016f7a2e3b073d4e1c729';


const APP_SCHEME = 'serveez'; 


const CALLBACK_URL = Linking.createURL('payment');

interface PaystackTransaction {
  reference: string;
  amount: number;
  email: string;
  metadata?: any;
}

export const getPaystackConfig = () => ({
  publicKey: PAYSTACK_PUBLIC_KEY,
  merchantEmail: 'webizinnovation@gmail.com',
  callbackUrl: CALLBACK_URL,
});

export async function initializeTransaction(amount: number, email: string, metadata?: any): Promise<PaystackTransaction> {
  try {
    const reference = `TXN_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    
  
    const { error } = await supabase
      .from('transactions')
      .insert([
        {
          reference,
          amount,
          type: 'deposit',
          status: 'pending',
          user_id: metadata.user_id,
          metadata: {
            email,
            ...metadata
          }
        },
      ]);

    if (error) throw error;

    return {
      reference,
      amount: amount * 100, 
      email,
      metadata,
    };
  } catch (error) {
    console.error('Error initializing transaction:', error);
    throw error;
  }
}

export async function verifyTransaction(reference: string) {
  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    
    return data;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    throw error;
  }
}

interface PaystackPayment {
  email: string;
  amount: number;
  reference: string;
  metadata?: any;
}

export const initializePayment = async (data: PaystackPayment) => {
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...data,
      callback_url: CALLBACK_URL,
    }),
  });

  const result = await response.json();
  if (!result.status) throw new Error(result.message);

  return result.data.authorization_url;
};

export const verifyPayment = async (reference: string) => {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    },
  });

  const data = await response.json();
  return data;
}; 