import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { getDatabase, ref, get, onValue } from 'firebase/database';
import { auth } from '../firebaseConfig';
import { WebView } from 'react-native-webview';

const HomeScreen = () => {
  const db = getDatabase();
  const currentUID = auth.currentUser?.uid;
  const [loading, setLoading] = useState(true);
  const [emergencyFriends, setEmergencyFriends] = useState([]);
  const webViewRef = useRef(null);

  useEffect(() => {
    if (!currentUID) return;

    const loadEmergencyFriends = async () => {
      try {
        const friendsRef = ref(db, `friendships/${currentUID}/friendList`);
        const friendSnap = await get(friendsRef);
        const friendUIDs = friendSnap.exists() ? friendSnap.val() : [];

        for (const uid of friendUIDs) {
          const userRef = ref(db, `users/${uid}`);
          onValue(userRef, (snapshot) => {
            const data = snapshot.val();
            if (data?.emergency) {
              const friend = {
                uid,
                email: data.email || uid,
                gps: data.gps || null,
              };

              setEmergencyFriends((prev) => {
                const filtered = prev.filter((f) => f.uid !== uid);
                return [...filtered, friend];
              });

              if (data.gps) {
                const [lat, lon] = data.gps.split(',').map(parseFloat);
                if (!isNaN(lat) && !isNaN(lon)) {
                  webViewRef.current?.injectJavaScript(`
                    updateMap('${uid}', ${lat}, ${lon}, '${data.email || uid}');
                    true;
                  `);
                }
              }
            } else {
              setEmergencyFriends((prev) => prev.filter((f) => f.uid !== uid));
            }
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading emergency friends:', error);
        setLoading(false);
      }
    };

    loadEmergencyFriends();
  }, [currentUID]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚨 Emergency Friends</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#1e90ff" />
      ) : (
        <ScrollView style={styles.list}>
          {emergencyFriends.length === 0 ? (
            <Text style={styles.empty}>None of your friends are in emergency.</Text>
          ) : (
            emergencyFriends.map((friend) => (
              <View key={friend.uid} style={styles.friendItem}>
                <Text style={styles.friendText}>{friend.email}</Text>
                <Text style={styles.gpsText}>
                  {friend.gps ? `📍 ${friend.gps}` : '⏳ Waiting for GPS fix...'}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: 'file:///android_asset/map_tracker.html' }}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        style={styles.map}
        onLoadEnd={() => {
          console.log("✅ Tracker Map loaded");
        }}
        onError={(e) => console.log("❌ WebView error:", e.nativeEvent)}
      />
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  list: { maxHeight: 200, marginBottom: 10 },
  friendItem: {
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 8,
  },
  friendText: { fontSize: 16, fontWeight: '500' },
  gpsText: { fontSize: 14, color: '#666' },
  empty: { textAlign: 'center', color: '#999', marginTop: 20 },
  map: { flex: 1, borderWidth: 1, borderColor: '#ccc' },
});
