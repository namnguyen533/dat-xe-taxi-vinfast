/**
 * TRANG CHI TIẾT XE
 * ------------------------------------------------------------
 * Đọc tham số ?id=vf8 trên URL, nạp dữ liệu từ cars.json + pricing.json
 * và hiển thị thông tin tương ứng (mặc định là VinFast VF 5 Plus).
 */
import './style.css';
import { CARS, getCarById } from './data/catalog.js';
import { escapeHtml, formatVND } from './data/store.js';

/** Dữ liệu mẫu khi URL không có hoặc sai tham số */
const FALLBACK_CAR = CARS[1] || CARS[0];

/** Gán nội dung vào thẻ theo id (bỏ qua nếu thẻ không tồn tại) */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderCarDetail(car) {
  if (!car) return;

  setText('detail-breadcrumb-name', car.name);
  setText('detail-title', car.name);
  setText('detail-subtitle', `${car.category} - ${car.seats} chỗ`);
  setText('detail-description', car.description);
  setText('detail-seats', `${car.seats} chỗ`);
  setText('detail-segment', car.segment);
  setText('detail-battery', car.specs.battery);
  setText('detail-range', car.specs.range);
  setText('detail-power', car.specs.power);
  setText('detail-luggage', car.specs.luggageCapacity);
  setText('detail-air-conditioning', car.specs.airConditioning ? 'Điều hòa 2 chiều' : 'Không có điều hòa');
  setText('detail-base-fare', formatVND(car.price?.baseFare ?? 0));
  setText('detail-per-km', `${formatVND(car.price?.perKm ?? 0)}/km`);
  setText('detail-waiting-fee', `${formatVND(car.price?.waitingFeePer5Min ?? 0)}/5 phút`);

  const featuresList = document.getElementById('detail-features-list');
  if (featuresList) {
    featuresList.innerHTML = car.features.map((feature) => `<li>✓ ${escapeHtml(feature)}</li>`).join('');
  }

  const mainImage = document.getElementById('detail-main-img');
  if (mainImage) {
    mainImage.src = car.image;
    mainImage.alt = car.name;
  }
  document.querySelectorAll('.thumbnail').forEach((thumb) => {
    thumb.src = car.image;
    thumb.alt = car.name;
  });

  document.querySelectorAll('[data-booking-model]').forEach((link) => {
    link.href = `booking.html?model=${encodeURIComponent(car.name)}`;
  });

  document.title = `${car.name} - TaxiVinFast`;
}

document.addEventListener('DOMContentLoaded', () => {
  const id = new URLSearchParams(window.location.search).get('id');
  const car = getCarById(id) || FALLBACK_CAR;
  renderCarDetail(car);

  // Nếu không có tham số hợp lệ thì báo nhẹ cho người dùng biết
  const notice = document.getElementById('detail-notice');
  if (notice) {
    notice.textContent = id && !getCarById(id)
      ? `Không tìm thấy mã xe "${id}", đang hiển thị ${car.name}.`
      : '';
    notice.style.display = notice.textContent ? 'block' : 'none';
  }
});
