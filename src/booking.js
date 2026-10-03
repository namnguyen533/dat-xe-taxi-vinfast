import './style.css';
import { calculateTripFare } from './price-calculator.js';
import { bookingStore, formatVND } from './data/booking-store.js';
import { getPricingConfig } from './data/pricing-store.js';
import { validateBookingForm } from './form-validation.js';
import { getDrivingRoute, resolveLocation, searchLocations } from './route-service.js';

document.addEventListener('DOMContentLoaded', () => {
  const authToken = sessionStorage.getItem('taxi-vinfast-auth-token') || localStorage.getItem('taxi-vinfast-auth-token');
  const userSession = JSON.parse(localStorage.getItem('taxi-current-user') || 'null');

  if (!authToken || !userSession) {
    const nextUrl = encodeURIComponent('booking.html');
    window.location.href = `dangnhap.html?next=${nextUrl}`;
    return;
  }

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
  const mapElement = document.getElementById('booking-map');
  const routeStatus = document.getElementById('route-status');

  const priceBaseEl = document.getElementById('price-base');
  const priceDistEl = document.getElementById('price-distance');
  const priceDiscEl = document.getElementById('price-discount');
  const rowDiscount = document.getElementById('row-discount');
  const priceTotalEl = document.getElementById('price-total');
  const priceRowDist = document.getElementById('price-row-distance');
  const priceRowSurcharge = document.getElementById('price-row-surcharge');
  const priceSurchargeEl = document.getElementById('price-surcharge');

  const couponInput = document.getElementById('coupon-code');
  const btnApplyCoupon = document.getElementById('btn-apply-coupon');
  const couponMsg = document.getElementById('coupon-message');

  const btnConfirm = document.getElementById('btn-confirm-booking');
  const formErrorSummary = document.getElementById('form-error-summary');

  // Modal elements
  const modal = document.getElementById('booking-success-modal');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnModalDone = document.getElementById('btn-modal-done');
  const receiptStatus = document.getElementById('receipt-status');

  // Ô nhập liệu + thông báo lỗi tương ứng
  const fieldInputs = {
    name: customerName,
    phone: customerPhone,
    pickup: pickupInput,
    destination: destInput,
    date: dateInput,
    time: timeInput,
    note: customerNote,
  };

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

  const customerPricing = getPricingConfig();
  vehicleCards.forEach((card) => {
    const model = card.getAttribute('data-model') || '';
    const rate = customerPricing.standardRates.find((item) =>
      item.modelName.toLocaleLowerCase('vi').includes(model.toLocaleLowerCase('vi')),
    );
    if (!rate) return;
    card.dataset.base = String(rate.baseFare);
    card.dataset.perKm = String(rate.rateUnder25km);
    const rateElement = card.querySelector('.vehicle-price-tag .price');
    if (rateElement) rateElement.textContent = `${new Intl.NumberFormat('vi-VN').format(rate.rateUnder25km)}đ`;
    if (card.classList.contains('active')) {
      currentCar.basePrice = rate.baseFare;
      currentCar.perKmPrice = rate.rateUnder25km;
    }
  });

  let distanceKm = 0;
  let durationMin = 0;
  let hasRoute = false;
  let routeRequestId = 0;
  let routeDebounce;
  let routeMap;
  let routeLine;
  let pickupMarker;
  let destinationMarker;
  let pickupLocation;
  let destinationLocation;
  /** Mã giảm giá đã áp dụng thành công ('' = không dùng) */
  let appliedCoupon = '';

  // Set default date & time
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayValue = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  if (dateInput) {
    dateInput.value = todayValue;
    dateInput.min = todayValue;
  }
  if (timeInput) timeInput.value = `${pad(today.getHours())}:${pad(today.getMinutes())}`;

  // Format currency helper
  const formatAmount = (amount) => formatVND(amount);

  // ==========================================================================
  // XỬ LÝ NHẬP ĐIỂM ĐÓN & ĐIỂM ĐẾN BẰNG JAVASCRIPT (LOCATION INPUT LOGIC)
  // ==========================================================================

  function setRouteStatus(message, state = '') {
    if (!routeStatus) return;
    routeStatus.textContent = message;
    routeStatus.dataset.state = state;
  }

  function clearDisplayedRoute() {
    routeLine?.remove();
    pickupMarker?.remove();
    destinationMarker?.remove();
    routeLine = null;
    pickupMarker = null;
    destinationMarker = null;
  }

  function initializeMap() {
    if (!mapElement || !globalThis.L) {
      setRouteStatus('Không tải được bản đồ. Vui lòng kiểm tra kết nối mạng và tải lại trang.', 'error');
      return;
    }
    routeMap = globalThis.L.map(mapElement).setView([10.7769, 106.7009], 12);
    globalThis.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(routeMap);
  }

  initializeMap();

  function renderSuggestions(dropdown, inputEl, locations) {
    dropdown.replaceChildren();
    locations.forEach((location) => {
      const item = document.createElement('li');
      item.className = 'autocomplete-item';
      item.textContent = location.label;
      item.addEventListener('click', () => {
        inputEl.value = location.label;
        dropdown.style.display = 'none';
        if (inputEl === pickupInput) pickupLocation = location;
        else destinationLocation = location;
        updateDistance();
      });
      dropdown.appendChild(item);
    });
    dropdown.style.display = locations.length ? 'block' : 'none';
  }

  function setupLocationAutocomplete(inputEl) {
    if (!inputEl) return;
    const parent = inputEl.parentElement;
    const dropdown = document.createElement('ul');
    dropdown.className = 'location-autocomplete-list';
    dropdown.style.display = 'none';
    parent.appendChild(dropdown);

    let searchTimer;
    let searchRequestId = 0;
    inputEl.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const query = inputEl.value.trim();
      const currentRequestId = ++searchRequestId;
      dropdown.style.display = 'none';
      searchTimer = setTimeout(async () => {
        if (query.length < 3) return;
        try {
          const locations = await searchLocations(query);
          if (currentRequestId === searchRequestId && inputEl.value.trim() === query) {
            renderSuggestions(dropdown, inputEl, locations);
          }
        } catch (error) {
          if (currentRequestId === searchRequestId) setRouteStatus(error.message, 'error');
        }
      }, 650);
    });
    inputEl.addEventListener('focus', () => {
      if (dropdown.childElementCount) dropdown.style.display = 'block';
    });
    inputEl.addEventListener('blur', () => {
      setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    });
    document.addEventListener('click', (event) => {
      if (!parent.contains(event.target)) dropdown.style.display = 'none';
    });
  }

  setupLocationAutocomplete(pickupInput);
  setupLocationAutocomplete(destInput);

  async function updateDistance() {
    const requestId = ++routeRequestId;
    clearDisplayedRoute();
    const pickupVal = pickupInput ? pickupInput.value.trim() : '';
    const destVal = destInput ? destInput.value.trim() : '';
    hasRoute = false;
    distanceKm = 0;
    durationMin = 0;
    if (summaryPickup) summaryPickup.textContent = pickupVal || '---';
    if (summaryDest) summaryDest.textContent = destVal || '---';
    if (metricDistance) metricDistance.textContent = 'Đang tính...';
    if (metricDuration) metricDuration.textContent = 'Đang tính...';
    setRouteStatus('Đang tìm địa chỉ và tính tuyến đường ô tô thực tế...');
    calculatePrice();

    if (!pickupVal || !destVal) {
      setRouteStatus('Nhập điểm đón và điểm đến để xem tuyến đường.');
      return;
    }
    if (pickupVal.toLocaleLowerCase('vi') === destVal.toLocaleLowerCase('vi')) {
      if (metricDistance) metricDistance.textContent = '---';
      if (metricDuration) metricDuration.textContent = '---';
      setRouteStatus('Điểm đón và điểm đến không được trùng nhau.', 'error');
      return;
    }

    try {
      const [pickup, destination] = await Promise.all([
        pickupLocation?.label === pickupVal ? pickupLocation : resolveLocation(pickupVal),
        destinationLocation?.label === destVal ? destinationLocation : resolveLocation(destVal),
      ]);
      if (requestId !== routeRequestId) return;
      pickupLocation = pickup;
      destinationLocation = destination;
      const route = await getDrivingRoute(pickup, destination);
      if (requestId !== routeRequestId) return;

      distanceKm = route.distanceKm;
      durationMin = route.durationMin;
      hasRoute = true;
      if (metricDistance) metricDistance.textContent = `${distanceKm.toFixed(1)} km`;
      if (metricDuration) metricDuration.textContent = `~${durationMin} phút`;
      if (routeMap) {
        if (routeLine) routeLine.remove();
        if (pickupMarker) pickupMarker.remove();
        if (destinationMarker) destinationMarker.remove();
        pickupMarker = globalThis.L.marker([pickup.lat, pickup.lng]).addTo(routeMap).bindPopup('Điểm đón');
        destinationMarker = globalThis.L.marker([destination.lat, destination.lng]).addTo(routeMap).bindPopup('Điểm đến');
        routeLine = globalThis.L.polyline(route.coordinates, { color: '#ff6b35', weight: 5 }).addTo(routeMap);
        routeMap.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
      }
      setRouteStatus(`Tuyến đường ô tô: ${distanceKm.toFixed(1)} km · khoảng ${durationMin} phút.`, 'success');
      calculatePrice();
    } catch (error) {
      if (requestId !== routeRequestId) return;
      hasRoute = false;
      distanceKm = 0;
      durationMin = 0;
      pickupLocation = null;
      destinationLocation = null;
      clearDisplayedRoute();
      if (metricDistance) metricDistance.textContent = 'Chưa có tuyến';
      if (metricDuration) metricDuration.textContent = '---';
      setRouteStatus(error.message || 'Không thể tính tuyến đường. Vui lòng thử lại.', 'error');
      calculatePrice();
    }
  }

  [pickupInput, destInput].forEach((input) => {
    input?.addEventListener('input', () => {
      if (input === pickupInput) pickupLocation = null;
      else destinationLocation = null;
      routeRequestId += 1;
      hasRoute = false;
      distanceKm = 0;
      durationMin = 0;
      clearDisplayedRoute();
      setRouteStatus('Đang cập nhật địa điểm và tính lại tuyến đường...');
      calculatePrice();
      clearTimeout(routeDebounce);
      routeDebounce = setTimeout(updateDistance, 1200);
    });
  });

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
      [pickupLocation, destinationLocation] = [destinationLocation, pickupLocation];

      // Cập nhật lại khoảng cách & giá cước
      updateDistance();
    });
  }

  // Nút lấy vị trí hiện tại bằng Geolocation API
  if (btnGeo) {
    btnGeo.addEventListener('click', () => {
      btnGeo.textContent = '⌛';
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            pickupInput.value = `${lat}, ${lng}`;
            pickupLocation = { label: pickupInput.value, lat, lng };
            btnGeo.textContent = '📍';
            updateDistance();
          },
          (error) => {
            console.warn('Geolocation Error:', error);
            btnGeo.textContent = '📍';
            setRouteStatus(`Không lấy được vị trí: ${error.message}`, 'error');
          }
        );
      } else {
        btnGeo.textContent = '📍';
        setRouteStatus('Trình duyệt này không hỗ trợ định vị.', 'error');
      }
    });
  }

  // Nút chọn gợi ý địa điểm nhanh (Quick Tags)
  quickTags.forEach(tag => {
    tag.addEventListener('click', () => {
      if (destInput) {
        destInput.value = tag.getAttribute('data-dest');
        destinationLocation = null;
        updateDistance();
      }
    });
  });

  // ==========================================================================

  // ==========================================================================
  // Tính & lưu kết quả cước phí hiện tại
  // ==========================================================================
  let lastFareResult = calculateTripFare({ distanceKm: 0 });

  function calculatePrice() {
    if (!priceBaseEl || !priceDistEl || !priceTotalEl) return;

    const timeVal = timeInput ? timeInput.value : '12:00';

    // Gọi công cụ mô phỏng tính cước
    const result = calculateTripFare({
      distanceKm: distanceKm,
      basePrice: currentCar.basePrice,
      perKmPrice: currentCar.perKmPrice,
      serviceType: selectedService,
      pickupTime: timeVal,
      pickupDate: dateInput?.value || '',
      couponCode: appliedCoupon,
      vehicleModel: currentCar.model,
    });
    lastFareResult = result;

    if (priceRowDist) {
      priceRowDist.textContent = hasRoute
        ? `Cước quãng đường (${distanceKm.toFixed(1)} km):`
        : 'Cước quãng đường (chưa xác định):';
    }
    if (!hasRoute) {
      priceBaseEl.textContent = '—';
      priceDistEl.textContent = '—';
      if (rowDiscount) rowDiscount.style.display = 'none';
      if (priceRowSurcharge) priceRowSurcharge.style.display = 'none';
      priceTotalEl.textContent = '—';
      return;
    }

    priceBaseEl.textContent = formatAmount(result.baseFare);
    priceDistEl.textContent = formatAmount(result.distanceCost);

    if (result.discount > 0 && rowDiscount) {
      rowDiscount.style.display = 'flex';
      if (priceDiscEl) priceDiscEl.textContent = `- ${formatAmount(result.discount)}`;
    } else if (rowDiscount) {
      rowDiscount.style.display = 'none';
    }

    // Phụ phí dịch vụ / đêm (thay cho dòng "Miễn phí" cố định)
    const surcharge = (result.nightSurcharge || 0) + (result.peakSurcharge || 0) + (result.rainSurcharge || 0) + (result.holidaySurcharge || 0) + (result.serviceFee || 0);
    if (priceRowSurcharge) priceRowSurcharge.style.display = surcharge > 0 ? 'flex' : 'none';
    if (priceSurchargeEl) priceSurchargeEl.textContent = `+ ${formatAmount(surcharge)}`;

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
        appliedCoupon = '';
        couponMsg.textContent = 'Vui lòng nhập mã giảm giá!';
        couponMsg.className = 'coupon-msg error';
        calculatePrice();
        return;
      }

      const promotion = getPricingConfig().promotions.find(
        (item) => item.code.toUpperCase() === code && item.active !== false,
      );
      if (promotion) {
        appliedCoupon = code;
        couponMsg.textContent = `✓ Đã áp dụng mã ${code} (${promotion.description})`;
        couponMsg.className = 'coupon-msg success';
      } else {
        appliedCoupon = '';
        couponMsg.textContent = 'Mã giảm giá không hợp lệ hoặc đã hết hạn.';
        couponMsg.className = 'coupon-msg error';
      }
      calculatePrice();
    });
  }

  // ==========================================================================
  // HIỂN THỊ / XÓA THÔNG BÁO LỖI CỦA FORM
  // ==========================================================================
  function showErrors(errors = {}) {
    Object.entries(fieldInputs).forEach(([field, input]) => {
      const errorEl = document.getElementById(`error-${field}`);
      const message = errors[field] || '';
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = message ? 'block' : 'none';
      }
      if (input) input.classList.toggle('invalid', Boolean(message));
    });

    if (formErrorSummary) {
      const list = Object.values(errors);
      formErrorSummary.textContent = list.length ? `Vui lòng kiểm tra lại ${list.length} thông tin còn thiếu hoặc chưa đúng.` : '';
      formErrorSummary.style.display = list.length ? 'block' : 'none';
    }
  }

  function focusFirstError(errors = {}) {
    const firstField = Object.keys(fieldInputs).find((field) => errors[field]);
    if (firstField && fieldInputs[firstField]) fieldInputs[firstField].focus();
  }

  // Gỡ cảnh báo của một trường khi người dùng sửa lại dữ liệu
  Object.entries(fieldInputs).forEach(([field, input]) => {
    input?.addEventListener('input', () => {
      const errorEl = document.getElementById(`error-${field}`);
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
      }
      input.classList.remove('invalid');

      const remaining = validateBookingForm(readFormData()).errors;
      if (formErrorSummary) {
        formErrorSummary.textContent = Object.keys(remaining).length
          ? `Vui lòng kiểm tra lại ${Object.keys(remaining).length} thông tin còn thiếu hoặc chưa đúng.`
          : '';
        formErrorSummary.style.display = Object.keys(remaining).length ? 'block' : 'none';
      }
    });
  });

  function readFormData() {
    return {
      name: customerName ? customerName.value : '',
      phone: customerPhone ? customerPhone.value : '',
      pickup: pickupInput ? pickupInput.value : '',
      destination: destInput ? destInput.value : '',
      date: dateInput ? dateInput.value : '',
      time: timeInput ? timeInput.value : '',
      note: customerNote ? customerNote.value : '',
    };
  }

  /** Tài xế được hệ thống điều ngẫu nhiên (mô phỏng) */
  const demoDrivers = [
    { name: 'Trần Thanh Sơn', phone: '0903 112 233', rating: 4.9 },
    { name: 'Lê Hoàng Nam', phone: '0977 445 566', rating: 5.0 },
    { name: 'Đặng Văn Hùng', phone: '0918 887 766', rating: 4.8 },
    { name: 'Nguyễn Hoàng Đức', phone: '0933 665 544', rating: 5.0 },
    { name: 'Phạm Quốc Huy', phone: '0908 334 455', rating: 4.7 },
  ];

  // Submit: kiểm tra dữ liệu rồi lưu đơn vào LocalStorage (mục 37 & 38)
  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      const { valid, errors, values } = validateBookingForm(readFormData());
      showErrors(errors);

      if (!valid) {
        focusFirstError(errors);
        return;
      }
      if (!hasRoute) {
        const message = 'Vui lòng chờ bản đồ xác định được tuyến đường thực tế trước khi đặt xe.';
        if (formErrorSummary) {
          formErrorSummary.textContent = message;
          formErrorSummary.style.display = 'block';
        }
        setRouteStatus(message, 'error');
        return;
      }

      const driver = demoDrivers[Math.floor(Math.random() * demoDrivers.length)];

      const savedBooking = bookingStore.add({
        customer: { name: values.name, phone: values.phone },
        serviceType: selectedService,
        vehicle: {
          model: `VinFast ${currentCar.model}`,
          seats: Number(currentCar.seats) || 4,
          licensePlate: `${randPlatePrefix()}-${Math.floor(100 + Math.random() * 900)}.${Math.floor(10 + Math.random() * 89)}`,
        },
        driver,
        route: {
          pickupLocation: values.pickup,
          destinationLocation: values.destination,
          distanceKm,
          estimatedDurationMin: durationMin,
          pickupCoordinates: pickupLocation ? [pickupLocation.lat, pickupLocation.lng] : null,
          destinationCoordinates: destinationLocation ? [destinationLocation.lat, destinationLocation.lng] : null,
        },
        schedule: {
          pickupDate: values.date,
          pickupTime: values.time,
        },
        fare: {
          basePrice: lastFareResult.baseFare,
          distanceCost: lastFareResult.distanceCost,
          discountCode: appliedCoupon || null,
          discountAmount: lastFareResult.discount,
          totalAmount: lastFareResult.totalFare,
          currency: 'VND',
        },
        payment: {
          method: document.querySelector('input[name="payment_method"]:checked')?.value || 'cash',
          status: 'pending',
        },
        status: 'pending',
        note: values.note || '',
      });

      // Populate Receipt Modal
      document.getElementById('receipt-id').textContent = savedBooking.bookingId;
      document.getElementById('receipt-name').textContent = savedBooking.customer.name;
      document.getElementById('receipt-phone').textContent = savedBooking.customer.phone;
      document.getElementById('receipt-car').textContent = savedBooking.vehicle.model;
      document.getElementById('receipt-pickup').textContent = savedBooking.route.pickupLocation;
      document.getElementById('receipt-dest').textContent = savedBooking.route.destinationLocation;
      document.getElementById('receipt-time').textContent = `${savedBooking.schedule.pickupTime} - ${savedBooking.schedule.pickupDate}`;
      document.getElementById('receipt-total').textContent = formatVND(savedBooking.fare.totalAmount);
      if (receiptStatus) receiptStatus.textContent = savedBooking.statusText;

      // Show Modal
      if (modal) modal.style.display = 'flex';
    });
  }

  function randPlatePrefix() {
    const provinces = ['51H', '51K', '51L', '30H', '60A', '29B'];
    return provinces[Math.floor(Math.random() * provinces.length)];
  }

  // Close Modal
  function closeModal() {
    if (modal) modal.style.display = 'none';
  }

  if (btnModalClose) btnModalClose.addEventListener('click', closeModal);
  if (btnModalDone) btnModalDone.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  // Initial Calculation Run
  updateDistance();
});
