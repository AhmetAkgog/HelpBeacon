import React, { useState } from 'react';
import { getDatabase, ref, set } from 'firebase/database'; // ✅ Firebase DB
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { auth } from '../firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';

const LoginSignupScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email and password are required');
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        Alert.alert('Success', 'Logged in successfully!');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // ✅ Write the user to /users/<uid>
        const db = getDatabase();
        await set(ref(db, `users/${user.uid}`), {
          email: user.email,
        });

        Alert.alert('Success', 'Account created successfully!');
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Authentication Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{isLogin ? 'Login' : 'Sign Up'}</Text>

      <TextInput
        placeholder="Email"
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        value={email}
      />

      <TextInput
        placeholder="Password"
        style={styles.input}
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      <TouchableOpacity style={styles.button} onPress={handleAuth}>
        <Text style={styles.buttonText}>
          {isLogin ? 'Login' : 'Create Account'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
        <Text style={styles.toggleText}>
          {isLogin
            ? "Don't have an account? Sign up"
            : 'Already have an account? Login'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginSignupScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#1e90ff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  toggleText: {
    textAlign: 'center',
    color: '#333',
    marginTop: 12,
  },
});
