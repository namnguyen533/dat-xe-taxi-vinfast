import test from 'node:test';
import assert from 'node:assert/strict';
import { getDrivingRoute, isWithinHanoi, resolveLocation, searchLocations } from '../src/route-service.js';

test('isWithinHanoi correctly identifies locations inside and outside Hanoi', () => {
  // Hoàn Kiếm, Hà Nội
  assert.equal(isWithinHanoi(21.0285, 105.8542), true);
  // Sân bay Nội Bài, Hà Nội
  assert.equal(isWithinHanoi(21.2212, 105.8072), true);
  // Ba Vì, Hà Nội
  assert.equal(isWithinHanoi(21.0800, 105.3600), true);
  // TP. Hồ Chí Minh
  assert.equal(isWithinHanoi(10.7725, 106.6980), false);
  // Đà Nẵng
  assert.equal(isWithinHanoi(16.0544, 108.2022), false);
});

test('searchLocations converts geocoder results into route coordinates in Hanoi', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /nominatim\.openstreetmap\.org\/search/);
    return {
      ok: true,
      json: async () => [{
        display_name: 'Hồ Hoàn Kiếm, Hà Nội',
        lat: '21.0285',
        lon: '105.8542',
        address: { state: 'Thành phố Hà Nội', country_code: 'vn' },
      }],
    };
  };

  try {
    const locations = await searchLocations('Hồ Hoàn Kiếm, Hà Nội');
    assert.deepEqual(locations, [{
      label: 'Hồ Hoàn Kiếm, Hà Nội',
      lat: 21.0285,
      lng: 105.8542,
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('searchLocations rejects neighboring provinces returned inside the broad map bounds', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return {
      ok: true,
      json: async () => requests === 1
        ? [{
            display_name: 'Địa điểm thuộc Bắc Ninh',
            lat: '21.10',
            lon: '106.10',
            address: { state: 'Bắc Ninh', country_code: 'vn' },
          }]
        : { features: [] },
    };
  };

  try {
    assert.deepEqual(await searchLocations('Địa điểm Bắc Ninh'), []);
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
            name: 'Văn Miếu Quốc Tử Giám',
            street: 'Quốc Tử Giám',
            city: 'Hà Nội',
            country: 'Vietnam',
            countrycode: 'VN',
          },
          geometry: { coordinates: [105.836, 21.0293] },
        }],
      }),
    };
  };

  try {
    const locations = await searchLocations('Văn Miếu');
    assert.deepEqual(locations, [{
      label: 'Văn Miếu Quốc Tử Giám, Quốc Tử Giám, Hà Nội, Vietnam',
      lat: 21.0293,
      lng: 105.836,
    }]);
    assert.match(requestedUrls[1], /photon\.komoot\.io\/api/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveLocation accepts coordinates only when reverse geocoding confirms Hanoi', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      address: { state: 'Thành phố Hà Nội', country_code: 'vn' },
    }),
  });

  try {
    const location = await resolveLocation('21.0285, 105.8542');
    assert.deepEqual(location, {
      label: '21.0285, 105.8542',
      lat: 21.0285,
      lng: 105.8542,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  await assert.rejects(resolveLocation('95, 200'), /Tọa độ GPS không hợp lệ/);
  await assert.rejects(resolveLocation('10.7725, 106.6980'), /chỉ hỗ trợ đặt xe trong khu vực Hà Nội/);
});

test('resolveLocation rejects GPS coordinates in a neighboring province inside the map bounds', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      address: { state: 'Bắc Ninh', country_code: 'vn' },
    }),
  });

  try {
    await assert.rejects(
      resolveLocation('21.10, 106.10'),
      /chỉ hỗ trợ đặt xe trong khu vực Hà Nội/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getDrivingRoute returns road distance, duration, and map geometry', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /router\.project-osrm\.org\/route\/v1\/driving\/105\.8,21;105\.9,21\.1/);
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{
          distance: 15234,
          duration: 1020,
          geometry: { coordinates: [[105.8, 21.0], [105.9, 21.1]] },
        }],
      }),
    };
  };

  try {
    const route = await getDrivingRoute(
      { lat: 21.0, lng: 105.8 },
      { lat: 21.1, lng: 105.9 },
    );
    assert.deepEqual(route, {
      distanceKm: 15.234,
      durationMin: 17,
      coordinates: [[21.0, 105.8], [21.1, 105.9]],
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

test('getDrivingRoute rejects coordinates outside Hanoi', async () => {
  await assert.rejects(
    getDrivingRoute({ lat: 10.7725, lng: 106.698 }, { lat: 21.0285, lng: 105.8542 }),
    /phải nằm trong phạm vi khu vực Hà Nội/,
  );
  await assert.rejects(
    getDrivingRoute({ lat: 40.7128, lng: -74.006 }, { lat: 21.0285, lng: 105.8542 }),
    /phải nằm trong phạm vi khu vực Hà Nội/,
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
          geometry: { coordinates: [[105.8, 21.0], [105.81, 21.01]] },
        }],
      }),
    };
  };

  try {
    const route = await getDrivingRoute(
      { lat: 21.0, lng: 105.8 },
      { lat: 21.01, lng: 105.81 },
    );
    assert.equal(route.distanceKm, 4.2);
    assert.equal(requestedUrls.length, 2);
    assert.match(requestedUrls[1], /routing\.openstreetmap\.de\/routed-car/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
