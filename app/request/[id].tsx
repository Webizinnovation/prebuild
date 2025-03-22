import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, Dimensions, Alert, Animated, FlatList } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { Ionicons } from '@expo/vector-icons';
import { Provider, ServiceItem } from '../../types/index';
import { MaterialIcons } from '@expo/vector-icons';
import { moderateScale, verticalScale, scale } from 'react-native-size-matters';
import { Checkbox } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { ServiceItem as ServiceItemComponent } from '../../components/ServiceItem';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type ToastPosition = 'top' | 'bottom' | 'center';

interface BookingDetails {
  service: string;
  date: string;
  time: string;
  address: string;
  landmark?: string;
  payment_plan: string;
  amount: number;
  services: ServiceItem[];
  total_price: number;
}

const DEFAULT_SERVICES = [
  { name: 'Barbing', price: 5000 },
  { name: 'Catering', price: 12000 },
  { name: 'HairStylist', price: 10000 },
  { name: 'Weldering', price: 10000 },
  { name: 'Plumber', price: 15000 },
  { name: 'Carpentering', price: 20000 }
];

const toastConfig = {
  success: (props: any) => (
    <View style={{
      width: '90%',
      backgroundColor: '#fff',
      padding: moderateScale(20),
      borderRadius: moderateScale(12),
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
      gap: moderateScale(12),
    }}>
      <MaterialIcons name="check-circle" size={30} color="#22C55E" />
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: scale(18),
          fontFamily: 'Urbanist-Bold',
          color: '#333',
          marginBottom: moderateScale(4),
        }}>
          {props.text1}
        </Text>
        <Text style={{
          fontSize: scale(14),
          fontFamily: 'Urbanist-Regular',
          color: '#666',
        }}>
          {props.text2}
        </Text>
      </View>
    </View>
  ),
};

const createUserNotification = async (userId: string, title: string, message: string, type: string) => {
  try {
    await supabase.rpc('create_user_notification', {
      p_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: type
    });
  } catch (error) {
    console.error('Error creating user notification:', error);
  }
};

export default function RequestScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { profile } = useUserStore();
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<string | null>(null);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return {
      day: date.getDate(),
      weekday: date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase(),
      month: date.toLocaleString('en-US', { month: 'long' }),
      year: date.getFullYear(),
      fullDate: date.toISOString().split('T')[0]
    };
  });
  }, []);

  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '12:00 PM', '12:30 PM', '01:30 PM', '02:00 PM',
    '03:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'
  ];

  const services = [
    'Barbing',
    'Hose Replacement',
    'Shower and Faucets Installation',
    'Drain Unclogging',
    'Kitchen Sink Installation',
    'Water System Installation'
  ];

  useEffect(() => {
    fetchProvider();
  }, [params.id]);

  const fetchProvider = async () => {
    try {
      console.log('Fetching provider with ID:', params.id);

      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select(`
          *,
          users:user_id (
            id,
            name,
            email,
            profile_pic,
            phone
          )
        `)
        .eq('id', params.id) 
        .single();

      if (providerError) {
    
        throw providerError;
      }

      setProvider(providerData);

      let serviceItems: ServiceItem[] = [];
      
      if (providerData?.services?.length > 0 && providerData.pricing) {
        serviceItems = providerData.services.map((service: string) => ({
          name: service,
          price: providerData.pricing[service] || 0,
          selected: false
        }));
      } else {
        serviceItems = DEFAULT_SERVICES.map(service => ({
          ...service,
          selected: false
        }));
      }

      setSelectedServices(serviceItems);

    } catch (error) {
      console.error('Error fetching provider:', error);
    
      setSelectedServices(DEFAULT_SERVICES.map(service => ({
        ...service,
        selected: false
      })));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (step === 1) {
      const selectedServicesList = selectedServices.filter(s => s.selected);
      if (selectedServicesList.length > 0) {
      setStep(2);
      }
    } else if (step === 2) {
      if (!selectedDate || !selectedTime || !address) {
        Toast.show({
          type: 'error',
          text1: 'Missing Information',
          text2: 'Please select date, time and enter address',
          position: 'bottom',
        });
        return;
      }
      setStep(3);
    } else if (step === 3 && selectedPaymentPlan && !isSubmitting) {
      try {
        setIsSubmitting(true);

        const selectedServicesList = selectedServices.filter(s => s.selected);
        
        if (!profile?.id || !params.id || !selectedDate || !selectedTime || !address) {
          throw new Error('Please fill in all required fields');
        }

        const formattedDate = new Date(selectedDate).toISOString().split('T')[0];
        const [time, period] = selectedTime.split(' ');
        const [hours, minutes] = time.split(':');
        let hour = parseInt(hours);
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        const formattedTime = `${hour.toString().padStart(2, '0')}:${minutes}:00`;

        // Prepare service details and agreed amounts
        const serviceDetails = selectedServicesList.map(service => ({
          service_name: service.name,
          details: service.serviceDetails || ''
        }));

        const agreedAmounts = selectedServicesList.map(service => ({
          service_name: service.name,
          amount: service.agreedAmount || service.price
        }));
       
        const bookingData = {
          user_id: profile.id,
          provider_id: params.id,
          service: selectedServicesList.map(s => s.name).join(', '), 
          booking_date: formattedDate,
          booking_time: formattedTime,
          address: address,
          landmark: landmark || '',
          payment_plan: selectedPaymentPlan,
          amount: totalPrice, 
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          service_details: serviceDetails,
          agreed_amounts: agreedAmounts
        };

        console.log('Submitting booking data:', bookingData);

        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .insert([bookingData])
          .select('*')
          .single();

        if (bookingError) {
          console.error('Booking error:', bookingError);
          throw bookingError;
        }

        console.log('Booking created successfully:', booking);

        // Send notification to provider
        try {
          await createUserNotification(
            provider?.user_id!,
            'New Booking Request',
            `You have a new booking request for ${selectedServicesList.map(s => s.name).join(', ')}`,
            'order'
          );
        } catch (notifError) {
          console.error('Failed to send provider notification, but booking was created:', notifError);
          // Continue with the process even if notification fails
        }

        // Also send notification to the user
        try {
          await createUserNotification(
            profile.id,
            'Booking Submitted',
            `Your booking request has been submitted successfully`,
            'order'
          );
        } catch (notifError) {
          console.error('Failed to send user notification, but booking was created:', notifError);
          // Continue with the process even if notification fails
        }

        Toast.show({
          type: 'success',
          text1: 'Booking Successful!',
          text2: 'Your booking has been confirmed. You can view the details in Your Bookings.',
          visibilityTime: 2500,
          topOffset: 0,
          onHide: () => router.push('/services'),
          props: {
            style: {
              width: '90%',
            }
          }
        });

      } catch (error: any) {
        console.error('Booking error:', error);
        Toast.show({
          type: 'error',
          text1: 'Booking Failed',
          text2: error.message || 'Failed to create booking. Please try again.',
          position: 'bottom',
          visibilityTime: 4000
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const calculateTotalPrice = (services: ServiceItem[]) => {
    return services
      .filter(service => service.selected)
      .reduce((total, service) => {
        return total + (service.agreedAmount || service.price);
      }, 0);
  };

  const handleServiceSelect = useCallback((index: number) => {
    setSelectedServices(prev => {
      const newServices = [...prev];
      newServices[index] = {
        ...newServices[index],
        selected: !newServices[index].selected
      };

      setTotalPrice(calculateTotalPrice(newServices));
      return newServices;
    });
  }, []);

  const handleAgreedAmountChange = useCallback((index: number, amount: string) => {
    setSelectedServices(prev => {
      const newServices = [...prev];
      newServices[index] = {
        ...newServices[index],
        agreedAmount: amount ? parseInt(amount) : undefined
      };

      setTotalPrice(calculateTotalPrice(newServices));
      return newServices;
    });
  }, []);

  const handleServiceDetailsChange = useCallback((index: number, details: string) => {
    setSelectedServices(prev => {
      const newServices = [...prev];
      newServices[index] = {
        ...newServices[index],
        serviceDetails: details
      };
      return newServices;
    });
  }, []);

  const renderService = useCallback(({ item, index }: { item: ServiceItem; index: number }) => (
    <ServiceItemComponent
      service={item}
      onSelect={() => handleServiceSelect(index)}
      onAgreedAmountChange={(amount) => handleAgreedAmountChange(index, amount)}
      onServiceDetailsChange={(details) => handleServiceDetailsChange(index, details)}
    />
  ), [handleServiceSelect, handleAgreedAmountChange, handleServiceDetailsChange]);

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.step1Container}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={styles.title}>Select Services</Text>
      
        <View style={styles.servicesListContainer}>
          {selectedServices.map((service, index) => (
            <ServiceItemComponent
              key={service.name}
              service={service}
              onSelect={() => handleServiceSelect(index)}
              onAgreedAmountChange={(amount) => handleAgreedAmountChange(index, amount)}
              onServiceDetailsChange={(details) => handleServiceDetailsChange(index, details)}
            />
          ))}
        </View>

      <View style={styles.totalPriceContainer}>
          <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalPrice}>₦{totalPrice.toLocaleString()}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            selectedServices.filter(s => s.selected).length === 0 && styles.continueButtonDisabled,
            { marginBottom: 32 }
          ]}
          onPress={() => setStep(2)}
          disabled={selectedServices.filter(s => s.selected).length === 0}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.step2Container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Choose your time and place</Text>

        {/* Date Selection */}
        <Text style={styles.sectionTitle}>Select Date</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.dateContainer}
        >
          {dates.map((date) => (
            <TouchableOpacity
              key={date.fullDate}
              style={[
                styles.dateButton,
                selectedDate === date.fullDate && styles.selectedDate
              ]}
              onPress={() => setSelectedDate(date.fullDate)}
            >
              <Text style={[
                styles.dateDay,
                selectedDate === date.fullDate && styles.selectedDateText
              ]}>{date.day}</Text>
              <Text style={[
                styles.dateWeekday,
                selectedDate === date.fullDate && styles.selectedDateText
              ]}>{date.weekday}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Time Selection */}
        <Text style={styles.sectionTitle}>Select Time</Text>
        <View style={styles.timeGrid}>
          {timeSlots.map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.timeButton,
                selectedTime === time && styles.selectedTime
              ]}
              onPress={() => setSelectedTime(time)}
            >
              <Text style={[
                styles.timeText,
                selectedTime === time && styles.selectedTimeText
              ]}>{time}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Address Input */}
        <Text style={styles.sectionTitle}>Address</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your address"
          value={address}
          onChangeText={setAddress}
        />

        <Text style={styles.sectionTitle}>Landmark (Optional)</Text>
        <TextInput
          style={[styles.input, styles.landmarkInput]}
          placeholder="Enter a landmark"
          value={landmark}
          onChangeText={setLandmark}
          multiline
        />

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedDate || !selectedTime || !address) && styles.disabledButton,
            { marginTop: 24, marginBottom: 32 }
          ]}
          onPress={handleSubmit}
          disabled={!selectedDate || !selectedTime || !address}
        >
          <Text style={styles.submitButtonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderPaymentPlans = () => (
    <View style={styles.plansContainer}>
        <TouchableOpacity
          style={[
          styles.planCard,
          selectedPaymentPlan === 'full_upfront' && styles.selectedPlan
        ]}
        onPress={() => setSelectedPaymentPlan('full_upfront')}
      >
        <View style={styles.planHeader}>
          <View style={styles.planIconContainer}>
            <MaterialIcons name="payment" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.planTitle}>Full Payment</Text>
          <Text style={styles.planPrice}>₦{totalPrice}</Text>
        </View>
        <Text style={styles.planDescription}>
          Pay the full amount upfront
        </Text>
        </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.planCard,
          selectedPaymentPlan === 'half' && styles.selectedPlan
        ]}
        onPress={() => setSelectedPaymentPlan('half')}
      >
        <View style={styles.planHeader}>
          <View style={styles.planIconContainer}>
            <MaterialIcons name="payments" size={20} color={Colors.primary} />
      </View>
          <Text style={styles.planTitle}>Half Payment</Text>
          <Text style={styles.planPrice}>₦{totalPrice / 2}</Text>
        </View>
        <Text style={styles.planDescription}>
          Pay 50% now and the rest after service completion
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => {
    const selectedServicesList = selectedServices.filter(s => s.selected);
    
    return (
    <View style={styles.stepContainer}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.step3Container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Confirm Booking</Text>
      
        {/* Provider Info */}
        <View style={styles.providerCard}>
          <Image 
            source={{ uri: provider?.users?.profile_pic || 'https://via.placeholder.com/40' }}
            style={styles.providerImage}
          />
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{provider?.users?.name}</Text>
            <Text style={styles.providerService}>{selectedServicesList.map(s => s.name).join(', ')}</Text>
          </View>
        </View>

        {/* Booking Details */}
        <View style={styles.bookingDetailsCard}>
          <Text style={styles.bookingDetailsTitle}>Booking Details</Text>
          
          {/* Services */}
          <View style={styles.bookingDetailRow}>
            <MaterialIcons name="home-repair-service" size={20} color="#666" />
            <View style={styles.addressContainer}>
              <Text style={styles.bookingDetailText}>
                {selectedServicesList.map(service => (
                  `${service.name} - ₦${(service.agreedAmount || service.price).toLocaleString()}${service.serviceDetails ? `\nDetails: ${service.serviceDetails}` : ''}`
                )).join('\n\n')}
              </Text>
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.bookingDetailRow}>
            <MaterialIcons name="access-time" size={20} color="#666" />
            <Text style={styles.bookingDetailText}>
              {selectedDate} at {selectedTime}
            </Text>
          </View>

          {/* Address */}
          <View style={styles.bookingDetailRow}>
            <MaterialIcons name="location-on" size={20} color="#666" />
            <View style={styles.addressContainer}>
              <Text style={styles.bookingDetailText}>{address}</Text>
              {landmark && (
                <Text style={styles.landmarkText}>Landmark: {landmark}</Text>
              )}
            </View>
          </View>

          {/* Total Price */}
          <View style={styles.bookingDetailRow}>
            <MaterialIcons name="payment" size={20} color="#666" />
            <Text style={[styles.bookingDetailText, styles.totalPrice]}>
              Total: ₦{totalPrice.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Payment Plans */}
        <Text style={styles.sectionTitle}>Select Payment Plan</Text>
        {renderPaymentPlans()}

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedPaymentPlan || isSubmitting) && styles.disabledButton,
            { marginTop: 24, marginBottom: 32 }
          ]}
          onPress={handleSubmit}
          disabled={!selectedPaymentPlan || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Processing...' : 'Confirm Booking'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
    );
  };

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
      setScreenHeight(window.height);
    });

    return () => subscription?.remove();
  }, []);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Stack.Screen 
        options={{
          title: 'Request Service',
          headerShown: true,
        }}
      />

      {/* Progress Steps */}
      <View style={styles.progressContainer}>
        <View style={styles.progressLine}>
          <View style={styles.progressBackground} />
          
          <View style={[
            styles.progressActive,
            { width: `${(step - 1) * 50}%` }
          ]} />
          
          {/* Progress dots */}
          <View style={[styles.progressDot, step >= 1 && styles.activeDot]}>
            <Text style={[styles.progressNumber, step >= 1 && styles.activeNumber]}>1</Text>
          </View>
          <View style={[styles.progressDot, step >= 2 && styles.activeDot]}>
            <Text style={[styles.progressNumber, step >= 2 && styles.activeNumber]}>2</Text>
          </View>
          <View style={[styles.progressDot, step >= 3 && styles.activeDot]}>
            <Text style={[styles.progressNumber, step >= 3 && styles.activeNumber]}>3</Text>
          </View>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: '16@ms',
    paddingBottom: '32@ms', // Add extra padding at bottom for scroll space
  },
  footerz: {
    padding: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
    // Add shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  scrollView: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: '16@ms',
  },
  step1Container: {
    flexGrow: 1,
    paddingBottom: '50@ms',
  },
  servicesListContainer: {
    marginBottom: '24@ms',
  },
  totalPriceContainer: {
    backgroundColor: '#F8FAFC',
    padding: '16@ms',
    borderRadius: '12@ms',
    marginBottom: '24@ms',
  },
  continueButton: {
    backgroundColor: Colors.primary,
    padding: '16@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
    width: '100%',
  },
  progressContainer: {
    paddingVertical: '20@ms',
    paddingHorizontal: '40@ms',
  },
  progressLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  progressBackground: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    height: '2@ms',
    backgroundColor: '#E5E7EB',
    top: '50%',
    transform: [{ translateY: -1 }],
  },
  progressActive: {
    position: 'absolute',
    left: '10%',
    height: '2@ms',
    backgroundColor: Colors.primary,
    top: '50%',
    transform: [{ translateY: -1 }],
    transition: 'width 0.3s ease-in-out',
  },
  progressDot: {
    width: '24@ms',
    height: '24@ms',
    borderRadius: '12@ms',
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: 2,
    borderColor: '#fff',
  },
  activeDot: {
    backgroundColor: Colors.primary,
    borderColor: '#fff',
  },
  progressNumber: {
    color: '#666',
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Bold',
  },
  activeNumber: {
    color: '#fff',
  },
  title: {
    fontSize: screenWidth * 0.045,
    maxFontSize: '20@ms',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '16@ms',
  },
  dateContainer: {
    marginBottom: '24@ms',
  },
  dateButton: {
    width: screenWidth * 0.15,
    minWidth: '60@ms',
    height: screenWidth * 0.2,
    maxHeight: '80@ms',
    borderRadius: '8@ms',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '12@ms',
  },
  selectedDate: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dateDay: {
    fontSize: screenWidth * 0.04,
    maxFontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  dateWeekday: {
    fontSize: screenWidth * 0.03,
    maxFontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  selectedDateText: {
    color: '#fff',
  },
  sectionTitle: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
    marginBottom: '12@ms',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '8@ms',
    marginBottom: '24@ms',
  },
  timeButton: {
    width: '30%',
    paddingHorizontal: '12@ms',
    paddingVertical: '8@ms',
    borderRadius: '20@ms',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedTime: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timeText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  selectedTimeText: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: '8@ms',
    padding: '12@ms',
    marginBottom: '16@ms',
    fontSize: screenWidth * 0.035,
    maxFontSize: '16@ms',
    fontFamily: 'Urbanist-Regular',
    width: '100%',
  },
  landmarkInput: {
    height: screenHeight * 0.12,
    maxHeight: '100@ms',
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    padding: '16@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
    width: '100%',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  subtitle: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginBottom: '24@ms',
  },
  serviceList: {
    paddingBottom: '16@ms',
  },
  totalLabel: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginBottom: '8@ms',
  },
  totalPrice: {
    fontSize: '24@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: '16@ms',
    borderRadius: '12@ms',
    marginBottom: '24@ms',
  },
  providerImage: {
    width: '40@ms',
    height: '40@ms',
    borderRadius: '20@ms',
  },
  providerInfo: {
    marginLeft: '12@ms',
  },
  providerName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  providerService: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  plansContainer: {
    gap: '16@ms',
    marginBottom: '24@ms',
  },
  planCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: '12@ms',
    padding: '16@ms',
    marginBottom: '12@ms',
    width: '100%',
  },
  selectedPlan: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F9FF',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  planIconContainer: {
    width: '32@ms',
    height: '32@ms',
    borderRadius: '16@ms',
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '12@ms',
  },
  planTitle: {
    flex: 1,
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  planPrice: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  planDescription: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    lineHeight: '20@ms',
  },
  bookingDetailsCard: {
    backgroundColor: '#F8FAFC',
    padding: '16@ms',
    borderRadius: '12@ms',
    marginBottom: '24@ms',
  },
  bookingDetailsTitle: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '12@ms',
  },
  bookingDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: '8@ms',
    gap: '12@ms',
  },
  bookingDetailText: {
    flex: 1,
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  addressContainer: {
    flex: 1,
  },
  landmarkText: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: '4@ms',
  },
  buttonContainer: {
    paddingTop: '24@ms',
    paddingHorizontal: '16@ms',
    paddingBottom: '24@ms',
  },
  footer: {
    padding: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
    // Add shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  step2Container: {
    flexGrow: 1,
    paddingBottom: '50@ms', // Extra padding to ensure button is visible
  },
  step3Container: {
    flexGrow: 1,
    paddingBottom: '50@ms', // Extra padding to ensure button is visible
  },
  bottomContainer: {
    padding: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
    // Add shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
}); 