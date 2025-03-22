// Create a new service: services/cache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const cacheData = async (key: string, data: any, ttl = 3600000) => {
  const item = {
    data,
    timestamp: Date.now(),
    expires: Date.now() + ttl
  };
  await AsyncStorage.setItem(key, JSON.stringify(item));
};

export const getCachedData = async (key: string) => {
  const value = await AsyncStorage.getItem(key);
  if (!value) return null;
  
  const item = JSON.parse(value);
  if (Date.now() > item.expires) {
    await AsyncStorage.removeItem(key);
    return null;
  }
  
  return item.data;
};