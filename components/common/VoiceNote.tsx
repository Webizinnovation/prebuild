import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, Animated, Easing } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { ScaledSheet } from 'react-native-size-matters';

interface VoiceNoteProps {
  isOwnMessage: boolean;
  audioUri: string;
  duration?: number;
}

export const VoiceNote: React.FC<VoiceNoteProps> = ({ isOwnMessage, audioUri, duration = 0 }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [loadError, setLoadError] = useState<string | null>(null);
  const playbackObj = useRef<Audio.Sound | null>(null);
  
  // Animation refs
  const progressAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const progressOpacityAnim = useRef(new Animated.Value(0.6)).current;
  
  useEffect(() => {
    // Initialize audio
    return () => {
      // Clean up sound on unmount
      if (playbackObj.current) {
        playbackObj.current.unloadAsync();
      }
    };
  }, []);

  // Animate progress bar based on playback position
  useEffect(() => {
    if (totalDuration > 0) {
      const progressPercentage = (playbackPosition / totalDuration);
      Animated.timing(progressAnim, {
        toValue: progressPercentage,
        duration: 100,
        useNativeDriver: false,
        easing: Easing.linear
      }).start();
      
      // Pulse the progress opacity when playing
      if (isPlaying) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(progressOpacityAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: false
            }),
            Animated.timing(progressOpacityAnim, {
              toValue: 0.6,
              duration: 800,
              useNativeDriver: false
            })
          ])
        ).start();
      } else {
        // Reset to default opacity when paused
        Animated.timing(progressOpacityAnim, {
          toValue: 0.6,
          duration: 300,
          useNativeDriver: false
        }).start();
      }
    }
  }, [playbackPosition, totalDuration, isPlaying]);

  const loadSound = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      
      // Unload any existing sound
      if (playbackObj.current) {
        await playbackObj.current.unloadAsync();
      }
      
      // Configure audio session
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });
      
      // Load the audio file
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      playbackObj.current = sound;
      setSound(sound);
    } catch (error) {
      console.error('Error loading sound:', error);
      setLoadError('Unable to load audio. Try again later.');
      Alert.alert('Playback Error', 'Unable to play this voice note. The file might be corrupted or unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis);
      if (status.durationMillis && totalDuration === 0) {
        setTotalDuration(status.durationMillis);
      }
      
      // Update playing state
      setIsPlaying(status.isPlaying);
      
      // When playback finishes
      if (status.didJustFinish) {
        setPlaybackPosition(0);
        setIsPlaying(false);
      }
    } else if (status.error) {
      console.error('Playback error:', status.error);
      setLoadError(`Playback error: ${status.error}`);
    }
  };

  const handlePlayPause = async () => {
    // Animate button press
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();
    
    if (loadError) {
      // Try loading again if there was an error
      setLoadError(null);
      await loadSound();
      return;
    }
    
    if (!sound) {
      await loadSound();
      if (playbackObj.current && !loadError) {
        try {
          await playbackObj.current.playAsync();
        } catch (error) {
          console.error('Error playing sound:', error);
          setLoadError('Playback failed. Try again later.');
        }
      }
    } else {
      try {
        if (isPlaying) {
          await sound.pauseAsync();
        } else {
          if (playbackPosition >= totalDuration) {
            await sound.setPositionAsync(0);
          }
          await sound.playAsync();
        }
      } catch (error) {
        console.error('Error controlling playback:', error);
        setLoadError('Playback control failed. Try again later.');
        
        // Try to recover by reloading
        if (playbackObj.current) {
          await playbackObj.current.unloadAsync();
          setSound(null);
        }
      }
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Calculate the width for the progress bar
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <View style={[
      styles.voiceNoteContainer,
      isOwnMessage ? styles.ownMessageVoiceNote : styles.receivedMessageVoiceNote
    ]}>
      <Animated.View style={[
        styles.playButtonContainer,
        { transform: [{ scale: buttonScaleAnim }] }
      ]}>
        <TouchableOpacity
          style={[
            styles.playButton,
            isOwnMessage ? styles.ownPlayButton : styles.receivedPlayButton
          ]}
          onPress={handlePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={isOwnMessage ? "#fff" : "#3c86f5"} />
          ) : loadError ? (
            <Ionicons
              name="alert-circle"
              size={22}
              color={isOwnMessage ? "#fff" : "#3c86f5"}
            />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color={isOwnMessage ? "#fff" : "#3c86f5"}
            />
          )}
        </TouchableOpacity>
      </Animated.View>
      
      <View style={styles.progressContainer}>
        <View style={[
          styles.progressBarBackground,
          isOwnMessage ? styles.ownProgressBarBackground : styles.receivedProgressBarBackground
        ]}>
          <Animated.View 
            style={[
              styles.progressBar, 
              { width: progressWidth, opacity: progressOpacityAnim },
              isOwnMessage ? styles.ownProgressBar : styles.receivedProgressBar,
              loadError ? styles.errorProgressBar : null,
              isPlaying && styles.playingProgressBar
            ]} 
          />
        </View>
        <View style={styles.timeContainer}>
          <Text style={[
            styles.durationText,
            isOwnMessage ? styles.ownDurationText : styles.receivedDurationText,
            loadError ? styles.errorText : null
          ]}>
            {loadError ? 'Tap to retry' : formatTime(playbackPosition > 0 ? playbackPosition : totalDuration)}
          </Text>
          {isPlaying && (
            <Animated.View style={[styles.liveIndicator, isOwnMessage ? styles.ownLiveIndicator : styles.receivedLiveIndicator]} />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = ScaledSheet.create({
  errorProgressBar: {
    backgroundColor: '#ff6b6b',
  },
  errorText: {
    color: '#ff6b6b',
  },
  voiceNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: '10@ms',
    width: '220@ms',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ownMessageVoiceNote: {
    backgroundColor: 'rgb(71, 84, 145)', 
    borderRadius: '16@ms',
    borderTopRightRadius: '4@ms',
    marginRight: '8@ms', // Add margin for the tail effect
  },
  receivedMessageVoiceNote: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: '16@ms',
    borderTopLeftRadius: '4@ms',
    marginLeft: '8@ms', // Add margin for the tail effect
  },
  playButtonContainer: {
    marginRight: '10@ms',
  },
  playButton: {
    width: '36@ms',
    height: '36@ms',
    borderRadius: '18@ms',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownPlayButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  receivedPlayButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  progressContainer: {
    flex: 1,
  },
  progressBarBackground: {
    height: '4@ms',
    borderRadius: '2@ms',
    overflow: 'hidden',
    marginBottom: '6@ms',
  },
  ownProgressBarBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  receivedProgressBarBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  progressBar: {
    height: '4@ms',
    borderRadius: '2@ms',
  },
  playingProgressBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  ownProgressBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  receivedProgressBar: {
    backgroundColor: '#3c86f5',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationText: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Medium',
  },
  ownDurationText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  receivedDurationText: {
    color: 'rgba(0, 0, 0, 0.7)',
  },
  liveIndicator: {
    width: '6@ms',
    height: '6@ms',
    borderRadius: '3@ms',
    marginLeft: '6@ms',
  },
  ownLiveIndicator: {
    backgroundColor: '#FF3B30',
  },
  receivedLiveIndicator: {
    backgroundColor: '#FF3B30',
  },
}); 