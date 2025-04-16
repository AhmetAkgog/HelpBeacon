import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { auth } from '../firebaseConfig';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
} from 'firebase/database';

const FriendsScreen = () => {
  const [friendEmail, setFriendEmail] = useState('');
  const [friendList, setFriendList] = useState([]);
  const db = getDatabase();
  const currentUID = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUID) return;
    const friendsRef = ref(db, `friendships/${currentUID}/friendList`);
    const unsubscribe = onValue(friendsRef, (snapshot) => {
      const data = snapshot.val();
      setFriendList(data ? data : []);
    });
    return () => unsubscribe();
  }, [currentUID]);

  const addFriend = async () => {
    if (!friendEmail || friendEmail === auth.currentUser.email) {
      Alert.alert('Invalid email');
      return;
    }

    try {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);

      if (!snapshot.exists()) {
        Alert.alert('User database is empty');
        return;
      }

      const usersData = snapshot.val();
      let foundUID = null;

      for (const uid in usersData) {
        if (
          usersData[uid].email &&
          usersData[uid].email.toLowerCase() === friendEmail.toLowerCase()
        ) {
          foundUID = uid;
          break;
        }
      }

      if (!foundUID) {
        Alert.alert('No user found with that email');
        return;
      }

      if (foundUID === currentUID) {
        Alert.alert('You cannot add yourself');
        return;
      }

      const updatedList = [...new Set([...friendList, foundUID])];
      await update(ref(db, `friendships/${currentUID}`), {
        friendList: updatedList,
      });

      setFriendEmail('');
    } catch (error) {
      console.error('Add friend error:', error);
      Alert.alert('Error adding friend');
    }
  };

  const removeFriend = async (uidToRemove) => {
    const updatedList = friendList.filter((uid) => uid !== uidToRemove);
    await set(ref(db, `friendships/${currentUID}/friendList`), updatedList);
  };

  const FriendItem = ({ uid }) => {
    const [email, setEmail] = useState(null);

    useEffect(() => {
      const fetchEmail = async () => {
        try {
          const userSnap = await get(ref(db, `users/${uid}`));
          if (userSnap.exists()) {
            setEmail(userSnap.val().email);
          } else {
            setEmail('Unknown user');
          }
        } catch (err) {
          setEmail('Error loading');
        }
      };
      fetchEmail();
    }, [uid]);

    return (
      <View style={styles.friendItem}>
        <Text>{email || 'Loading...'}</Text>
        <TouchableOpacity onPress={() => removeFriend(uid)}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👥 My Friends</Text>

      <View style={styles.inputRow}>
        <TextInput
          placeholder="Enter friend's email"
          value={friendEmail}
          onChangeText={setFriendEmail}
          style={styles.input}
        />
        <TouchableOpacity style={styles.addButton} onPress={addFriend}>
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={friendList}
        keyExtractor={(uid) => uid}
        renderItem={({ item }) => <FriendItem uid={item} />}
        ListEmptyComponent={<Text style={styles.empty}>No friends yet.</Text>}
      />
    </View>
  );
};

export default FriendsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  inputRow: { flexDirection: 'row', marginBottom: 20 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
  },
  addButton: {
    marginLeft: 10,
    backgroundColor: '#1e90ff',
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderRadius: 8,
  },
  addText: { color: 'white', fontWeight: 'bold' },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  removeText: { color: 'red', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 20, color: '#999' },
});
