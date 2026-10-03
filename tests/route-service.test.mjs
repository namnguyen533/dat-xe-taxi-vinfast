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

test('searchLocations falls back to Photon when Nominatim is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    if (requestedUrls.length === 1) throw new TypeError('Failed to fetch');
    return {
      ok: true,
      json: async () => ({
        features: [{
          properties: {
            name: 'Landmark 81',
            street: 'Trần Trọng Kim',
            city: 'Ho Chi Minh City',
            country: 'Vietnam',
            countrycode: 'VN',
          },
          geometry: { coordinates: [106.7219, 10.795] },
        }],
      }),
    };
  };

  try {
    const locations = await searchLocations('Landmark 81');
    assert.deepEqual(locations, [{
      label: 'Landmark 81, Trần Trọng Kim, Ho Chi Minh City, Vietnam',
      lat: 10.795,
      lng: 106.7219,
    }]);
    assert.match(requestedUrls[1], /photon\.komoot\.io\/api/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveLocation accepts valid GPS coordinates without geocoding', async () => {
  const location = await resolveLocation('21.0285, 105.8542');
  assert.deepEqual(location, {
    label: '21.0285, 105.8542',
    lat: 21.0285,
    lng: 105.8542,
  });
  await assert.rejects(resolveLocation('95, 200'), /Tọa độ GPS không hợp lệ/);
  await assert.rejects(resolveLocation('40.7128, -74.0060'), /chỉ hỗ trợ đặt xe trong lãnh thổ Việt Nam/);
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
  let requests = 0;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => {
      requests += 1;
      return { code: 'NoRoute', routes: [] };
    },
  });

  try {
    await assert.rejects(
      getDrivingRoute({ lat: 21, lng: 105.8 }, { lat: 21.1, lng: 105.9 }),
      /Không tìm thấy tuyến đường ô tô/,
    );
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getDrivingRoute rejects coordinates outside Vietnam', async () => {
  await assert.rejects(
    getDrivingRoute({ lat: 40.7128, lng: -74.006 }, { lat: 21.0285, lng: 105.8542 }),
    /phải nằm trong lãnh thổ Việt Nam/,
  );
});

test('getDrivingRoute retries the secondary public router after a network failure', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    if (requestedUrls.length === 1) throw new TypeError('Failed to fetch');
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{
          distance: 4200,
          duration: 600,
          geometry: { coordinates: [[106.7, 10.7], [106.71, 10.71]] },
        }],
      }),
    };
  };

  try {
    const route = await getDrivingRoute(
      { lat: 10.7, lng: 106.7 },
      { lat: 10.71, lng: 106.71 },
    );
    assert.equal(route.distanceKm, 4.2);
    assert.equal(requestedUrls.length, 2);
    assert.match(requestedUrls[1], /routing\.openstreetmap\.de\/routed-car/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
