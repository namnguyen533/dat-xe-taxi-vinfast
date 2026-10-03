const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const locationCache = new Map();
let geocodingQueue = Promise.resolve();
let lastGeocodingRequestAt = 0;

function isWithinVietnam(lat, lng) {
  return lat >= 6 && lat <= 24 && lng >= 102 && lng <= 112;
}

function requestJson(url, serviceName) {
  return fetch(url).catch(() => {
    throw new Error(`${serviceName} không kết nối được. Hãy kiểm tra Internet rồi thử lại.`);
  }).then(async (response) => {
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

  const nominatimParams = new URLSearchParams({
    q: cleanQuery,
    format: 'jsonv2',
    limit: String(limit),
    addressdetails: '1',
    'accept-language': 'vi',
    countrycodes: 'vn',
  });
  const photonParams = new URLSearchParams({ q: cleanQuery, limit: String(limit) });
  const request = (async () => {
    try {
      const results = await requestGeocoding(`${NOMINATIM_URL}?${nominatimParams}`);
      if (!Array.isArray(results)) throw new Error('Dữ liệu địa điểm trả về không hợp lệ.');
      const locations = results
        .map((item) => ({
          label: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
          countryCode: item.address?.country_code,
        }))
        .filter((location) =>
          location.label
          && Number.isFinite(location.lat)
          && Number.isFinite(location.lng)
          && isWithinVietnam(location.lat, location.lng)
          && (!location.countryCode || location.countryCode.toLowerCase() === 'vn'),
        )
        .map(({ label, lat, lng }) => ({ label, lat, lng }));
      if (locations.length) return locations;
    } catch {
      // Try the alternate public geocoder when Nominatim is unavailable.
    }

    const data = await requestJson(`${PHOTON_URL}?${photonParams}`, 'Dịch vụ tìm địa chỉ');
    if (!Array.isArray(data.features)) {
      throw new Error('Dữ liệu địa điểm trả về không hợp lệ.');
    }
    return data.features
      .map((feature) => {
        const properties = feature.properties || {};
        const address = [
          properties.name,
          properties.street,
          properties.locality,
          properties.district,
          properties.city,
          properties.state,
          properties.country,
        ].filter((part, index, parts) => part && parts.indexOf(part) === index);
        return {
          label: address.join(', '),
          lng: Number(feature.geometry?.coordinates?.[0]),
          lat: Number(feature.geometry?.coordinates?.[1]),
          countryCode: properties.countrycode,
        };
      })
      .filter((location) =>
        location.label
        && Number.isFinite(location.lat)
        && Number.isFinite(location.lng)
        && (!location.countryCode || location.countryCode.toUpperCase() === 'VN'),
      )
      .map(({ label, lat, lng }) => ({ label, lat, lng }));
  })();
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
    if (!isWithinVietnam(lat, lng)) {
      throw new Error('Ứng dụng hiện chỉ hỗ trợ đặt xe trong lãnh thổ Việt Nam.');
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
  if (!isWithinVietnam(pickup.lat, pickup.lng) || !isWithinVietnam(destination.lat, destination.lng)) {
    throw new Error('Điểm đón và điểm đến phải nằm trong lãnh thổ Việt Nam.');
  }
  const coordinates = `${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}`;
  const params = new URLSearchParams({ overview: 'full', geometries: 'geojson' });
  const providers = [
    `${OSRM_URL}/${coordinates}?${params}`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordinates}?${params}`,
  ];
  let lastError;

  for (const url of providers) {
    try {
      const data = await requestJson(url, 'Dịch vụ định tuyến');
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
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError?.message.includes('không kết nối được')) {
    throw new Error('Không kết nối được dịch vụ tính tuyến. Hãy kiểm tra Internet hoặc dùng nút Google Maps.');
  }
  throw lastError || new Error('Không tìm thấy tuyến đường ô tô giữa hai địa điểm đã chọn.');
}
