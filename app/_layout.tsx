import React, { useEffect, useCallback } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { useUserStore } from '../store/useUserStore';
import { PaperProvider } from 'react-native-paper';
import { NetworkStatus } from '../components/common/NetworkStatus';
import { View, Animated, Easing, Text } from 'react-native';
import { useFonts } from 'expo-font';
import Logo from '../assets/images/Svg/logo1.svg';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';
import { moderateScale, scale } from 'react-native-size-matters';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const toastConfig = {
  success: (props: any) => (
    <View style={{
      position: 'relative',
      top: '80%',
      left: '10%',
      transform: [{ translateX: -45 }, { translateY: -50 }],
      width: '90%',
      backgroundColor: '#fff',
      padding: moderateScale(20),
      borderRadius: moderateScale(12),
      borderLeftWidth: 4,
      borderLeftColor: '#22C55E',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
    }}>
      <MaterialIcons name="check-circle" size={30} color="#22C55E" />
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: scale(18),
          fontFamily: 'Urbanist-Bold',
          color: '#333',
          marginBottom: moderateScale(4),
        }}>
          {props.text1}
        </Text>
        <Text style={{
          fontSize: scale(14),
          fontFamily: 'Urbanist-Regular',
          color: '#666',
        }}>
          {props.text2}
        </Text>
      </View>
    </View>
  ),
  
  error: (props: any) => (
    <View style={{
      position: 'relative',
      top: '80%',
      left: '10%',
      transform: [{ translateX: -45 }, { translateY: -50 }],
      width: '90%',
      backgroundColor: '#fff',
      padding: moderateScale(20),
      borderRadius: moderateScale(12),
      borderLeftWidth: 4,
      borderLeftColor: '#EF4444',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
    }}>
      <MaterialIcons name="error" size={30} color="#EF4444" />
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: scale(18),
          fontFamily: 'Urbanist-Bold',
          color: '#333',
          marginBottom: moderateScale(4),
        }}>
          {props.text1}
        </Text>
        <Text style={{
          fontSize: scale(14),
          fontFamily: 'Urbanist-Regular',
          color: '#666',
        }}>
          {props.text2}
        </Text>
      </View>
    </View>
  ),
  
  info: (props: any) => (
    <View style={{
      position: 'relative',
      top: '80%',
      left: '10%',
      transform: [{ translateX: -45 }, { translateY: -50 }],
      width: '90%',
      backgroundColor: '#fff',
      padding: moderateScale(20),
      borderRadius: moderateScale(12),
      borderLeftWidth: 4,
      borderLeftColor: '#3B82F6',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
    }}>
      <MaterialIcons name="info" size={30} color="#3B82F6" />
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: scale(18),
          fontFamily: 'Urbanist-Bold',
          color: '#333',
          marginBottom: moderateScale(4),
        }}>
          {props.text1}
        </Text>
        <Text style={{
          fontSize: scale(14),
          fontFamily: 'Urbanist-Regular',
          color: '#666',
        }}>
          {props.text2}
        </Text>
      </View>
    </View>
  ),
};

export default function RootLayout() {
  const { session, isLoading: authLoading } = useAuth();
  const { profile } = useUserStore();
  const fadeAnim = React.useRef(new Animated.Value(0.3)).current;

  const [fontsLoaded, fontError] = useFonts({
    "Urbanist-Black": require("../assets/fonts/Urbanist/static/Urbanist-Black.ttf"),
    "Urbanist-Medium": require("../assets/fonts/Urbanist/static/Urbanist-Medium.ttf"),
    "Urbanist-Regular": require("../assets/fonts/Urbanist/static/Urbanist-Regular.ttf"),
    "Urbanist-Bold": require("../assets/fonts/Urbanist/static/Urbanist-Bold.ttf"),
    "Urbanist-Light": require("../assets/fonts/Urbanist/static/Urbanist-Light.ttf"),
    "Urbanist-BlackItalic": require("../assets/fonts/Urbanist/static/Urbanist-BlackItalic.ttf"),
    "Urbanist-Italic": require("../assets/fonts/Urbanist/static/Urbanist-Italic.ttf"),
    "Urbanist-SemiBold": require("../assets/fonts/Urbanist/static/Urbanist-SemiBold.ttf"),
    "Urbanist-ExtraBold": require("../assets/fonts/Urbanist/static/Urbanist-ExtraBold.ttf"),
    "Urbanist-MediumItalic": require("../assets/fonts/Urbanist/static/Urbanist-MediumItalic.ttf"),
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  // Hide splash screen when ready
  useEffect(() => {
    if (fontsLoaded && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authLoading]);

  useEffect(() => {
    const fadeInOut = () => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.ease
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.ease
        })
      ]).start(() => fadeInOut()); 
    };

    if (authLoading) {
      fadeInOut();
    }

    return () => {
      fadeAnim.stopAnimation();
    };
  }, [authLoading]);

 
  if (!fontsLoaded) {
    return null;
  }

  
  if (authLoading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#fff' 
      }}>
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{
            scale: fadeAnim.interpolate({
              inputRange: [0.3, 1],
              outputRange: [0.9, 1.1]
            })
          }]
        }}>
          <Logo width={100} height={100} />
        </Animated.View>
      </View>
    );
  }

  return (
    <PaperProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        {!session || !profile ? (
          <>
            <Stack.Screen 
              name="onboarding"
              options={{ 
                headerShown: false,
                animation: 'fade'
              }} 
            />
            <Stack.Screen 
              name="(auth)"
              options={{ 
                headerShown: false,
                animation: 'fade'
              }} 
            />
          </>
        ) : (
          <>
            <Stack.Screen 
              name="(tabs)"
              options={{ 
                headerShown: false,
                animation: 'fade'
              }} 
            />
            <Stack.Screen 
              name="(provider)"
              options={{ 
                headerShown: false,
                animation: 'fade'
              }} 
            />
            <Stack.Screen 
              name="chat/[id]"
              options={{ 
                headerShown: false,
                animation: 'fade'
              }} 
            />
            <Stack.Screen 
              name="provider/chat/[id]"
              options={{ 
                headerShown: false,
                animation: 'fade'
              }} 
            />
          </>
        )}
      </Stack>
      <NetworkStatus />
      <StatusBar style="auto" />
      <Toast config={toastConfig} />
    </PaperProvider>
  );
}