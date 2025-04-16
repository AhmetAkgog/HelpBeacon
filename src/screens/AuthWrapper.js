import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginSignupScreen from './LoginSignupScreen';
import MainTabs from './MainTabs';
import { auth } from '../firebaseConfig';

const Stack = createStackNavigator();

const AuthWrapper = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((userAuth) => {
      setUser(userAuth);
    });
    return unsubscribe;
  }, []);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Home" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginSignupScreen} />
      )}
    </Stack.Navigator>
  );
};

export default AuthWrapper;