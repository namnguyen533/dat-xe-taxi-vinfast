import {
  clearAuthSession,
  hasAuthSession,
  AUTH_USER_KEY,
  isDriverUser,
} from './auth-client.js';
import { bookingStore, formatDateTime, formatVND, paymentMethodLabel, serviceTypeLabel, statusMeta } from './data/booking-store.js';
import { getAdminOperations } from './data/admin-operations.js';
import {
  getDriverEarnings,
  getDriverSettings,
  getDriverWallet,
  saveDriverSettings,
  saveDriverWallet,
} from './driver-data.js';

function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
    return user && typeof user === 'object' ? user : null;
  } catch {
    return null;
  }
}

if (!hasAuthSession()) {
  window.location.replace('driver-login.html');
} else if (!isDriverUser(getCurrentUser())) {
  window.location.replace('driver-login.html?error=driver-only');
} else {
  initializeDriverPage();
}

function initializeDriverPage() {
  const user = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || '{}');
  const email = typeof user.email === 'string' ? user.email : '';
  const profile = getDriverSettings(localStorage, email, {
    fullName: user.name || 'Tài xế',
    phone: user.phone || '',
  });
  const skippedOffers = new Set();
  let knownOfferIds = new Set();
  let driverMap;
  let driverMarker;
  let noticeTimer;

  const notice = document.getElementById('driver-notice');
  const driverName = () => profile.fullName.trim() || 'Tài xế';
  const allBookings = () => bookingStore.getAll();
  const assignedBookings = () => allBookings().filter((booking) => booking.driver?.name === driverName());
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const bookingNet = (booking) => {
    const fare = Number(booking.fare?.totalAmount) || 0;
    return fare - Math.round(fare * 0.2);
  };
  const withdrawableEarnings = () => assignedBookings()
    .filter((booking) => (
      booking.status === 'completed'
      && booking.payment?.status === 'paid'
      && booking.payment?.method !== 'cash'
    ))
    .reduce((total, booking) => total + bookingNet(booking), 0)
    - (getAdminOperations(localStorage).drivers.find((driver) => driver.name === driverName())?.paidOut || 0);
  const bookedAt = (booking) => booking.updatedAt || booking.schedule?.createdDate || '';
  const isSameDay = (booking, date = new Date()) => {
    const value = bookedAt(booking);
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime())
      && parsed.getFullYear() === date.getFullYear()
      && parsed.getMonth() === date.getMonth()
      && parsed.getDate() === date.getDate();
  };
  const isThisWeek = (booking, date = new Date()) => {
    const value = bookedAt(booking);
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return false;
    const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
    return parsed >= weekStart && parsed <= date;
  };
  const isThisMonth = (booking, date = new Date()) => {
    const value = bookedAt(booking);
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime())
      && parsed.getFullYear() === date.getFullYear()
      && parsed.getMonth() === date.getMonth();
  };
  const dateLabel = (booking) => `${escape(booking.schedule?.pickupDate || '—')} ${escape(booking.schedule?.pickupTime || '')}`;
  const routeText = (booking) => `${escape(booking.route?.pickupLocation || 'Chưa có điểm đón')} → ${escape(booking.route?.destinationLocation || 'Chưa có điểm đến')}`;
  const statusLabel = (booking) => statusMeta(booking.status).text;
  const paymentStatusLabel = (booking) => booking.payment?.status === 'paid'
    ? 'Đã thanh toán'
    : booking.payment?.status === 'refunded' ? 'Đã hoàn tiền' : 'Chờ xác nhận';

  function showNotice(message, type = 'success') {
    clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.className = `driver-notice is-${type}`;
    notice.hidden = false;
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 5000);
  }

  function getOffers() {
    return allBookings().filter((booking) => (
      booking.status === 'pending'
      && !booking.driver?.name
      && !skippedOffers.has(booking.bookingId)
    ));
  }

  function rideCard(booking, isOffer = false) {
    const route = booking.route || {};
    const fare = Number(booking.fare?.totalAmount) || 0;
    const isCash = booking.payment?.method === 'cash';
    const flowStage = booking.driver?.stage || 'accepted';
    const destination = booking.status === 'in_progress';
    const actionButtons = isOffer
      ? `<div class="driver-ride-actions"><button class="driver-secondary-button" type="button" data-action="skip" data-id="${escape(booking.bookingId)}">Bỏ qua</button><button class="driver-primary-button" type="button" data-action="accept" data-id="${escape(booking.bookingId)}">Nhận chuyến</button></div>`
      : booking.status === 'pending'
        ? `<div class="driver-ride-actions"><button class="driver-primary-button" type="button" data-action="accept" data-id="${escape(booking.bookingId)}">Xác nhận nhận chuyến</button></div>`
        : booking.status === 'confirmed'
          ? `<div class="driver-ride-actions">
              ${flowStage === 'arrived'
                ? `<span class="driver-inline-status">✓ Đã đến điểm đón · <span class="driver-waiting-time" data-waiting-from="${Date.parse(booking.driver.arrivedAt || Date.now())}">Chờ ${Math.max(0, Math.floor((Date.now() - new Date(booking.driver.arrivedAt || Date.now()).getTime()) / 60_000))} phút</span> · phí chờ theo điều phối</span><button class="driver-primary-button" type="button" data-action="start" data-id="${escape(booking.bookingId)}">Bắt đầu chuyến</button>`
                : `<button class="driver-primary-button" type="button" data-action="arrive" data-id="${escape(booking.bookingId)}">Đã đến điểm đón</button>`}
              <button class="driver-secondary-button" type="button" data-action="cancel" data-id="${escape(booking.bookingId)}">Hủy chuyến</button>
            </div>`
          : booking.status === 'in_progress'
            ? `<div class="driver-cash-check">${isCash
                ? `<label><input type="checkbox" data-action="cash-received" data-id="${escape(booking.bookingId)}"${booking.payment?.status === 'paid' ? ' checked disabled' : ''} /> Tôi xác nhận đã nhận ${formatVND(fare)} tiền mặt</label>`
                : `<span>Thanh toán ${escape(paymentMethodLabel(booking.payment?.method))} · ${escape(paymentStatusLabel(booking))}</span>`}
              </div><div class="driver-ride-actions"><button class="driver-primary-button" type="button" data-action="complete" data-id="${escape(booking.bookingId)}"${isCash && booking.payment?.status !== 'paid' ? ' disabled' : ''}>Kết thúc chuyến</button><button class="driver-sos-inline" type="button" data-action="sos" data-id="${escape(booking.bookingId)}">SOS / Hỗ trợ</button></div>`
            : `<div class="driver-ride-actions"><span class="driver-inline-status">✓ ${escape(statusLabel(booking))}</span></div>`;

    return `<article class="driver-ride-card${isOffer ? ' is-offer' : ''}">
      <div class="driver-ride-top"><span class="driver-booking-id">${escape(booking.bookingId)}</span><span class="driver-status-chip status-${escape(booking.status)}">${escape(statusLabel(booking))}</span></div>
      <div class="driver-route-lines"><div><i class="route-dot pickup"></i><span><small>ĐÓN KHÁCH · ${dateLabel(booking)}</small><strong>${escape(route.pickupLocation || 'Chưa có điểm đón')}</strong></span></div><div><i class="route-dot destination"></i><span><small>ĐIỂM ĐẾN</small><strong>${escape(route.destinationLocation || 'Chưa có điểm đến')}</strong></span></div></div>
      <div class="driver-ride-meta"><span>📏 ${Number(route.distanceKm) || 0} km · ~${Number(route.estimatedDurationMin) || 0} phút</span><span>${escape(serviceTypeLabel(booking.serviceType))} · ${escape(booking.vehicle?.model || 'Xe điện')} ${Number(booking.vehicle?.seats) || '—'} chỗ</span></div>
      <div class="driver-customer-row"><div><strong>${escape(booking.customer?.name || 'Khách hàng')}</strong><span>${escape(booking.customer?.phone || 'Chưa có số điện thoại')}</span></div><span class="driver-payment-method">${escape(paymentMethodLabel(booking.payment?.method))}</span></div>
      ${booking.note ? `<p class="driver-ride-note">Ghi chú: ${escape(booking.note)}</p>` : ''}
      <div class="driver-ride-fare"><span>${isOffer ? 'Thu nhập ước tính · phí demo 20%' : 'Cước chuyến'}<strong>${formatVND(fare)}</strong></span><span>${isOffer ? 'Dự kiến thực nhận' : escape(paymentStatusLabel(booking))}<strong>${formatVND(bookingNet(booking))}</strong></span></div>
      ${booking.customer?.phone ? `<div class="driver-contact-links"><a href="tel:${escape(booking.customer.phone.replace(/[^\d+]/g, ''))}">☎ Gọi khách</a><a href="sms:${escape(booking.customer.phone.replace(/[^\d+]/g, ''))}">✉ Nhắn tin</a><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination ? route.destinationLocation || '' : route.pickupLocation || '')}">↗ ${destination ? 'Dẫn đường đến điểm trả' : 'Dẫn đường đón khách'}</a></div>` : ''}
      ${actionButtons}
    </article>`;
  }

  function renderOffers() {
    const offers = getOffers();
    const html = offers.length
      ? offers.map((booking) => rideCard(booking, true)).join('')
      : '<div class="driver-empty-state"><span>✓</span><strong>Chưa có chuyến mới</strong><p>Đơn khách vừa đặt sẽ xuất hiện tại đây để bạn nhận chuyến.</p></div>';
    document.getElementById('driver-offers').innerHTML = html;
    document.getElementById('driver-home-offers').innerHTML = offers.slice(0, 2).map((booking) => rideCard(booking, true)).join('')
      || '<div class="driver-empty-state compact"><strong>Chưa có chuyến mới</strong><p>Hãy bật nhận chuyến để sẵn sàng đón yêu cầu.</p></div>';
    document.getElementById('driver-ride-count').textContent = String(offers.length);
    knownOfferIds = new Set(offers.map((booking) => booking.bookingId));
  }

  function renderActiveRides() {
    const active = assignedBookings().filter((booking) => ['pending', 'confirmed', 'in_progress'].includes(booking.status));
    document.getElementById('driver-active-count').textContent = `${active.length} chuyến`;
    document.getElementById('driver-active-rides').innerHTML = active.map((booking) => rideCard(booking)).join('')
      || '<div class="driver-empty-state"><span>⌁</span><strong>Bạn chưa có chuyến đang phục vụ</strong><p>Nhận chuyến mới để bắt đầu.</p></div>';
    const current = active.find((booking) => ['confirmed', 'in_progress'].includes(booking.status));
    document.getElementById('driver-current-trip').innerHTML = current
      ? `<div class="driver-current-trip-heading"><span class="driver-eyebrow">CHUYẾN ĐANG PHỤC VỤ</span><span class="driver-status-chip status-${escape(current.status)}">${escape(statusLabel(current))}</span></div><strong>${escape(current.customer?.name || 'Khách hàng')}</strong><p>${routeText(current)}</p><button type="button" class="driver-inline-link" data-open-tab="rides">Mở chi tiết chuyến →</button>`
      : '<div class="driver-current-trip-empty"><span class="driver-eyebrow">CHUYẾN ĐANG PHỤC VỤ</span><strong>Chưa có chuyến</strong><p>Chuyến được nhận sẽ hiển thị tại đây.</p></div>';
  }

  function renderHistory() {
    const filter = document.getElementById('driver-history-filter').value;
    const completed = assignedBookings()
      .filter((booking) => ['completed', 'cancelled'].includes(booking.status))
      .filter((booking) => filter === 'month' ? isThisMonth(booking) : filter === 'week' ? isThisWeek(booking) : true)
      .sort((a, b) => new Date(bookedAt(b)) - new Date(bookedAt(a)));
    document.getElementById('driver-history-count').textContent = `${completed.length} chuyến`;
    document.getElementById('driver-history').innerHTML = completed.length
      ? completed.map((booking) => {
        const ratings = JSON.parse(localStorage.getItem('taxivinfast_driver_customer_ratings') || '{}');
        const rating = ratings[email]?.[booking.bookingId];
        return `<tr><td><strong>${escape(booking.bookingId)}</strong><span class="driver-history-status status-${escape(booking.status)}">${escape(statusLabel(booking))}</span></td><td>${formatDateTime(bookedAt(booking))}</td><td><span class="driver-history-route">${escape(booking.route?.pickupLocation || '—')}</span><span class="driver-history-route">→ ${escape(booking.route?.destinationLocation || '—')}</span></td><td>${formatVND(booking.fare?.totalAmount)}</td><td>${booking.status === 'completed' ? formatVND(bookingNet(booking)) : '—'}</td><td>${escape(paymentMethodLabel(booking.payment?.method))}<span class="driver-history-status">${escape(paymentStatusLabel(booking))}</span></td><td>${booking.status === 'completed' && !rating ? `<button class="driver-complaint-button" type="button" data-action="rate" data-id="${escape(booking.bookingId)}">Đánh giá khách</button>` : rating ? `<span class="driver-history-status">Đã đánh giá ${rating} ★</span>` : ''}<button class="driver-complaint-button" type="button" data-action="complaint" data-id="${escape(booking.bookingId)}">Khiếu nại</button></td></tr>`;
      }).join('')
      : '<tr><td colspan="7" class="driver-table-empty">Chưa có chuyến trong khoảng thời gian này.</td></tr>';
  }

  function renderIncome() {
    const completed = assignedBookings().filter((booking) => booking.status === 'completed');
    const totals = getDriverEarnings(allBookings(), driverName());
    const cashCollected = assignedBookings()
      .filter((booking) => (
        booking.payment?.method === 'cash'
        && booking.payment?.status === 'paid'
        && booking.payment?.receivedBy === 'driver'
      ))
      .reduce((total, booking) => total + (Number(booking.fare?.totalAmount) || 0), 0);
    const today = completed.filter((booking) => isSameDay(booking));
    const week = completed.filter((booking) => isThisWeek(booking));
    const month = completed.filter((booking) => isThisMonth(booking));
    const sum = (trips) => trips.reduce((total, booking) => total + bookingNet(booking), 0);
    const wallet = getDriverWallet(localStorage, email);
    const driverPayouts = getAdminOperations(localStorage).drivers.find((driver) => driver.name === driverName())?.payouts || [];
    const withdrawals = wallet.withdrawals.filter((item) => item.status === 'pending' || item.status === 'approved');
    const reserved = withdrawals.reduce((total, item) => total + item.amount, 0);
    const pendingSettlement = completed
      .filter((booking) => booking.payment?.method !== 'cash' && booking.payment?.status !== 'paid')
      .reduce((total, booking) => total + bookingNet(booking), 0);
    document.getElementById('driver-income-month').textContent = formatVND(sum(month));
    document.getElementById('driver-month-trips').textContent = `${month.length} chuyến`;
    document.getElementById('driver-income-today').textContent = formatVND(sum(today));
    document.getElementById('driver-today-trip-label').textContent = `${today.length} chuyến hoàn thành`;
    document.getElementById('driver-income-week').textContent = formatVND(sum(week));
    document.getElementById('driver-week-trip-label').textContent = `${week.length} chuyến hoàn thành`;
    document.getElementById('driver-wallet-available').textContent = formatVND(Math.max(0, withdrawableEarnings() - reserved));
    document.getElementById('driver-cash-collected').textContent = formatVND(cashCollected);
    document.getElementById('driver-wallet-pending').textContent = formatVND(pendingSettlement);
    document.getElementById('driver-performance-trips').textContent = String(totals.trips);
    document.getElementById('driver-performance-rating').textContent = `${Number(profile.rating).toFixed(1)} ★`;
    document.getElementById('driver-performance-fees').textContent = formatVND(totals.fees);
    document.getElementById('driver-transactions').innerHTML = [
      ...completed.map((booking) => ({
        date: booking.payment?.receivedAt || bookedAt(booking),
        title: `Thu nhập chuyến ${booking.bookingId}`,
        detail: `Phí nền tảng ${formatVND(Math.round((Number(booking.fare?.totalAmount) || 0) * 0.2))} · ${paymentStatusLabel(booking)}`,
        amount: bookingNet(booking),
      })),
      ...wallet.withdrawals.map((item) => ({
        date: item.createdAt,
        title: `Yêu cầu rút tiền · ${item.status === 'pending' ? 'Chờ xử lý' : item.status === 'rejected' ? 'Từ chối' : 'Đã xử lý'}`,
        detail: `${item.bankName} · ${item.bankAccount}`,
        amount: -item.amount,
      })),
      ...driverPayouts.map((item) => ({
        date: item.createdAt,
        title: 'Nền tảng đã chi trả',
        detail: `Đã ghi nhận chi trả ${formatVND(item.amount)}`,
        amount: item.amount,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).map((item) => `<div class="driver-transaction"><span class="driver-transaction-icon">${item.amount < 0 ? '↗' : '₫'}</span><span><strong>${escape(item.title)}</strong><small>${escape(item.detail)} · ${formatDateTime(item.date)}</small></span><b class="${item.amount < 0 ? 'is-debit' : ''}">${item.amount > 0 ? '+' : ''}${formatVND(item.amount)}</b></div>`).join('')
      || '<div class="driver-empty-state compact"><strong>Chưa có giao dịch</strong><p>Thu nhập từ chuyến hoàn thành sẽ hiển thị tại đây.</p></div>';
    document.getElementById('driver-today-income').textContent = formatVND(sum(today));
    document.getElementById('driver-today-trips').textContent = String(today.length);
  }

  function renderProfile() {
    const form = document.getElementById('driver-profile-form');
    for (const [name, value] of Object.entries(profile)) {
      const field = form.elements.namedItem(name);
      if (!field) continue;
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else field.value = value;
    }
    form.elements.email.value = email;
    document.getElementById('driver-header-name').textContent = driverName();
    document.getElementById('driver-greeting').textContent = `Chào ${driverName()}!`;
    document.getElementById('driver-profile-display-name').textContent = driverName();
    document.getElementById('driver-profile-display-phone').textContent = profile.phone || 'Chưa cập nhật số điện thoại';
    document.getElementById('driver-profile-rating').textContent = `${Number(profile.rating).toFixed(1)} ★ Đánh giá demo`;
    document.getElementById('driver-avatar').textContent = driverName().split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase();
    document.getElementById('driver-vehicle-model').textContent = profile.vehicle;
    document.getElementById('driver-vehicle-plate').textContent = `${profile.plate} · Dịch vụ xe điện`;
  }

  function renderOnlineState() {
    const online = localStorage.getItem('taxivinfast_driver_online') === 'true';
    const toggle = document.getElementById('driver-online-toggle');
    toggle.classList.toggle('is-online', online);
    toggle.setAttribute('aria-pressed', String(online));
    document.getElementById('driver-online-text').textContent = online ? 'Đang nhận chuyến' : 'Bật nhận chuyến';
  }

  function renderAll() {
    renderProfile();
    renderOnlineState();
    renderOffers();
    renderActiveRides();
    renderHistory();
    renderIncome();
    renderNetworkState();
  }

  function notifyIncomingOffers(previousOfferIds) {
    const incoming = getOffers().filter((booking) => !previousOfferIds.has(booking.bookingId));
    if (!incoming.length || !profile.notifications) return;
    showNotice(`Bạn có ${incoming.length} chuyến mới đang chờ nhận.`);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('TaxiVinFast · Có chuyến mới', {
        body: `${incoming.length} yêu cầu mới đang chờ tài xế phản hồi.`,
      });
    }
    if (profile.sound && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 740;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.16);
      oscillator.addEventListener('ended', () => context.close());
    }
  }

  function renderNetworkState() {
    const element = document.getElementById('driver-network-state');
    element.classList.toggle('is-connected', navigator.onLine);
    element.innerHTML = `<i></i>${navigator.onLine ? 'Đang kết nối Internet' : 'Mất kết nối Internet'}`;
  }

  function setupMap() {
    const mapElement = document.getElementById('driver-map');
    if (!globalThis.L) {
      mapElement.innerHTML = '<p class="driver-map-fallback">Không tải được thư viện bản đồ. Hãy kiểm tra kết nối Internet.</p>';
      return;
    }
    driverMap = globalThis.L.map(mapElement, { zoomControl: true }).setView([21.0285, 105.8542], 12);
    globalThis.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(driverMap);
    setTimeout(() => driverMap.invalidateSize(), 0);
  }

  function currentMapPosition() {
    if (!driverMarker) return null;
    const { lat, lng } = driverMarker.getLatLng();
    return { lat, lng };
  }

  function requestDriverLocation() {
    const state = document.getElementById('driver-gps-state');
    if (!navigator.geolocation) {
      state.innerHTML = '<i></i> Thiết bị không hỗ trợ GPS';
      showNotice('Trình duyệt này không hỗ trợ định vị GPS.', 'error');
      return;
    }
    state.innerHTML = '<i></i> Đang lấy vị trí GPS…';
    navigator.geolocation.getCurrentPosition((position) => {
      const currentPosition = [position.coords.latitude, position.coords.longitude];
      if (driverMap) {
        if (driverMarker) {
          driverMarker.setLatLng(currentPosition);
        } else {
          driverMarker = globalThis.L.marker(currentPosition).addTo(driverMap);
        }
        driverMarker.bindPopup('Vị trí GPS hiện tại của bạn').openPopup();
        driverMap.setView(currentPosition, 15);
      }
      state.classList.add('is-connected');
      state.innerHTML = '<i></i> GPS đang hoạt động';
      showNotice('Đã cập nhật vị trí GPS hiện tại.');
    }, (error) => {
      state.classList.remove('is-connected');
      state.innerHTML = '<i></i> Không lấy được GPS';
      showNotice(error.code === error.PERMISSION_DENIED
        ? 'Bạn chưa cấp quyền vị trí. Hãy cho phép GPS trong cài đặt trình duyệt.'
        : 'Không thể xác định vị trí. Vui lòng kiểm tra thiết bị và thử lại.', 'error');
    }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 });
  }

  function switchTab(tab) {
    document.querySelectorAll('.driver-tab').forEach((button) => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.driver-panel').forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.panel === tab);
    });
    if (tab === 'home' && driverMap) setTimeout(() => driverMap.invalidateSize(), 0);
    if (tab === 'rides') renderActiveRides();
  }

  function logout() {
    clearAuthSession();
    localStorage.removeItem('taxivinfast_driver_online');
    window.location.replace('dangnhap.html');
  }

  function handleRideAction(action, id) {
    const booking = bookingStore.getById(id);
    if (action === 'skip') {
      skippedOffers.add(id);
      renderOffers();
      return;
    }
    if (!booking) {
      showNotice('Không tìm thấy thông tin chuyến xe.', 'error');
      renderAll();
      return;
    }
    if (action === 'accept') {
      if (booking.status !== 'pending') {
        showNotice('Chuyến này đã được tài xế khác nhận hoặc không còn khả dụng.', 'error');
        renderAll();
        return;
      }
      const accepted = bookingStore.acceptBooking(
        id,
        { name: driverName(), phone: profile.phone, rating: Number(profile.rating) },
        { model: profile.vehicle, licensePlate: profile.plate },
      );
      if (!accepted) {
        showNotice('Chuyến này vừa được tài xế khác nhận hoặc đã được điều phối.', 'error');
        renderAll();
        return;
      }
      showNotice(`Bạn đã nhận chuyến ${id}.`);
    } else if (action === 'arrive') {
      if (booking.status !== 'confirmed' || booking.driver?.name !== driverName()) return;
      bookingStore.update(id, { driver: { ...booking.driver, stage: 'arrived', arrivedAt: new Date().toISOString() } });
      showNotice('Đã ghi nhận bạn tới điểm đón. Hãy xác nhận sau khi khách lên xe.');
    } else if (action === 'start') {
      if (booking.status !== 'confirmed' || booking.driver?.name !== driverName() || booking.driver?.stage !== 'arrived') {
        showNotice('Hãy xác nhận đã tới điểm đón trước khi bắt đầu chuyến.', 'error');
        return;
      }
      bookingStore.updateStatus(id, 'in_progress');
      showNotice('Chuyến đi đã bắt đầu.');
    } else if (action === 'cash-received') {
      if (
        booking.payment?.method !== 'cash'
        || booking.status !== 'in_progress'
        || booking.driver?.name !== driverName()
        || booking.payment?.status === 'paid'
      ) return;
      bookingStore.update(id, {
        payment: {
          ...(booking.payment || {}),
          status: 'paid',
          receivedBy: 'driver',
          receivedAt: new Date().toISOString(),
        },
      });
      showNotice('Đã ghi nhận bạn xác nhận nhận tiền mặt.');
    } else if (action === 'complete') {
      if (booking.status !== 'in_progress' || booking.driver?.name !== driverName()) return;
      if (booking.payment?.method === 'cash' && booking.payment.status !== 'paid') {
        showNotice('Hãy xác nhận đã nhận tiền mặt trước khi kết thúc chuyến.', 'error');
        return;
      }
      bookingStore.updateStatus(id, 'completed');
      showNotice(booking.payment?.method !== 'cash' && booking.payment?.status !== 'paid'
        ? 'Đã kết thúc chuyến. Thanh toán online vẫn chờ hệ thống thanh toán xác nhận.'
        : 'Chuyến đi đã hoàn thành.');
    } else if (action === 'cancel') {
      const reason = window.prompt('Lý do hủy chuyến (bắt buộc):');
      if (reason === null) return;
      if (!reason.trim()) {
        showNotice('Vui lòng nhập lý do hủy chuyến.', 'error');
        return;
      }
      bookingStore.update(id, { cancellationReason: reason.trim() });
      bookingStore.updateStatus(id, 'cancelled');
      showNotice('Đã hủy chuyến và lưu lý do.');
    } else if (action === 'complaint') {
      const detail = window.prompt(`Nội dung khiếu nại cho chuyến ${id}:`);
      if (detail === null) return;
      if (!detail.trim()) {
        showNotice('Vui lòng nhập nội dung khiếu nại.', 'error');
        return;
      }
      const complaints = JSON.parse(localStorage.getItem('taxivinfast_driver_complaints') || '[]');
      complaints.unshift({ bookingId: id, detail: detail.trim(), createdAt: new Date().toISOString() });
      localStorage.setItem('taxivinfast_driver_complaints', JSON.stringify(complaints));
      showNotice('Đã lưu khiếu nại trong bản demo.');
    } else if (action === 'rate') {
      const answer = window.prompt(`Đánh giá khách hàng cho chuyến ${id} (1–5 sao):`);
      if (answer === null) return;
      const value = Number(answer);
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        showNotice('Đánh giá phải là số sao nguyên từ 1 đến 5.', 'error');
        return;
      }
      const ratings = JSON.parse(localStorage.getItem('taxivinfast_driver_customer_ratings') || '{}');
      ratings[email] ||= {};
      ratings[email][id] = value;
      localStorage.setItem('taxivinfast_driver_customer_ratings', JSON.stringify(ratings));
      showNotice('Đã lưu đánh giá khách hàng.');
    } else if (action === 'sos') {
      const description = window.prompt('Mô tả sự cố để gửi cho trung tâm hỗ trợ:');
      if (description === null) return;
      if (!description.trim()) {
        showNotice('Vui lòng mô tả sự cố để gửi hỗ trợ.', 'error');
        return;
      }
      const incidents = JSON.parse(localStorage.getItem('taxivinfast_driver_incidents') || '[]');
      incidents.unshift({
        bookingId: id,
        description: description.trim(),
        location: currentMapPosition(),
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('taxivinfast_driver_incidents', JSON.stringify(incidents));
      showNotice('Đã lưu báo cáo SOS demo. Nếu khẩn cấp, hãy gọi 1900 232 345.', 'error');
    }
    renderAll();
  }

  document.querySelectorAll('.driver-tab').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
  document.addEventListener('click', (event) => {
    const tabButton = event.target.closest('[data-open-tab]');
    if (tabButton) switchTab(tabButton.dataset.openTab);
    const actionButton = event.target.closest('button[data-action]');
    if (actionButton) handleRideAction(actionButton.dataset.action, actionButton.dataset.id);
  });
  document.addEventListener('change', (event) => {
    const cashCheckbox = event.target.closest('input[data-action="cash-received"]');
    if (cashCheckbox?.checked) handleRideAction('cash-received', cashCheckbox.dataset.id);
  });
  document.getElementById('driver-online-toggle').addEventListener('click', () => {
    const online = localStorage.getItem('taxivinfast_driver_online') === 'true';
    localStorage.setItem('taxivinfast_driver_online', String(!online));
    renderAll();
    showNotice(online ? 'Bạn đã tắt nhận chuyến.' : 'Bạn đang bật nhận chuyến.');
  });
  document.getElementById('driver-locate').addEventListener('click', requestDriverLocation);
  document.getElementById('driver-logout').addEventListener('click', logout);
  document.getElementById('driver-account-logout').addEventListener('click', logout);
  document.getElementById('driver-history-filter').addEventListener('change', renderHistory);
  window.addEventListener('online', renderNetworkState);
  window.addEventListener('offline', renderNetworkState);
  window.addEventListener('storage', (event) => {
    if (!event.key || event.key === 'taxivinfast_bookings' || event.key === 'taxivinfast_admin_operations') {
      const previousOfferIds = knownOfferIds;
      renderAll();
      notifyIncomingOffers(previousOfferIds);
    }
  });

  document.getElementById('driver-profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const oldName = driverName();
    const updatedName = String(fields.get('fullName') || '').trim();
    if (updatedName.length < 2) {
      showNotice('Vui lòng nhập họ tên hợp lệ.', 'error');
      return;
    }
    Object.assign(profile, {
      fullName: updatedName,
      phone: String(fields.get('phone') || '').trim(),
      vehicle: String(fields.get('vehicle') || '').trim(),
      plate: String(fields.get('plate') || '').trim(),
      bankName: String(fields.get('bankName') || '').trim(),
      bankAccount: String(fields.get('bankAccount') || '').trim(),
      licenseExpiry: String(fields.get('licenseExpiry') || ''),
      vehiclePaperExpiry: String(fields.get('vehiclePaperExpiry') || ''),
      rating: Math.min(5, Math.max(1, Number(fields.get('rating')) || 5)),
      notifications: fields.has('notifications'),
      sound: fields.has('sound'),
      language: String(fields.get('language') || 'vi'),
    });
    saveDriverSettings(localStorage, email, profile);
    if (profile.notifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    allBookings().filter((booking) => booking.driver?.name === oldName).forEach((booking) => {
      bookingStore.update(booking.bookingId, {
        driver: { ...booking.driver, name: profile.fullName, phone: profile.phone, rating: profile.rating },
      });
    });
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ ...user, name: profile.fullName, phone: profile.phone }));
    renderAll();
    showNotice('Thông tin tài khoản đã được lưu trên thiết bị này.');
  });

  const withdrawDialog = document.getElementById('driver-withdraw-dialog');
  document.getElementById('driver-withdraw-open').addEventListener('click', () => {
    document.getElementById('driver-withdraw-bank-hint').textContent = profile.bankName && profile.bankAccount
      ? `Tài khoản nhận: ${profile.bankName} · ${profile.bankAccount}`
      : 'Vui lòng cập nhật ngân hàng và số tài khoản trong mục Tài khoản trước khi rút.';
    withdrawDialog.showModal();
  });
  withdrawDialog.querySelectorAll('[data-close-dialog], .driver-dialog-close').forEach((button) => {
    button.addEventListener('click', () => withdrawDialog.close());
  });
  document.getElementById('driver-withdraw-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = Number(new FormData(event.currentTarget).get('amount'));
    const wallet = getDriverWallet(localStorage, email);
    const reserved = wallet.withdrawals
      .filter((item) => item.status === 'pending' || item.status === 'approved')
      .reduce((sum, item) => sum + item.amount, 0);
    if (!profile.bankName || !profile.bankAccount) {
      showNotice('Cập nhật thông tin ngân hàng trong tài khoản trước khi rút tiền.', 'error');
      switchTab('account');
      withdrawDialog.close();
      return;
    }
    if (!Number.isFinite(amount) || amount < 10_000 || amount > withdrawableEarnings() - reserved) {
      showNotice('Số tiền rút phải từ 10.000 đ và không vượt quá số dư khả dụng.', 'error');
      return;
    }
    wallet.withdrawals.unshift({
      id: `WD-${Date.now()}`,
      amount,
      bankName: profile.bankName,
      bankAccount: profile.bankAccount,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    saveDriverWallet(localStorage, email, wallet);
    event.currentTarget.reset();
    withdrawDialog.close();
    renderIncome();
    showNotice('Đã tạo yêu cầu rút tiền demo. Việc chuyển tiền cần được backend xác nhận.');
  });
  document.getElementById('driver-sos').addEventListener('click', () => {
    const active = assignedBookings().find((booking) => booking.status === 'in_progress');
    if (active) handleRideAction('sos', active.bookingId);
    else showNotice('Chưa có chuyến đang thực hiện. Nếu khẩn cấp, hãy gọi 1900 232 345.', 'error');
  });

  setupMap();
  renderAll();
  setInterval(() => {
    document.querySelectorAll('[data-waiting-from]').forEach((timer) => {
      const minutes = Math.max(0, Math.floor((Date.now() - Number(timer.dataset.waitingFrom)) / 60_000));
      timer.textContent = `Chờ ${minutes} phút`;
    });
  }, 1000);
}
