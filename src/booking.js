import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM elements ---
  const pickupInput = document.getElementById('pickup-location');
  const destInput = document.getElementById('destination-location');
  const btnSwap = document.getElementById('btn-swap-locations');
  const btnGeo = document.querySelector('.btn-location-geo');
  const quickTags = document.querySelectorAll('.quick-tag');
  const serviceTabs = document.querySelectorAll('.tab-btn');
  
  const vehicleCards = document.querySelectorAll('.vehicle-card');
  const paymentOptions = document.querySelectorAll('.payment-option');

  const dateInput = document.getElementById('booking-date');
  const timeInput = document.getElementById('booking-time');

  const customerName = document.getElementById('customer-name');
  const customerPhone = document.getElementById('customer-phone');
  const customerNote = document.getElementById('customer-note');

  // Summary elements
  const summaryPickup = document.getElementById('summary-pickup');
  const summaryDest = document.getElementById('summary-dest');
  const summaryCarImg = document.getElementById('summary-car-img');
  const summaryCarName = document.getElementById('summary-car-name');
  const summaryCarType = document.getElementById('summary-car-type');
  const metricDistance = document.getElementById('metric-distance');
  const metricDuration = document.getElementById('metric-duration');

  const priceBaseEl = document.getElementById('price-base');
  const priceDistEl = document.getElementById('price-distance');
  const priceDiscEl = document.getElementById('price-discount');
  const rowDiscount = document.getElementById('row-discount');
  const priceTotalEl = document.getElementById('price-total');

  const couponInput = document.getElementById('coupon-code');
  const btnApplyCoupon = document.getElementById('btn-apply-coupon');
  const couponMsg = document.getElementById('coupon-message');

  const btnConfirm = document.getElementById('btn-confirm-booking');

  // Modal elements
  const modal = document.getElementById('booking-success-modal');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnModalDone = document.getElementById('btn-modal-done');

  // --- Initial State ---
  let selectedService = 'point-to-point';
  let currentCar = {
    model: 'VF 5 Plus',
    basePrice: 12000,
    perKmPrice: 10000,
    seats: 4,
    type: 'Compact SUV (4 chỗ)',
    img: '/src/assets/vf5.jpg'
  };

  let distanceKm = 12.5;
  let durationMin = 25;
  let activeDiscountPercent = 0;
  let activeDiscountAmount = 0;

  // Set default date & time
  const today = new Date();
  dateInput.value = today.toISOString().split('T')[0];
  const hours = String(today.getHours()).padStart(2, '0');
  const minutes = String(today.getMinutes()).padStart(2, '0');
  timeInput.value = `${hours}:${minutes}`;

  // Format currency helper
  function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
  }

  // Calculate Distance based on string lengths / hashes for realistic demo UI
  function updateDistance() {
    const pickupVal = pickupInput.value.trim();
    const destVal = destInput.value.trim();

    if (!pickupVal || !destVal) {
      distanceKm = 0;
      durationMin = 0;
    } else {
      // Generate a stable fake distance between 3.5km and 28km
      const combined = (pickupVal + destVal).length;
      distanceKm = parseFloat(((combined % 20) + 3.5).toFixed(1));
      durationMin = Math.round(distanceKm * 2.2 + 5);
    }

    summaryPickup.textContent = pickupVal || '---';
    summaryDest.textContent = destVal || '---';
    metricDistance.textContent = distanceKm > 0 ? `${distanceKm} km` : '---';
    metricDuration.textContent = durationMin > 0 ? `~${durationMin} phút` : '---';

    calculatePrice();
  }

  // Calculate Price Breakdown
  function calculatePrice() {
    if (distanceKm === 0) {
      priceBaseEl.textContent = '0 đ';
      priceDistEl.textContent = '0 đ';
      priceTotalEl.textContent = '0 đ';
      return;
    }

    let base = currentCar.basePrice;
    let distCost = distanceKm * currentCar.perKmPrice;

    // Service multiplier adjustments
    if (selectedService === 'hourly') {
      base += 50000;
    } else if (selectedService === 'intercity') {
      distCost *= 0.85; // 15% discount for long distance
    } else if (selectedService === 'airport') {
      base += 15000;
    }

    let subtotal = base + distCost;
    let discount = 0;

    if (activeDiscountPercent > 0) {
      discount += (subtotal * activeDiscountPercent) / 100;
    }
    if (activeDiscountAmount > 0) {
      discount += activeDiscountAmount;
    }

    let finalTotal = Math.max(0, subtotal - discount);

    priceBaseEl.textContent = formatVND(base);
    priceDistEl.textContent = `${formatVND(distCost)} (${distanceKm} km)`;
    
    if (discount > 0) {
      rowDiscount.style.display = 'flex';
      priceDiscEl.textContent = `- ${formatVND(discount)}`;
    } else {
      rowDiscount.style.display = 'none';
    }

    priceTotalEl.textContent = formatVND(finalTotal);
  }

  // Input listeners
  pickupInput.addEventListener('input', updateDistance);
  destInput.addEventListener('input', updateDistance);

  // Swap locations button
  if (btnSwap) {
    btnSwap.addEventListener('click', () => {
      const temp = pickupInput.value;
      pickupInput.value = destInput.value;
      destInput.value = temp;
      updateDistance();
    });
  }

  // Geolocation button
  if (btnGeo) {
    btnGeo.addEventListener('click', () => {
      btnGeo.textContent = '⌛';
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            pickupInput.value = `Vị trí hiện tại (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
            btnGeo.textContent = '📍';
            updateDistance();
          },
          () => {
            pickupInput.value = 'Chợ Bến Thành, Quận 1, TPHCM';
            btnGeo.textContent = '📍';
            updateDistance();
          }
        );
      } else {
        pickupInput.value = 'Chợ Bến Thành, Quận 1, TPHCM';
        btnGeo.textContent = '📍';
        updateDistance();
      }
    });
  }

  // Quick tag buttons
  quickTags.forEach(tag => {
    tag.addEventListener('click', () => {
      destInput.value = tag.getAttribute('data-dest');
      updateDistance();
    });
  });

  // Service tab switching
  serviceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      serviceTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedService = tab.getAttribute('data-service');
      calculatePrice();
    });
  });

  // Vehicle Selection
  vehicleCards.forEach(card => {
    card.addEventListener('click', () => {
      vehicleCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;

      const model = card.getAttribute('data-model');
      const base = parseInt(card.getAttribute('data-base'), 10);
      const perKm = parseInt(card.getAttribute('data-per-km'), 10);
      const seats = card.getAttribute('data-seats');
      const img = card.querySelector('img').src;
      const typeText = card.querySelector('.vehicle-type').textContent;

      currentCar = {
        model,
        basePrice: base,
        perKmPrice: perKm,
        seats,
        type: typeText,
        img
      };

      // Update Summary UI
      summaryCarName.textContent = `VinFast ${model}`;
      summaryCarType.textContent = typeText;
      summaryCarImg.src = img;

      calculatePrice();
    });
  });

  // Payment Option selection
  paymentOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      paymentOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      const radio = opt.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Apply Coupon Code
  if (btnApplyCoupon) {
    btnApplyCoupon.addEventListener('click', () => {
      const code = couponInput.value.trim().toUpperCase();
      if (!code) {
        couponMsg.textContent = 'Vui lòng nhập mã giảm giá!';
        couponMsg.className = 'coupon-msg error';
        return;
      }

      if (code === 'VINFAST20') {
        activeDiscountPercent = 20;
        activeDiscountAmount = 0;
        couponMsg.textContent = '✓ Đã áp dụng mã VINFAST20 (Giảm 20%)!';
        couponMsg.className = 'coupon-msg success';
      } else if (code === 'XEXANH') {
        activeDiscountAmount = 30000;
        activeDiscountPercent = 0;
        couponMsg.textContent = '✓ Đã áp dụng mã XEXANH (Giảm 30.000đ)!';
        couponMsg.className = 'coupon-msg success';
      } else {
        couponMsg.textContent = 'Mã giảm giá không hợp lệ hoặc đã hết hạn.';
        couponMsg.className = 'coupon-msg error';
      }
      calculatePrice();
    });
  }

  // Submit & Modal Confirmation
  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      const name = customerName.value.trim();
      const phone = customerPhone.value.trim();
      const pickup = pickupInput.value.trim();
      const dest = destInput.value.trim();

      if (!pickup || !dest) {
        alert('Vui lòng nhập đầy đủ điểm đón và điểm đến!');
        pickupInput.focus();
        return;
      }

      if (!name) {
        alert('Vui lòng nhập họ và tên của bạn!');
        customerName.focus();
        return;
      }

      if (!phone) {
        alert('Vui lòng nhập số điện thoại để tài xế liên hệ!');
        customerPhone.focus();
        return;
      }

      // Populate Receipt Modal
      const randomID = '#VF' + Math.floor(1000 + Math.random() * 9000);
      document.getElementById('receipt-id').textContent = randomID;
      document.getElementById('receipt-name').textContent = name;
      document.getElementById('receipt-phone').textContent = phone;
      document.getElementById('receipt-car').textContent = `VinFast ${currentCar.model}`;
      document.getElementById('receipt-pickup').textContent = pickup;
      document.getElementById('receipt-dest').textContent = dest;

      const dateVal = dateInput.value;
      const timeVal = timeInput.value;
      document.getElementById('receipt-time').textContent = `${timeVal} - ${dateVal}`;

      document.getElementById('receipt-total').textContent = priceTotalEl.textContent;

      // Show Modal
      modal.style.display = 'flex';
    });
  }

  // Close Modal
  function closeModal() {
    modal.style.display = 'none';
  }

  if (btnModalClose) btnModalClose.addEventListener('click', closeModal);
  if (btnModalDone) btnModalDone.addEventListener('click', closeModal);

  // Initial Calculation Run
  updateDistance();
});

