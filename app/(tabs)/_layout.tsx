import React, { useMemo } from "react";
import { Tabs } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Colors } from "../../constants/Colors";
import TabIcon from "../../components/TabIcon";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { Dimensions, StyleSheet } from "react-native";

const { width } = Dimensions.get("window");

const updateColors = {
  primary: Colors.primary,
  secondary: "rgba(102,138,169,0.91)",
  inactive: "rgba(0,0,0,0.65)",
  light: "rgb(255,255,255)",
  activeBackground: Colors.primary,
};

const styles = StyleSheet.create({
  gestureHandlerRootView: {
    flex: 1,
  },
  animatedView: {
    flex: 1,
    flexDirection: "row",
  },
  tabBarStyle: {
    borderTopColor: updateColors.light,
    justifyContent: "center",
    height: width > 400 ? 65 : 60,
    backgroundColor: updateColors.light,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    paddingHorizontal: 4,
  },
  tabBarItemStyle: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: 2,
  },
});

export default function TabLayout() {
  const translateX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ 
      translateX: withSpring(-translateX.value, {
        damping: 20,
        stiffness: 90,
      })
    }],
  }));

  const tabs = useMemo(() => [
    {
      name: "index",
      label: "Home",
      icon: MaterialCommunityIcons,
      IconName: "home",
    },
    {
      name: "services",
      label: "Services",
      icon: FontAwesome5,
      IconName: "list-alt",
    },
    {
      name: "wallet",
      label: "Wallet",
      icon: Ionicons,
      IconName: "wallet-outline",
    },
    {
      name: "chat",
      label: "Chat",
      icon: MaterialCommunityIcons,
      IconName: "message-text-outline",
    },
    {
      name: "profile",
      label: "Profile",
      icon: Ionicons,
      IconName: "person-outline",
    },
  ], []);

  const screenOptions = useMemo(() => ({
    headerShown: false,
    tabBarShowLabel: false,
    tabBarStyle: styles.tabBarStyle,
    tabBarItemStyle: styles.tabBarItemStyle,
    tabBarActiveTintColor: updateColors.primary,
    tabBarInactiveTintColor: updateColors.inactive,
    tabBarHideOnKeyboard: true,
  }), []);

  return (
    <GestureHandlerRootView style={styles.gestureHandlerRootView}>
      <Animated.View style={[styles.animatedView, animatedStyle]}>
        <Tabs screenOptions={screenOptions}>
          {tabs.map((tab) => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{
                title: tab.label,
                tabBarIcon: ({ focused }) => (
                  <TabIcon
                    name={tab.IconName}
                    focused={focused}
                    iconComponent={tab.icon}
                    label={tab.label}
                    colors={updateColors}
                  />
                ),
              }}
            />
          ))}
        </Tabs>
      </Animated.View>
    </GestureHandlerRootView>
  );
}
