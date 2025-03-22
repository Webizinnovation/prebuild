const PAYSTACK_SECRET_KEY = 'sk_test_49ea20a4b1c065cc0e9016f7a2e3b073d4e1c729';
const PAYSTACK_API = 'https://api.paystack.co';

interface BankValidationResponse {
  status: boolean;
  message: string;
  data?: {
    account_number: string;
    account_name: string;
    bank_code: string;
  };
}

export const validateBankAccount = async (account_number: string, bank_code: string): Promise<BankValidationResponse> => {
  try {
    const response = await fetch(
      `${PAYSTACK_API}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
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
    console.error('Error validating account:', error);
    return { status: false, message: 'Failed to validate account' };
  }
};

export const getBanks = async () => {
  try {
    const response = await fetch('https://api.paystack.co/bank', {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();
    return data.data.map((bank: any) => ({
      id: bank.id.toString(),
      name: bank.name,
      code: bank.code,
    }));
  } catch (error) {
    console.error('Error fetching banks:', error);
    throw error;
  }
};

export const createTransferRecipient = async (
  name: string,
  account_number: string,
  bank_code: string
) => {
  try {
    const response = await fetch(`${PAYSTACK_API}/transferrecipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name,
        account_number,
        bank_code,
        currency: 'NGN',
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating recipient:', error);
    return { status: false, message: 'Failed to create transfer recipient' };
  }
};


export const initiateTransfer = async (
  amount: number,
  recipient: string,
  reference: string
) => {
  try {
    const response = await fetch(`${PAYSTACK_API}/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amount * 100, 
        recipient,
        reference,
        reason: 'Wallet Withdrawal',
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error initiating transfer:', error);
    return { status: false, message: 'Failed to initiate transfer' };
  }
};


export const verifyTransfer = async (reference: string) => {
  try {
    const response = await fetch(`${PAYSTACK_API}/transfer/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error verifying transfer:', error);
    return { status: false, message: 'Failed to verify transfer' };
  }
}; 