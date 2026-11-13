// Seed places for the mock backend: a spread of Timișoara venues across every category.
import type { PlaceCategory, PlaceDetail } from '@/api/types.places';

type Row = [string, PlaceCategory, number, number, string, string | null, Record<string, string>?];

const ROWS: Row[] = [
  ['Pizzeria Napoli', 'restaurant', 45.7537, 21.2257, 'Strada Alba Iulia 2', 'Mo-Su 11:00-23:00', { cuisine: 'pizza', phone: '+40 256 000 000' }],
  ['La Focacceria', 'restaurant', 45.7561, 21.2301, 'Strada Mercy 7', 'Mo-Sa 12:00-22:00', { cuisine: 'italian' }],
  ['Casa Bunicii', 'restaurant', 45.7482, 21.2214, 'Strada Gheorghe Lazăr 11', 'Mo-Su 10:00-22:00', { cuisine: 'romanian' }],
  ['Sushi Yama', 'restaurant', 45.7519, 21.2362, 'Bulevardul Revoluției 5', null, { cuisine: 'sushi' }],
  ['Trattoria Verde', 'restaurant', 45.7603, 21.2275, 'Strada Eugeniu de Savoya 3', 'Mo-Su 12:00-23:00', { cuisine: 'italian', 'diet:vegetarian': 'yes' }],
  ['Meet & Greet Café', 'cafe', 45.7545, 21.2268, 'Piața Victoriei 6', 'Mo-Su 08:00-22:00', { outdoor_seating: 'yes' }],
  ['Bean There', 'cafe', 45.7578, 21.2292, 'Piața Unirii 2', 'Mo-Fr 07:30-20:00', {}],
  ['Café Central', 'cafe', 45.7552, 21.2285, 'Strada Lonovici 4', 'Mo-Su 08:00-23:00', {}],
  ['Origo', 'cafe', 45.7499, 21.2231, 'Strada Iancu Văcărescu 1', 'Mo-Su 09:00-22:00', { website: 'https://example.ro' }],
  ['Beer O’Clock', 'bar', 45.7528, 21.2243, 'Strada Ștefan cel Mare 9', 'Mo-Su 16:00-02:00', {}],
  ['Scârț Loc Lejer', 'bar', 45.7489, 21.2318, 'Strada Mărășești 1', 'Mo-Su 14:00-03:00', {}],
  ['Berăria H', 'bar', 45.7554, 21.2178, 'Strada Hunedoara 2', 'Mo-Su 12:00-00:00', {}],
  ['Shot Bar', 'bar', 45.7511, 21.2343, 'Strada Proclamația de la Timișoara 4', 'Mo-Sa 18:00-03:00', {}],
  ['McDonald’s Iulius', 'fast_food', 45.7665, 21.2276, 'Strada Gheorghe Lazăr 2', 'Mo-Su 06:00-00:00', { brand: 'McDonald’s' }],
  ['Kebab Express', 'fast_food', 45.7526, 21.2301, 'Strada Mărășești 9', 'Mo-Su 10:00-04:00', { takeaway: 'yes' }],
  ['Burger Hub', 'fast_food', 45.7563, 21.2239, 'Strada Cluj 3', 'Mo-Su 11:00-23:00', { takeaway: 'yes' }],
  ['Club Daos', 'club', 45.7527, 21.2263, 'Strada Piatra Craiului 1', 'Th-Sa 22:00-05:00', {}],
  ['Fabrica', 'club', 45.7473, 21.2412, 'Strada Fabrica de Bere 1', 'Fr-Sa 22:00-06:00', {}],
  ['Sala Capitol', 'club', 45.7561, 21.2271, 'Strada Alba Iulia 12', null, {}],
  ['Farmacia Catena', 'pharmacy', 45.7541, 21.2249, 'Piața Victoriei 8', 'Mo-Su 08:00-22:00', { brand: 'Catena' }],
  ['Farmacia Dona', 'pharmacy', 45.7585, 21.2325, 'Bulevardul Take Ionescu 40', 'Mo-Fr 08:00-20:00', {}],
  ['Help Net', 'pharmacy', 45.7499, 21.2275, 'Strada Gheorghe Doja 20', 'Mo-Su 00:00-24:00', {}],
  ['Mega Image', 'supermarket', 45.7556, 21.2255, 'Strada Mercy 1', 'Mo-Su 07:00-23:00', { brand: 'Mega Image' }],
  ['Lidl Mehala', 'supermarket', 45.7392, 21.2012, 'Calea Aradului 15', 'Mo-Su 07:00-22:00', { brand: 'Lidl' }],
  ['Kaufland Girocului', 'supermarket', 45.7344, 21.2389, 'Strada Gheorghe Lazăr 90', 'Mo-Su 07:00-22:00', { brand: 'Kaufland' }],
  ['Parcul Rozelor', 'park', 45.7507, 21.2297, 'Strada Gheorghe Lazăr', null, {}],
  ['Parcul Central', 'park', 45.7541, 21.2352, 'Bulevardul C. D. Loga', null, {}],
  ['Parcul Botanic', 'park', 45.7365, 21.2402, 'Strada Gheorghe Doja', null, {}],
  ['Muzeul Național al Banatului', 'attraction', 45.7569, 21.2288, 'Bastion Theresia', 'Tu-Su 10:00-18:00', { website: 'https://example.ro' }],
  ['Catedrala Mitropolitană', 'attraction', 45.7522, 21.2257, 'Piața Victoriei', 'Mo-Su 07:00-20:00', {}],
  ['Piața Unirii', 'attraction', 45.7585, 21.2292, 'Piața Unirii', null, {}],
  ['Teatrul Național Timișoara', 'attraction', 45.7539, 21.2257, 'Strada Mărășești 2', null, {}],
  ['BCR ATM Victoriei', 'atm', 45.7531, 21.2262, 'Piața Victoriei', 'Mo-Su 00:00-24:00', {}],
  ['ING ATM Iulius', 'atm', 45.7661, 21.2279, 'Strada Gheorghe Lazăr 2', 'Mo-Su 00:00-24:00', {}],
  ['BRD ATM Unirii', 'atm', 45.7581, 21.2297, 'Piața Unirii', 'Mo-Su 00:00-24:00', {}],
];

/** Stable fake id for the Nth seeded place. */
export const placeId = (n: number) => `a0000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`;

/** All seeded places in the detail shape. */
export function seedPlaces(): PlaceDetail[] {
  return ROWS.map(([name, category, lat, lon, address, openingHours, tags], i) => ({
    id: placeId(i),
    osmId: `node/${1000000 + i}`,
    name,
    category,
    lat,
    lon,
    address,
    openingHours,
    tags: tags ?? {},
  }));
}
