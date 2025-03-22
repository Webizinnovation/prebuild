import { BackHandler, Platform } from 'react-native';
import { router } from 'expo-router';

export const setupBackHandler = (handleLogout: () => void) => {
  const handleBackPress = () => {
    // Only handle back press if we're at the root/home screen
    if (router.canGoBack()) {
      return false; // Let the system handle the back press
    }
    handleLogout();
    return true;
  };

  if (Platform.OS === 'android') {
    BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', handleBackPress);
  }
}; 