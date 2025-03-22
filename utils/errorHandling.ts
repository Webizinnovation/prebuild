import { supabase } from '../services/supabase';

export type TransactionErrorType = 'deposit' | 'withdrawal';
export type TransactionStage = 'initialization' | 'processing' | 'verification' | 'wallet_update';

export interface TransactionErrorDetails {
  type: TransactionErrorType;
  stage: TransactionStage;
  error: any;
  details?: {
    amount?: number;
    reference?: string;
    userId?: string;
  };
}

export const logTransactionError = (errorDetails: TransactionErrorDetails) => {
  const timestamp = new Date().toISOString();
  
  console.error('\n=== Transaction Error Log ===');
  console.error(`Type: ${errorDetails.type}`);
  console.error(`Stage: ${errorDetails.stage}`);
  console.error(`Time: ${timestamp}`);
  if (errorDetails.details) {
    console.error('Details:', errorDetails.details);
  }
  console.error('Error:', errorDetails.error);
  if (errorDetails.error?.stack) {
    console.error('Stack:', errorDetails.error.stack);
  }
  console.error('========================\n');

  return {
    ...errorDetails,
    timestamp
  };
};

export const updateTransactionStatus = async (
  transactionId: string,
  status: 'failed' | 'completed',
  error?: any
) => {
  try {
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status,
        metadata: error ? {
          error: {
            message: error.message || 'Unknown error',
            timestamp: new Date().toISOString()
          }
        } : undefined
      })
      .eq('id', transactionId);

    if (updateError) {
      console.error('Failed to update transaction status:', updateError);
    }
  } catch (e) {
    console.error('Error updating transaction status:', e);
  }
}; 