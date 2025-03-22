import React from 'react';
import { View } from 'react-native';
import ProviderChatRoom from '../../../components/chat/ProviderChatRoom';
import { Stack } from 'expo-router';
export default function ProviderChatRoomScreen() {
  return (
    <>
    <Stack.Screen 
    options={{ 
      headerShown: false 
    }} 
    />
    <View style={{ flex: 1, paddingVertical: 10 }}>
      <ProviderChatRoom />
    </View>
    </>
    
  );
}
