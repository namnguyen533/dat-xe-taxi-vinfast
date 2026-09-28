/**
 * DANH MỤC XE TÁI SỬ DỤNG
 * ------------------------------------------------------------
 * Gộp dữ liệu xe (cars.json) với bảng giá (pricing.json) để các trang
 * danh sách xe, chi tiết xe và trang đặt xe dùng chung một nguồn dữ liệu.
 */
import cars from './cars.json';
import pricing from './pricing.json';

/** Bảng giá chuẩn theo từng dòng xe */
export const STANDARD_RATES = pricing.standardRates;

/** Danh sách xe kèm thông tin giá */
export const CARS = cars.map((car) => {
  const rate = STANDARD_RATES.find((item) => item.modelId === car.id);
  return {
    ...car,
    price: rate
      ? {
          baseFare: rate.baseFare,
          perKm: rate.rateUnder25km,
          perKmOver25: rate.rateOver25km,
          waitingFeePer5Min: rate.waitingFeePer5Min,
        }
      : null,
  };
});

/** Tìm xe theo mã (vf5, vf8...) */
export function getCarById(id) {
  const key = String(id || '').trim().toLowerCase();
  return CARS.find((car) => car.id.toLowerCase() === key) || null;
}

/** Tìm xe theo tên (VinFast VF 5 Plus, VF 5 Plus, VF5...) */
export function getCarByName(name) {
  const key = String(name || '')
    .toLowerCase()
    .replace(/vinfast/g, '')
    .replace(/\s+/g, '');
  return CARS.find((car) => car.name.toLowerCase().replace(/\s+/g, '').includes(key) || key.includes(car.id)) || null;
}
