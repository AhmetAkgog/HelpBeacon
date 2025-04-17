import React, { useEffect, useRef, useState } from 'react';
import {
  PermissionsAndroid,
  Platform,
  Alert,
  Linking,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';
import { decode as atob } from 'base-64';
import { WebView } from 'react-native-webview';
import { getDatabase, ref, set } from '@react-native-firebase/database'; // ✅ Modular Firebase
import { getApp } from '@react-native-firebase/app'; // ✅ Modular Firebase
import { getAuth } from 'firebase/auth';
import { firebaseApp } from '../firebaseConfig';

const app = getApp();
console.log("🔥 Firebase App Name:", app.name);
console.log("🌐 Firebase DB URL:", app.options.databaseURL);


const manager = new BleManager();
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';

const DeviceConnectionScreen = () => {
  const [devices, setDevices] = useState([]);
  const deviceMap = useRef(new Map());
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [gpsData, setGpsData] = useState('');
  const [gpsLog, setGpsLog] = useState([]);
  const webViewRef = useRef(null);
  const hasSentSearching = useRef(false);

  const uploadToFirebase = async (lat, lon, deviceId, bootTimeMs) => {
    const now = new Date().toISOString();
    const data = {
      lat,
      lon,
      appTimestamp: now,
      bootTimeMs,
      deviceId,
    };

    const db = getDatabase(getApp());
    const safeDeviceId = (deviceId || "unknown").replace(/[:.#$\[\]]/g, '_');

    // 1. Save to /emergencies/{deviceId}
    await set(ref(db, `/emergencies/${safeDeviceId}`), data)
      .then(() => console.log("📡 Sent EMERGENCY GPS to Firebase:", data))
      .catch(err => console.error("❌ Firebase upload failed:", err));

    // 2. Also sync emergency state to /users/{uid}
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (uid) {
      const gpsString = `${lat},${lon}`;
      await set(ref(db, `users/${uid}/emergency`), true);
      await set(ref(db, `users/${uid}/gps`), gpsString);
      console.log("✅ Synced emergency location to /users/" + uid);
    } else {
      console.warn("⚠️ No user logged in – cannot sync to /users/{uid}");
    }
  };


  const uploadSearchStatus = async (deviceId) => {
    console.log("🚨 uploadSearchStatus() called with:", deviceId);
    console.log("📡 Writing data:", data);
    console.log("📍 Firebase path: /emergencies/" + safeDeviceId);
    const now = new Date().toISOString();
    const db = getDatabase(getApp());
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    const safeDeviceId = (deviceId || "unknown").replace(/[:.#$\[\]]/g, '_');

    const data = {
      status: "SEARCHING_FOR_GPS",
      appTimestamp: now,
      deviceId,
      uid: uid || null
    };

    console.log("💾 Trying to write to /emergencies/" + safeDeviceId, data);

    try {
      await set(ref(db, `/emergencies/${safeDeviceId}`), data);
      console.log("✅ SUCCESS writing to /emergencies");
    } catch (err) {
      console.error("❌ ERROR writing to /emergencies:", err.message);
    }

    if (uid) {
        try {
          await set(ref(db, `/emergencies/${safeDeviceId}`), data);
          console.log("✅ SUCCESS writing to /emergencies/" + safeDeviceId);
        } catch (err) {
          console.error("❌ ERROR writing to /emergencies:", err.message);
        }
    }
  };

  useEffect(() => {
    let stateSub = null;

    const requestPermissions = async () => {
      const isAndroid12OrAbove = Platform.OS === 'android' && Platform.Version >= 31;
      const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

      if (isAndroid12OrAbove) {
        permissions.push(
          'android.permission.BLUETOOTH_CONNECT',
          'android.permission.BLUETOOTH_SCAN'
        );
      }

      const results = await PermissionsAndroid.requestMultiple(permissions);
      const denied = Object.entries(results).filter(
        ([, result]) => result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      );

      if (denied.length > 0) {
        Alert.alert('Permission Required', 'Some permissions were permanently denied. Please enable them in app settings.', [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return false;
      }

      return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
    };

    const startScan = async () => {
      const granted = await requestPermissions();
      if (!granted) return;

      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          return;
        }

        if (!device || !device.name || deviceMap.current.has(device.id)) return;

        if (device.name.includes('GPS')) {
          deviceMap.current.set(device.id, device);
          setDevices(Array.from(deviceMap.current.values()));
        }
      });
    };

    const monitorBluetooth = async () => {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      stateSub = manager.onStateChange((state) => {
        if (state === State.PoweredOn) startScan();
      }, true);
    };

    monitorBluetooth();

    return () => {
      manager.destroy();
      if (stateSub) stateSub.remove();
    };
  }, []);

  const connectToDevice = async (device) => {
    manager.stopDeviceScan();
    try {
      await manager.cancelDeviceConnection(device.id);
    } catch {}

    try {
      const connected = await manager.connectToDevice(device.id);
      setConnectedDevice(connected);
      const updatedDevice = await connected.discoverAllServicesAndCharacteristics();

      const services = await updatedDevice.services();

      for (const service of services) {
        if (service.uuid.toLowerCase() !== SERVICE_UUID.toLowerCase()) continue;

        const characteristics = await service.characteristics();

        for (const char of characteristics) {
          if (char.isNotifiable) {
            setTimeout(() => {
              updatedDevice.monitorCharacteristicForService(
                service.uuid,
                char.uuid,
                (error, characteristic) => {
                  if (error) {
                    console.error('Monitor error:', error);
                    return;
                  }

                  if (characteristic?.value) {
                    const decoded = atob(characteristic.value).trim();
                    setGpsData(decoded);
                    setGpsLog(prev => [decoded, ...prev].slice(0, 20));

                    if (decoded.startsWith("EMERGENCY:")) {
                      const raw = decoded.replace("EMERGENCY:", "");

                      if (raw === "SEARCHING") {
                        if (!hasSentSearching.current) {
                              const deviceId = updatedDevice?.id || connectedDevice?.id || "unknown";
                              console.log("🔗 Using device ID for SEARCHING:", deviceId);
                              uploadSearchStatus(deviceId);
                          hasSentSearching.current = true;
                        }
                      } else {
                        const parts = raw.split(",");
                        if (parts.length === 3) {
                          const [timestamp, latStr, lonStr] = parts;
                          const lat = parseFloat(latStr);
                          const lon = parseFloat(lonStr);

                          if (!isNaN(lat) && !isNaN(lon)) {
                                const deviceId = updatedDevice?.id || connectedDevice?.id || "unknown";
                                console.log("🔗 Using device ID for GPS FIX:", deviceId);
                                uploadSearchStatus(deviceId);
                            webViewRef.current?.injectJavaScript(`updateMap(${lat}, ${lon}); true;`);
                            hasSentSearching.current = false; // Reset
                          }
                        }
                      }
                    } else if (decoded.startsWith("LOCAL:")) {
                      const parts = decoded.replace("LOCAL:", "").split(",");
                      if (parts.length === 3) {
                        const [, latStr, lonStr] = parts;
                        const lat = parseFloat(latStr);
                        const lon = parseFloat(lonStr);
                        if (!isNaN(lat) && !isNaN(lon)) {
                          webViewRef.current?.injectJavaScript(`updateMap(${lat}, ${lon}); true;`);
                        }
                      }
                    }
                  }
                }
              );
            }, 1000);
          }
        }
      }

      updatedDevice.onDisconnected(() => {
        setConnectedDevice(null);
        setGpsData('');
        setGpsLog([]);
        setTimeout(() => {
          manager.startDeviceScan(null, null, (error, device) => {
            if (error) return;
            if (!device || !device.name || deviceMap.current.has(device.id)) return;
            if (device.name.includes("GPS")) {
              deviceMap.current.set(device.id, device);
              setDevices(Array.from(deviceMap.current.values()));
            }
          });
        }, 3000);
      });

    } catch (e) {
      console.error('Connection error:', e);
      Alert.alert('Failed to connect');
    }
  };

  const renderLog = () => (
    <ScrollView style={{ maxHeight: 200, marginTop: 10 }}>
      {gpsLog.map((entry, index) => (
        <Text key={index} style={{ fontSize: 14, color: '#555' }}>• {entry}</Text>
      ))}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {connectedDevice ? (
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 18, marginBottom: 10 }}>
              Connected to: {connectedDevice.name}
            </Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>GPS Output</Text>
            {gpsData ? (
              <Text style={{ fontSize: 16 }}>{gpsData}</Text>
            ) : (
              <Text style={{ fontSize: 16, color: '#999' }}>Waiting for GPS data...</Text>
            )}
            {renderLog()}
          </View>
        ) : (
          <FlatList
            contentContainerStyle={{ paddingTop: 50 }}
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ padding: 15, borderBottomWidth: 1, borderColor: '#ccc' }}
                onPress={() => connectToDevice(item)}
              >
                <Text>{item.name}</Text>
                <Text style={{ fontSize: 12, color: '#888' }}>{item.id}</Text>
              </TouchableOpacity>
            )}
            ListHeaderComponent={
              <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 10 }}>
                Nearby GPS Devices
              </Text>
            }
          />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          ref={webViewRef}
          source={{ uri: 'file:///android_asset/map_sender.html' }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={{ flex: 1, backgroundColor: 'white' }}
          onLoadEnd={() => {
            console.log("✅ WebView loaded – injecting default coords");
            setTimeout(() => {
              webViewRef.current?.injectJavaScript(`
                updateMap(48.1351, 11.5820);
                true;
              `);
            }, 500);
          }}
          onError={(e) => console.log("❌ WebView error:", e.nativeEvent)}
        />
      </View>
    </View>
  );
};

export default DeviceConnectionScreen;
