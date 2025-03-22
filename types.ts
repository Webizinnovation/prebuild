export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'user' | 'provider';
  profile_pic?: string;
  created_at?: string;
  wallet_balance?: number;
}

export interface Provider {
  id: string;
  user_id: string;
  services: string[];
  pricing: Record<string, number>;
  experience: number;
  rating: number;
  reviews_count: number;
  availability: boolean;
  location: {
    city: string;
    state: string;
  };
  users?: {
    id: string;
    name: string;
    email: string;
    profile_pic: string | null;
  };
  bio?: string;
}

export interface ServiceRequest {
  id: string;
  provider_id: string;
  user_id: string;
  service: string;
  description: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  price: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  status: string;
  name: string;
  date: string;
  recipient?: { name: string };
  sender?: { name: string };
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface ChatParticipant {
  id: string;
  name: string;
  email: string;
  profile_pic: string | null;
}

export interface ChatRoom {
  id: string;
  user_id: string;
  provider_id: string;
  order_id?: string;
  last_message?: string;
  last_message_at?: string;
  user?: ChatParticipant;
  provider?: ChatParticipant;
} 