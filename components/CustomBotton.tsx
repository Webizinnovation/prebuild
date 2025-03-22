import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { Colors } from "../constants/Colors";

interface CustomButtonProps {
  title: string;
  containerStyle?: any;
  handlePress: () => void;
  textStyles?: any;
  isLoading?: boolean;
}

const CustomButton = ({
  title,
  containerStyle,
  handlePress,
  textStyles,
  isLoading,
}: CustomButtonProps) => {
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className={`${isLoading ? "opacity-50" : ""}`}
      style={[styles.container, containerStyle]}
      disabled={isLoading}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
};
const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: 25,
    padding: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontFamily: "Urbanist-Bold",
  },
});

export default CustomButton;
