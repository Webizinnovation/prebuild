import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="[id]"
        options={{
          presentation: 'modal',
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
} 