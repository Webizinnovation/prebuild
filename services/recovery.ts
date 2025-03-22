import { supabase } from './supabase';
import { retry } from '../utils/retry';
import { handlePaystackWebhook } from './webhook';

export const recoverFailedTransactions = async () => {
  try {
    // Get failed transactions that haven't exceeded retry limit
    const { data: failedTransactions, error } = await supabase
      .from('transactions')
      .select('*')
      .in('status', ['failed', 'retrying'])
      .lt('retry_count', 3)
      .order('created_at', { ascending: true });

    if (error) throw error;

    for (const transaction of failedTransactions) {
      try {
        // Attempt to recover each transaction
        await retry(
          async () => {
            if (transaction.type === 'withdrawal') {
              // Retry withdrawal
              const response = await fetch(
                `https://api.paystack.co/transfer/${transaction.reference}/retry`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                  },
                }
              );

              const data = await response.json();
              if (data.status) {
                await handlePaystackWebhook({
                  event: 'transfer.success',
                  data: data.data,
                });
              }
            } else {
              // For deposits, verify transaction status
              const response = await fetch(
                `https://api.paystack.co/transaction/verify/${transaction.reference}`,
                {
                  headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                  },
                }
              );

              const data = await response.json();
              if (data.status) {
                await handlePaystackWebhook({
                  event: 'charge.success',
                  data: data.data,
                });
              }
            }
          },
          { maxAttempts: 3, delay: 5000 }
        );
      } catch (error) {
        console.error(`Recovery failed for transaction ${transaction.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Transaction recovery error:', error);
    throw error;
  }
}; 