import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginSignupScreen from './LoginSignupScreen';
import { auth } from '../firebaseConfig';

const Stack = createNativeStackNavigator();

const AuthWrapper = ({ BleGpsScreen }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((userAuth) => {
      setUser(userAuth);
    });
    return unsubscribe;
  }, []);

  console.log('✅ LoginSignupScreen:', typeof LoginSignupScreen);
  console.log('✅ BleGpsScreen:', typeof BleGpsScreen);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Home">
            {() => <BleGpsScreen />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Auth" component={LoginSignupScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AuthWrapper;