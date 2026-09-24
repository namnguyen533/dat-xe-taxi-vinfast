import './style.css';
import { calculateTripFare } from './price-calculator.js';

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
  if (dateInput) dateInput.value = today.toISOString().split('T')[0];
  const hours = String(today.getHours()).padStart(2, '0');
  const minutes = String(today.getMinutes()).padStart(2, '0');
  if (timeInput) timeInput.value = `${hours}:${minutes}`;

  // Format currency helper
  function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
  }

  // ==========================================================================
  // XỬ LÝ NHẬP ĐIỂM ĐÓN & ĐIỂM ĐẾN BẰNG JAVASCRIPT (LOCATION INPUT LOGIC)
  // ==========================================================================

  // Danh sách địa điểm gợi ý phổ biến
  const popularLocations = [
    { title: "Sân bay Tân Sơn Nhất, TPHCM", icon: "✈️", zone: "Tân Bình" },
    { title: "Chợ Bến Thành, Quận 1, TPHCM", icon: "🏢", zone: "Quận 1" },
    { title: "Landmark 81, 720A Điện Biên Phủ, Bình Thạnh, TPHCM", icon: "🏙️", zone: "Bình Thạnh" },
    { title: "Bến xe Miền Đông mới, TP. Thủ Đức", icon: "🚌", zone: "Thủ Đức" },
    { title: "Sân bay Quốc tế Nội Bài, Hà Nội", icon: "✈️", zone: "Sóc Sơn" },
    { title: "Hồ Hoàn Kiếm, Quận Hoàn Kiếm, Hà Nội", icon: "🏞️", zone: "Hoàn Kiếm" },
    { title: "Crescent Mall, Quận 7, TPHCM", icon: "🛍️", zone: "Quận 7" },
    { title: "Thành phố Vũng Tàu, Bà Rịa - Vũng Tàu", icon: "🏖️", zone: "Tỉnh khác" }
  ];

  /**
   * Tạo menu gợi ý tự động (Autocomplete Dropdown) cho thẻ ô nhập liệu
   * @param {HTMLInputElement} inputEl Thẻ input cần áp dụng
   */
  function setupLocationAutocomplete(inputEl) {
    if (!inputEl) return;

    // Tạo phần tử danh sách gợi ý bên dưới ô input
    const parent = inputEl.parentElement;
    if (parent.style.position !== 'relative') {
      parent.style.position = 'relative';
    }

    const dropdown = document.createElement('ul');
    dropdown.className = 'location-autocomplete-list';
    dropdown.style.display = 'none';
    parent.appendChild(dropdown);

    // Hàm hiển thị danh sách lọc
    function renderSuggestions(filterText = '') {
      const keyword = filterText.toLowerCase().trim();
      const matches = popularLocations.filter(loc => 
        loc.title.toLowerCase().includes(keyword) || 
        loc.zone.toLowerCase().includes(keyword)
      );

      if (matches.length === 0) {
        dropdown.style.display = 'none';
        return;
      }

      dropdown.innerHTML = matches.map(loc => `
        <li class="autocomplete-item" data-value="${loc.title}">
          <span class="loc-icon">${loc.icon}</span>
          <div class="loc-info">
            <strong class="loc-title">${loc.title}</strong>
            <span class="loc-zone">${loc.zone}</span>
          </div>
        </li>
      `).join('');

      dropdown.style.display = 'block';

      // Lắng nghe sự kiện click vào từng địa điểm trong danh sách
      dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          inputEl.value = item.getAttribute('data-value');
          dropdown.style.display = 'none';
          updateDistance();
        });
      });
    }

    // Sự kiện khi người dùng gõ phím vào ô nhập liệu
    inputEl.addEventListener('input', () => {
      renderSuggestions(inputEl.value);
    });

    // Sự kiện khi bấm vào ô input (Focus)
    inputEl.addEventListener('focus', () => {
      renderSuggestions(inputEl.value);
    });

    // Ẩn menu khi click ra ngoài
    document.addEventListener('click', (e) => {
      if (!parent.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  // Khởi tạo tính năng gợi ý tự động cho Điểm đón và Điểm đến
  setupLocationAutocomplete(pickupInput);
  setupLocationAutocomplete(destInput);

  /**
   * Tính toán khoảng cách (Km) & thời gian dựa trên điểm đi và điểm đến
   */
  function updateDistance() {
    const pickupVal = pickupInput ? pickupInput.value.trim() : '';
    const destVal = destInput ? destInput.value.trim() : '';

    // Cảnh báo nếu điểm đón trùng điểm đến
    if (pickupVal && destVal && pickupVal.toLowerCase() === destVal.toLowerCase()) {
      if (summaryPickup) summaryPickup.textContent = pickupVal;
      if (summaryDest) summaryDest.textContent = destVal;
      if (metricDistance) metricDistance.textContent = '0 km (Trùng nhau)';
      if (metricDuration) metricDuration.textContent = '0 phút';
      distanceKm = 0;
      durationMin = 0;
      calculatePrice();
      return;
    }

    if (!pickupVal || !destVal) {
      distanceKm = 0;
      durationMin = 0;
    } else {
      // Giả lập khoảng cách linh hoạt từ 3.5 km tới 35 km
      const combined = (pickupVal + destVal).length;
      distanceKm = parseFloat(((combined % 25) + 4.2).toFixed(1));
      durationMin = Math.round(distanceKm * 2.1 + 4);
    }

    if (summaryPickup) summaryPickup.textContent = pickupVal || '---';
    if (summaryDest) summaryDest.textContent = destVal || '---';
    if (metricDistance) metricDistance.textContent = distanceKm > 0 ? `${distanceKm} km` : '---';
    if (metricDuration) metricDuration.textContent = durationMin > 0 ? `~${durationMin} phút` : '---';

    calculatePrice();
  }

  // Lắng nghe sự kiện thay đổi điểm đi & đến trực tiếp
  if (pickupInput) pickupInput.addEventListener('input', updateDistance);
  if (destInput) destInput.addEventListener('input', updateDistance);

  // Nút Đổi Điểm Đi & Điểm Đến (Swap Locations)
  if (btnSwap) {
    btnSwap.addEventListener('click', () => {
      if (!pickupInput || !destInput) return;

      // Xoay icon hiệu ứng 180 độ
      btnSwap.style.transform = 'rotate(180deg)';
      setTimeout(() => { btnSwap.style.transform = 'none'; }, 300);

      // Tráo đổi giá trị 2 ô input
      const temp = pickupInput.value;
      pickupInput.value = destInput.value;
      destInput.value = temp;

      // Cập nhật lại khoảng cách & giá cước
      updateDistance();
    });
  }

  // Nút Lấy vị trí hiện tại bằng Geolocation API (📍)
  if (btnGeo) {
    btnGeo.addEventListener('click', () => {
      btnGeo.textContent = '⌛';
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude.toFixed(4);
            const lng = pos.coords.longitude.toFixed(4);
            pickupInput.value = `Vị trí hiện tại của tôi (${lat}, ${lng})`;
            btnGeo.textContent = '📍';
            updateDistance();
          },
          (error) => {
            console.warn('Geolocation Error:', error);
            pickupInput.value = 'Chợ Bến Thành, Lê Lợi, Quận 1, TPHCM';
            btnGeo.textContent = '📍';
            updateDistance();
          }
        );
      } else {
        pickupInput.value = 'Chợ Bến Thành, Lê Lợi, Quận 1, TPHCM';
        btnGeo.textContent = '📍';
        updateDistance();
      }
    });
  }

  // Nút chọn gợi ý địa điểm nhanh (Quick Tags)
  quickTags.forEach(tag => {
    tag.addEventListener('click', () => {
      if (destInput) {
        destInput.value = tag.getAttribute('data-dest');
        updateDistance();
      }
    });
  });

  // ==========================================================================

  // Calculate Price Breakdown bằng Module mô phỏng giá cước
  function calculatePrice() {
    if (!priceBaseEl || !priceDistEl || !priceTotalEl) return;

    const timeVal = timeInput ? timeInput.value : '12:00';
    const couponVal = couponInput ? couponInput.value : '';

    // Gọi công cụ mô phỏng tính cước
    const result = calculateTripFare({
      distanceKm: distanceKm,
      basePrice: currentCar.basePrice,
      perKmPrice: currentCar.perKmPrice,
      serviceType: selectedService,
      pickupTime: timeVal,
      couponCode: couponVal
    });

    priceBaseEl.textContent = `${new Intl.NumberFormat('vi-VN').format(result.baseFare)} đ`;
    priceDistEl.textContent = `${new Intl.NumberFormat('vi-VN').format(result.distanceCost)} đ (${distanceKm} km)`;

    if (result.discount > 0 && rowDiscount) {
      rowDiscount.style.display = 'flex';
      if (priceDiscEl) priceDiscEl.textContent = `- ${new Intl.NumberFormat('vi-VN').format(result.discount)} đ`;
    } else if (rowDiscount) {
      rowDiscount.style.display = 'none';
    }

    priceTotalEl.textContent = result.formattedTotal;
  }

  // Select Car Card logic
  function handleSelectCarCard(cardElement) {
    if (!cardElement) return;

    vehicleCards.forEach(c => c.classList.remove('active'));
    cardElement.classList.add('active');

    const radio = cardElement.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;

    const model = cardElement.getAttribute('data-model');
    const base = parseInt(cardElement.getAttribute('data-base'), 10);
    const perKm = parseInt(cardElement.getAttribute('data-per-km'), 10);
    const seats = cardElement.getAttribute('data-seats');
    const imgEl = cardElement.querySelector('img');
    const img = imgEl ? imgEl.src : '';
    const typeTextEl = cardElement.querySelector('.vehicle-type');
    const typeText = typeTextEl ? typeTextEl.textContent : '';

    currentCar = {
      model,
      basePrice: base,
      perKmPrice: perKm,
      seats,
      type: typeText,
      img
    };

    if (summaryCarName) summaryCarName.textContent = `VinFast ${model}`;
    if (summaryCarType) summaryCarType.textContent = typeText;
    if (summaryCarImg && img) summaryCarImg.src = img;

    calculatePrice();
  }

  function selectCarByModel(modelName) {
    if (!modelName) return;
    const cleanModel = modelName.trim().toUpperCase();

    let targetCard = null;
    vehicleCards.forEach(card => {
      const cardModel = (card.getAttribute('data-model') || '').toUpperCase();
      if (cardModel === cleanModel || cleanModel.includes(cardModel)) {
        targetCard = card;
      }
    });

    if (targetCard) {
      handleSelectCarCard(targetCard);
    }
  }

  vehicleCards.forEach(card => {
    card.addEventListener('click', () => {
      handleSelectCarCard(card);
    });

    const radio = card.querySelector('input[type="radio"]');
    if (radio) {
      radio.addEventListener('change', () => {
        handleSelectCarCard(card);
      });
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  const requestedModel = urlParams.get('model') || urlParams.get('car');
  if (requestedModel) {
    selectCarByModel(requestedModel);
  }

  // Service tab switching
  serviceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      serviceTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedService = tab.getAttribute('data-service');
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
      const name = customerName ? customerName.value.trim() : '';
      const phone = customerPhone ? customerPhone.value.trim() : '';
      const pickup = pickupInput ? pickupInput.value.trim() : '';
      const dest = destInput ? destInput.value.trim() : '';

      if (!pickup || !dest) {
        alert('Vui lòng nhập đầy đủ điểm đón và điểm đến!');
        if (pickupInput) pickupInput.focus();
        return;
      }

      if (!name) {
        alert('Vui lòng nhập họ và tên của bạn!');
        if (customerName) customerName.focus();
        return;
      }

      if (!phone) {
        alert('Vui lòng nhập số điện thoại để tài xế liên hệ!');
        if (customerPhone) customerPhone.focus();
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

      const dateVal = dateInput ? dateInput.value : '';
      const timeVal = timeInput ? timeInput.value : '';
      document.getElementById('receipt-time').textContent = `${timeVal} - ${dateVal}`;

      document.getElementById('receipt-total').textContent = priceTotalEl.textContent;

      // Show Modal
      if (modal) modal.style.display = 'flex';
    });
  }

  // Close Modal
  function closeModal() {
    if (modal) modal.style.display = 'none';
  }

  if (btnModalClose) btnModalClose.addEventListener('click', closeModal);
  if (btnModalDone) btnModalDone.addEventListener('click', closeModal);

  // Initial Calculation Run
  updateDistance();
});
