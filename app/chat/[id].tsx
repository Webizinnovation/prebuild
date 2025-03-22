import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import UserChatRoom from '../../components/chat/UserChatRoom';
import ProviderChatRoom from '../../components/chat/ProviderChatRoom';

export default function ChatRoomScreen() {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider';

  return (
    <View style={{ flex: 1 }}>
      {isProvider ? <ProviderChatRoom /> : <UserChatRoom />}
    </View>
  );
} 