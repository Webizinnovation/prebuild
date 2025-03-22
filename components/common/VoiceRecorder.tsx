import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { ScaledSheet } from 'react-native-size-matters';
import { Colors } from '../../constants/Colors';

interface VoiceRecorderProps {
  onRecordingComplete: (audioUri: string, duration: number) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onRecordingComplete, 
  onCancel 
}) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  
  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordBtnScaleAnim = useRef(new Animated.Value(1)).current;
  const recordingBarHeight = useRef(new Animated.Value(0)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackObj = useRef<Audio.Sound | null>(null);
  
  // Component mount animation
  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, []);
  
  // Start pulse animation
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // Animate recording bars
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingBarHeight, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false
          }),
          Animated.timing(recordingBarHeight, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: false
          })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      
      // Reset recording bars
      Animated.timing(recordingBarHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false
      }).start();
    }
    
    return () => {
      pulseAnim.setValue(1);
      recordingBarHeight.setValue(0);
    };
  }, [isRecording, pulseAnim, recordingBarHeight]);
  
  // Handle duration timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      if (playbackObj.current) {
        playbackObj.current.unloadAsync();
      }
    };
  }, []);

  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(recordBtnScaleAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(recordBtnScaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();
  };

  const startRecording = async () => {
    animateButtonPress();
    
    try {
      // Reset states when starting a new recording
      setRecordedUri(null);
      setPlaybackPosition(0);
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      
      // Check if permission is granted
      if (!permissionResponse?.granted) {
        const { granted } = await requestPermission();
        if (!granted) {
          Alert.alert(
            'Permission Required', 
            'Please grant microphone permission to record audio.'
          );
          return;
        }
      }
      
      // Animate controls out
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start(() => {
        // Once faded out, show recording controls
        setIsRecording(true);
        // Fade recording controls in
        Animated.timing(controlsOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start();
      });
      
      // Configure audio session for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: 1, // Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX (1)
        interruptionModeAndroid: 1, // Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX (1)
      });
      
      // Create and start recording with more compatible settings
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });
      
      setRecording(recording);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    animateButtonPress();
    
    try {
      // Animate out current controls
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start(() => {
        setIsRecording(false);
        // Fade in playback controls
        Animated.timing(controlsOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start();
      });
      
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      
      const uri = recording.getURI();
      
      if (uri) {
        setRecordedUri(uri);
      } else {
        Alert.alert('Error', 'Recording failed to save. Please try again.');
        onCancel();
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
      onCancel();
    }
    
    setRecording(null);
  };

  const cancelRecording = async () => {
    animateButtonPress();
    
    if (recording) {
      try {
        setIsRecording(false);
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch (error) {
        console.error('Failed to cancel recording:', error);
      }
      
      setRecording(null);
    }
    
    // If we're in playback mode, clean up
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error('Failed to unload sound:', error);
      }
    }
    
    setRecordedUri(null);
    setRecordingDuration(0);
    setPlaybackPosition(0);
    onCancel();
  };

  // Load and play the recorded audio for preview
  const loadAndPlayRecording = async () => {
    if (!recordedUri) return;
    
    animateButtonPress();
    
    try {
      // If sound is already loaded
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playFromPositionAsync(playbackPosition);
          setIsPlaying(true);
        }
      } else {
        // Configure audio session for playback
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: 1,
          interruptionModeAndroid: 1,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false
        });
        
        // Load and play the recording
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: recordedUri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        
        setSound(newSound);
        playbackObj.current = newSound;
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Failed to play recording:', error);
      Alert.alert('Error', 'Failed to play the recording. Please try again.');
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis);
      
      // Update playing state
      setIsPlaying(status.isPlaying);
      
      // When playback finishes
      if (status.didJustFinish) {
        setPlaybackPosition(0);
        setIsPlaying(false);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Function to send the recorded voice note
  const sendVoiceNote = () => {
    animateButtonPress();
    
    if (recordedUri) {
      onRecordingComplete(recordedUri, recordingDuration * 1000); // Convert to milliseconds
    }
  };

  // Calculate progress percentage for the playback progress bar
  const calculateProgress = () => {
    if (recordingDuration === 0) return 0;
    return (playbackPosition / (recordingDuration * 1000)) * 100;
  };

  // Render recording visualizer bars
  const renderVisualizer = () => {
    const bars = [];
    const barCount = 7; // Increased bar count for more visual interest
    
    for (let i = 0; i < barCount; i++) {
      // Create a more dynamic wave pattern
      const baseHeight = 0.5 + Math.sin((i / barCount) * Math.PI) * 0.5;
      // Add randomness to heights for more natural appearance
      const randomOffset = isRecording ? Math.random() * 0.4 : 0;
      const heightMultiplier = baseHeight + randomOffset;
      
      // Create color variations for a gradient effect
      const hue = isRecording ? 358 - (i * 5) : 358; // Red spectrum
      
      bars.push(
        <Animated.View 
          key={i}
          style={[
            styles.visualizerBar,
            { 
              height: recordingBarHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [5, 30 * heightMultiplier]
              }),
              backgroundColor: `hsl(${hue}, 100%, ${50 + (i * 3)}%)`,
              marginHorizontal: 3 + (i % 2),
              borderRadius: 3 + (i % 2)
            }
          ]}
        />
      );
    }
    
    return (
      <View style={styles.visualizerContainer}>
        {bars}
      </View>
    );
  };

  // Render recording UI
  const renderRecordingUI = () => (
    <Animated.View style={{ opacity: controlsOpacity }}>
      <View style={styles.recordingInfo}>
        <Animated.View 
          style={[
            styles.recordingIndicator,
            { transform: [{ scale: pulseAnim }] }
          ]}
        />
        <Text style={styles.timerText}>{formatTime(recordingDuration)}</Text>
      </View>
      
      {renderVisualizer()}
      
      <View style={styles.controlsContainer}>
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={cancelRecording}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Animated.View style={{ transform: [{ scale: recordBtnScaleAnim }] }}>
          <TouchableOpacity 
            style={[styles.recordButton, styles.stopButton]}
            onPress={stopRecording}
          >
            <Ionicons name="stop" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );

  // Render playback UI (after recording is done)
  const renderPlaybackUI = () => {
    // Calculate the progress width as a percentage
    const progressPercentage = calculateProgress();
    
    return (
      <Animated.View style={{ opacity: controlsOpacity }}>
        <View style={styles.recordingInfo}>
          <Ionicons name="musical-note" size={18} color="#FF3B30" style={styles.previewIcon} />
          <Text style={styles.previewText}>Voice Note Preview</Text>
        </View>
        
        <View style={styles.playbackContainer}>
          <Animated.View style={{ transform: [{ scale: recordBtnScaleAnim }] }}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={loadAndPlayRecording}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={22} 
                color="#fff" 
              />
            </TouchableOpacity>
          </Animated.View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBar, 
                  { width: `${progressPercentage}%` }
                ]} 
              />
            </View>
            <View style={styles.durationRow}>
              <Text style={styles.durationText}>
                {formatTime(Math.floor(playbackPosition / 1000))} / {formatTime(recordingDuration)}
              </Text>
              {isPlaying && (
                <View style={styles.liveIndicator}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={cancelRecording}
          >
            <Ionicons name="trash-outline" size={22} color="#fff" />
            <Text style={styles.buttonLabel}>Delete</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.reRecordButton}
            onPress={startRecording}
          >
            <Ionicons name="refresh-outline" size={22} color="#fff" />
            <Text style={styles.buttonLabel}>Re-record</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.sendButton}
            onPress={sendVoiceNote}
          >
            <Ionicons name="send" size={22} color="#fff" />
            <Text style={styles.buttonLabel}>Send</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  // Render initial UI (before recording)
  const renderInitialUI = () => (
    <Animated.View style={{ opacity: controlsOpacity }}>
      <View style={styles.recordingInfo}>
        <Text style={styles.instructionText}>
          Tap the microphone to start recording
        </Text>
      </View>
      
      <View style={styles.controlsContainer}>
        <Animated.View style={{ transform: [{ scale: recordBtnScaleAnim }] }}>
          <TouchableOpacity 
            style={[styles.recordButton, styles.startButton]}
            onPress={startRecording}
          >
            <Ionicons name="mic" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );

  return (
    <Animated.View style={[
      styles.container, 
      { opacity: fadeIn }
    ]}>
      {isRecording 
        ? renderRecordingUI() 
        : recordedUri 
          ? renderPlaybackUI() 
          : renderInitialUI()
      }
    </Animated.View>
  );
};

const styles = ScaledSheet.create({
  container: {
    width: '100%',
    padding: '16@ms',
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#eaeaea',
    borderTopLeftRadius: '16@ms',
    borderTopRightRadius: '16@ms',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16@ms',
    height: '28@ms',
  },
  recordingIndicator: {
    width: '12@ms',
    height: '12@ms',
    borderRadius: '6@ms',
    backgroundColor: '#FF3B30',
    marginRight: '8@ms',
  },
  timerText: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
  },
  instructionText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  previewText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
  },
  previewIcon: {
    marginRight: '8@ms',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '8@ms',
  },
  playbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '16@ms',
    paddingHorizontal: '8@ms',
  },
  progressContainer: {
    flex: 1,
    marginLeft: '12@ms',
  },
  progressBarBackground: {
    height: '4@ms',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: '2@ms',
    overflow: 'hidden',
    marginBottom: '4@ms',
  },
  progressBar: {
    height: '4@ms',
    backgroundColor: Colors.primary,
    borderRadius: '2@ms',
  },
  durationText: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveIndicator: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: '6@ms',
    paddingVertical: '2@ms',
    borderRadius: '4@ms',
  },
  liveText: {
    color: 'white',
    fontSize: '10@ms',
    fontFamily: 'Urbanist-Bold',
  },
  buttonLabel: {
    fontSize: '10@ms',
    marginTop: '4@ms',
    fontFamily: 'Urbanist-Medium',
    color: 'white',
  },
  playButton: {
    width: '44@ms',
    height: '44@ms',
    borderRadius: '22@ms',
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  recordButton: {
    width: '64@ms',
    height: '64@ms',
    borderRadius: '32@ms',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  startButton: {
    backgroundColor: Colors.primary,
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  cancelButton: {
    width: '60@ms',
    height: '60@ms',
    borderRadius: '16@ms',
    backgroundColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: '8@ms',
  },
  reRecordButton: {
    width: '60@ms',
    height: '60@ms',
    borderRadius: '16@ms',
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sendButton: {
    width: '60@ms',
    height: '60@ms',
    borderRadius: '16@ms',
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  visualizerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: '35@ms',
    marginBottom: '16@ms',
    backgroundColor: 'rgba(248, 248, 248, 0.9)',
    borderRadius: '10@ms',
    paddingVertical: '8@ms',
  },
  visualizerBar: {
    width: '4@ms',
    backgroundColor: '#FF3B30',
    marginHorizontal: '3@ms',
    borderRadius: '2@ms',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
}); 