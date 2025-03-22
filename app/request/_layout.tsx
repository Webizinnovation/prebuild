import { Stack } from 'expo-router';

export default function RequestLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="[id]"
        options={{
          headerShown: true,
        }}
      />
      <Stack.Screen 
        name="details/[id]"
        options={{
          headerShown: true,
          title: "Booking Details"
        }}
      />
    </Stack>
  );
} 