import { verifyPaystackWebhook } from '../../../middleware/verifyWebhook';
import { handlePaystackWebhook } from '../../../services/webhook';
import { supabase } from '../../../services/supabase';


export default function PaystackWebhook() {

  return null;
}


export async function handleWebhook(req: any, res: any) {
  try {
    const signature = req.headers['x-paystack-signature'];
    

    if (!verifyPaystackWebhook(req.body, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    
    if (event.event === 'charge.success') {
      const { reference, metadata, status } = event.data;
      
      // Get existing transaction to preserve metadata
      const { data: transaction, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .single();

      if (fetchError) throw fetchError;
      if (!transaction) throw new Error('Transaction not found');

      // Update transaction with status and metadata
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'completed',
          sender_type: 'user',
          metadata: {
            ...transaction.metadata,
            verified_at: new Date().toISOString(),
            payment_status: status,
            paystack_response: {
              status,
              gateway_response: event.data.gateway_response,
              channel: event.data.channel,
              currency: event.data.currency,
              ip_address: event.data.ip_address,
              transaction_date: event.data.transaction_date
            },
            webhook_event: event.event
          }
        })
        .eq('reference', reference);

      if (updateError) throw updateError;

      const amount = event.data.amount / 100; 
      await supabase.rpc('update_wallet_balance', { 
        p_user_id: metadata.user_id,
        p_amount: amount
      });
    } else if (event.event === 'transfer.success' || event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
      const { reference, status } = event.data;
      
      // Get the transaction
      const { data: transaction, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .single();

      if (fetchError) throw fetchError;
      if (!transaction) throw new Error('Transaction not found');

      const transactionStatus = 
        status === 'success' ? 'completed' :
        status === 'failed' || status === 'reversed' ? 'failed' : 'processing';

      // Update transaction with transfer status while preserving existing metadata
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: transactionStatus,
          metadata: {
            ...transaction.metadata,
            transfer_status: status,
            webhook_event: event.event,
            webhook_data: event.data,
            updated_at: new Date().toISOString()
          }
        })
        .eq('id', transaction.id);

      if (updateError) throw updateError;

      // If the transfer failed or was reversed, refund the wallet
      if (status === 'failed' || status === 'reversed') {
        const { error: walletError } = await supabase.rpc('increase_wallet_balance', {
          p_user_id: transaction.user_id,
          p_amount: transaction.amount
        });

        if (walletError) throw walletError;
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(400).json({ error: 'Webhook handling failed' });
  }
} 