import test from 'node:test';
import assert from 'node:assert/strict';
import { getDrivingRoute, resolveLocation, searchLocations } from '../src/route-service.js';

test('searchLocations converts geocoder results into route coordinates', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /nominatim\.openstreetmap\.org\/search/);
    return {
      ok: true,
      json: async () => [{ display_name: 'Chợ Bến Thành, Hồ Chí Minh', lat: '10.7725', lon: '106.6980' }],
    };
  };

  try {
    const locations = await searchLocations('Chợ Bến Thành, Hồ Chí Minh');
    assert.deepEqual(locations, [{
      label: 'Chợ Bến Thành, Hồ Chí Minh',
      lat: 10.7725,
      lng: 106.698,
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveLocation accepts valid GPS coordinates without geocoding', async () => {
  const location = await resolveLocation('10.7769, 106.7009');
  assert.deepEqual(location, {
    label: '10.7769, 106.7009',
    lat: 10.7769,
    lng: 106.7009,
  });
  await assert.rejects(resolveLocation('95, 200'), /Tọa độ GPS không hợp lệ/);
});

test('getDrivingRoute returns road distance, duration, and map geometry', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /router\.project-osrm\.org\/route\/v1\/driving\/106\.7,10\.7;106\.8,10\.8/);
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{
          distance: 15234,
          duration: 1020,
          geometry: { coordinates: [[106.7, 10.7], [106.8, 10.8]] },
        }],
      }),
    };
  };

  try {
    const route = await getDrivingRoute(
      { lat: 10.7, lng: 106.7 },
      { lat: 10.8, lng: 106.8 },
    );
    assert.deepEqual(route, {
      distanceKm: 15.234,
      durationMin: 17,
      coordinates: [[10.7, 106.7], [10.8, 106.8]],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getDrivingRoute reports routing service errors', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ code: 'NoRoute', routes: [] }),
  });

  try {
    await assert.rejects(
      getDrivingRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }),
      /Không tìm thấy tuyến đường ô tô/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
