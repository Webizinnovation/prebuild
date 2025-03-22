import { supabase } from '../../../services/supabase';

export default function VerifyPayment() {
  return null;
}

export async function verifyTransaction(reference: string) {
  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (data.status) {
      const paystackStatus = data.data.status;
      const transactionStatus = paystackStatus === 'success' ? 'completed' : 
                               paystackStatus === 'failed' ? 'failed' : 'pending';

    
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status: transactionStatus,
          sender_type: 'user',
          metadata: {
            verified_at: new Date().toISOString(),
            payment_status: paystackStatus,
            paystack_response: {
              status: paystackStatus,
              gateway_response: data.data.gateway_response,
              channel: data.data.channel,
              currency: data.data.currency,
              ip_address: data.data.ip_address,
              transaction_date: data.data.transaction_date
            }
          }
        })
        .eq('reference', reference);

      if (updateError) throw updateError;

      // Only update wallet balance if transaction is successful
      if (transactionStatus === 'completed') {
        const amount = data.data.amount / 100; 
        await supabase.rpc('update_wallet_balance', { 
          p_user_id: data.data.metadata.user_id,
          p_amount: amount
        });
      }

      return { success: true, status: transactionStatus };
    }

    return { success: false, error: 'Payment verification failed' };
  } catch (error) {
    console.error('Verification error:', error);
    return { success: false, error: 'Payment verification failed' };
  }
} 