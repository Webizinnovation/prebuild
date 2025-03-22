import { Stack } from 'expo-router';

export default function TransactionsLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="[id]"
        options={{
          headerShown: true,
        }}
      />
      <Stack.Screen 
        name="all"
        options={{
          headerShown: true,
          title: "All Transactions"
        }}
      />
    </Stack>
  );
} 