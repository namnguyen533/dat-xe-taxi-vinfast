import './style.css';
import { calculateTripFare } from './price-calculator.js';

document.addEventListener('DOMContentLoaded', () => {
  const modelSelect = document.getElementById('sim-model-select');
  const distanceSlider = document.getElementById('sim-distance-slider');
  const distanceValText = document.getElementById('sim-distance-val');
  const timeSelect = document.getElementById('sim-time-select');
  const couponInput = document.getElementById('sim-coupon-input');
  
  // Output Elements
  const outBase = document.getElementById('sim-out-base');
  const outDistance = document.getElementById('sim-out-distance');
  const outNight = document.getElementById('sim-out-night');
  const outDiscount = document.getElementById('sim-out-discount');
  const outTotal = document.getElementById('sim-out-total');
  const breakdownList = document.getElementById('sim-breakdown-list');

  if (!modelSelect || !distanceSlider) return;

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

    // Format VND
    const fmt = (amt) => new Intl.NumberFormat('vi-VN').format(amt) + ' đ';

    if (outBase) outBase.textContent = fmt(result.baseFare);
    if (outDistance) outDistance.textContent = `${fmt(result.distanceCost)} (${distanceKm} km)`;
    
    if (outNight) {
      const nightRow = outNight.parentElement;
      if (result.nightSurcharge > 0) {
        nightRow.style.display = 'flex';
        outNight.textContent = `+ ${fmt(result.nightSurcharge)}`;
      } else {
        nightRow.style.display = 'none';
      }
    }

    if (outDiscount) {
      const discRow = outDiscount.parentElement;
      if (result.discount > 0) {
        discRow.style.display = 'flex';
        outDiscount.textContent = `- ${fmt(result.discount)}`;
      } else {
        discRow.style.display = 'none';
      }
    }

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

