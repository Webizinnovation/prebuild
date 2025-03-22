import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const storage = Platform.select({
  web: {
    getItem: (key: string) => {
      return Promise.resolve(localStorage.getItem(key));
    },
    setItem: (key: string, value: string) => {
      return Promise.resolve(localStorage.setItem(key, value));
    },
    removeItem: (key: string) => {
      return Promise.resolve(localStorage.removeItem(key));
    },
  },
  default: AsyncStorage,
});