import { Animated, StyleSheet, View, Image, Text } from "react-native";
import React, { useEffect } from "react";
import { Colors } from "../../constants/Colors";
import { SafeAreaView } from "react-native-safe-area-context";
import ScrollView = Animated.ScrollView;
import { Link, useRouter } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import Logo from "../../assets/images/Svg/logo1.svg";
import Logo2 from "../../assets/images/Svg/Illustr--Man with tools.svg";
import Logo3 from "../../assets/images/Svg/Page indicator.svg";

export default function App() {
    const router = useRouter();
    
    // useEffect(() => {
    //   setTimeout(() => {
    //     router.push("/onboarding/onboarding");
    //   }, 7000);
    // }, []);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={{ height: "100%" }}
                overScrollMode={"auto"}
            >
                <View
                    style={{
                        display: "flex",
                        paddingTop: 50,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 260,
                    }}
                >
                    <View>
                        <Link
                            href={"/"}
                            style={{
                                color: Colors.primary,
                                fontSize: 17,
                                fontFamily: "Urbanist-SemiBold",
                            }}
                        >
                            <AntDesign name="left" size={18} color={Colors.primary} /> Back
                        </Link>
                    </View>

                    <Link
                        dismissTo
                        href={"/onboarding/onboarding"}
                        style={{
                            color: Colors.primary,
                            fontSize: 17,
                            fontFamily: "Urbanist-SemiBold",
                        }}
                    >
                        Skip
                        <AntDesign name="right" size={18} color={Colors.primary} />
                    </Link>
                </View>
                <View
                    style={{
                        display: "flex",
                        alignItems: "center",
                        marginTop: 40,
                    }}
                >
                    <Logo width={77} height={77} />
                    <View>
                        <Logo2 width={280.08} height={329.6} />
                    </View>
                    <View>
                        <Text
                            style={{
                                fontFamily: "Urbanist-Bold",
                                fontSize: 17,
                                width: 300,
                                textAlign: "center",
                                paddingTop: 30,
                                paddingBottom: 10,
                                color: Colors.primary,
                            }}
                        >
                            Welcome to serve<Text style={{ color: "#F58220" }}>ez</Text>
                        </Text>
                        <View
                            style={{
                                display: "flex",
                                flexDirection: "row-reverse",
                                width: 28,
                                height: 5,
                                marginLeft: 130,
                                marginTop: 10,
                                justifyContent: "center",
                                alignItems: "center",
                                gap: 7,
                            }}
                        >
                            <Logo3 />
                        </View>
                        <View>
                            <Text
                                style={{
                                    fontFamily: "Urbanist-Regular",
                                    fontSize: 15,
                                    width: 300,
                                    textAlign: "center",
                                    paddingTop: 30,
                                }}
                            >
                                Book with us from anywhere, anytime. We'll take care of the
                                rest.
                            </Text>
                        </View>
                        <View
                            style={{
                                alignItems: "center",
                                justifyContent: "center",
                                paddingTop: 30,
                            }}
                        ></View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#fff",
        height: "100%",
    },
});
