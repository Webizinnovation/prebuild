import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { FontAwesome, AntDesign } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Logo from '../../assets/images/Svg/logo1.svg';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const africanCountries: { [key: string]: string[] } = {
  Nigeria: ['Lagos', 'Abuja', 'Kano', 'Kaduna'],
  Kenya: ['Nairobi', 'Mombasa', 'Kisumu'],
  SouthAfrica: ['Johannesburg', 'Cape Town', 'Durban'],
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
      marginTop: 50,
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
  error: (props: any) => (
    <View style={{
      width: '90%',
      backgroundColor: '#fff',
      padding: 20,
      borderRadius: 12,
      borderLeftWidth: 4,
      borderLeftColor: '#ef4444',
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
      marginTop: 50,
    }}>
      <MaterialIcons name="error" size={30} color="#ef4444" />
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

export default function Signup() {
  const [role, setRole] = useState('user');
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    service: '',
    price: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [states, setStates] = useState<string[]>([]);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');

  const services = [
    "Appliances",
    "Refrigerator Services",
    "Mechanics",
    "Barbers",
    "Brick Layers",
    "Carpentry Services",
    "Laundry",
    "Car Washers",
    "Catering",
    "Driver",
    "Shipping Services",
    "Electrician",
    "Fashion Designers",
    "Fumigation Services",
    "Generator Services",
    "Hairstylist",
    "Home Interior Designers",
    "Make-Up Artist",
    "Nail Technician",
    "Painter",
    "Phone Repairers",
    "Photographer",
    "Plumber",
    "POP",
    "Tiller",
    "Video Editor",
    "Welder",
  ];

  const validateInput = () => {
    if (!form.username || !form.email || !form.password || !form.confirmPassword || !form.phone) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all required fields including phone number',
        visibilityTime: 3000
      });
      return false;
    }
    if (form.password !== form.confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Passwords do not match',
        visibilityTime: 3000
      });
      return false;
    }
    if (role === 'provider' && (!form.service || !form.price)) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all provider details',
        visibilityTime: 3000
      });
      return false;
    }
    if (!selectedCountry || !selectedState) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select your location',
        visibilityTime: 3000
      });
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validateInput()) return;
    
    setLoading(true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            name: form.username
          }
        }
      });

      if (authError) throw authError;

      if (!authData.user?.id) throw new Error('User ID is null');

      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: form.email,
            name: form.username,
            phone: form.phone,
            role,
            location: {
              country: selectedCountry,
              state: selectedState,
            },
          }
        ]);

      if (profileError) throw profileError;

      if (role === 'provider') {
        const { error: providerError } = await supabase
          .from('providers')
          .insert([
            {
              user_id: authData.user.id,
              services: [form.service],
              experience: 0,
              rating: 0,
              reviews_count: 0,
              availability: true,
              location: {
                city: selectedState,
                state: selectedCountry,
              },
              pricing: {
                [form.service]: parseFloat(form.price),
              },
            },
          ]);

        if (providerError) throw providerError;
      }

      await new Promise(resolve => {
        Toast.show({
          type: 'success',
          text1: 'Signup Successful! 🎉',
          text2: 'Please check your email to verify your account before logging in.',
          position: 'top',
          visibilityTime: 4000,
          topOffset: 50,
          onHide: () => {
            router.replace('/(auth)/login');
            resolve(null);
          }
        });
      });

    } catch (error: any) {
      console.error('Signup error:', error);
      Toast.show({
        type: 'error',
        text1: 'Signup Failed',
        text2: error.message || 'An error occurred during signup',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 50
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
        <Link href="/onboarding/onboarding" style={styles.backLink}>
          <AntDesign name="left" size={24} color="white" />
        </Link>

        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Logo width={77} height={77} style={styles.logo} />
            <Text style={styles.description}>
              Join 750+ professionals in providing services and meeting needs near you.
            </Text>
            <TouchableOpacity
              style={styles.roleToggle}
              onPress={() => setRole(role === 'user' ? 'provider' : 'user')}
            >
              <FontAwesome name="plus-square" size={24} color="white" />
              <View style={styles.roleToggleSeparator} />
              <Text style={styles.roleToggleText}>
                Create a {role === 'user' ? 'Provider' : 'User'} account
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Animated.Text
            entering={FadeInDown.duration(800).springify()}
            style={styles.title}
          >
            To create a {role} account,
          </Animated.Text>
          <Text style={styles.subtitle}>
            Fill in your accurate details below.
          </Text>

          {/* Common Fields */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your username"
              placeholderTextColor="gray"
              value={form.username}
              onChangeText={(text) => setForm(prev => ({ ...prev, username: text }))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="gray"
              value={form.email}
              onChangeText={(text) => setForm(prev => ({ ...prev, email: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="+234"
              placeholderTextColor="gray"
              value={form.phone}
              onChangeText={(text) => setForm(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordContainer}>
            <TextInput
                  style={[styles.input, styles.passwordInput]}
              placeholder="Enter your password"
              placeholderTextColor="gray"
              value={form.password}
              onChangeText={(text) => setForm(prev => ({ ...prev, password: text }))}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <FontAwesome 
                    name={showPassword ? "eye" : "eye-slash"} 
                    size={24} 
                    color="gray" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Confirm your password"
                  placeholderTextColor="gray"
                  value={form.confirmPassword}
                  onChangeText={(text) => setForm(prev => ({ ...prev, confirmPassword: text }))}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <FontAwesome 
                    name={showConfirmPassword ? "eye" : "eye-slash"} 
                    size={24} 
                    color="gray" 
                  />
                </TouchableOpacity>
              </View>
          </View>

          {/* Location Fields */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Country</Text>
            <TouchableOpacity 
              style={styles.input} 
              onPress={() => setShowCountryModal(true)}
            >
              <Text style={styles.pickerText}>
                {selectedCountry || "Select a country"}
              </Text>
            </TouchableOpacity>
          </View>

          <Modal
            visible={showCountryModal}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.modalView}>
              {Object.keys(africanCountries).map((country) => (
                <TouchableOpacity
                  key={country}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedCountry(country);
                    setStates(africanCountries[country]);
                    setSelectedState('');
                    setShowCountryModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{country}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Modal>

          {selectedCountry && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>State</Text>
              <TouchableOpacity 
                style={styles.input} 
                onPress={() => setShowStateModal(true)}
              >
                <Text style={styles.pickerText}>
                  {selectedState || "Select a state"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Modal
            visible={showStateModal}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.modalView}>
              {states.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedState(state);
                    setShowStateModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{state}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Modal>

          {/* Provider-specific Fields */}
          {role === 'provider' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Service</Text>
                <TouchableOpacity 
                  style={styles.input} 
                  onPress={() => setShowServiceModal(true)}
                >
                  <Text style={styles.pickerText}>
                    {form.service || "Select a service"}
                  </Text>
                </TouchableOpacity>
              </View>

              <Modal
                visible={showServiceModal}
                animationType="slide"
                transparent={true}
              >
                <View style={styles.modalView}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select a Service</Text>
                    <TouchableOpacity onPress={() => setShowServiceModal(false)}>
                      <AntDesign name="close" size={24} color="black" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search services..."
                      placeholderTextColor="#999"
                      value={serviceSearch}
                      onChangeText={setServiceSearch}
                    />
                  </View>
                  <ScrollView style={styles.modalScrollView}>
                    {services
                      .filter(service => 
                        service.toLowerCase().includes(serviceSearch.toLowerCase())
                      )
                      .map((service) => (
                        <TouchableOpacity
                          key={service}
                          style={styles.modalItem}
                          onPress={() => {
                            setForm(prev => ({ ...prev, service }));
                            setShowServiceModal(false);
                            setServiceSearch('');
                          }}
                        >
                          <Text style={styles.modalItemText}>{service}</Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              </Modal>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your price"
                  placeholderTextColor="gray"
                  value={form.price}
                  onChangeText={(text) => setForm(prev => ({ ...prev, price: text }))}
                  keyboardType="numeric"
                />
              </View>
            </>
          )}

          <Button 
            mode="contained"
            onPress={handleSignup}
            loading={loading}
            disabled={loading}
            style={styles.signupButton}
            contentStyle={styles.buttonContent}
          >
            {loading ? 'Creating Account...' : `Sign up as ${role === 'user' ? 'User' : 'Provider'}`}
          </Button>

          <Text style={styles.loginText}>
            Already have an account?{' '}
            <Link href="/(auth)/login" style={styles.loginLink}>
              Log In
            </Link>
          </Text>
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
  title: {
    color: "rgba(0,0,0,0.78)",
    fontSize: 28,
    fontFamily: "Urbanist-Bold",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "Urbanist-Light",
    fontSize: 17,
    color: '#666',
    marginBottom: 10,
  },
  backLink: {
    marginTop: 20,
    marginLeft: 20,
  },
  header: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingVertical: 20,
  },
  logoContainer: {
    marginTop: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  logo: {
    backgroundColor: "white",
    borderRadius: 300,
    resizeMode: "contain",
    marginBottom: 20,
  },
  description: {
    textAlign: 'center',
    fontSize: 18,
    color: "white",
    fontFamily: "Urbanist-Light",
    width: 300,
    lineHeight: 24,
  },
  roleToggle: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.63)",
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginTop: 10,
    borderRadius: 8,
  },
  roleToggleSeparator: {
    width: 1,
    height: 24,
    backgroundColor: 'white',
    marginHorizontal: 10,
  },
  roleToggleText: {
    color: 'white',
    fontFamily: "Urbanist-SemiBold",
    fontSize: 17,
  },
  formContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    padding: 30,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: "Urbanist-Medium",
    fontSize: 16,
    marginBottom: 8,
    marginLeft: 5,
    color: '#333',
  },
  input: {
    backgroundColor: "#D9D9D9",
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    fontFamily: "Urbanist-Medium",
    height: 50,
  },
  pickerText: {
    fontSize: 16,
    fontFamily: "Urbanist-Medium",
    color: '#666',
  },
  modalView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Urbanist-Bold",
  },
  modalScrollView: {
    maxHeight: 400, // Increased height for better visibility
    backgroundColor: 'white',
  },
  modalItem: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalItemText: {
    fontSize: 16,
    fontFamily: "Urbanist-Medium",
    color: '#333',
  },
  signupButton: {
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: "#00456C",
    width: width > 400 ? 320 : 300,
    alignSelf: "center",
    fontFamily: "Urbanist-Medium",
  },
  buttonContent: {
    padding: 10,
    fontFamily: "Urbanist-Medium",
  },
  loginText: {
    textAlign: "center",
    marginTop: 20,
    fontFamily: "Urbanist-Medium",
    fontSize: 15,
    color: '#666',
  },
  loginLink: {
    color: "#F58220",
    fontFamily: "Urbanist-Bold",
  },
  pickerContainer: {
    backgroundColor: "#D9D9D9",
    borderRadius: 20,
    overflow: "hidden",
  },
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 50, // Make space for the eye icon
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    height: 50,
    justifyContent: 'center',
  },
  searchContainer: {
    padding: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    fontFamily: "Urbanist-Medium",
    fontSize: 16,
  },
}); 