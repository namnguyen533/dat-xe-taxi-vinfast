import './style.css';
import { calculateTripFare } from './price-calculator.js';
import { STANDARD_RATES } from './data/catalog.js';

document.addEventListener('DOMContentLoaded', () => {
  const modelSelect = document.getElementById('sim-model-select');
  const distanceSlider = document.getElementById('sim-distance-slider');
  const distanceValText = document.getElementById('sim-distance-val');
  const timeSelect = document.getElementById('sim-time-select');
  const couponInput = document.getElementById('sim-coupon-input');
  
  // Output Elements
  const outTotal = document.getElementById('sim-out-total');
  const breakdownList = document.getElementById('sim-breakdown-list');

  if (!modelSelect || !distanceSlider) return;

  // Nạp danh sách dòng xe & đơn giá từ pricing.json
  const formatPerKm = (amount) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ/km';
  modelSelect.innerHTML = STANDARD_RATES.map(
    (rate, index) => `
      <option value="${rate.modelName}" data-base="${rate.baseFare}" data-per-km="${rate.rateUnder25km}"${index === 1 ? ' selected' : ''}>
        ${rate.modelName} (${rate.seats} chỗ - ${formatPerKm(rate.rateUnder25km)})
      </option>`,
  ).join('');

  function runSimulation() {
    const selectedOption = modelSelect.options[modelSelect.selectedIndex];
    const basePrice = parseInt(selectedOption.getAttribute('data-base'), 10) || 12000;
    const perKmPrice = parseInt(selectedOption.getAttribute('data-per-km'), 10) || 10000;
    const distanceKm = parseFloat(distanceSlider.value);
    const pickupTime = timeSelect ? timeSelect.value : '12:00';
    const couponCode = couponInput ? couponInput.value : '';

    if (distanceValText) {
      distanceValText.textContent = `${distanceKm} km`;
    }

    // Run Calculation Engine
    const result = calculateTripFare({
      distanceKm,
      basePrice,
      perKmPrice,
      pickupTime,
      couponCode
    });

    if (outTotal) outTotal.textContent = result.formattedTotal;

    // Render detailed breakdown list
    if (breakdownList) {
      breakdownList.innerHTML = result.breakdown.map(item => `
        <li class="breakdown-item ${item.isDiscount ? 'text-success' : ''}">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </li>
      `).join('');
    }
  }

  // Event Listeners for real-time recalculation
  modelSelect.addEventListener('change', runSimulation);
  distanceSlider.addEventListener('input', runSimulation);
  if (timeSelect) timeSelect.addEventListener('change', runSimulation);
  if (couponInput) couponInput.addEventListener('input', runSimulation);

  // Initial Run
  runSimulation();
});

