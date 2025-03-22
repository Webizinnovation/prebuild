import { Stack } from 'expo-router';
import React from 'react';

export default function PaymentLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTintColor: '#000',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="withdraw" options={{ title: 'Withdraw Funds' }} />
      <Stack.Screen name="deposit" options={{ title: 'Deposit Funds' }} />
    </Stack>
  );
} 