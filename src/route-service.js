const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const locationCache = new Map();
let geocodingQueue = Promise.resolve();
let lastGeocodingRequestAt = 0;

function requestJson(url, serviceName) {
  return fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`${serviceName} trả về lỗi HTTP ${response.status}.`);
    }
    return response.json();
  });
}

function requestGeocoding(url) {
  const request = geocodingQueue.then(async () => {
    const waitMs = Math.max(0, 1100 - (Date.now() - lastGeocodingRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastGeocodingRequestAt = Date.now();
    return requestJson(url, 'Dịch vụ tìm địa chỉ');
  });
  geocodingQueue = request.catch(() => {});
  return request;
}

export async function searchLocations(query, limit = 5) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const cacheKey = cleanQuery.toLocaleLowerCase('vi');
  if (locationCache.has(cacheKey)) return locationCache.get(cacheKey);

  const params = new URLSearchParams({
    q: cleanQuery,
    format: 'jsonv2',
    limit: String(limit),
    addressdetails: '1',
    'accept-language': 'vi',
    countrycodes: 'vn',
  });
  const request = requestGeocoding(`${NOMINATIM_URL}?${params}`).then((results) => {
    if (!Array.isArray(results)) {
      throw new Error('Dữ liệu địa điểm trả về không hợp lệ.');
    }

    return results
      .map((item) => ({
        label: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
      }))
      .filter((location) =>
        location.label && Number.isFinite(location.lat) && Number.isFinite(location.lng),
      );
  });
  locationCache.set(cacheKey, request);
  try {
    return await request;
  } catch (error) {
    locationCache.delete(cacheKey);
    throw error;
  }
}

export async function resolveLocation(query) {
  const cleanQuery = query.trim();
  const coordinates = cleanQuery.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coordinates) {
    const lat = Number(coordinates[1]);
    const lng = Number(coordinates[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error('Tọa độ GPS không hợp lệ.');
    }
    return { label: cleanQuery, lat, lng };
  }

  const locations = await searchLocations(cleanQuery, 1);
  if (!locations.length) {
    throw new Error(`Không tìm thấy địa chỉ "${cleanQuery}". Hãy nhập rõ hơn hoặc chọn gợi ý.`);
  }
  return locations[0];
}

export async function getDrivingRoute(pickup, destination) {
  const coordinates = `${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}`;
  const params = new URLSearchParams({ overview: 'full', geometries: 'geojson' });
  const data = await requestJson(`${OSRM_URL}/${coordinates}?${params}`, 'Dịch vụ định tuyến');
  const route = data.routes?.[0];
  if (
    data.code !== 'Ok'
    || !route
    || !Number.isFinite(route.distance)
    || route.distance <= 0
    || !Number.isFinite(route.duration)
    || !Array.isArray(route.geometry?.coordinates)
    || route.geometry.coordinates.length === 0
    || route.geometry.coordinates.some((coordinate) =>
      !Array.isArray(coordinate)
      || coordinate.length < 2
      || !Number.isFinite(coordinate[0])
      || !Number.isFinite(coordinate[1])
      || Math.abs(coordinate[0]) > 180
      || Math.abs(coordinate[1]) > 90,
    )
  ) {
    throw new Error('Không tìm thấy tuyến đường ô tô giữa hai địa điểm đã chọn.');
  }

  return {
    distanceKm: route.distance / 1000,
    durationMin: Math.max(1, Math.round(route.duration / 60)),
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  };
}
