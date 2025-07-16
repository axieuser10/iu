import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useConversation } from '@elevenlabs/react';
import { Mic, MicOff, Phone, PhoneOff, Shield } from 'lucide-react';
import TermsPopup from '../components/TermsPopup';
import VoiceOrb from '../components/VoiceOrb';
import StatusIndicators from '../components/StatusIndicators';
import PermissionWarning from '../components/PermissionWarning';

// Constants for better performance
const CONNECTION_TIMEOUT = 8000;
const RETRY_ATTEMPTS = 3;

const HomePage: React.FC = () => {
  // State management with proper typing
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isSecureConnection, setIsSecureConnection] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);

  // Check terms acceptance on mount
  useEffect(() => {
    const checkTermsAcceptance = () => {
      try {
        const storedConsent = localStorage.getItem('axie_studio_terms_consent');
        if (storedConsent) {
          const consentData = JSON.parse(storedConsent);
          const isValid = consentData.accepted && consentData.timestamp;
          
          // Check if consent is less than 1 year old
          const consentDate = new Date(consentData.timestamp);
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          
          if (isValid && consentDate > oneYearAgo) {
            setHasAcceptedTerms(true);
            console.log('✅ Valid terms consent found');
          } else {
            console.log('⚠️ Terms consent expired or invalid');
            localStorage.removeItem('axie_studio_terms_consent');
            setHasAcceptedTerms(false);
          }
        } else {
          console.log('ℹ️ No terms consent found');
          setHasAcceptedTerms(false);
        }
      } catch (error) {
        console.error('❌ Error checking terms consent:', error);
        setHasAcceptedTerms(false);
      }
    };

    checkTermsAcceptance();
  }, []);

  // Memoized agent ID with validation
  const agentId = useMemo(() => {
    const id = import.meta.env.VITE_AXIE_STUDIO_AGENT_ID || import.meta.env.VITE_ELEVENLABS_AGENT_ID;
    if (!id) {
      console.error('❌ Axie Studio Agent ID missing in environment variables');
      return null;
    }
    console.log('✅ Axie Studio Agent ID loaded securely');
    return id;
  }, []);

  // Enhanced conversation configuration
  const conversation = useConversation({
    onConnect: useCallback(() => {
      console.log('🔗 Connected to Axie Studio AI Assistant');
      setIsSecureConnection(true);
      setConnectionAttempts(0);
      setCallStartTime(Date.now());
    }, []),
    onDisconnect: useCallback(() => {
      console.log('🔌 Disconnected from Axie Studio AI Assistant');
      setIsSecureConnection(false);
      setCallStartTime(null);
    }, []),
    onMessage: useCallback((message) => {
      console.log('💬 Message received:', message);
    }, []),
    onError: useCallback((error) => {
      console.error('❌ Connection error:', error);
      setIsSecureConnection(false);
      
      // Auto-retry logic for better reliability
      if (connectionAttempts < RETRY_ATTEMPTS) {
        setTimeout(() => {
          setConnectionAttempts(prev => prev + 1);
          console.log(`🔄 Retrying connection (${connectionAttempts + 1}/${RETRY_ATTEMPTS})`);
        }, 2000);
      }
    }, [connectionAttempts])
  });

  // Optimized microphone permission request with better UX
  const requestMicrophonePermission = useCallback(async () => {
    if (isRequestingPermission) return;
    
    setIsRequestingPermission(true);
    console.log('🎤 Requesting microphone permission...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      // Immediately stop the stream to free resources
      stream.getTracks().forEach(track => track.stop());
      
      setHasPermission(true);
      console.log('✅ Microphone permission granted');
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      setHasPermission(false);
    } finally {
      setIsRequestingPermission(false);
    }
  }, [isRequestingPermission]);

  // Enhanced session management
  const handleStartSession = useCallback(async () => {
    if (!agentId) {
      console.error('❌ Cannot start session: Axie Studio Agent ID missing');
      return;
    }

    if (!hasPermission) {
      await requestMicrophonePermission();
      return;
    }

    console.log('🚀 Starting secure session...');
    
    try {
      const sessionPromise = conversation.startSession({
        agentId: agentId,
        connectionType: 'webrtc'
      });

      // Add timeout for connection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Axie Studio connection timeout')), CONNECTION_TIMEOUT);
      });

      await Promise.race([sessionPromise, timeoutPromise]);
      console.log('✅ Axie Studio session started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start Axie Studio session:', error);
      
      // Auto-retry on failure
      if (connectionAttempts < RETRY_ATTEMPTS) {
        setConnectionAttempts(prev => prev + 1);
        setTimeout(() => handleStartSession(), 1000);
      }
    }
  }, [agentId, hasPermission, requestMicrophonePermission, conversation, connectionAttempts]);

  // Handle initial call button click
  const handleInitialCallClick = useCallback(async () => {
    // Check terms acceptance first
    if (!hasAcceptedTerms) {
      console.log('📋 Terms not accepted, showing terms modal');
      setShowTermsModal(true);
      return;
    }

    // Directly start session if terms already accepted
    await handleStartSession();
  }, [hasAcceptedTerms, handleStartSession]);

  // Handle terms acceptance
  const handleTermsAccept = useCallback(() => {
    console.log('✅ Terms and conditions accepted');
    setHasAcceptedTerms(true);
    setShowTermsModal(false);
    
    // Directly start the session after terms acceptance
    setTimeout(() => {
      handleStartSession();
    }, 100);
  }, [handleStartSession]);

  // Handle terms decline
  const handleTermsDecline = useCallback(() => {
    console.log('❌ Terms and conditions declined');
    setShowTermsModal(false);
    setHasAcceptedTerms(false);
    
    // Show user-friendly message
    alert('Du måste acceptera våra villkor för att använda Axie Studio AI Röstassistent.');
  }, []);

  // Optimized session end with cleanup
  const handleEndSession = useCallback(async () => {
    console.log('🛑 Ending Axie Studio session...');
    
    try {
      await conversation.endSession();
      console.log('✅ Axie Studio session ended successfully');
    } catch (error) {
      console.error('❌ Error ending Axie Studio session:', error);
    } finally {
      setIsSecureConnection(false);
      setConnectionAttempts(0);
    }
  }, [conversation]);

  // Check initial permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setHasPermission(result.state === 'granted');
          
          result.addEventListener('change', () => {
            setHasPermission(result.state === 'granted');
          });
        } catch (error) {
          console.warn('⚠️ Could not check microphone permissions:', error);
        }
      }
    };

    checkPermissions();
  }, []);

  // Security check for HTTPS
  useEffect(() => {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.warn('⚠️ Insecure connection detected. HTTPS recommended for production.');
    }
  }, []);

  // Memoized connection status
  const connectionStatus = useMemo(() => {
    const isConnected = conversation.status === 'connected';
    const isConnecting = conversation.status !== 'connected' && conversation.status !== 'disconnected';
    
    return { isConnected, isConnecting };
  }, [conversation.status]);

  const { isConnected, isConnecting } = connectionStatus;

  return (
    <>
      {/* Terms and Conditions Popup */}
      <TermsPopup
        isOpen={showTermsModal}
        onAccept={handleTermsAccept}
        onDecline={handleTermsDecline}
      />

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="text-center w-full max-w-lg">
          <VoiceOrb
            isConnected={isConnected}
            isConnecting={isConnecting}
            isRequestingPermission={isRequestingPermission}
            isSpeaking={conversation.isSpeaking}
            hasPermission={hasPermission}
            connectionAttempts={connectionAttempts}
            onCallClick={isConnected ? handleEndSession : handleInitialCallClick}
          />

          <StatusIndicators
            isConnected={isConnected}
            isSecureConnection={isSecureConnection}
            isSpeaking={conversation.isSpeaking}
          />

          <PermissionWarning hasPermission={hasPermission} />
        </div>
      </div>
    </>
  );
};

export default HomePage;