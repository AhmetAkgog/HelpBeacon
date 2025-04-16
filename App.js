import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AuthWrapper from './src/screens/AuthWrapper';

const App = () => {
  return (
    <NavigationContainer>
      <AuthWrapper />
    </NavigationContainer>
  );
};

export default App;