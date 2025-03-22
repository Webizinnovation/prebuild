import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, StyleSheet, Modal, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { supabase } from '../../services/supabase';
import SearchBar from '../SearchBar';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../store/useUserStore';
import { router } from 'expo-router';
import { sendBookingStatusNotification } from '../../utils/notifications';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

type TabType = 'New' | 'InProgress' | 'Completed' | 'Cancelled';

type Request = {
  id: string;
  service: string;
  service_date: string;
  service_time: string;
  address: string;
  landmark?: string;
  amount: number;
  status: string;
  provider_accepted: boolean;
  user_id: string;
  user_details?: {
    id: string;
    name: string;
    profile_pic: string | null;
  };
  bookingId: string;
};

type ReportType = 'provider_report' | 'user_report';

export default function ProviderServices() {
  const [activeTab, setActiveTab] = useState<TabType>('New');
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { profile } = useUserStore();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const fetchRequests = async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id, user_id')
        .eq('user_id', profile?.id)
        .single();

      if (providerError) throw providerError;

      const statusMap = {
        'New': ['pending'],
        'InProgress': ['accepted'],
        'Completed': ['completed'],
        'Cancelled': ['cancelled']
      };

      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          service,
          booking_date,
          booking_time,
          address,
          landmark,
          amount,
          status,
          user_id,
          provider_id
        `)
        .eq('provider_id', providerData.id)
        .in('status', statusMap[activeTab]);

      if (bookingsError) throw bookingsError;

      if (!bookings?.length) {
        setRequests([]);
        return;
      }

      const userIds = bookings.map(booking => booking.user_id);
      const { data: userDetails, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          profile_pic
        `)
        .in('id', userIds);

      if (userError) throw userError;

      const transformedData = bookings.map(booking => {
        const userDetail = userDetails?.find(user => user.id === booking.user_id);
        return {
          id: booking.id,
          bookingId: `PL${booking.id.slice(0, 4).toUpperCase()}`,
          service: booking.service,
          service_date: booking.booking_date,
          service_time: booking.booking_time,
          address: booking.address,
          landmark: booking.landmark,
          amount: booking.amount,
          status: booking.status,
          provider_accepted: booking.status === 'accepted',
          user_id: booking.user_id,
          user_details: {
            id: userDetail?.id || booking.user_id,
            name: userDetail?.name || 'Unknown User',
            profile_pic: userDetail?.profile_pic || null
          }
        };
      });

      setRequests(transformedData);
    } catch (error: any) {
      console.error('Error in fetchRequests:', error);
      Alert.alert('Error', 'Failed to load requests');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const refreshInterval = setInterval(() => {
      fetchRequests(false); 
    }, 30000); 

    return () => clearInterval(refreshInterval);
  }, [activeTab]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchRequests(false);
  }, [activeTab]);

  const handleMarkAsDone = async (bookingId: string) => {
    try {
      Alert.alert(
        "Mark as Done",
        "Are you sure you want to mark this booking as completed?. This means the user has made all payments.",
        [
          {
            text: "No",
            style: "cancel"
          },
          {
            text: "Yes",
            style: "default",
            onPress: async () => {
              const request = requests.find(req => req.id === bookingId);
              
              const { error } = await supabase
                .from('bookings')
                .update({
                  status: 'completed',
                  updated_at: new Date().toISOString()
                })
                .eq('id', bookingId);

              if (error) throw error;

              if (request?.user_id) {
                try {
                  await sendBookingStatusNotification(
                    request.user_id,
                    bookingId,
                    'completed',
                    request.service
                  );
                } catch (notifError) {
                  console.error('Failed to send notification, but booking was marked as completed:', notifError);
                }
              }

              fetchRequests();
              Alert.alert('Success', 'Booking marked as completed');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error marking as done:', error);
      Alert.alert('Error', 'Failed to update booking status');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      Alert.alert(
        "Cancel Booking",
        "Are you sure you want to cancel this booking?",
        [
          {
            text: "No",
            style: "cancel"
          },
          {
            text: "Yes, Cancel",
            style: "destructive",
            onPress: async () => {
              const request = requests.find(req => req.id === bookingId);
              
              const { error } = await supabase
                .from('bookings')
                .update({
                  status: 'cancelled',
                  updated_at: new Date().toISOString()
                })
                .eq('id', bookingId);

              if (error) throw error;
              
              if (request?.user_id) {
                try {
                  await sendBookingStatusNotification(
                    request.user_id,
                    bookingId,
                    'cancelled',
                    request.service
                  );
                } catch (notifError) {
                  console.error('Failed to send notification, but booking was cancelled:', notifError);
                  // Continue with the process even if notification fails
                }
              }

              fetchRequests();
              Alert.alert('Success', 'Booking has been cancelled');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error cancelling booking:', error);
      Alert.alert('Error', 'Failed to cancel booking');
    }
  };

  const handleReport = async (userId: string, bookingId: string) => {
    setSelectedUserId(userId);
    setSelectedBookingId(bookingId);
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!reportReason.trim() || !reportDescription.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all fields',
        position: 'top'
      });
      return;
    }

    setIsSubmittingReport(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert([{ 
          reporter_id: profile?.id,
          reported_id: selectedUserId,
          booking_id: selectedBookingId,
          report_type: 'provider_report',
          reason: reportReason,
          description: reportDescription,
          status: 'pending'
        }]);

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Report submitted successfully',
        position: 'top'
      });
      
      setShowReportModal(false);
      setReportReason('');
      setReportDescription('');
      setSelectedUserId(null);
      setSelectedBookingId(null);
    } catch (error) {
      console.error('Error submitting report:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit report. Please try again.',
        position: 'top'
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    
    const query = searchQuery.toLowerCase().trim();
    return requests.filter(request => 
      request.service.toLowerCase().includes(query) ||
      request.user_details?.name.toLowerCase().includes(query) ||
      request.address.toLowerCase().includes(query)
    );
  }, [requests, searchQuery]);

  const renderNewRequest = (request: Request) => (
    <View key={request.id} style={styles.newRequestCard}>
      <View style={styles.userNameContainer}>
        <Text style={styles.userNamez}>{request.user_details?.name}</Text>
        <Text style={styles.amountz}>NGN {request.amount.toLocaleString()}</Text>
      </View>
      
      <Text style={styles.serviceDate}>
        Service Date: {request.service_date} {request.service_time}
      </Text>
      <Text style={styles.address}>Address: {request.address}</Text>

      <View style={styles.bottomRow}>
        <View style={styles.activitiesContainer}>
          {request.service.split(', ').slice(0, 1).map((service, index) => (
            <View key={index} style={styles.activityTag}>
              <Text style={styles.activityText}>
                {service}
                {request.service.split(', ').length > 1 && 
                  ` +${request.service.split(', ').length - 1}`}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.viewDetailsButton}
          onPress={() => router.push(`/provider/details/${request.id}`)}
        >
          <Text style={styles.viewDetailsText}>View details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCompletedRequest = (request: Request) => (
    <View key={request.id} style={styles.completedCard}>
      <View style={styles.completedHeader}>
        <Text style={styles.completedUserName}>{request.user_details?.name}</Text>
        <View style={styles.bookingIdBadge}>
          <Text style={styles.bookingIdText}>{request.bookingId}</Text>
        </View>
      </View>

      <Text style={styles.completedServiceDate}>
        Service Date: {request.service_date} {request.service_time}
      </Text>
      <Text style={styles.completedAddress}>{request.address}</Text>

      <View style={styles.completedActions}>
        <TouchableOpacity style={styles.queryPaymentButton}>
          <Text style={styles.queryPaymentText}>Query payment</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.viewOrderButton}
          onPress={() => router.push(`/provider/details/${request.id}`)}
        >
          <Text style={styles.viewOrderText}>View order details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by service or customer name..."
      />
      <View style={styles.tabsContainer}>
        {(['New', 'InProgress', 'Completed', 'Cancelled'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => {
              setActiveTab(tab);
              setRequests([]); 
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        style={styles.requestsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0066CC']}
            tintColor="#0066CC"
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066CC" />
          </View>
        ) : (
          <>
            {activeTab === 'New' && (
              filteredRequests.length > 0 ? (
                filteredRequests.map(request => renderNewRequest(request))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No New Requests</Text>
                  <Text style={styles.emptyStateText}>
                    New booking requests will appear here
                  </Text>
                </View>
              )
            )}
            
            {activeTab === 'InProgress' && (
              filteredRequests.length > 0 ? (
                filteredRequests.map((request) => (
                  <View key={request.id} style={styles.inProgressCard}>
                    <View style={styles.locationContainer}>
                      <Text style={styles.locationLabel}>Location: [Office]</Text>
                      <View style={styles.bookingIdContainer}>
                        <Text style={styles.bookingId}>{request.bookingId}</Text>
                      </View>
                    </View>

                    <Text style={styles.locationAddress}>
                      {request.address}
                    </Text>
                    
                    {request.landmark ? (
                      <TouchableOpacity style={styles.locateButton}>
                        <Text style={styles.locateText}>{request.landmark}</Text>
                      </TouchableOpacity>
                    ) : null}

                    <View style={styles.divider} />

                    <Text style={styles.customerName}>{request.user_details?.name}</Text>
                    
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailLabel}>Start Date:</Text>
                      <Text style={styles.detailValue}>{request.service_date}</Text>
                    </View>

                    <View style={styles.detailsRow}>
                      <Text style={styles.detailLabel}>Service Fee:</Text>
                      <Text style={styles.detailValue}>NGN {request.amount.toLocaleString()}</Text>
                    </View>

                    <TouchableOpacity style={styles.initiatePaymentButton}>
                      <Text style={styles.initiatePaymentText}>Initiate payment</Text>
                    </TouchableOpacity>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity 
                        style={styles.markAsDoneButton}
                        onPress={() => handleMarkAsDone(request.id)}
                      >
                        <Text style={styles.buttonText}>Mark as done</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.cancelReportButton}
                        onPress={() => handleCancelBooking(request.id)}
                      >
                        <Text style={styles.buttonText}>Cancel/Report</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No InProgress Requests</Text>
                  <Text style={styles.emptyStateText}>
                    No in-progress requests found
                  </Text>
                </View>
              )
            )}

            {activeTab === 'Completed' && (
              filteredRequests.length > 0 ? (
                filteredRequests.map(request => renderCompletedRequest(request))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No Completed Requests</Text>
                  <Text style={styles.emptyStateText}>
                    Completed requests will appear here
                  </Text>
                </View>
              )
            )}

            {activeTab === 'Cancelled' && (
              filteredRequests.length > 0 ? (
                filteredRequests.map((request) => (
                  <View key={request.id} style={styles.cancelledCard}>
                    <View style={styles.cancelledHeader}>
                      <View style={styles.userInfoContainer}>
                        <Image 
                          source={request.user_details?.profile_pic ? { uri: request.user_details.profile_pic } : require('../../assets/images/logo.png')} 
                          style={styles.userProfilePic} 
                        />
                        <Text style={styles.cancelledName}>{request.user_details?.name}</Text>
                      </View>
                      <View style={styles.bookingIdBadge}>
                        <Text style={styles.bookingIdText}>{request.bookingId}</Text>
                      </View>
                    </View>
                    <View style={styles.serviceDetails}>
                      <Text style={styles.serviceDate}>Service Date: {request.service_date} {request.service_time}</Text>
                      <Text style={styles.serviceLocation}>{request.address}</Text>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity 
                        style={styles.reportLink}
                        onPress={() => handleReport(request.user_id, request.id)}
                      >
                        <Text style={styles.reportLinkText}>Report this user</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.viewBookingsButton}
                        onPress={() => router.push(`/provider/details/${request.id}`)}
                      >
                        <Text style={styles.viewBookingsText}>View Bookings</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No Cancelled Requests</Text>
                  <Text style={styles.emptyStateText}>
                    Cancelled requests will appear here
                  </Text>
                </View>
              )
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModalContent}>
            <View style={styles.reportModalHeader}>
              <Text style={styles.reportModalTitle}>Report User</Text>
              <TouchableOpacity 
                onPress={() => setShowReportModal(false)}
                style={styles.closeButton}
                disabled={isSubmittingReport}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.reportForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Reason for Report</Text>
                <TextInput
                  style={styles.reasonInput}
                  value={reportReason}
                  onChangeText={setReportReason}
                  placeholder="Enter reason for report"
                  placeholderTextColor="#666"
                  editable={!isSubmittingReport}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.descriptionInput}
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  placeholder="Provide more details about the issue"
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!isSubmittingReport}
                />
              </View>

              <TouchableOpacity 
                style={[styles.submitReportButton, isSubmittingReport && styles.submitReportButtonDisabled]}
                onPress={submitReport}
                disabled={isSubmittingReport}
              >
                {isSubmittingReport ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitReportButtonText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: '30@ms',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: '16@ms',
    paddingVertical: '12@ms',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: '8@ms',
    paddingHorizontal: '14@ms',
    borderRadius: '20@ms',
  },
  activeTab: {
    backgroundColor: '#222',
  },
  tabText: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  requestsList: {
    flex: 1,
    paddingHorizontal: '16@ms',
    paddingTop: '8@ms',
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: '12@ms',
    padding: '16@ms',
    marginBottom: '16@ms',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '12@ms',
  },
  userImage: {
    width: '40@ms',
    height: '40@ms',
    borderRadius: '20@ms',
    marginRight: '12@ms',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '4@ms',
  },
  serviceInfo: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.primary,
    marginBottom: '4@ms',
  },
  serviceDate: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginBottom: '4@ms',
  },
  address: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginBottom: '12@ms',
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '12@ms',
  },
  amount: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: '32@ms',
  },
  emptyStateTitle: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#222',
    marginBottom: '8@ms',
  },
  emptyStateText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    textAlign: 'center',
  },
  newRequestCard: {
    backgroundColor: '#fff',
    borderRadius: '16@ms',
    padding: '16@ms',
    marginBottom: '12@ms',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  userNameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12@ms',
  },
  userNamez: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#000',
  },
  amountz: {
    fontSize: '15@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#FF9500',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8@s',
  },
  activitiesContainer: {
    flex: 1,
    marginRight: '8@s',
  },
  activityTag: {
    backgroundColor: '#E5F3FF',
    paddingHorizontal: '8@s',
    paddingVertical: '4@s',
    borderRadius: '4@s',
    alignSelf: 'flex-start',
  },
  activityText: {
    fontSize: '12@s',
    fontFamily: 'Urbanist-Medium',
    color: '#0066CC',
  },
  viewDetailsButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: '12@s',
    paddingVertical: '6@s',
    borderRadius: '4@s',
  },
  viewDetailsText: {
    fontSize: '12@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#fff',
  },
  inProgressCard: {
    backgroundColor: '#fff',
    borderRadius: '16@ms',
    padding: '16@ms',
    marginBottom: '12@ms',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  locationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  locationLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  bookingIdContainer: {
    backgroundColor: '#E5F3FF',
    paddingHorizontal: '12@ms',
    paddingVertical: '4@ms',
    borderRadius: '16@ms',
  },
  bookingId: {
    fontSize: '13@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#0066CC',
  },
  locationAddress: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#222',
    marginBottom: '8@ms',
  },
  locateButton: {
    alignSelf: 'flex-start',
  },
  locateText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#0066CC',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: '16@ms',
  },
  customerName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#222',
    marginBottom: '16@ms',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  detailLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  detailValue: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#222',
  },
  initiatePaymentButton: {
    alignSelf: 'flex-start',
    marginVertical: '12@ms',
  },
  initiatePaymentText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#0066CC',
    textDecorationLine: 'underline',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: '16@ms',
    gap: '8@ms',
  },
  markAsDoneButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  cancelReportButton: {
    flex: 1,
    backgroundColor: '#FF4B55',
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
  },
  cancelledCard: {
    backgroundColor: '#fff',
    borderRadius: '12@ms',
    padding: '16@ms',
    marginBottom: '12@ms',
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  cancelledHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12@ms',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12@ms',
  },
  userProfilePic: {
    width: '40@ms',
    height: '40@ms',
    borderRadius: '20@ms',
  },
  cancelledName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  serviceDetails: {
    marginBottom: '12@ms',
  },
  serviceLocation: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
  },
  bookingIdWrapper: {
    marginBottom: '12@ms',
  },
  bookingIdBadge: {
    backgroundColor: '#E5F3FF',
    paddingHorizontal: '12@ms',
    paddingVertical: '4@ms',
    borderRadius: '16@ms',
  },
  bookingIdText: {
    fontSize: '13@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#0066CC',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8@ms',
  },
  reportLink: {
    alignSelf: 'flex-start',
  },
  reportLinkText: {
    fontSize: '14@ms',
    color: '#FF4B55',
    textDecorationLine: 'underline',
    fontFamily: 'Urbanist-Medium',
  },
  viewBookingsButton: {
    alignSelf: 'flex-start',
  },
  viewBookingsText: {
    fontSize: '14@ms',
    color: '#0066CC',
    textDecorationLine: 'underline',
    fontFamily: 'Urbanist-Medium',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: '16@ms',
  },
  reportModalContent: {
    backgroundColor: '#fff',
    borderRadius: '16@ms',
    padding: '20@ms',
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20@ms',
  },
  reportModalTitle: {
    fontSize: '20@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  closeButton: {
    padding: '4@ms',
  },
  reportForm: {
    gap: '16@ms',
  },
  inputContainer: {
    gap: '8@ms',
  },
  inputLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: '8@ms',
    paddingHorizontal: '12@ms',
    paddingVertical: '10@ms',
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#000',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: '8@ms',
    paddingHorizontal: '12@ms',
    paddingVertical: '10@ms',
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#000',
    height: '100@ms',
  },
  submitReportButton: {
    backgroundColor: '#FF4B55',
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
    marginTop: '8@ms',
  },
  submitReportButtonDisabled: {
    opacity: 0.7,
  },
  submitReportButtonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: '32@ms',
  },
  completedCard: {
    backgroundColor: '#fff',
    borderRadius: '12@ms',
    padding: '16@ms',
    marginBottom: '12@ms',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  completedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12@ms',
  },
  completedUserName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#000',
  },
  completedServiceDate: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginBottom: '4@ms',
  },
  completedAddress: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginBottom: '16@ms',
  },
  completedActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queryPaymentButton: {
    alignSelf: 'flex-start',
  },
  queryPaymentText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#FF4B55',
    textDecorationLine: 'underline',
  },
  viewOrderButton: {
    alignSelf: 'flex-start',
  },
  viewOrderText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#0066CC',
    textDecorationLine: 'underline',
  },
}); 