// Typed wrapper around the Neighbourhood Pulse endpoint (docs/API.md -> Neighbourhoods).
import { api } from './client';
import type { NeighbourhoodPulseResponse } from './types.neighbourhoods';

/** Every Timișoara area's live card, busiest first (public, no token). */
export const getNeighbourhoodPulse = () => api<NeighbourhoodPulseResponse>('GET', '/neighbourhoods/pulse');
