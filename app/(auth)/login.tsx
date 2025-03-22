import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import CustomButton from '../../components/CustomBotton';
import Logo from '../../assets/images/Svg/logo1.svg';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all fields',
        position: 'bottom',
        visibilityTime: 4000,
      });
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (userError) throw userError;

      if (userData.role !== role) {
        await supabase.auth.signOut();
        Toast.show({
          type: 'error',
          text1: 'Access Denied',
          text2: `This account is registered as a ${userData.role}. Please select the correct role.`,
          position: 'bottom',
          visibilityTime: 4000,
        });
        return;
      }

      // Show success toast after successful login
      Toast.show({
        type: 'success',
        text1: 'Welcome back!',
        text2: 'Successfully logged in',
        visibilityTime: 3000,
        position: 'top',
        topOffset: 40,
      });

      // Wait a moment for the toast to be visible before navigation
      setTimeout(() => {
        router.replace('/');
      }, 1000);
      
    } catch (error: any) {
      console.error('Login error:', error);
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: error instanceof Error ? error.message : 'Please check your credentials',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const toastConfig = {
    success: (props: any) => (
      <View style={{
        width: '90%',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
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
        gap: 12,
      }}>
        <MaterialIcons name="check-circle" size={30} color="#22C55E" />
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 18,
            fontFamily: 'Urbanist-Bold',
            color: '#333',
            marginBottom: 4,
          }}>
            {props.text1}
          </Text>
          <Text style={{
            fontSize: 14,
            fontFamily: 'Urbanist-Regular',
            color: '#666',
          }}>
            {props.text2}
          </Text>
        </View>
      </View>
    ),
  };

  return (
    <>
      <SafeAreaView style={styles.container}>
        <ScrollView>
          <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
          <Link href="/onboarding/onboarding" style={styles.backLink}>
            <FontAwesome name="arrow-left" size={24} color="white" />
          </Link>

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Logo width={111} height={111} style={styles.logo} />
            </View>

            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'user' && styles.activeRole]}
                onPress={() => setRole('user')}
              >
                <Text style={[styles.roleText, role === 'user' && styles.activeRoleText]}>User</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleButton, role === 'provider' && styles.activeRole]}
                onPress={() => setRole('provider')}
              >
                <Text style={[styles.roleText, role === 'provider' && styles.activeRoleText]}>Provider</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <Animated.Text
                entering={FadeInDown.duration(800).springify()}
                style={styles.title}
              >
                Welcome Back!
              </Animated.Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#666"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    theme={{
                      colors: {
                        primary: Colors.primary,
                        text: '#000',
                        placeholder: '#666',
                      }
                    }}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#666"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!isPasswordVisible}
                    theme={{
                      colors: {
                        primary: Colors.primary,
                        text: '#000',
                        placeholder: '#666',
                      }
                    }}
                  />
                  <TouchableOpacity onPress={togglePasswordVisibility}>
                    <FontAwesome
                      name={isPasswordVisible ? "eye" : "eye-slash"}
                      size={18}
                      color="#666"
                      style={{ marginRight: 15 }}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.forgotPasswordContainer}>
                <TouchableOpacity 
                  onPress={() => {
                    Toast.show({
                      type: 'info',
                      text1: 'Reset Password',
                      text2: 'Password reset functionality coming soon',
                      position: 'bottom',
                      visibilityTime: 4000,
                    });
                  }}
                >
                  <Text style={styles.forgotPassword}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <Button 
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={styles.loginButton}
                contentStyle={styles.buttonContent}
              >
                {loading ? 'Logging in...' : `Login as ${role === 'user' ? 'User' : 'Provider'}`}
              </Button>

              <Text style={styles.orText}>or</Text>
              <View style={styles.socialLinks}>
                <TouchableOpacity>
                  <FontAwesome name="google" size={24} color="#DB4437" />
                </TouchableOpacity>
                <View style={styles.separator} />
                <TouchableOpacity>
                  <FontAwesome name="apple" size={24} color="#000000" />
                </TouchableOpacity>
                <View style={styles.separator} />
                <TouchableOpacity>
                  <FontAwesome name="facebook" size={24} color="#4267B2" />
                </TouchableOpacity>
              </View>

              <Link href="/(auth)/signup" asChild>
                <TouchableOpacity style={styles.signupLink}>
                  <Text style={styles.signupText}>
                    Don't have an account? <Text style={styles.signupHighlight}>Sign up</Text>
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      <Toast config={toastConfig} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  backLink: {
    margin: 20,
  },
  header: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
    backgroundColor: Colors.primary,
  },
  logoContainer: {
    marginTop: 0,
    marginBottom: width > 400 ? 150 : 35,
  },
  logo: {
    width: width > 400 ? 160 : 140,
    height: width > 400 ? 160 : 140,
    backgroundColor: "white",
    borderRadius: 300,
    resizeMode: "contain",
  },
  roleSelector: {
    flexDirection: 'row',
    marginBottom: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    padding: 5,
  },
  roleButton: {
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
  },
  activeRole: {
    backgroundColor: 'white',
  },
  roleText: {
    color: 'white',
    fontSize: 16,
    fontFamily: "Urbanist-Bold",
  },
  activeRoleText: {
    color: Colors.primary,
  },

  formContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    width: '100%',
    height: height > 400 ? '100%' : '50%',
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontFamily: "Urbanist-Bold",
    marginBottom: 30,
    textAlign: 'left',
    color: Colors.primary,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: "Urbanist-Medium",
    fontSize: 16,
    marginBottom: 10,
    marginLeft: 13,
    color: '#333',
  },
  inputContainer: {
    backgroundColor: "#D9D9D9",
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    backgroundColor: "#D9D9D9",
    height: 50,
    paddingHorizontal: 20,
    fontSize: 16,
    fontFamily: "Urbanist-Medium",
    color: '#000',
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D9D9D9",
    borderRadius: 12,
    overflow: 'hidden',
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  loginButton: {
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: "#00456C",
    width: width > 400 ? 320 : 300,
    alignSelf: "center",
    fontFamily: "Urbanist-Medium",
  },
  signupLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  signupText: {
    fontSize: 16,
    color: '#666',
    fontFamily: "Urbanist-Medium",
  },
  signupHighlight: {
    color: Colors.primary,
    fontFamily: "Urbanist-Bold",
  },
  forgotPasswordContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: -3,
    marginTop: -13,
  },
  forgotPassword: {
    textAlign: "right",
    color: Colors.primary,
    fontFamily: "Urbanist-MediumItalic",
    fontSize: 14,
    marginTop: 5,
  },
  orText: {
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Urbanist-Medium",
    marginVertical: 10,
  },
  socialLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 15,
    marginTop: 10,
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: "#ccc",
    marginHorizontal: 10,
  },
  buttonContent: {
    padding: 10,
    fontFamily: "Urbanist-Medium",
  },
}); 