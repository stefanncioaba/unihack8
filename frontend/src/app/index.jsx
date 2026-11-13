import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { regionForCoordinates, TIMISOARA_CENTER } from '../lib/map';

// Displays the initial Timișoara map and lets users center it on their position.
export default function DiscoverScreen() {
  const mapRef = useRef(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('Tap Locate to show your position.');
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  // Requests foreground access only when the user taps Locate.
  async function locateUser() {
    setLocating(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationMessage('Location permission denied. You can still explore Timișoara.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const region = regionForCoordinates(
        position.coords.latitude,
        position.coords.longitude
      );
      setHasLocationPermission(true);
      setLocationMessage('Showing your current area.');
      mapRef.current?.animateToRegion(region, 500);
    } catch {
      setLocationMessage('Could not get your position. Try again.');
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={regionForCoordinates(
          TIMISOARA_CENTER.latitude,
          TIMISOARA_CENTER.longitude
        )}
        showsUserLocation={hasLocationPermission}
        showsMyLocationButton={false}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.title}>Explore your city</Text>
          <Text style={styles.description}>
            Places, events and public transport will appear here as their APIs are connected.
          </Text>
          <Text style={styles.status}>{locationMessage}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Locate me"
            disabled={locating}
            onPress={locateUser}
            style={styles.button}
          >
            {locating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Locate me</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#102432' },
  description: { fontSize: 14, lineHeight: 20, color: '#405563' },
  status: { fontSize: 13, color: '#405563' },
  button: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#146C94',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
