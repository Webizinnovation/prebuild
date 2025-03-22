import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { UserProfile } from '../types';

interface UserState {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  selectedOrderTab: 'ALL' | 'YOUR BOOKINGS' | 'FAVORITES';
  isLoading: boolean;
  isOnline: boolean;
  setIsOnline: (status: boolean) => void;
  fetchProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
  clearProfile: () => void;
  refreshOnlineStatus: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  isAuthenticated: false,
  selectedOrderTab: 'YOUR BOOKINGS',
  isLoading: false,
  isOnline: false,
  setIsOnline: (status) => set({ isOnline: status }),
  
  fetchProfile: async () => {
    try {
      set({ isLoading: true });
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
          
        set({ profile });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  refreshProfile: async () => {
    try {
      const { profile } = get();
      
      if (!profile?.id) return;
      
      const { data: updatedProfile } = await supabase
        .from('users')
        .select(`
          *,
          wallets (
            balance
          )
        `)
        .eq('id', profile.id)
        .single();
        
      if (updatedProfile) {
        set({ 
          profile: {
            ...updatedProfile,
            wallet_balance: updatedProfile.wallets?.balance || 0
          }
        });
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  },
  
  updateProfile: async (updates) => {
    try {
      set({ isLoading: true });
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id);
          
        if (error) throw error;
        
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...updates } : null
        }));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  setProfile: (profile) => set({ profile }),

  clearProfile: () => set({
    profile: null,
    isAuthenticated: false,
    selectedOrderTab: 'YOUR BOOKINGS',
    isLoading: false,
    isOnline: false
  }),

  refreshOnlineStatus: async () => {
    try {
      const { profile } = get();
      if (!profile || profile.role !== 'provider') return;
      
      const { data, error } = await supabase
        .from('providers')
        .select('availability')
        .eq('user_id', profile.id)
        .single();
        
      if (error) throw error;
      
      if (data) {
        set({ isOnline: data.availability });
      }
    } catch (error) {
      console.error('Error refreshing online status:', error);
    }
  },
})); 