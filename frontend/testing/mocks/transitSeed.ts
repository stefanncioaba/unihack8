// Seed for the mock transit backend: a few real STPT lines and stops around the centre (positions approximate).
// Each line lists its stops in order, so mock vehicles can move along them.
import type { TransitRoute, TransitStop } from '@/api/types.transit';

export const MOCK_ROUTES: TransitRoute[] = [
  { id: '1', type: 'TRAM', name: '1', from: 'Gara de Nord', to: 'Piața Gh. Domășneanu (AEM)', color: '#e3a900' },
  { id: '2', type: 'TRAM', name: '2', from: 'Dâmbovița', to: 'Shopping City', color: '#d6322f' },
  { id: '8', type: 'TRAM', name: '8', from: 'Dâmbovița', to: 'Piața Traian', color: '#2e7d32' },
  { id: '14', type: 'TROLLEYBUS', name: '14', from: 'Piața Traian', to: 'Calea Martirilor', color: '#1e88e5' },
  { id: 'E4', type: 'EXPRESS', name: 'E4', from: 'Gara de Nord', to: 'Calea Torontalului', color: null },
];

/** Stops (id, name, lat, lon); the lines that serve each one are derived from `LINE_STOPS`. */
const STOPS: [string, string, number, number][] = [
  ['1', 'Dâmbovița (Ion Barac)', 45.74015, 21.19611],
  ['2', 'Gara de Nord', 45.7505, 21.2075],
  ['3', 'Piața Maria', 45.7525, 21.218],
  ['4', 'Catedrala Mitropolitană', 45.7506, 21.224],
  ['5', 'Piața Libertății', 45.755, 21.228],
  ['6', 'Bastion', 45.758, 21.233],
  ['7', 'Piața Traian', 45.76, 21.242],
  ['8', 'Universitate', 45.747, 21.231],
  ['9', 'Memorandumului', 45.744, 21.237],
  ['10', 'Shopping City', 45.7275, 21.2355],
  ['11', 'Piața 700', 45.759, 21.226],
  ['12', 'Calea Martirilor', 45.7355, 21.2405],
];

/** Ordered stops of each line (both directions run the same stops). */
export const LINE_STOPS: Record<string, string[]> = {
  '1': ['2', '3', '4', '5', '6', '7'],
  '2': ['1', '3', '4', '8', '9', '10'],
  '8': ['1', '2', '11', '5', '6', '7'],
  '14': ['7', '6', '5', '4', '8', '9', '12'],
  E4: ['2', '11', '6'],
};

export const MOCK_STOPS: TransitStop[] = STOPS.map(([id, name, lat, lon]) => ({
  id,
  name,
  lat,
  lon,
  routes: Object.keys(LINE_STOPS).filter((r) => LINE_STOPS[r].includes(id)),
}));

/** Lines with no vehicles out right now (shows the "not running" state). */
export const LINES_NOT_RUNNING = ['E4'];
