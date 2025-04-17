import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AuthWrapper from './src/screens/AuthWrapper';

import messaging from '@react-native-firebase/messaging';
import { getDatabase, ref, set } from 'firebase/database';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const registerFcmToken = async (user) => {
  try {
    const permission = await messaging().requestPermission();
    const enabled =
      permission === messaging.AuthorizationStatus.AUTHORIZED ||
      permission === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log("🚫 Notification permission not granted");
      return;
    }

    const token = await messaging().getToken();
    console.log("📲 FCM Token:", token);

    const db = getDatabase();
    await set(ref(db, `tokens/${user.uid}`), token);
  } catch (err) {
    console.error("❌ Failed to register FCM token:", err);
  }
};

const App = () => {
  useEffect(() => {
    const auth = getAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        registerFcmToken(user);
      }
    });

    const unsubscribeRefresh = messaging().onTokenRefresh(async (newToken) => {
      const user = getAuth().currentUser;
      if (user) {
        await set(ref(getDatabase(), `tokens/${user.uid}`), newToken);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRefresh();
    };
  }, []);

  return (
    <NavigationContainer>
      <AuthWrapper />
    </NavigationContainer>
  );
};

export default App;
