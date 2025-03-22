import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useUserStore } from "../../store/useUserStore";
import { ChatRoom, ChatParticipant } from "../../types";
import { useAuth } from '../../hooks/useAuth';
import UserChatList from '../../components/chat/UserChatList';
import ProviderChatList from '../../components/chat/ProviderChatList';

interface ChatRoomWithParticipant extends ChatRoom {
  participant: ChatParticipant;
}


export default function ChatScreen() {
  const { session } = useAuth();
  const { profile } = useUserStore();
  
  console.log('ChatScreen - Profile:', { 
    sessionExists: !!session,
    profile: profile,
    profileRole: profile?.role 
  });

  const isProvider = profile?.role === 'provider';
  console.log('Is provider:', isProvider);``

  return (
    <View style={{ flex: 1 }}>
      {isProvider ? (
        <ProviderChatList />
      ) : (
        <UserChatList />
      )}
    </View>
  );
}
