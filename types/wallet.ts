export interface TransactionMetadata {
    booking_id?: string;
    bank_name?: string;
    account_name?: string;
    account_number?: string;
    reference?: string;
    transfer_code?: string;
    recipient_code?: string;
    payment_type?: string;
    timestamp?: string;
    user_name?: string;
    user_id?: string;
    service?: string;
    paystack_response?: any;
  }
  
  export interface WalletTransaction {
    id: string;
    created_at: string;
    sender_id: string | null;
    recipient_id: string | null;
    amount: number;
    type: 'deposit' | 'withdrawal' | 'payment' | 'booking_payment';
    status: 'pending' | 'completed' | 'failed';
    description?: string;
    metadata?: TransactionMetadata;
    reference?: string;
    sender?: {
      name: string;
    };
    recipient?: {
      name: string;
    };
    booking?: any;
  } 