import React from 'react';
import AuthWrapper from './src/screens/AuthWrapper';
import GpsScreen from './src/screens/GpsScreen';
console.log('✅ GpsScreen imported:', typeof GpsScreen);

const App = () => {
  return <AuthWrapper BleGpsScreen={BleGpsScreen} />;
};

export default App;