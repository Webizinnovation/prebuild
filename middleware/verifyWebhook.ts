import { Buffer } from 'buffer';
import sha512 from 'js-sha512';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

export const verifyPaystackWebhook = (
  payload: any,
  signature: string
): boolean => {
  try {
    // Convert payload to string if it's not already
    const payloadString = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload);

    // Create hash using js-sha512
    const hash = sha512.hmac(PAYSTACK_SECRET_KEY, payloadString);

    return hash === signature;
  } catch (error) {
    console.error('Webhook verification error:', error);
    return false;
  }
}; 