export interface Provider {
  id: string;
  user_id: string;
  services: Record<string, number>;
  experience: number;
  rating: number;
  reviews_count: number;
  pricing: Record<string, number>;
  availability: boolean;
  location: {
    latitude: number;
    longitude: number;
    city: string;
    state: string;
  };
  users: {
    id: string;
    name: string;
    email: string;
    profile_pic?: string;
    phone?: string;
  };
  distance?: number;
  bank_details?: {
    account_number: string;
    bank_name: string;
  };
  completed_jobs?: number;
  cancelled_jobs?: number;
  provider_gallery?: Array<{
    id: string;
    image_url: string;
    provider_id: string;
    created_at: string;
  }>;
  level?: number;
  bio?: string;
  booking?: {
    id: string;
    service: string;
    booking_date: string;
    booking_time?: string;
    address?: string;
    amount: number;
    status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  };
}

export interface JobRequest {
  id: string;
  user_id: string;
  user_name: string;
  service: string;
  location: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Order {
  id: string;
  service: string;
  amount: number;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Transaction {
  id: string;
  created_at: string;
  sender_id: string | null;
  recipient_id: string | null;
  amount: number;
  type: 'deposit' | 'withdrawal';
  status: 'pending' | 'completed' | 'failed';
  description?: string;
  metadata?: {
    booking_id?: string;
    bank_name?: string;
    account_name?: string;
    account_number?: string;
    reference?: string;
    transfer_code?: string;
    recipient_code?: string;
    payment_type?: string;
    timestamp?: string;
  };
  sender?: {
    name: string;
  };
  recipient?: {
    name: string;
  };
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'voice' | 'file';
  created_at: string;
  file_name?: string;
  duration?: string;
}

export interface ChatRoom {
  id: string;
  user_id: string;
  provider_id: string;
  order_id?: string;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
}

export interface ChatParticipant {
  id: string;
  name: string;
  profile_pic?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'provider';
  profile_pic?: string;
  phone?: string;
  services?: string[];
  location?: {
    region: string;
    subregion: string;
    current_address?: string;
  };
  wallet_balance?: number;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'order' | 'chat' | 'payment' | 'system';
  read: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  provider_id: string;
  provider: {
    id: string;
    services: string[];
    users: {
      name: string;
      profile_pic?: string;
    }
  };
  category: string;
  date: string;
  details: string;
  price: number;
  status: 'InProgress' | 'Completed' | 'Cancelled';
  created_at: string;
}

export interface ServiceItem {
  name: string;
  price: number;
  selected?: boolean;
  agreedAmount?: number;
  serviceDetails?: string;
}

export interface BookingDetails {
  id: string;
  service: string;
  price: number;
  name: string;
  date: string;
  time?: string;
  details?: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  payment_details: {
    workmanship_fee: number;
    tools_hardware: number;
    vat: number;
  };
  landmark?: string;
  payment_plan: 'full_upfront' | 'half';
  payment_status?: 'pending' | 'completed';
  provider_id: string;
  provider_accepted?: boolean;
  services: ServiceItem[];
  total_price: number;
}

export interface Message {
  id: string;
  chat_room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_type: 'user' | 'provider';
  type: 'text' | 'image' | 'voice' | 'file';
  file_name?: string;
  is_read?: boolean;
  duration?: string;
}

export interface FileUpload {
  name: string;
  size?: number;
  mimeType?: string;
  uri: string;
  lastModified?: number;
} 