import assert from 'node:assert/strict';
import test from 'node:test';

import { apiBaseUrl, apiGet } from '../src/lib/api.js';
import { regionForCoordinates } from '../src/lib/map.js';

// Coordinates outside valid latitude and longitude ranges must never reach MapView.
test('map region rejects coordinates outside Earth bounds', () => {
  assert.throws(() => regionForCoordinates(91, 20), RangeError);
  assert.throws(() => regionForCoordinates(45, Number.NaN), RangeError);
});

// The API helper must produce one predictable URL from a configured base.
test('API URL removes trailing slashes and joins paths', async () => {
  let requestedUrl;
  const fetcher = async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => ({ ready: true }) };
  };

  assert.equal(apiBaseUrl('http://localhost:8080///'), 'http://localhost:8080');
  assert.deepEqual(
    await apiGet('/health', { baseUrl: 'http://localhost:8080/', fetcher }),
    { ready: true }
  );
  assert.equal(requestedUrl, 'http://localhost:8080/health');
});

// HTTP failures must remain visible to feature screens using the API helper.
test('API errors include the HTTP status', async () => {
  await assert.rejects(
    apiGet('/missing', {
      baseUrl: 'http://localhost:8080',
      fetcher: async () => ({ ok: false, status: 404 }),
    }),
    /404/
  );
});
