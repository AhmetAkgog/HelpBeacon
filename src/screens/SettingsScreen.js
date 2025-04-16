import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { auth } from '../firebaseConfig';

const SettingsScreen = () => {
  const handleLogout = async () => {
    try {
      await auth.signOut();
      Alert.alert('Logged out', 'You have been logged out successfully.');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚙️ Settings</Text>
      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>🚪 Log Out</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, marginBottom: 30 },
  logoutButton: {
    backgroundColor: '#ff3b30',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});