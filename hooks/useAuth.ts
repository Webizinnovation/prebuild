import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Session } from '@supabase/supabase-js';
import { useUserStore } from '../store/useUserStore';
import { router } from 'expo-router';

interface User {
  id: string;
  role: 'user' | 'provider';
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setProfile, profile } = useUserStore();
  const [redirectInProgress, setRedirectInProgress] = useState(false);

  useEffect(() => {
    console.log('useAuth: Starting authentication check...');
    let isActive = true; // For avoiding state updates after unmount
    
    // Fetch user profile based on session
    const fetchUserProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
          
        if (error) {
          console.error('Profile error:', error);
          return null;
        }
        
        console.log('Profile found:', data ? 'Yes' : 'No');
        return data;
      } catch (error) {
        console.error('Profile fetch error:', error);
        return null;
      }
    };

    // Handle auth state changes - both initial and subsequent
    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      console.log('Auth state changed:', event);
      
      if (!isActive) return;
      
      if (event === 'SIGNED_OUT') {
        // Explicit sign-out - redirect to login screen
        if (!redirectInProgress) {
          setRedirectInProgress(true);
          
          // Clear auth state
          setSession(null);
          setProfile(null);
          
          // Navigate to login screen for explicit sign-out
          console.log('Redirecting to login screen after sign-out');
          router.replace('/(auth)/login');
          
          // Reset redirect flag after a delay (for safety)
          setTimeout(() => {
            if (isActive) setRedirectInProgress(false);
          }, 1000);
        }
      } else if (!currentSession) {
        // No session (first visit or expired) - redirect to Welcome
        if (!redirectInProgress) {
          setRedirectInProgress(true);
          
          // Clear auth state
          setSession(null);
          setProfile(null);
          
          // Navigate to Welcome screen for no session
          console.log('Redirecting to Welcome screen for no session');
          router.replace('/onboarding/Welcome');
          
          // Reset redirect flag after a delay (for safety)
          setTimeout(() => {
            if (isActive) setRedirectInProgress(false);
          }, 1000);
        }
      } else if (currentSession?.user) {
        setSession(currentSession);
        
        // Only fetch profile if we don't already have it or the user ID changed
        if (!profile || profile.id !== currentSession.user.id) {
          const userProfile = await fetchUserProfile(currentSession.user.id);
          if (isActive) setProfile(userProfile);
        }
      }
      
      if (isActive) setIsLoading(false);
    };

    // Initial session check
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          if (isActive) {
            setIsLoading(false);
            setSession(null);
            setProfile(null);
            
            // Navigate to Welcome screen on error
            console.log('Redirecting to Welcome screen due to session error');
            router.replace('/onboarding/Welcome');
          }
          return;
        }
        
        // Use the same handler for initial session check
        await handleAuthChange(session ? 'INITIAL' : 'SIGNED_OUT', session);
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isActive) {
          setIsLoading(false);
          setSession(null);
          setProfile(null);
          
          // Navigate to Welcome screen on error
          console.log('Redirecting to Welcome screen due to initialization error');
          router.replace('/onboarding/Welcome');
        }
      }
    };

    // Start the auth initialization process
    initializeAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Cleanup function
    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    isLoading,
    user: session?.user as User | null
  };
} 