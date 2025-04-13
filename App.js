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

const manager = new BleManager();
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';

const App = () => {
  const [devices, setDevices] = useState([]);
  const deviceMap = useRef(new Map());
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [gpsData, setGpsData] = useState('');
  const [gpsLog, setGpsLog] = useState([]);
  const webViewRef = useRef(null);

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

        if (device.name.includes('ESP')) {
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
      console.log("Discovered Services:", services.map(s => s.uuid));

      for (const service of services) {
        if (service.uuid.toLowerCase() !== SERVICE_UUID.toLowerCase()) continue;

        const characteristics = await service.characteristics();
        console.log(`🧪 Service: ${service.uuid}`);

        for (const char of characteristics) {
          console.log(`  ↳ Characteristic: ${char.uuid} | Notifiable: ${char.isNotifiable}`);

          if (char.isNotifiable) {
            console.log('✅ Delaying monitor setup for:', char.uuid);
            setTimeout(() => {
              console.log('📡 Now setting up monitor on:', char.uuid);
              updatedDevice.monitorCharacteristicForService(
                service.uuid,
                char.uuid,
                (error, characteristic) => {
                  if (error) {
                    console.error('Monitor error:', error);
                    return;
                  }

                  console.log('🚨 monitor triggered');

                  if (characteristic?.value) {
                    console.log('Raw base64:', characteristic.value);
                    const decoded = atob(characteristic.value).trim();
                    console.log('📡 GPS Data:', decoded);
                    setGpsData(decoded);
                    setGpsLog(prev => [decoded, ...prev].slice(0, 20));

                    // 🚀 Inject GPS data into WebView map
                    const parsed = decoded.split(',');
                    const lat = parseFloat(parsed[0]);
                    const lon = parseFloat(parsed[1]);
                    if (!isNaN(lat) && !isNaN(lon)) {
                      webViewRef.current?.injectJavaScript(`
                        updateMap(${lat}, ${lon});
                        true;
                      `);
                    }
                  }
                }
              );
            }, 1000);
          }
        }
      }

      updatedDevice.onDisconnected((error, disconnectedDevice) => {
        console.warn("❌ Disconnected from device:", disconnectedDevice.id);
        setConnectedDevice(null);
        setGpsData('');
        setGpsLog([]);
        setTimeout(() => {
          manager.startDeviceScan(null, null, (error, device) => {
            if (error) {
              console.error("Scan error:", error);
              return;
            }
            if (!device || !device.name || deviceMap.current.has(device.id)) return;
            if (device.name.includes("ESP")) {
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
      {connectedDevice ? (
        <>
          <View style={{ paddingTop: 40, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 18, marginBottom: 10 }}>Connected to: {connectedDevice.name}</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>GPS Output</Text>
            {gpsData ? (
              <Text style={{ fontSize: 16 }}>{gpsData}</Text>
            ) : (
              <Text style={{ fontSize: 16, color: '#999' }}>Waiting for GPS data...</Text>
            )}
            {renderLog()}
          </View>
          <WebView
            ref={webViewRef}
            source={{ uri: 'file:///android_asset/map.html' }}
            originWhitelist={['*']}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </>
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
          ListHeaderComponent={<Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 10 }}>Nearby ESP32 Devices</Text>}
        />
      )}
    </View>
  );
};

export default App;