import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  FlatList,
  Animated,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { router } from "expo-router";
import { Colors } from "../../constants/Colors";

export interface DrawerItem {
  key: string;
  route?: `/${string}`;
  color?: string;
  icon?: string;
}

interface DrawerModalProps {
  isVisible: boolean;
  onClose: () => void;
  items?: DrawerItem[];
  profileImageUri?: string;
  onItemPress?: (itemKey: string) => void;
  showLogout?: boolean;
  customHeader?: React.ReactNode;
  role?: 'user' | 'provider';
}

const defaultItems: DrawerItem[] = [
  { key: "Home", icon: "home", route: "/(tabs)" },
  { key: "Services", icon: "list", route: "/(tabs)/services" },
  { key: "Notifications", icon: "notifications", route: "/notifications" },
  { key: "Transactions history", icon: "cash", route: "/transactions" },
  { key: "Create new request", icon: "add-circle" },
  { key: "Switch to Provider Account", color: "orange", icon: "swap-horizontal" },
  { key: "Edit Profile", icon: "person", route: "/profile/edit" },
  { key: "Favorites", icon: "heart", route: "/favorites" },
  { key: "Settings", icon: "settings", route: "/settings" },
  { key: "Help", icon: "help-circle", route: "/help" },
];

const DrawerModal: React.FC<DrawerModalProps> = ({
  isVisible,
  onClose,
  items = defaultItems,
  profileImageUri,
  onItemPress,
  showLogout = true,
  customHeader,
  role,
}) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              Alert.alert("Logged out successfully");
              router.push("/onboarding/Welcome");
            } catch (error: any) {
              Alert.alert("Error logging out", error.message);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleItemPress = (item: DrawerItem) => {
    onClose();
    if (item.route) {
      router.push(item.route as any);
    } else if (onItemPress) {
      onItemPress(item.key);
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.drawerContainer}>
        <Animated.View
          style={[
            styles.drawerContent,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          {customHeader || (
            <View style={styles.header}>
              <Image
                source={{ 
                  uri: profileImageUri || 'https://via.placeholder.com/50'
                }}
                style={styles.drawerProfileImage}
              />
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.drawerTitle}>{role === "user" ? "Provider" : "User"}</Text>
          <FlatList
            data={items}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleItemPress(item)}>
                <View style={styles.drawerItemContainer}>
                  {item.icon && (
                    <Ionicons 
                      name={item.icon as any} 
                      size={20} 
                      color={item.color || Colors.primary} 
                      style={styles.itemIcon}
                    />
                  )}
                  <Text
                    style={[styles.drawerItem, { color: item.color || "black" }]}
                  >
                    {item.key}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.key}
          />
          {showLogout && (
            <TouchableOpacity onPress={handleLogout}>
              <View style={styles.drawerItemContainer}>
                <Ionicons 
                  name="log-out" 
                  size={20} 
                  color="red" 
                  style={styles.itemIcon}
                />
                <Text style={styles.logoutText}>Logout</Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
  },
  drawerContent: {
    backgroundColor: "white",
    width: 300,
    height: "100%",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  drawerProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  closeButton: {
    padding: 8,
  },
  drawerTitle: {
    fontSize: 16,
    fontFamily: "Urbanist-Medium",
    marginVertical: 16,
  },
  drawerItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(204,204,204,0.27)",
  },
  itemIcon: {
    marginRight: 12,
  },
  drawerItem: {
    fontSize: 17,
    fontFamily: "Urbanist-SemiBold",
  },
  logoutText: {
    color: "red",
    fontSize: 17,
    fontFamily: "Urbanist-SemiBold",
  },
});

export default DrawerModal; 