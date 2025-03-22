import { supabase } from './supabase';
import { retry } from '../utils/retry';

interface PaystackEvent {
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    transfer_code: string;
    recipient: {
      recipient_code: string;
      name: string;
    };
  };
}

// Add transaction status type
type TransactionStatus = 'pending' | 'completed' | 'failed' | 'retrying';

export const handlePaystackWebhook = async (event: PaystackEvent) => {
  try {
    const { reference, status } = event.data;

    // Find and lock the transaction
    const { data: transaction, error: findError } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .single();

    if (findError) throw findError;
    if (!transaction) throw new Error('Transaction not found');

    // Mark transaction as retrying if needed
    if (transaction.retry_count && transaction.retry_count > 0) {
      await supabase
        .from('transactions')
        .update({ status: 'retrying' as TransactionStatus })
        .eq('id', transaction.id);
    }

    // Update transaction with retry
    await retry(
      async () => {
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            status: status === 'success' ? 'completed' : 'failed',
            retry_count: (transaction.retry_count || 0) + 1,
            metadata: {
              ...transaction.metadata,
              paystack_response: event.data,
              last_retry: new Date().toISOString(),
            },
          })
          .eq('id', transaction.id);

        if (updateError) throw updateError;

        // If successful, update wallet balance with retry
        if (status === 'success') {
          await retry(
            async () => {
              const { error: walletError } = await supabase.rpc(
                transaction.type === 'withdrawal' ? 'decrease_wallet_balance' : 'increase_wallet_balance',
                {
                  user_id: transaction.user_id,
                  amount: event.data.amount / 100,
                }
              );

              if (walletError) throw walletError;
            },
            { maxAttempts: 5, delay: 2000 }
          );
        }
      },
      { maxAttempts: 3 }
    );

    return { success: true };
  } catch (error) {
    console.error('Webhook handling error:', error);
    
    // Log failed transaction for manual review
    await supabase
      .from('failed_transactions')
      .insert({
        transaction_id: transaction?.id,
        error_message: error.message,
        payload: event,
        created_at: new Date().toISOString(),
      });

    throw error;
  }
}; 