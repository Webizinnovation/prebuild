import React, { useEffect } from "react";
import { Text, View, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useChatStore } from "../store/useChatStore";
import { useUserStore } from "../store/useUserStore";

interface TabIconProps {
  name: string;
  focused: boolean;
  iconComponent: any;
  label: string;
  colors: {
    primary: string;
    inactive: string;
  };
}

const TabIcon: React.FC<TabIconProps> = ({
  name,
  focused,
  iconComponent: IconComponent,
  label,
  colors,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const { userUnreadCount, providerUnreadCount, refreshUnreadCounts } = useChatStore();
  const { profile } = useUserStore();

  const showNotification = (label === "Chat" || label === "Chats") && 
    ((profile?.role === 'user' && userUnreadCount > 0) || 
     (profile?.role === 'provider' && providerUnreadCount > 0));

  useEffect(() => {
    const config = { damping: 15, stiffness: 120 };
    scale.value = withSpring(focused ? 1.2 : 1, config);
    opacity.value = withSpring(focused ? 1 : 0.5, config);
    
    if (focused && (label === "Chat" || label === "Chats")) {
      refreshUnreadCounts(profile?.role || 'user', profile?.id);
    }
  }, [focused, profile?.id]);

  useEffect(() => {
    if (profile?.id && (label === "Chat" || label === "Chats")) {
      refreshUnreadCounts(profile.role || 'user', profile.id);
    }
  }, [profile?.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const notificationDotStyle = showNotification 
    ? [styles.notificationDot] 
    : [styles.notificationDot, { opacity: 0 }];

  return (
    <Animated.View style={[animatedStyle, { position: 'relative' }]}>
      <View
        style={
          focused
            ? styles.focusedContainer(colors.primary)
            : styles.defaultContainer
        }
      >
        <IconComponent
          name={name}
          size={22}
          color={focused ? "white" : colors.inactive}
        />
        {focused && <Text style={styles.label}>{label}</Text>}
      </View>
      <View style={notificationDotStyle} />
    </Animated.View>
  );
};

const styles = {
  focusedContainer: (backgroundColor: string): ViewStyle => ({
    flexDirection: "row",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 20,
    paddingHorizontal: 8,
    minWidth: 70,
    height: 36,
    top: 10,
    backgroundColor,
  }),
  defaultContainer: {
    flexDirection: "row",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minWidth: 70,
    height: 36,
    top: 10,
  } as ViewStyle,
  label: {
    color: "white",
    fontFamily: "Urbanist-SemiBold",
    marginLeft: 4,
    fontSize: 12,
  },
  notificationDot: {
    position: 'absolute' as const,
    top: 5,
    right: 15,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    borderWidth: 1,
    borderColor: 'white',
  } as ViewStyle,
};

export default TabIcon; 