// Global Jest setup: turns on the mock backend and replaces native modules that Expo Go provides.
process.env.EXPO_PUBLIC_USE_MOCKS = 'true';
process.env.EXPO_PUBLIC_API_URL = 'http://test-host:8080';

import { configure } from '@testing-library/react-native';

import { resetMocks, setMockLatency } from '@/mocks';

// Rendering the SVG backgrounds is slow on some machines; give async queries more time.
configure({ asyncUtilTimeout: 15000 });
jest.setTimeout(40000);

// Fresh mock-backend data and no fake network delay for every test.
beforeEach(() => {
  resetMocks();
  setMockLatency(0);
  (globalThis as { __routeParams?: Record<string, string> }).__routeParams = {};
});

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// Icons: plain views (the real component loads a font asynchronously and triggers act() warnings).
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Ionicons = ({ name }: { name: string }) => React.createElement(View, { testID: `icon-${name}` });
  Ionicons.glyphMap = {};
  return { Ionicons };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Router: records navigation calls; route params are set per test through `globalThis.__routeParams`.
jest.mock('expo-router', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
  const passthrough = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: () => (globalThis as { __routeParams?: object }).__routeParams ?? {},
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
      React.createElement(Pressable, { ...rest, onPress: () => router.push(href) }, children),
    Stack: Object.assign(passthrough, { Screen: () => null, Protected: passthrough }),
    Tabs: Object.assign(passthrough, { Screen: () => null }),
  };
});

// Maps: plain views, with the imperative methods the screens call. `Polyline`, `Circle` and `Callout` are plain
// views too. Tests trigger map events with fireEvent(map, 'regionChangeComplete', region) / 'press' / 'longPress'.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = React.forwardRef((props: object, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: jest.fn(),
      animateCamera: jest.fn(),
      fitToCoordinates: jest.fn(),
      getMapBoundaries: jest.fn(async () => ({ northEast: { latitude: 45.8, longitude: 21.3 }, southWest: { latitude: 45.7, longitude: 21.1 } })),
    }));
    return React.createElement(View, props);
  });
  const plain = (props: object) => React.createElement(View, props);
  return { __esModule: true, default: MapView, Marker: plain, Polyline: plain, Circle: plain, Callout: plain, PROVIDER_GOOGLE: 'google' };
});

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 45.76, longitude: 21.23 } })),
}));

// Camera: tests trigger scans through `globalThis.__scan(token)`.
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const state = { permission: { granted: true, canAskAgain: true } as { granted: boolean; canAskAgain: boolean } | null };
  (globalThis as { __cameraState?: typeof state }).__cameraState = state;
  const CameraView = (props: { onBarcodeScanned?: (e: { data: string }) => void }) => {
    (globalThis as { __scan?: (t: string) => void }).__scan = (data: string) => props.onBarcodeScanned?.({ data });
    return React.createElement(View, { testID: 'camera-mock' });
  };
  return { CameraView, useCameraPermissions: () => [state.permission, jest.fn()] };
});

jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ value }: { value: string }) => React.createElement(Text, { testID: 'qr-code' }, value) };
});

// Supabase: no storage, no network. Individual tests configure the auth methods.
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn(async () => ({ error: null })),
      signUp: jest.fn(async () => ({ data: { session: {} }, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  },
}));
