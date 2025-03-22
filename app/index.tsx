import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { View, Animated, Easing } from 'react-native';
import Logo from '../assets/images/Svg/logo1.svg';
import React, { useRef, useEffect } from 'react';
import { useUserStore } from '../store/useUserStore';

export default function Index() {
  const { session, isLoading } = useAuth();
  const { profile } = useUserStore();
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isLoading) {
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

      fadeInOut();
      return () => fadeAnim.stopAnimation();
    }
  }, [isLoading]);

  if (isLoading) {
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

  if (!isLoading) {
    if (session && profile) {
      return <Redirect href="/(tabs)" />;
    }
    return <Redirect href="/onboarding/Welcome" />;
  }

  return null;
} 