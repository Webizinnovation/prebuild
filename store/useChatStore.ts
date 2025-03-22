import { create } from 'zustand';
import { supabase } from '../services/supabase';

interface ChatStore {
  userUnreadCount: number;
  providerUnreadCount: number;
  setUserUnreadCount: (count: number) => void;
  setProviderUnreadCount: (count: number) => void;
  refreshUnreadCounts: (role: string, userId?: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set) => ({
  userUnreadCount: 0,
  providerUnreadCount: 0,
  setUserUnreadCount: (count) => set({ userUnreadCount: count }),
  setProviderUnreadCount: (count) => set({ providerUnreadCount: count }),
  refreshUnreadCounts: async (role, userId) => {
    if (!userId) return;
    
    try {
      
      if (role === 'user') {
        
        const { data: chatRooms, error: roomsError } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('user_id', userId);
          
        if (roomsError) {
          return;
        }
        
        if (!chatRooms || chatRooms.length === 0) {
          set({ userUnreadCount: 0 });
          return;
        }
        
        const chatRoomIds = chatRooms.map(room => room.id);
        const { count, error } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_type', 'provider')
          .or('is_read.is.null,is_read.eq.false')
          .in('chat_id', chatRoomIds);
            
        if (error) {
        } else if (count !== null) {
          set({ userUnreadCount: count });
        }
      } else if (role === 'provider') {
        const { data: chatRooms, error: roomsError } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('provider_id', userId);
          
        if (roomsError) {
          return;
        }
        
        if (!chatRooms || chatRooms.length === 0) {
          set({ providerUnreadCount: 0 });
          return;
        }
        
        const chatRoomIds = chatRooms.map(room => room.id);
        const { count, error } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_type', 'user')
          .or('is_read.is.null,is_read.eq.false')
          .in('chat_id', chatRoomIds);
            
        if (error) {
        } else if (count !== null) {
          set({ providerUnreadCount: count });
        }
      }
    } catch (error) {
    }
  }
})); 