import React, { useState, useRef, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, ViewToken, Dimensions, TouchableOpacity, Platform } from "react-native";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useAnimatedReaction,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import Memo from "../assets/images/Svg/memo.svg";
import Wallet from "../assets/images/Svg/wallet.svg";
import Discount from "../assets/images/Svg/discount.svg";
import { UserProfile } from "../types";

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375; // Detect smaller devices (iPhone SE, etc)

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  reg?: string;
  backgroundColor: string;
  SvgComponent: React.FC<{ animatedStyle: any, size?: number }>;
  actionText?: string;
  onPress?: () => void;
  isAdMob?: boolean;
}

interface BannerSliderProps {
  profile?: UserProfile | null;
}

const BannerSlider: React.FC<BannerSliderProps> = ({ profile }) => {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [customBanners, setCustomBanners] = useState<Banner[]>([]);
  
  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index || 0);
      }
    }
  ).current;

  const animatedValue = useSharedValue(0);
  const opacityValue = useSharedValue(0);
  const translateYValue = useSharedValue(50);

  useAnimatedReaction(
    () => currentIndex,
    () => {
      animatedValue.value = withTiming(1, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      });
      opacityValue.value = withTiming(1, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      });
      translateYValue.value = withTiming(0, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      });
    },
    [currentIndex]
  );

  useEffect(() => {
    const banners: Banner[] = [];
    
    if (profile?.id && !profile?.profile_pic) {
      banners.push({
        id: "1",
        title: `Welcome ${profile.name || 'User'}!`,
        subtitle: "Complete your profile by adding\na profile picture",
        backgroundColor: "#4A90E2",
        actionText: "Complete Profile",
        onPress: () => router.push('/profile'),
        SvgComponent: ({ animatedStyle, size = isSmallDevice ? 70 : 85 }) => (
          <Animated.View style={animatedStyle}>
            <Memo width={size} height={size} />
          </Animated.View>
        ),
      });
    }
    
    if (profile?.id) {
      banners.push({
        id: "2",
        title: "Fund Wallet",
        subtitle: "You need to fund your wallet\nto place your bookings",
        backgroundColor: "#C35D5D",
        actionText: "Fund Now",
        onPress: () => router.push('/wallet'),
        SvgComponent: ({ animatedStyle, size = isSmallDevice ? 80 : 95 }) => (
          <Animated.View style={animatedStyle}>
            <Wallet width={size} height={size * 0.77} />
          </Animated.View>
        ),
      });
    }
    
    banners.push({
      id: "3",
      title: "Welcome Offer",
      subtitle: "Enjoy 40% discount on your\nfirst booking for new users",
      backgroundColor: "#C0A681",
      SvgComponent: ({ animatedStyle, size = isSmallDevice ? 80 : 95 }) => (
        <Animated.View style={animatedStyle}>
          <Discount width={size} height={size * 0.77} />
        </Animated.View>
      ),
    });
    
    setCustomBanners(banners);
  }, [profile, router]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animatedValue.value }],
  }));

  const bannerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacityValue.value,
    transform: [{ translateY: translateYValue.value }],
  }));

  return (
    <View>
      <FlatList
        data={customBanners}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <Animated.View
            style={[
              styles.banner,
              { backgroundColor: item.backgroundColor },
              bannerAnimatedStyle,
            ]}
          >
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
              <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
              {item.id === "3" && (
                <View style={styles.specialOffer}>
                  <Text style={styles.specialOfferText}>welcome04</Text>
                </View>
              )}
              {item.actionText && (
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={item.onPress}
                >
                  <Text style={styles.actionButtonText}>{item.actionText}</Text>
                </TouchableOpacity>
              )}
            </View>
            <item.SvgComponent animatedStyle={animatedStyle} />
          </Animated.View>
        )}
      />
      <View style={styles.dotContainer}>
        {customBanners.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === currentIndex ? "#F58220" : "#5E5E5E",
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

export default BannerSlider;

const styles = StyleSheet.create({
  banner: {
    width: width - 32,
    height: 140,
    borderRadius: 20,
    padding: isSmallDevice ? 20 : 28,
    marginVertical: 16,
    marginHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: isSmallDevice ? 5 : 10,
    overflow: 'hidden',
  },
  bannerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontSize: isSmallDevice ? 22 : 25,
    fontFamily: "Urbanist-ExtraBold",
    marginBottom: isSmallDevice ? 6 : 8,
  },
  bannerSubtitle: {
    fontSize: isSmallDevice ? 12 : 14,
    fontFamily: "Urbanist-Medium",
    color: "rgba(255,255,255,0.99)",
    marginBottom: isSmallDevice ? 12 : 15,
  },
  regContainer: {
    position: "absolute",
    top: -20,
    right: -130,
  },
  reg: {
    color: "rgba(255,255,255,0.87)",
    fontSize: 12,
    fontFamily: "Urbanist-SemiBold",
  },
  specialOffer: {
    marginTop: isSmallDevice ? 12 : 15,
    paddingVertical: 4,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 12,
    borderStyle: "dotted",
    alignSelf: "flex-start",
  },
  specialOfferText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: isSmallDevice ? 12 : 14,
    fontFamily: "Urbanist-SemiBold",
    textTransform: "uppercase",
  },
  dotContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  actionButton: {
    marginTop: isSmallDevice ? 12 : 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: isSmallDevice ? 5 : 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: isSmallDevice ? 12 : 14,
    fontFamily: "Urbanist-Bold",
  },
}); 