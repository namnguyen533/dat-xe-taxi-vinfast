/**
 * BẢNG GIÁ ĐƯỢC NẠP ĐỘNG TỪ CÙNG CẤU HÌNH VỚI TRANG ĐẶT XE VÀ ADMIN
 * ------------------------------------------------------------
 * Dùng chung bảng giá với trang danh sách xe và công cụ mô phỏng,
 * tránh viết cứng nhiều lần ở giao diện.
 */
import './style.css';
import { getPricingConfig } from './data/pricing-store.js';
import { CARS } from './data/catalog.js';

const vnd = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('pricing-table-body');
  const hourlyList = document.getElementById('hourly-pricing-list');
  const error = document.getElementById('pricing-error');
  if (!tbody || !hourlyList) return;

  try {
    const pricing = getPricingConfig();
    if (!pricing.standardRates?.length) {
      throw new Error('Chưa có dữ liệu giá cước cho các dòng xe.');
    }

    tbody.innerHTML = pricing.standardRates
      .map((rate) => {
        const car = CARS.find((item) => item.id === rate.modelId);
        return `
          <tr>
            <th scope="row">
              <div class="pricing-car">
                ${car?.image ? `<img src="${escapeHtml(car.image)}" alt="" loading="lazy">` : ''}
                <span>${escapeHtml(rate.modelName)}</span>
              </div>
            </th>
            <td>${Number(rate.seats)} chỗ</td>
            <td class="price-cell">${vnd(Number(rate.baseFare))}</td>
            <td class="price-cell">${vnd(Number(rate.rateUnder25km))}/km</td>
            <td class="price-cell">${vnd(Number(rate.rateOver25km))}/km</td>
            <td class="price-cell">${vnd(Number(rate.waitingFeePer5Min))}/5 phút</td>
          </tr>`;
      })
      .join('');

    hourlyList.innerHTML = (pricing.hourlyRental ?? [])
      .map((packageRate) => `
        <article class="hourly-pricing-card">
          <div class="hourly-pricing-topline">
            <span>GÓI THUÊ</span>
            <strong>${Number(packageRate.durationHours)} giờ</strong>
          </div>
          <p class="hourly-pricing-distance">Tối đa ${Number(packageRate.maxDistanceKm)} km</p>
          <div class="hourly-pricing-rates">
            ${Object.entries(packageRate.rates ?? {}).map(([model, price]) => `
              <div><span>${escapeHtml(model)}</span><strong>${vnd(Number(price))}</strong></div>
            `).join('')}
          </div>
          <p class="hourly-pricing-extra">Vượt gói: ${vnd(Number(packageRate.extraKmRate))}/km · ${vnd(Number(packageRate.extraHourRate))}/giờ</p>
        </article>
      `)
      .join('');
  } catch (loadError) {
    console.error('Không thể tải bảng giá.', loadError);
    tbody.innerHTML = '<tr><td colspan="6" class="pricing-loading">Không thể tải dữ liệu giá cước.</td></tr>';
    if (error) {
      error.textContent = loadError instanceof Error ? loadError.message : 'Đã xảy ra lỗi khi tải bảng giá.';
      error.hidden = false;
    }
  }
});
