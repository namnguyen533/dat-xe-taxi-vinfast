/**
 * TRANG DANH SÁCH XE ĐIỆN VINFAST
 * ------------------------------------------------------------
 * Dữ liệu xe được nạp từ file cars.json và gộp với pricing.json
 * (xem src/data/catalog.js) rồi hiển thị động bằng JavaScript.
 */
import './style.css';
import { CARS } from './data/catalog.js';
import { escapeHtml } from './data/store.js';

const state = { filter: 'all' };

/** Lọc danh sách xe theo số chỗ hoặc phân khúc */
function filterCars(cars, filterValue) {
  if (filterValue === 'all') return cars;
  const seats = parseInt(filterValue, 10);
  if (Number.isFinite(seats)) return cars.filter((car) => car.seats === seats);
  const keyword = String(filterValue).toLowerCase();
  return cars.filter(
    (car) =>
      car.category.toLowerCase().includes(keyword) ||
      car.segment.toLowerCase().includes(keyword) ||
      car.name.toLowerCase().includes(keyword),
  );
}

/** Vẽ danh sách xe lên giao diện */
function renderCarsUI(cars, containerId = 'cars-grid-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!cars || cars.length === 0) {
    container.innerHTML = '<p class="no-data">Không có dữ liệu xe phù hợp với bộ lọc hiện tại.</p>';
    return;
  }

  container.innerHTML = cars
    .map(
      (car) => `
      <div class="car-card" data-category="${escapeHtml(car.category)}">
        <div class="car-image">
          <img src="${escapeHtml(car.image)}" alt="${escapeHtml(car.name)}" class="car-img" loading="lazy" onerror="this.src='/src/assets/vf5.jpg'">
        </div>
        <div class="car-info">
          <div class="car-badge-header">
            <h3 class="car-name">${escapeHtml(car.name)}</h3>
            ${car.badge ? `<span class="badge-tag">${escapeHtml(car.badge)}</span>` : ''}
          </div>
          <p class="car-type">${escapeHtml(car.category)} (${escapeHtml(car.seats)} chỗ) - ${escapeHtml(car.segment)}</p>
          <p class="car-desc">${escapeHtml(car.description)}</p>

          <div class="car-specs">
            <span class="spec">🔋 Pin: ${escapeHtml(car.specs.battery)}</span>
            <span class="spec">🛣️ Quãng đường: ${escapeHtml(car.specs.range)}</span>
            <span class="spec">⚡ Công suất: ${escapeHtml(car.specs.power)}</span>
            <span class="spec">❄️ Điều hòa: ${car.specs.airConditioning ? 'Có' : 'Không'}</span>
          </div>

          <div class="car-features-list">
            ${car.features.map((feature) => `<span class="feat-item">✓ ${escapeHtml(feature)}</span>`).join('')}
          </div>

          <div class="car-price">
            <span class="price-label">Giá mở cửa:</span>
            <span class="price-value">${new Intl.NumberFormat('vi-VN').format(car.price?.baseFare ?? 0)}đ</span>
            <span class="price-label">Giá theo km:</span>
            <span class="price-value">${new Intl.NumberFormat('vi-VN').format(car.price?.perKm ?? 0)}đ/km</span>
          </div>

          <div class="car-actions">
            <a href="car-detail.html?id=${encodeURIComponent(car.id)}" class="btn-view">Xem chi tiết</a>
            <a href="booking.html?model=${encodeURIComponent(car.name)}" class="btn-book">Đặt xe ngay</a>
          </div>
        </div>
      </div>`,
    )
    .join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const filterBtns = document.querySelectorAll('.car-filter-btn');

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((item) => item.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter || 'all';
      renderCarsUI(filterCars(CARS, state.filter));
    });
  });

  renderCarsUI(filterCars(CARS, state.filter));
});
