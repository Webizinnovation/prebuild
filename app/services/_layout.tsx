import { Stack } from 'expo-router';

export default function ServicesLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="[name]" 
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
} 