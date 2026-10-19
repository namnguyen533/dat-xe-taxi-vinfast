const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const locationCache = new Map();
let geocodingQueue = Promise.resolve();
let lastGeocodingRequestAt = 0;

export const HANOI_BOUNDS = {
  minLat: 20.45,
  maxLat: 21.50,
  minLng: 105.20,
  maxLng: 106.25,
};

export function isWithinHanoi(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= HANOI_BOUNDS.minLat &&
    lat <= HANOI_BOUNDS.maxLat &&
    lng >= HANOI_BOUNDS.minLng &&
    lng <= HANOI_BOUNDS.maxLng
  );
}

export function isWithinVietnam(lat, lng) {
  return lat >= 6 && lat <= 24 && lng >= 102 && lng <= 112;
}

function hasHanoiAdministrativeArea(address = {}) {
  const administrativeAreas = [
    address.city,
    address.state,
    address.municipality,
    address.province,
  ].filter(Boolean);

  return administrativeAreas.some((area) =>
    area.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi').includes('ha noi'),
  );
}

function isHanoiAdministrativeArea(address = {}) {
  return hasHanoiAdministrativeArea(address);
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

  const hasHanoiKeyword = /hà nội|ha noi|\bhn\b/i.test(cleanQuery);
  const searchQuery = hasHanoiKeyword ? cleanQuery : `${cleanQuery}, Hà Nội`;

  const nominatimParams = new URLSearchParams({
    q: searchQuery,
    format: 'jsonv2',
    limit: String(limit),
    addressdetails: '1',
    'accept-language': 'vi',
    countrycodes: 'vn',
    viewbox: '105.20,21.50,106.25,20.45',
    bounded: '0',
  });
  const photonParams = new URLSearchParams({
    q: searchQuery,
    limit: String(limit),
    bbox: '105.20,20.45,106.25,21.50',
  });
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
          administrativeArea: item.address,
        }))
        .filter((location) =>
          location.label
          && Number.isFinite(location.lat)
          && Number.isFinite(location.lng)
          && isWithinHanoi(location.lat, location.lng)
          && isHanoiAdministrativeArea(location.administrativeArea)
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
          administrativeArea: {
            city: properties.city,
            state: properties.state,
            municipality: properties.municipality,
            province: properties.province,
          },
        };
      })
      .filter((location) =>
        location.label
        && Number.isFinite(location.lat)
        && Number.isFinite(location.lng)
        && isWithinHanoi(location.lat, location.lng)
        && isHanoiAdministrativeArea(location.administrativeArea)
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

export const HANOI_DISTRICTS = [
  { name: 'Hồ Hoàn Kiếm, Quận Hoàn Kiếm, Hà Nội', lat: 21.0285, lng: 105.8542 },
  { name: 'Quảng trường Ba Đình, Quận Ba Đình, Hà Nội', lat: 21.0341, lng: 105.8244 },
  { name: 'Văn Miếu, Quận Đống Đa, Hà Nội', lat: 21.0181, lng: 105.8299 },
  { name: 'Công viên Thống Nhất, Quận Hai Bà Trưng, Hà Nội', lat: 21.0076, lng: 105.8524 },
  { name: 'Cầu Giấy, Quận Cầu Giấy, Hà Nội', lat: 21.0313, lng: 105.7892 },
  { name: 'Hồ Tây, Quận Tây Hồ, Hà Nội', lat: 21.0718, lng: 105.8230 },
  { name: 'Nguyễn Trãi, Quận Thanh Xuân, Hà Nội', lat: 20.9937, lng: 105.8078 },
  { name: 'Bến xe Giáp Bát, Quận Hoàng Mai, Hà Nội', lat: 20.9765, lng: 105.8451 },
  { name: 'Aeon Mall Long Biên, Quận Long Biên, Hà Nội', lat: 21.0400, lng: 105.8800 },
  { name: 'Sân vận động Mỹ Đình, Quận Nam Từ Liêm, Hà Nội', lat: 21.0134, lng: 105.7656 },
  { name: 'Đại học Mỏ - Địa chất, Quận Bắc Từ Liêm, Hà Nội', lat: 21.0667, lng: 105.7667 },
  { name: 'Văn Quán, Quận Hà Đông, Hà Nội', lat: 20.9720, lng: 105.7760 },
  { name: 'Vinhomes Ocean Park, Huyện Gia Lâm, Hà Nội', lat: 21.0100, lng: 105.9400 },
  { name: 'Thị trấn Đông Anh, Huyện Đông Anh, Hà Nội', lat: 21.1367, lng: 105.8467 },
  { name: 'Sân bay Quốc tế Nội Bài, Huyện Sóc Sơn, Hà Nội', lat: 21.2212, lng: 105.8072 },
];

function getNearestDistrict(lat, lng) {
  let nearest = HANOI_DISTRICTS[0];
  let minD = Infinity;
  for (const d of HANOI_DISTRICTS) {
    const distSq = (d.lat - lat) ** 2 + (d.lng - lng) ** 2;
    if (distSq < minD) {
      minD = distSq;
      nearest = d;
    }
  }
  return nearest;
}

function formatAddressResult(result, lat, lng) {
  if (!result) return getNearestDistrict(lat, lng).name;

  const addr = result.address || {};
  
  // Xây dựng địa chỉ thân thiện, dễ đọc theo chuẩn Việt Nam
  const streetPart = [
    addr.house_number,
    addr.road || addr.pedestrian || addr.street || addr.amenity || addr.building,
  ].filter(Boolean).join(' ');

  const wardPart = addr.suburb || addr.quarter || addr.neighbourhood || addr.residential || addr.village;
  const districtPart = addr.city_district || addr.district || addr.county || addr.town;
  const cityPart = addr.city || addr.state || 'Hà Nội';

  const parts = [streetPart, wardPart, districtPart, cityPart].filter(Boolean);
  const uniqueParts = parts.filter((part, idx, arr) => arr.indexOf(part) === idx);

  if (uniqueParts.length >= 2) {
    return uniqueParts.join(', ');
  }

  if (result.display_name) {
    const cleanName = result.display_name
      .replace(/,\s*\d{5,6}/g, '')
      .replace(/,\s*Việt Nam/gi, '')
      .trim();
    if (cleanName) return cleanName;
  }

  return getNearestDistrict(lat, lng).name;
}

export async function reverseGeocodeLocation(lat, lng) {
  if (!isWithinHanoi(lat, lng)) {
    throw new Error('Dịch vụ TaxiVinFast hiện chỉ hỗ trợ khu vực Hà Nội.');
  }

  // 1. Thử Nominatim reverse geocode
  try {
    const reverseParams = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      addressdetails: '1',
      'accept-language': 'vi',
    });
    const result = await requestGeocoding(`${NOMINATIM_URL.replace('/search', '/reverse')}?${reverseParams}`);
    if (result && hasHanoiAdministrativeArea(result.address)) {
      const label = formatAddressResult(result, lat, lng);
      return { label, lat, lng };
    }
  } catch {
    // Thử dịch vụ dự phòng Photon
  }

  // 2. Thử Photon reverse geocode
  try {
    const photonReverseUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const data = await requestJson(photonReverseUrl, 'Dịch vụ tìm địa chỉ');
    const feature = data.features?.[0];
    if (feature?.properties) {
      const p = feature.properties;
      const parts = [p.name, p.street, p.district || p.suburb, p.city || 'Hà Nội'].filter(Boolean);
      const unique = parts.filter((x, i, a) => a.indexOf(x) === i);
      if (unique.length) {
        return { label: unique.join(', '), lat, lng };
      }
    }
  } catch {
    // Dùng vị trí quận Hà Nội gần nhất
  }

  // 3. Fallback: Quận Hà Nội gần nhất
  const nearest = getNearestDistrict(lat, lng);
  return {
    label: nearest.name,
    lat,
    lng,
  };
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
    if (!isWithinHanoi(lat, lng)) {
      throw new Error('Dịch vụ TaxiVinFast hiện chỉ hỗ trợ đặt xe trong khu vực Hà Nội.');
    }

    return await reverseGeocodeLocation(lat, lng);
  }

  const locations = await searchLocations(cleanQuery, 1);
  if (!locations.length) {
    throw new Error(`Không tìm thấy địa chỉ "${cleanQuery}" tại Hà Nội. Vui lòng chọn địa điểm trong phạm vi Hà Nội.`);
  }
  return locations[0];
}

export async function getDrivingRoute(pickup, destination) {
  if (!isWithinHanoi(pickup.lat, pickup.lng) || !isWithinHanoi(destination.lat, destination.lng)) {
    throw new Error('Điểm đón và điểm đến phải nằm trong phạm vi khu vực Hà Nội.');
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
