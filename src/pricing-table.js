/**
 * BẢNG GIÁ ĐƯỢC NẠP ĐỘNG TỪ FILE pricing.json
 * ------------------------------------------------------------
 * Dùng chung bảng giá với trang danh sách xe và công cụ mô phỏng,
 * tránh viết cứng nhiều lần ở giao diện.
 */
import './style.css';
import pricing from './data/pricing.json';

const vnd = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('pricing-table-body');
  if (!tbody) return;

  if (!pricing.standardRates?.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Không có dữ liệu bảng giá.</td></tr>';
    return;
  }

  tbody.innerHTML = pricing.standardRates
    .map(
      (rate) => `
      <tr>
        <td>${rate.modelName}</td>
        <td>${rate.seats} chỗ</td>
        <td class="price-cell">${vnd(rate.baseFare)}</td>
        <td class="price-cell">${vnd(rate.rateUnder25km)}/km</td>
        <td class="price-cell">${vnd(rate.waitingFeePer5Min)}/5 phút</td>
      </tr>`,
    )
    .join('');
});
