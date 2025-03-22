import {
    Animated,
    RefreshControl,
    StyleSheet,
    View,
    Text,
    Pressable,
  } from "react-native";
  import React, { useEffect, memo, useCallback, useState } from "react";
  import { Colors } from "../../constants/Colors";
  import { SafeAreaView } from "react-native-safe-area-context";
  import { useRouter } from "expo-router";
  import AntDesign from "@expo/vector-icons/AntDesign";
  import Logo from "../../assets/images/Svg/logo1.svg";
  import Logo1 from "../../assets/images/Svg/people.svg";
  import Logo3 from "../../assets/images/Svg/Page indicator.svg";
  import { scale, verticalScale, moderateScale } from "react-native-size-matters";
  
  const Welcome = memo(() => {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    
    // useEffect(() => {
    //     const timer = setTimeout(() => {
    //         router.push("/onboarding/Skip");
    //     }, 7000);
    //     return () => clearTimeout(timer);
    // }, [router]);
  
    const onRefresh = useCallback(() => {
      setRefreshing(true);
      setTimeout(() => {
        setRefreshing(false);
      }, 2000);
    }, []);
  
    const handleSkipPress = useCallback(() => {
      router.push("/onboarding/onboarding");
    }, [router]);
  
    return (
      <SafeAreaView style={styles.container}>
        <Animated.ScrollView
          contentContainerStyle={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.skipContainer}>
            <Pressable onPress={handleSkipPress} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
              <AntDesign name="right" size={17} color={Colors.primary} />
            </Pressable>
          </View>
          <View style={styles.logoContainer}>
            <Logo width={77} height={77} />
            <View style={styles.quoteContainer}>
              <Text style={styles.quoteText}>"Find services anywhere"</Text>
              <View style={styles.logo1Container}>
                <Logo1 width={374} height={197} style={styles.logo1} />
              </View>
            </View>
            <View>
              <Text style={styles.welcomeText}>
                Welcome to serve<Text style={styles.serveEzText}>ez</Text>
              </Text>
              <View style={styles.pageIndicatorContainer}>
                <Logo3 />
              </View>
              <Text style={styles.descriptionText}>
                Find professionals for your domestic needs quickly, and without
                hassles.
              </Text>
            </View>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
    );
  });
  
  const styles = StyleSheet.create({
    container: {
      backgroundColor: "#fff",
      height: "100%",
    },
    scrollView: {
      height: "100%",
    },
    skipContainer: {
      width: scale(30),
      height: verticalScale(80),
      padding: moderateScale(0),
      left: moderateScale(320),
    },
    skipButton: {
      display: "flex",
      flexDirection: "row",
      position: "relative",
      paddingTop: 30,
    },
    skipText: {
      color: Colors.primary,
      fontSize: 17,
      fontFamily: "Urbanist-SemiBold",
    },
    logoContainer: {
      display: "flex",
      alignItems: "center",
      marginTop: 40,
    },
    quoteContainer: {
      padding: 10,
    },
    quoteText: {
      fontFamily: "Urbanist-Regular",
      fontSize: 15,
      width: 300,
      textAlign: "center",
      paddingBottom: 30,
      color: "#5A8192",
    },
    logo1Container: {
      marginHorizontal: 55,
      height: 40,
      width: 40,
      borderRadius: 2,
      borderWidth: 103,
      borderColor: "#D9D9D966",
      alignItems: "center",
    },
    logo1: {
      marginHorizontal: -159,
      marginVertical: -59,
    },
    welcomeText: {
      fontFamily: "Urbanist-Bold",
      fontSize: 17,
      width: 300,
      textAlign: "center",
      paddingTop: 30,
      paddingBottom: 10,
      color: Colors.primary,
    },
    serveEzText: {
      color: "#F58220",
    },
    pageIndicatorContainer: {
      display: "flex",
      flexDirection: "row-reverse",
      width: 28,
      height: 5,
      marginLeft: 130,
      marginTop: 10,
      justifyContent: "center",
      alignItems: "center",
      gap: 7,
    },
    descriptionText: {
      fontFamily: "Urbanist-Regular",
      fontSize: 15,
      width: 300,
      textAlign: "center",
      paddingTop: 30,
    },
  });
  
  export default Welcome;
  