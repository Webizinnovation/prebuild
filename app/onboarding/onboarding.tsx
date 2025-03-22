import React, { useEffect } from "react";
import {
  View,
  Dimensions,
  StyleSheet,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { Colors } from "../../constants/Colors";
import AntDesign from "@expo/vector-icons/AntDesign";
import { router } from "expo-router";
import CustomButton from "../../components/CustomBotton";
import Animated, {
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import Logo from "../../assets/images/Svg/logo2svg.svg";

const { width } = Dimensions.get("window");

export default function Onboard() {

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        <AntDesign
          name="left"
          size={24}
          color="white"
          onPress={() => router.back()}
        />
      </View>
      <View style={styles.main}>
        <Animated.View style={styles.logoContainer}>
          <Logo style={styles.logo} />
        </Animated.View>
        <View style={styles.contentContainer}>
          <Animated.Text
            entering={FadeInDown.duration(700).springify()}
            style={styles.title}
          >
            Almost There!
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.duration(700).springify()}
            style={styles.subtitle}
          >
            Experience the convenience of a seamless and personalized process,
            coming to you wherever you are.
          </Animated.Text>
          <View style={styles.buttonGroup}>
            <Animated.View entering={FadeIn.duration(700).delay(300)}>
              <CustomButton
                title="Sign Up"
                handlePress={() => router.push("/(auth)/signup")}
                containerStyle={styles.signUpButton}
                textStyles={undefined}
                isLoading={undefined}
              />
            </Animated.View>
            <Animated.View entering={FadeIn.duration(700).delay(600)}>
              <CustomButton
                title="Log In"
                handlePress={() => router.push("/(auth)/login")}
                containerStyle={styles.logInButton}
                textStyles={undefined}
                isLoading={undefined}
              />
            </Animated.View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    marginTop: 70,
    marginLeft: 20,
  },
  main: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Colors.primary,
  },
  logoContainer: {
    marginTop: width > 400 ? 100 : 71,
    marginBottom: width > 400 ? 70 : 50,
  },
  logo: {
    borderRadius: 100,
    backgroundColor: "white",
  },
  contentContainer: {
    width: "100%",
    height: "70%",
    backgroundColor: "#fff",
    borderRadius: 80,
    paddingHorizontal: 20,
    paddingVertical: width > 400 ? 120 : 90,
    marginBottom: -55,
  },
  title: {
    color: Colors.primary,
    fontSize: width > 400 ? 36 : 32,
    fontFamily: "Urbanist-Bold",
    textAlign: "left",
    marginBottom: 20,
    marginLeft: 20,
  },
  subtitle: {
    fontSize: width > 400 ? 20 : 17,
    fontFamily: "Urbanist-Regular",
    marginLeft: 20,
    marginBottom: 30,
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 15,
    marginTop: width > 400 ? 80 : 70,
  },
  signUpButton: {
    paddingVertical: 20,
    paddingHorizontal: width > 400 ? 60 : 50,
    borderRadius: 40,
    backgroundColor: Colors.primary,
  },
  logInButton: {
    paddingVertical: 20,
    paddingHorizontal: width > 400 ? 60 : 50,
    borderRadius: 40,
    backgroundColor: "#00456C",
  },
});
