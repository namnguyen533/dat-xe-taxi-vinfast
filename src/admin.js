import './style.css';
import carsInitialData from './data/cars.json';
import pricingInitialData from './data/pricing.json';
import { getAdminOperations, saveAdminOperations } from './data/admin-operations.js';
import { getPricingConfig, savePricingConfig } from './data/pricing-store.js';
import {
  BOOKING_STATUSES,
  STATUS_MAP,
  bookingStore,
  escapeHtml,
  filterBookings,
  formatDateTime,
  formatVND,
  paymentMethodLabel,
  statusMeta,
  todayISO,
} from './data/booking-store.js';

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('admin_authenticated') !== 'true') {
    window.location.href = 'admin-login.html';
    return;
  }

  const nameEl = document.getElementById('admin-display-name');
  const storedUser = localStorage.getItem('admin_user');
  let adminUser = {};
  if (storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser);
      adminUser = parsedUser && typeof parsedUser === 'object' ? parsedUser : {};
    } catch (error) {
      console.warn('Không thể đọc thông tin quản trị viên đã lưu.', error);
    }
  }
  if (nameEl) nameEl.textContent = adminUser.name || 'Quản trị viên';
  const accountName = document.getElementById('admin-account-name');
  const accountEmail = document.getElementById('admin-account-email');
  const accountRole = document.getElementById('admin-account-role');
  if (accountName) accountName.textContent = adminUser.name || 'Quản trị viên';
  if (accountEmail) accountEmail.textContent = adminUser.email || 'admin@taxivinfast.com';
  if (accountRole) accountRole.textContent = adminUser.role || 'Quản trị viên';

  const clockEl = document.getElementById('live-clock');
  const updateClock = () => {
    if (clockEl) clockEl.textContent = new Date().toLocaleTimeString('vi-VN');
  };
  updateClock();
  window.setInterval(updateClock, 1000);

  const tabBtns = document.querySelectorAll('.sidebar-tab-btn');
  const tabContents = document.querySelectorAll('.admin-tab-content');
  const pageTitle = document.getElementById('page-heading-title');
  const tabTitleMap = {
    dashboard: 'Tổng quan',
    bookings: 'Quản lý đơn đặt xe',
    dispatch: 'Điều hành chuyến đi',
    fleet: 'Đội xe VinFast',
    drivers: 'Đội ngũ tài xế',
    vouchers: 'Khuyến mãi & bảng giá',
    customers: 'Khách hàng & chăm sóc',
    finance: 'Tài chính & phân tích',
    settings: 'Cài đặt hệ thống',
  };

  function selectTab(targetTab) {
    tabBtns.forEach((button) => {
      const isActive = button.dataset.tab === targetTab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    tabContents.forEach((content) => {
      content.classList.toggle('active', content.id === `tab-view-${targetTab}`);
    });
    if (pageTitle && tabTitleMap[targetTab]) pageTitle.textContent = tabTitleMap[targetTab];
  }

  tabBtns.forEach((button) => {
    button.addEventListener('click', () => selectTab(button.dataset.tab));
  });

  let bookingsState = bookingStore.getAll();
  let currentFilter = 'all';
  const searchTableInput = document.getElementById('booking-search-table');

  function migrateLegacyAdminBookings() {
    const migrationKey = 'admin_bookings_migrated_to_shared_store';
    if (localStorage.getItem(migrationKey) === 'true') return;

    const legacyRaw = localStorage.getItem('admin_bookings_data');
    if (legacyRaw) {
      let legacyBookings;
      try {
        legacyBookings = JSON.parse(legacyRaw);
      } catch (error) {
        console.warn('Không thể nhập dữ liệu đơn cũ của trang quản trị.', error);
        return;
      }
      if (!Array.isArray(legacyBookings)) {
        console.warn('Dữ liệu đơn cũ của trang quản trị không đúng định dạng; không thể nhập.');
        return;
      }

      const existingIds = new Set(bookingsState.filter(Boolean).map((booking) => booking.bookingId));
      legacyBookings.forEach((booking) => {
        if (!booking || typeof booking !== 'object') return;
        const status = booking.status === 'driver_assigned'
          ? 'confirmed'
          : STATUS_MAP[booking.status]
            ? booking.status
            : 'pending';
        if (booking.bookingId && existingIds.has(booking.bookingId)) {
          const sharedBooking = bookingStore.getById(booking.bookingId);
          if (sharedBooking && !sharedBooking.updatedAt && sharedBooking.status !== status) {
            bookingStore.updateStatus(booking.bookingId, status);
          }
          return;
        }
        const migratedBooking = bookingStore.add({
          ...booking,
          status,
          statusText: statusMeta(status).text,
        });
        if (status === 'completed' || status === 'cancelled') {
          bookingStore.updateStatus(migratedBooking.bookingId, status);
        }
        existingIds.add(migratedBooking.bookingId);
      });
      bookingsState = bookingStore.getAll();
    }
    localStorage.setItem(migrationKey, 'true');
  }

  migrateLegacyAdminBookings();
  bookingsState = bookingStore.getAll();
  let operationsState = getAdminOperations();
  let pricingState = getPricingConfig();
  const actorName = adminUser.name || 'Quản trị viên';
  const driverVehicleSelect = document.getElementById('driver-vehicle-model');
  if (driverVehicleSelect) {
    driverVehicleSelect.innerHTML = '<option value="">Chọn loại xe</option>' + carsInitialData
      .map((car) => `<option value="${escapeHtml(car.name)}">${escapeHtml(car.name)} · ${Number(car.seats)} chỗ</option>`)
      .join('');
  }

  function recordAudit(action, entity, detail) {
    operationsState.auditLogs.unshift({
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      actor: actorName,
      action,
      entity,
      detail,
    });
    operationsState.auditLogs = operationsState.auditLogs.slice(0, 250);
    saveAdminOperations(operationsState);
  }

  function getStatusBadge(status) {
    const meta = statusMeta(status);
    const label = escapeHtml(meta.text);
    return `<span class="badge-status ${escapeHtml(meta.tone)}">${escapeHtml(meta.icon)} ${label}</span>`;
  }

  function renderKPI() {
    const stats = bookingStore.stats(bookingsState);
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    const ongoingCount = ['pending', 'confirmed', 'in_progress'].reduce(
      (total, status) => total + (stats.byStatus[status] || 0),
      0,
    );
    setText('kpi-revenue', formatVND(stats.revenue));
    setText('kpi-total-bookings', `${stats.total} chuyến`);
    setText('kpi-today-count', `${stats.todayCount} chuyến`);
    setText('live-orders-count', ongoingCount);
    setText('dashboard-booking-summary', `${stats.total} đơn · ${stats.byStatus.completed || 0} hoàn thành · ${stats.cancelledCount} đã hủy`);

    const breakdown = document.getElementById('dashboard-status-breakdown');
    if (breakdown) {
      breakdown.innerHTML = BOOKING_STATUSES.map((status) => `
        <li>
          <span>${getStatusBadge(status.value)}</span>
          <strong>${stats.byStatus[status.value] || 0}</strong>
        </li>
      `).join('');
    }
  }

  function bookingTimestamp(booking) {
    const createdAt = booking.schedule?.createdDate || booking.createdAt || '';
    const timestamp = new Date(createdAt).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function renderRecentOrders() {
    const tbody = document.getElementById('dashboard-recent-orders');
    if (!tbody) return;

    const recentBookings = [...bookingsState]
      .sort((left, right) => bookingTimestamp(right) - bookingTimestamp(left))
      .slice(0, 5);

    if (!recentBookings.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty-state">Chưa có đơn đặt xe nào.</td></tr>';
      return;
    }

    tbody.innerHTML = recentBookings.map((booking) => `
      <tr>
        <td><strong class="booking-id-tag">${escapeHtml(booking.bookingId)}</strong></td>
        <td><strong>${escapeHtml(booking.customer?.name || 'Khách hàng')}</strong></td>
        <td><span class="car-badge-sm">${escapeHtml(booking.vehicle?.model || 'Chưa chọn xe')}</span></td>
        <td>
          <span class="route-truncate" title="${escapeHtml(booking.route?.pickupLocation || '')}">${escapeHtml(booking.route?.pickupLocation || 'Chưa có điểm đón')}</span>
          <span class="route-truncate" title="${escapeHtml(booking.route?.destinationLocation || '')}">→ ${escapeHtml(booking.route?.destinationLocation || 'Chưa có điểm đến')}</span>
        </td>
        <td><strong class="price-text">${formatVND(booking.fare?.totalAmount)}</strong></td>
        <td>${getStatusBadge(booking.status)}</td>
      </tr>
    `).join('');
  }

  function renderOrdersTable(filterStatus = currentFilter, keyword = searchTableInput?.value || '') {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;

    let filtered = filterBookings(bookingsState, { keyword, status: filterStatus });
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi');
    if (normalizedKeyword) {
      const sharedResults = new Set(filtered);
      filtered = bookingsState.filter((booking) => {
        const matchesSharedFields = sharedResults.has(booking);
        const email = String(booking.customer?.email || '').toLocaleLowerCase('vi');
        return matchesSharedFields || email.includes(normalizedKeyword);
      }).filter((booking) => filterStatus === 'all' || booking.status === filterStatus);
    }

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="admin-empty-state">Không tìm thấy đơn đặt xe phù hợp.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((booking) => {
      const id = escapeHtml(booking.bookingId);
      const canComplete = !['completed', 'cancelled'].includes(booking.status);
      const canCancel = !['completed', 'cancelled'].includes(booking.status);
      const paymentStatus = booking.payment?.status === 'paid'
        ? 'Đã thanh toán'
        : booking.payment?.status === 'refunded'
          ? 'Đã hoàn tiền'
          : 'Chưa thanh toán';
      const pickup = booking.route?.pickupLocation || 'Chưa có điểm đón';
      const destination = booking.route?.destinationLocation || 'Chưa có điểm đến';
      const pickupDateTime = booking.schedule?.pickupDate
        ? `${booking.schedule.pickupDate}T${booking.schedule.pickupTime || '00:00'}`
        : booking.schedule?.createdDate || booking.createdAt || '';
      const driverName = booking.driver?.name || 'Chưa phân công';

      return `
        <tr>
          <td><strong class="booking-id-tag">${id}</strong></td>
          <td>
            <div class="user-info-cell">
              <strong>${escapeHtml(booking.customer?.name || 'Khách hàng')}</strong>
              <a href="tel:${escapeHtml(booking.customer?.phone || '')}">${escapeHtml(booking.customer?.phone || 'Chưa có SĐT')}</a>
              ${booking.customer?.email ? `<span>${escapeHtml(booking.customer.email)}</span>` : ''}
            </div>
          </td>
          <td><span class="car-badge-sm">${escapeHtml(booking.vehicle?.model || 'Chưa chọn xe')}</span></td>
          <td>
            <div class="driver-info-cell">
              <strong>${escapeHtml(driverName)}</strong>
              <span class="plate">${escapeHtml(booking.vehicle?.licensePlate || 'Chưa có biển số')}</span>
            </div>
          </td>
          <td>
            <div class="route-cell">
              <span class="from" title="${escapeHtml(pickup)}">🟢 ${escapeHtml(pickup)}</span>
              <span class="to" title="${escapeHtml(destination)}">🔴 ${escapeHtml(destination)}</span>
              ${pickupDateTime ? `<span class="booking-time">${escapeHtml(formatDateTime(pickupDateTime))}</span>` : ''}
            </div>
          </td>
          <td>
            <div class="payment-cell">
              <strong class="price-text">${formatVND(booking.fare?.totalAmount)}</strong>
              <span>${escapeHtml(booking.payment?.method ? paymentMethodLabel(booking.payment.method) : 'Chưa chọn phương thức')} · ${paymentStatus}</span>
            </div>
          </td>
          <td>${getStatusBadge(booking.status)}</td>
          <td>
            <div class="action-buttons-cell">
              ${canComplete ? `<button type="button" class="btn-sm-action approve" data-action="complete" data-id="${id}">Hoàn thành</button>` : ''}
              ${canCancel ? `<button type="button" class="btn-sm-action cancel" data-action="cancel" data-id="${id}">Hủy đơn</button>` : ''}
              <button type="button" class="btn-sm-action delete" data-action="delete" data-id="${id}">Xóa</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderFleetGrid() {
    const fleetGrid = document.getElementById('admin-fleet-grid');
    if (!fleetGrid) return;
    fleetGrid.innerHTML = carsInitialData.map((car) => `
      <article class="fleet-admin-card">
        <img src="${escapeHtml(car.image)}" alt="${escapeHtml(car.name)}" class="fleet-admin-img" />
        <div class="fleet-admin-body">
          <h4>${escapeHtml(car.name)}</h4>
          <p class="car-type">${escapeHtml(car.category)} · ${escapeHtml(car.seats)} chỗ</p>
          <div class="fleet-specs">
            <span>🔋 Pin: ${escapeHtml(car.specs?.battery || 'Đang cập nhật')}</span>
            <span>🛣️ Tầm hoạt động: ${escapeHtml(car.specs?.range || 'Đang cập nhật')}</span>
          </div>
          <div class="fleet-footer-status"><span class="badge-status info">Dòng xe trong danh mục</span></div>
        </div>
      </article>
    `).join('');
    const fleetCount = document.getElementById('kpi-fleet-count');
    if (fleetCount) fleetCount.textContent = `${carsInitialData.length} dòng xe`;

    const fleetBody = document.getElementById('admin-fleet-ops-table');
    const fleetSummary = document.getElementById('fleet-ops-summary');
    if (fleetBody) {
      const threshold = operationsState.settings.lowBatteryThreshold || 25;
      const lowBattery = operationsState.fleet.filter((vehicle) => vehicle.stateOfCharge <= threshold).length;
      const dueDocs = operationsState.fleet.filter((vehicle) => vehicle.inspectionDue <= todayISO() || vehicle.maintenanceDue <= todayISO()).length;
      if (fleetSummary) {
        fleetSummary.innerHTML = `
          <div><strong>${operationsState.fleet.length}</strong><span>xe theo dõi</span></div>
          <div class="${lowBattery ? 'alert' : ''}"><strong>${lowBattery}</strong><span>xe pin thấp (≤ ${threshold}%)</span></div>
          <div class="${dueDocs ? 'alert' : ''}"><strong>${dueDocs}</strong><span>xe đến hạn bảo dưỡng / đăng kiểm</span></div>
        `;
      }
      fleetBody.innerHTML = operationsState.fleet.map((vehicle) => {
        const low = vehicle.stateOfCharge <= threshold;
        const dateTone = (date) => date <= todayISO() ? 'danger' : 'secondary';
        return `
          <tr>
            <td><strong>${escapeHtml(vehicle.model)}</strong><span class="fleet-plate">${escapeHtml(vehicle.plate)}</span></td>
            <td><div class="battery-readout ${low ? 'low' : ''}"><strong>${vehicle.stateOfCharge}%</strong><div class="battery-track"><i style="width:${vehicle.stateOfCharge}%"></i></div></div></td>
            <td><span class="badge-status ${vehicle.status === 'ready' ? 'success' : vehicle.status === 'charging' ? 'info' : vehicle.status === 'driving' ? 'primary' : 'warning'}">${vehicle.status === 'ready' ? 'Sẵn sàng' : vehicle.status === 'charging' ? 'Đang sạc' : vehicle.status === 'driving' ? 'Đang chạy' : 'Bảo dưỡng'}</span></td>
            <td>${Number(vehicle.odometerKm).toLocaleString('vi-VN')} km</td>
            <td><span class="badge-status ${dateTone(vehicle.maintenanceDue)}">${escapeHtml(vehicle.maintenanceDue)}</span></td>
            <td><span class="badge-status ${dateTone(vehicle.inspectionDue)}">${escapeHtml(vehicle.inspectionDue)}</span></td>
            <td><span class="badge-status ${dateTone(vehicle.insuranceDue)}">${escapeHtml(vehicle.insuranceDue)}</span></td>
            <td><div class="action-buttons-cell">
              <button class="btn-sm-action" data-action="fleet-charge" data-id="${escapeHtml(vehicle.id)}">Cập nhật pin</button>
              <button class="btn-sm-action" data-action="fleet-maintenance" data-id="${escapeHtml(vehicle.id)}">Lịch bảo dưỡng</button>
              <button class="btn-sm-action" data-action="fleet-documents" data-id="${escapeHtml(vehicle.id)}">Đăng kiểm / bảo hiểm</button>
            </div></td>
          </tr>
        `;
      }).join('');
    }
  }

  function renderDriversTable() {
    const tbody = document.getElementById('admin-drivers-table');
    if (!tbody) return;

    const drivers = new Map(operationsState.drivers.map((driver) => [
      driver.name,
      { ...driver, car: driver.vehicleModel || '', plate: '', trips: 0, activeTrips: 0, completedTrips: 0, earnings: 0 },
    ]));
    bookingsState.forEach((booking) => {
      const name = booking.driver?.name?.trim();
      if (!name) return;
      const driver = drivers.get(name) || {
        id: `DRV-${drivers.size + 1}`,
        name,
        phone: booking.driver?.phone || '',
        approved: true,
        blocked: false,
        shift: 'off',
        walletBalance: 0,
        incentiveBalance: 0,
        penaltyBalance: 0,
        earnings: 0,
        paidOut: 0,
        rating: booking.driver?.rating,
        trips: 0,
        activeTrips: 0,
        completedTrips: 0,
        car: '',
        plate: '',
      };
      driver.trips += 1;
      if (['pending', 'confirmed', 'in_progress'].includes(booking.status)) driver.activeTrips += 1;
      if (booking.status === 'completed') driver.completedTrips = (driver.completedTrips || 0) + 1;
      if (booking.status === 'completed') driver.earnings = (driver.earnings || 0) + Math.round(Number(booking.fare?.totalAmount || 0) * 0.8);
      if (!driver.phone && booking.driver?.phone) driver.phone = booking.driver.phone;
      if (!driver.car && booking.vehicle?.model) driver.car = booking.vehicle.model;
      if (!driver.plate && booking.vehicle?.licensePlate) driver.plate = booking.vehicle.licensePlate;
      if (driver.rating == null && booking.driver?.rating != null) driver.rating = booking.driver.rating;
      if (driver.earnings) driver.walletBalance = Math.max(driver.walletBalance || 0, driver.earnings - (driver.paidOut || 0));
      drivers.set(name, driver);
    });

    if (!drivers.size) {
      tbody.innerHTML = '<tr><td colspan="10" class="admin-empty-state">Chưa có thông tin tài xế trong các đơn đặt xe.</td></tr>';
      return;
    }

    tbody.innerHTML = [...drivers.values()].map((driver) => `
      <tr>
        <td><strong>${escapeHtml(driver.name)}</strong></td>
        <td>${driver.phone ? `<a href="tel:${escapeHtml(driver.phone)}">${escapeHtml(driver.phone)}</a>` : 'Chưa cập nhật'}</td>
        <td><span class="car-badge-sm">${escapeHtml(driver.car || '—')}</span></td>
        <td><strong class="plate">${escapeHtml(driver.plate || '—')}</strong></td>
        <td>${driver.rating == null ? '—' : `⭐ ${escapeHtml(driver.rating)}`}</td>
        <td><strong>${driver.trips} chuyến</strong></td>
        <td><span class="badge-status ${driver.approved ? 'success' : 'warning'}">${driver.approved ? 'Đã duyệt' : 'Chờ duyệt'}${driver.blocked ? ' · Đã khóa' : ''}</span></td>
        <td><button class="btn-sm-action" data-action="driver-shift" data-id="${escapeHtml(driver.id)}">${driver.shift === 'on' ? 'Đang trực' : driver.shift === 'off' ? 'Ngoài ca' : escapeHtml(driver.shift)}</button></td>
        <td><strong>${formatVND(Math.max(0, driver.walletBalance || 0))}</strong><span class="fleet-plate">Thưởng ${formatVND(driver.incentiveBalance || 0)} · Phạt ${formatVND(driver.penaltyBalance || 0)}</span></td>
        <td><div class="action-buttons-cell">
          <button class="btn-sm-action" data-action="driver-approve" data-id="${escapeHtml(driver.id)}">${driver.approved ? 'Hồ sơ' : 'Duyệt'}</button>
          <button class="btn-sm-action" data-action="driver-wallet" data-id="${escapeHtml(driver.id)}">Thưởng / phạt</button>
          <button class="btn-sm-action ${driver.blocked ? '' : 'cancel'}" data-action="driver-block" data-id="${escapeHtml(driver.id)}">${driver.blocked ? 'Mở khóa' : 'Khóa'}</button>
        </div></td>
      </tr>
    `).join('');
  }

  function renderPromotions() {
    const promotionsBody = document.getElementById('admin-promotions-table');
    if (promotionsBody) {
      promotionsBody.innerHTML = pricingState.promotions.map((promotion) => {
        const usageCount = bookingsState.filter(
          (booking) => booking.fare?.discountCode?.toUpperCase() === promotion.code,
        ).length;
        const discount = promotion.discountType === 'percentage'
          ? `${promotion.discountValue}%${promotion.maxDiscount ? ` · tối đa ${formatVND(promotion.maxDiscount)}` : ''}`
          : formatVND(promotion.discountValue);
        return `
          <tr>
            <td><strong class="voucher-code-tag">${escapeHtml(promotion.code)}</strong></td>
            <td>${promotion.discountType === 'percentage' ? 'Phần trăm' : 'Mức cố định'}</td>
            <td><strong>${escapeHtml(discount)}</strong></td>
            <td>${escapeHtml(promotion.description)}</td>
            <td><span class="badge-status ${promotion.active === false ? 'secondary' : 'success'}">${promotion.active === false ? 'Tạm dừng' : 'Áp dụng khi đặt xe'}</span></td>
            <td>${usageCount} lượt · <button type="button" class="btn-sm-action" data-action="promotion-toggle" data-id="${escapeHtml(promotion.code)}">${promotion.active === false ? 'Bật' : 'Tắt'}</button></td>
          </tr>
        `;
      }).join('');
    }

    const ratesBody = document.getElementById('admin-pricing-table');
    if (ratesBody) {
      ratesBody.innerHTML = pricingState.standardRates.map((rate) => `
        <tr data-rate-id="${escapeHtml(rate.modelId)}">
          <td><strong>${escapeHtml(rate.modelName)}</strong></td>
          <td>${rate.seats} chỗ</td>
          <td><input class="form-input rate-value" data-rate-field="baseFare" type="number" min="0" value="${rate.baseFare}" aria-label="Giá mở cửa ${escapeHtml(rate.modelName)}" /></td>
          <td><input class="form-input rate-value" data-rate-field="rateUnder25km" type="number" min="0" value="${rate.rateUnder25km}" aria-label="Giá dưới 25km ${escapeHtml(rate.modelName)}" /></td>
          <td><input class="form-input rate-value" data-rate-field="rateOver25km" type="number" min="0" value="${rate.rateOver25km}" aria-label="Giá trên 25km ${escapeHtml(rate.modelName)}" /></td>
          <td><input class="form-input rate-value" data-rate-field="waitingFeePer5Min" type="number" min="0" value="${rate.waitingFeePer5Min}" aria-label="Phí chờ ${escapeHtml(rate.modelName)}" /></td>
        </tr>
      `).join('');
      document.getElementById('pricing-peak-enabled').checked = Boolean(pricingState.surcharges?.peakHours?.enabled);
      document.getElementById('pricing-peak-hours').value = pricingState.surcharges?.peakHours?.ranges || '07:00-09:00,17:00-20:00';
      document.getElementById('pricing-peak-percent').value = pricingState.surcharges?.peakHours?.percentage || 0;
      document.getElementById('pricing-rain-enabled').checked = Boolean(pricingState.surcharges?.rain?.enabled);
      document.getElementById('pricing-rain-percent').value = pricingState.surcharges?.rain?.percentage || 0;
      document.getElementById('pricing-night-percent').value = pricingState.surcharges?.nightSurcharge?.percentage ?? 10;
      document.getElementById('pricing-hourly-fee').value = pricingState.surcharges?.serviceFees?.hourly ?? 50000;
      document.getElementById('pricing-airport-fee').value = pricingState.surcharges?.serviceFees?.airport ?? 15000;
      document.getElementById('pricing-holiday-dates').value = (pricingState.surcharges?.holidaySurcharge?.dates || []).join(',');
    }
  }

  function renderSystemInfo() {
    const count = document.getElementById('admin-system-booking-count');
    if (count) count.textContent = `${bookingsState.length} đơn`;
    document.getElementById('setting-low-battery').value = operationsState.settings.lowBatteryThreshold || 25;
    document.getElementById('setting-rain-mode').checked = Boolean(operationsState.settings.rainMode);
    document.querySelectorAll('[data-staff-role]').forEach((select) => {
      select.value = select.dataset.currentRole || 'operator';
    });
    document.getElementById('admin-audit-table').innerHTML = operationsState.auditLogs.length
      ? operationsState.auditLogs.map((entry) => `
        <tr><td>${escapeHtml(formatDateTime(entry.timestamp))}</td><td>${escapeHtml(entry.actor)}</td><td>${escapeHtml(entry.action)}</td><td>${escapeHtml(entry.entity)}</td><td>${escapeHtml(entry.detail)}</td></tr>
      `).join('')
      : '<tr><td colspan="5" class="admin-empty-state">Chưa có thao tác được ghi nhận.</td></tr>';
    const staffTable = document.getElementById('admin-staff-table');
    if (staffTable) {
      const roleLabels = { operator: 'Điều hành', accountant: 'Kế toán', support: 'CSKH', admin: 'Quản trị viên' };
      staffTable.innerHTML = operationsState.staff.map((staff) => `
        <tr><td><strong>${escapeHtml(staff.name)}</strong></td><td>${escapeHtml(staff.email)}</td>
          <td><select class="form-select staff-role-select" data-id="${escapeHtml(staff.id)}" aria-label="Vai trò ${escapeHtml(staff.name)}">
            ${Object.entries(roleLabels).map(([role, label]) => `<option value="${role}" ${staff.role === role ? 'selected' : ''}>${label}</option>`).join('')}
          </select></td>
          <td><span class="badge-status ${staff.active ? 'success' : 'secondary'}">${staff.active ? 'Đang hoạt động' : 'Đã vô hiệu hóa demo'}</span></td>
          <td><button class="btn-sm-action ${staff.active ? 'cancel' : ''}" data-action="staff-toggle" data-id="${escapeHtml(staff.id)}">${staff.active ? 'Vô hiệu hóa' : 'Kích hoạt'}</button></td>
        </tr>
      `).join('');
    }
  }

  function renderDispatch() {
    const activeTrips = bookingsState.filter((booking) => ['pending', 'confirmed', 'in_progress'].includes(booking.status));
    const dispatchList = document.getElementById('dispatch-active-trips');
    const map = document.getElementById('dispatch-map');
    if (dispatchList) {
      dispatchList.innerHTML = activeTrips.length
        ? activeTrips.map((booking) => {
          const id = escapeHtml(booking.bookingId);
          const eligibleDrivers = operationsState.drivers.filter((driver) => driver.approved && !driver.blocked);
          return `
            <article class="dispatch-trip">
              <div class="dispatch-trip-heading"><strong>${id}</strong>${getStatusBadge(booking.status)}</div>
              <span>${escapeHtml(booking.customer?.name || 'Khách hàng')} · ${escapeHtml(booking.vehicle?.model || 'Chưa chọn xe')}</span>
              <span class="dispatch-route">${escapeHtml(booking.route?.pickupLocation || 'Chưa có điểm đón')} → ${escapeHtml(booking.route?.destinationLocation || 'Chưa có điểm đến')}</span>
              <label>Điều phối tài xế
                <select class="form-select dispatch-driver-select" data-booking-id="${id}">
                  <option value="">${booking.driver?.name ? `Hiện tại: ${escapeHtml(booking.driver.name)}` : 'Chọn tài xế'}</option>
                  ${eligibleDrivers
                    .filter((driver) => !driver.vehicleModel || driver.vehicleModel === booking.vehicle?.model)
                    .map((driver) => `<option value="${escapeHtml(driver.id)}">${escapeHtml(driver.name)}${driver.vehicleModel ? ` · ${escapeHtml(driver.vehicleModel)}` : ''}${driver.shift === 'on' ? ' · Đang trực' : ''}</option>`)
                    .join('')}
                </select>
              </label>
            </article>
          `;
        }).join('')
        : '<p class="admin-empty-state">Không có chuyến đang chờ điều phối.</p>';
    }
    if (map) {
      map.innerHTML = operationsState.fleet.map((vehicle, index) => {
        const activeTrip = activeTrips.find((booking) => booking.vehicle?.licensePlate === vehicle.plate);
        const status = activeTrip ? 'driving' : vehicle.status === 'charging' ? 'charging' : 'available';
        const x = 12 + ((index * 31) % 76);
        const y = 16 + ((index * 43) % 68);
        return `<span class="map-vehicle-pin ${status}" style="left:${x}%;top:${y}%" title="${escapeHtml(vehicle.plate)} · ${vehicle.stateOfCharge}% pin"><b>⚡</b><small>${escapeHtml(vehicle.plate)}</small></span>`;
      }).join('') + '<span class="map-place-label place-one">Quận 1</span><span class="map-place-label place-two">Bình Thạnh</span><span class="map-place-label place-three">Thủ Đức</span>';
    }

    const incidentsBody = document.getElementById('admin-incidents-table');
    if (incidentsBody) {
      incidentsBody.innerHTML = operationsState.incidents.length
        ? operationsState.incidents.map((incident) => `
          <tr>
            <td><strong>${escapeHtml(incident.id)}</strong></td><td>${escapeHtml(incident.bookingId || '—')}</td>
            <td>${escapeHtml(incident.detail)}</td><td><span class="badge-status ${incident.severity === 'urgent' ? 'danger' : 'warning'}">${incident.severity === 'urgent' ? 'Khẩn cấp' : 'Thông thường'}</span></td>
            <td><span class="badge-status ${incident.status === 'resolved' ? 'success' : 'warning'}">${incident.status === 'resolved' ? 'Đã xử lý' : 'Đang xử lý'}</span></td>
            <td>${incident.status === 'resolved' ? '—' : `<button class="btn-sm-action approve" data-action="incident-resolve" data-id="${escapeHtml(incident.id)}">Đóng sự cố</button>`}</td>
          </tr>
        `).join('')
        : '<tr><td colspan="6" class="admin-empty-state">Chưa ghi nhận sự cố.</td></tr>';
    }
  }

  function renderCustomers() {
    const grouped = new Map();
    bookingsState.forEach((booking) => {
      const customer = booking.customer || {};
      const key = customer.phone || customer.email || customer.name || booking.bookingId;
      const item = grouped.get(key) || {
        key,
        name: customer.name || 'Khách hàng',
        phone: customer.phone || '',
        email: customer.email || '',
        bookings: [],
      };
      item.bookings.push(booking);
      grouped.set(key, item);
    });
    const blacklistPhones = new Set(operationsState.blacklist.map((entry) => entry.phone));
    const keyword = (document.getElementById('crm-customer-search')?.value || '').trim().toLocaleLowerCase('vi');
    const visibleCustomers = [...grouped.values()].filter((customer) => {
      const text = `${customer.name} ${customer.phone} ${customer.email}`.toLocaleLowerCase('vi');
      return !keyword || text.includes(keyword);
    });
    const table = document.getElementById('admin-customers-table');
    if (table) {
      table.innerHTML = visibleCustomers.length
        ? visibleCustomers.map((customer) => {
          const latest = [...customer.bookings].sort((a, b) => bookingTimestamp(b) - bookingTimestamp(a))[0];
          const spend = customer.bookings.reduce((total, booking) => total + (booking.status === 'cancelled' ? 0 : Number(booking.fare?.totalAmount) || 0), 0);
          const phone = escapeHtml(customer.phone);
          const blocked = blacklistPhones.has(customer.phone);
          return `
            <tr><td><strong>${escapeHtml(customer.name)}</strong></td>
              <td>${phone ? `<a href="tel:${phone}">${phone}</a>` : '—'}<span class="fleet-plate">${escapeHtml(customer.email)}</span></td>
              <td>${customer.bookings.length}</td><td>${formatVND(spend)}</td>
              <td>${latest ? escapeHtml(latest.bookingId) : '—'}</td>
              <td><span class="badge-status ${blocked ? 'danger' : 'success'}">${blocked ? 'Hạn chế' : 'Hoạt động'}</span></td>
              <td><button class="btn-sm-action" data-action="customer-history" data-phone="${phone}">Xem chuyến</button>
              ${customer.phone ? `<button class="btn-sm-action ${blocked ? '' : 'cancel'}" data-action="customer-blacklist" data-phone="${phone}">${blocked ? 'Gỡ hạn chế' : 'Hạn chế'}</button>` : ''}</td>
            </tr>
          `;
        }).join('')
        : '<tr><td colspan="7" class="admin-empty-state">Không tìm thấy khách hàng.</td></tr>';
    }

    const complaintsBody = document.getElementById('admin-complaints-table');
    if (complaintsBody) {
      complaintsBody.innerHTML = operationsState.complaints.length
        ? operationsState.complaints.map((complaint) => `
          <tr><td><strong>${escapeHtml(complaint.id)}</strong></td><td>${escapeHtml(complaint.customerName)}</td>
            <td>${escapeHtml(complaint.bookingId || '—')}</td><td><strong>${escapeHtml(complaint.category)}</strong><span class="fleet-plate">${escapeHtml(complaint.detail)}</span></td>
            <td>${escapeHtml(formatDateTime(complaint.createdAt))}</td>
            <td><span class="badge-status ${complaint.status === 'resolved' ? 'success' : complaint.status === 'open' ? 'warning' : 'info'}">${complaint.status === 'resolved' ? 'Đã xử lý' : complaint.status === 'open' ? 'Mới tiếp nhận' : 'Đang xử lý'}</span></td>
            <td>${complaint.status === 'resolved' ? '—' : `<button class="btn-sm-action approve" data-action="complaint-resolve" data-id="${escapeHtml(complaint.id)}">Đã xử lý</button>`}</td></tr>
        `).join('')
        : '<tr><td colspan="7" class="admin-empty-state">Chưa có khiếu nại.</td></tr>';
    }

    const blacklistBody = document.getElementById('admin-blacklist-table');
    if (blacklistBody) {
      blacklistBody.innerHTML = operationsState.blacklist.length
        ? operationsState.blacklist.map((entry) => `
          <tr><td><strong>${escapeHtml(entry.name)}</strong></td><td>${escapeHtml(entry.phone)}</td><td>${escapeHtml(entry.reason)}</td><td>${escapeHtml(entry.createdAt)}</td>
            <td><button class="btn-sm-action" data-action="customer-unblacklist" data-phone="${escapeHtml(entry.phone)}">Gỡ hạn chế</button></td></tr>
        `).join('')
        : '<tr><td colspan="5" class="admin-empty-state">Danh sách đang trống.</td></tr>';
    }
  }

  function renderFinance() {
    const relevantBookings = bookingsState.filter((booking) => booking.status !== 'cancelled');
    const revenue = relevantBookings.reduce((sum, booking) => sum + (Number(booking.fare?.totalAmount) || 0), 0);
    const pendingPayments = relevantBookings.filter((booking) => booking.payment?.status !== 'paid' && booking.payment?.status !== 'refunded');
    const pendingAmount = pendingPayments.reduce((sum, booking) => sum + (Number(booking.fare?.totalAmount) || 0), 0);
    const completedBookings = bookingsState.filter((booking) => booking.status === 'completed');
    const driverPayout = completedBookings.reduce((sum, booking) => sum + Math.round((Number(booking.fare?.totalAmount) || 0) * 0.8), 0);
    document.getElementById('finance-revenue').textContent = formatVND(revenue);
    document.getElementById('finance-unreconciled').textContent = formatVND(pendingAmount);
    document.getElementById('finance-driver-payout').textContent = formatVND(driverPayout);
    document.getElementById('finance-transaction-count').textContent = String(relevantBookings.length);

    const paymentsTable = document.getElementById('admin-payments-table');
    if (paymentsTable) {
      paymentsTable.innerHTML = relevantBookings.length
        ? relevantBookings.map((booking) => {
          const isPaid = booking.payment?.status === 'paid';
          return `<tr><td><strong>${escapeHtml(booking.bookingId)}</strong></td><td>${escapeHtml(booking.customer?.name || 'Khách hàng')}</td>
            <td>${escapeHtml(booking.payment?.method ? paymentMethodLabel(booking.payment.method) : 'Chưa xác định')}</td>
            <td>${formatVND(booking.fare?.totalAmount)}</td><td><span class="badge-status ${isPaid ? 'success' : 'warning'}">${isPaid ? 'Đã đối soát demo' : 'Chưa đối soát'}</span></td>
            <td>${isPaid ? '—' : `<button class="btn-sm-action approve" data-action="payment-reconcile" data-id="${escapeHtml(booking.bookingId)}">Đánh dấu đã nhận</button>`}</td></tr>`;
        }).join('')
        : '<tr><td colspan="6" class="admin-empty-state">Chưa có giao dịch.</td></tr>';
    }

    const payroll = document.getElementById('admin-payroll-table');
    if (payroll) {
      const drivers = operationsState.drivers.map((driver) => {
        const trips = completedBookings.filter((booking) => booking.driver?.name === driver.name);
        const amount = trips.reduce((sum, booking) => sum + Math.round((Number(booking.fare?.totalAmount) || 0) * 0.8), 0);
        return { driver, trips, amount };
      }).filter((item) => item.trips.length);
      payroll.innerHTML = drivers.length
        ? drivers.map(({ driver, trips, amount }) => `
          <tr><td>${escapeHtml(driver.name)}</td><td>${trips.length}</td><td>${formatVND(amount)}</td><td>${formatVND(driver.paidOut || 0)}</td>
            <td>${amount > (driver.paidOut || 0) ? `<button class="btn-sm-action approve" data-action="driver-payout" data-id="${escapeHtml(driver.id)}">Chi trả demo</button>` : 'Đã chi đủ'}</td></tr>
        `).join('')
        : '<tr><td colspan="5" class="admin-empty-state">Chưa có chuyến hoàn thành đủ điều kiện chi trả.</td></tr>';
    }

    const zoneCounts = new Map();
    bookingsState.forEach((booking) => {
      if (booking.status === 'cancelled') return;
      const zone = (booking.route?.pickupLocation || 'Chưa phân vùng').split(',')[0].trim();
      zoneCounts.set(zone, (zoneCounts.get(zone) || 0) + 1);
    });
    const maxDemand = Math.max(1, ...zoneCounts.values());
    document.getElementById('admin-demand-heatmap').innerHTML = [...zoneCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([zone, count]) => `<div class="heatmap-zone" style="--demand:${count / maxDemand}"><span>${escapeHtml(zone)}</span><strong>${count} chuyến</strong></div>`)
      .join('') || '<p class="admin-empty-state">Chưa có dữ liệu chuyến đi.</p>';
  }

  function persistOperations(action, entity, detail) {
    recordAudit(action, entity, detail);
    renderAll();
  }

  document.getElementById('dispatch-active-trips')?.addEventListener('change', (event) => {
    const select = event.target.closest('.dispatch-driver-select');
    if (!select || !select.value) return;
    const driver = operationsState.drivers.find((item) => item.id === select.value);
    const booking = bookingStore.getById(select.dataset.bookingId);
    if (!driver || !booking) return;
    bookingStore.update(booking.bookingId, {
      driver: { ...(booking.driver || {}), name: driver.name, phone: driver.phone },
      status: booking.status === 'pending' ? 'confirmed' : booking.status,
      statusText: booking.status === 'pending' ? statusMeta('confirmed').text : booking.statusText,
    });
    persistOperations('Phân công tài xế', booking.bookingId, `Giao chuyến cho ${driver.name}`);
  });

  document.getElementById('admin-fleet-ops-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const vehicle = operationsState.fleet.find((item) => item.id === button.dataset.id);
    if (!vehicle) return;
    if (button.dataset.action === 'fleet-charge') {
      const value = window.prompt(`Cập nhật SoC cho ${vehicle.plate} (0–100):`, String(vehicle.stateOfCharge));
      if (value === null) return;
      const stateOfCharge = Number(value);
      if (!Number.isInteger(stateOfCharge) || stateOfCharge < 0 || stateOfCharge > 100) {
        window.alert('SoC phải là số nguyên từ 0 đến 100.');
        return;
      }
      vehicle.stateOfCharge = stateOfCharge;
      vehicle.status = stateOfCharge >= 90 ? 'ready' : 'charging';
      persistOperations('Cập nhật pin xe', vehicle.plate, `SoC ${stateOfCharge}%`);
    } else if (button.dataset.action === 'fleet-maintenance') {
      const dueDate = window.prompt('Nhập ngày bảo dưỡng tiếp theo (YYYY-MM-DD):', vehicle.maintenanceDue);
      if (!dueDate) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(new Date(`${dueDate}T00:00:00`).getTime())) {
        window.alert('Ngày không hợp lệ. Vui lòng nhập YYYY-MM-DD.');
        return;
      }
      vehicle.maintenanceDue = dueDate;
      const setMaintenance = window.confirm('Đánh dấu xe đang vào bảo dưỡng? Chọn Hủy để chỉ cập nhật lịch.');
      if (setMaintenance) vehicle.status = 'maintenance';
      persistOperations('Cập nhật bảo dưỡng xe', vehicle.plate, `Lịch tiếp theo ${dueDate}`);
    } else if (button.dataset.action === 'fleet-documents') {
      const documentType = window.prompt('Nhập "dangkiem" hoặc "baohiem":');
      if (!documentType) return;
      const field = documentType.trim().toLocaleLowerCase('vi') === 'dangkiem'
        ? 'inspectionDue'
        : documentType.trim().toLocaleLowerCase('vi') === 'baohiem'
          ? 'insuranceDue'
          : '';
      if (!field) {
        window.alert('Loại hồ sơ không hợp lệ.');
        return;
      }
      const dueDate = window.prompt('Hạn tiếp theo (YYYY-MM-DD):', vehicle[field]);
      if (!dueDate) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(new Date(`${dueDate}T00:00:00`).getTime())) {
        window.alert('Ngày không hợp lệ. Vui lòng nhập YYYY-MM-DD.');
        return;
      }
      vehicle[field] = dueDate;
      persistOperations('Cập nhật hồ sơ xe', vehicle.plate, `${field}: ${dueDate}`);
    }
  });

  document.getElementById('admin-drivers-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const driver = operationsState.drivers.find((item) => item.id === button.dataset.id);
    if (!driver) return;
    if (button.dataset.action === 'driver-approve') {
      if (driver.approved) {
        window.alert(`Hồ sơ: ${driver.name}\nĐiện thoại: ${driver.phone || 'Chưa cập nhật'}\nĐánh giá: ${driver.rating ?? 'Chưa có'}\nTổng chuyến: ${driver.trips || 0}\nTrạng thái: ${driver.blocked ? 'Đã khóa' : 'Hoạt động'}`);
        return;
      }
      if (!window.confirm(`Duyệt hồ sơ tài xế ${driver.name}?`)) return;
      driver.approved = true;
      persistOperations('Duyệt hồ sơ tài xế', driver.name, 'Trạng thái hồ sơ đã duyệt');
    } else if (button.dataset.action === 'driver-shift') {
      driver.shift = driver.shift === 'on' ? 'off' : 'on';
      persistOperations('Cập nhật ca trực', driver.name, `Ca trực ${driver.shift === 'on' ? 'đang hoạt động' : 'đã kết thúc'}`);
    } else if (button.dataset.action === 'driver-block') {
      const nextBlocked = !driver.blocked;
      if (!window.confirm(`${nextBlocked ? 'Khóa' : 'Mở khóa'} tài khoản demo của ${driver.name}?`)) return;
      driver.blocked = nextBlocked;
      persistOperations(nextBlocked ? 'Khóa tài khoản tài xế' : 'Mở khóa tài khoản tài xế', driver.name, 'Trạng thái demo đã cập nhật');
    } else if (button.dataset.action === 'driver-wallet') {
      const type = window.prompt('Nhập "thuong" để thưởng hoặc "phat" để ghi nhận phạt:');
      if (!type) return;
      const amountRaw = window.prompt('Số tiền (VND):');
      if (amountRaw === null) return;
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount) || amount <= 0) {
        window.alert('Số tiền phải lớn hơn 0.');
        return;
      }
      if (type.trim().toLocaleLowerCase('vi') === 'thuong') {
        driver.incentiveBalance = (driver.incentiveBalance || 0) + amount;
        driver.walletBalance = (driver.walletBalance || 0) + amount;
      } else if (type.trim().toLocaleLowerCase('vi') === 'phat') {
        driver.penaltyBalance = (driver.penaltyBalance || 0) + amount;
        driver.walletBalance = Math.max(0, (driver.walletBalance || 0) - amount);
      } else {
        window.alert('Loại giao dịch không hợp lệ.');
        return;
      }
      persistOperations(type.trim().toLowerCase() === 'thuong' ? 'Thưởng tài xế' : 'Ghi nhận phạt tài xế', driver.name, formatVND(amount));
    }
  });

  document.getElementById('driver-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('driver-name').value.trim();
    const phone = document.getElementById('driver-phone').value.trim();
    const vehicleModel = driverVehicleSelect.value;
    if (operationsState.drivers.some((driver) => driver.phone === phone)) {
      window.alert('Số điện thoại tài xế đã có trong danh sách.');
      return;
    }
    operationsState.drivers.push({
      id: `DRV-${Date.now().toString().slice(-6)}`,
      name,
      phone,
      vehicleModel,
      rating: null,
      approved: false,
      blocked: false,
      shift: 'off',
      walletBalance: 0,
      incentiveBalance: 0,
      penaltyBalance: 0,
      paidOut: 0,
      trips: 0,
      earnings: 0,
    });
    event.currentTarget.reset();
    persistOperations('Tạo hồ sơ tài xế demo', name, `${phone} · ${vehicleModel} · Chờ duyệt`);
  });

  document.getElementById('admin-incidents-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="incident-resolve"]');
    if (!button) return;
    const incident = operationsState.incidents.find((item) => item.id === button.dataset.id);
    if (!incident || !window.confirm(`Đóng sự cố ${incident.id}?`)) return;
    incident.status = 'resolved';
    persistOperations('Đóng sự cố vận hành', incident.id, incident.detail);
  });

  document.getElementById('btn-add-incident')?.addEventListener('click', () => {
    const bookingId = window.prompt('Mã chuyến liên quan (để trống nếu chưa có):') || '';
    if (bookingId && !bookingStore.getById(bookingId)) {
      window.alert('Không tìm thấy mã đơn này.');
      return;
    }
    const detail = window.prompt('Mô tả sự cố:');
    if (!detail?.trim()) return;
    const urgent = window.confirm('Đây có phải sự cố khẩn cấp?');
    operationsState.incidents.unshift({
      id: `INC-${Date.now().toString().slice(-6)}`,
      bookingId,
      detail: detail.trim(),
      severity: urgent ? 'urgent' : 'normal',
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    persistOperations('Tiếp nhận sự cố', bookingId || 'Chưa gắn chuyến', detail.trim());
  });

  document.getElementById('admin-customers-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const phone = button.dataset.phone;
    if (button.dataset.action === 'customer-history') {
      const booking = bookingsState.find((item) => item.customer?.phone === phone);
      if (searchTableInput) searchTableInput.value = phone;
      selectTab('bookings');
      renderOrdersTable('all', phone);
      if (!booking) window.alert('Khách hàng chưa có chuyến đặt xe.');
      return;
    }
    if (button.dataset.action === 'customer-blacklist') {
      const existingIndex = operationsState.blacklist.findIndex((item) => item.phone === phone);
      if (existingIndex >= 0) {
        operationsState.blacklist.splice(existingIndex, 1);
        persistOperations('Gỡ hạn chế khách hàng', phone, 'Đã gỡ khỏi danh sách hạn chế');
      } else {
        addBlacklistEntry(phone);
      }
    }
  });

  function addBlacklistEntry(phone) {
    const booking = bookingsState.find((item) => item.customer?.phone === phone);
    if (!booking || !phone) return;
    if (operationsState.blacklist.some((entry) => entry.phone === phone)) return;
    const reason = window.prompt(`Lý do hạn chế ${booking.customer.name}:`);
    if (!reason?.trim()) return;
    operationsState.blacklist.push({
      name: booking.customer.name,
      phone,
      reason: reason.trim(),
      createdAt: todayISO(),
    });
    persistOperations('Hạn chế tài khoản khách hàng', phone, reason.trim());
  }

  document.getElementById('admin-blacklist-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="customer-unblacklist"]');
    if (!button) return;
    operationsState.blacklist = operationsState.blacklist.filter((entry) => entry.phone !== button.dataset.phone);
    persistOperations('Gỡ hạn chế khách hàng', button.dataset.phone, 'Đã gỡ khỏi danh sách hạn chế');
  });

  document.getElementById('btn-add-blacklist')?.addEventListener('click', () => {
    const phone = window.prompt('Số điện thoại khách hàng cần hạn chế:');
    if (phone === null) return;
    addBlacklistEntry(phone.trim());
  });

  document.getElementById('admin-complaints-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="complaint-resolve"]');
    if (!button) return;
    const complaint = operationsState.complaints.find((item) => item.id === button.dataset.id);
    if (!complaint) return;
    complaint.status = 'resolved';
    persistOperations('Đóng khiếu nại', complaint.id, complaint.category);
  });

  document.getElementById('btn-add-complaint')?.addEventListener('click', () => {
    const phone = window.prompt('Số điện thoại khách hàng:');
    if (phone === null) return;
    const customer = bookingsState.find((booking) => booking.customer?.phone === phone.trim())?.customer;
    const detail = window.prompt('Nội dung khiếu nại:');
    if (!detail?.trim()) return;
    const bookingId = window.prompt('Mã đơn liên quan (không bắt buộc):') || '';
    if (bookingId && !bookingStore.getById(bookingId)) {
      window.alert('Không tìm thấy mã đơn này.');
      return;
    }
    operationsState.complaints.unshift({
      id: `CS-${Date.now().toString().slice(-6)}`,
      bookingId,
      customerName: customer?.name || 'Khách hàng chưa xác minh',
      phone: phone.trim(),
      category: 'Yêu cầu khách hàng',
      detail: detail.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    persistOperations('Tiếp nhận khiếu nại', bookingId || phone.trim(), detail.trim());
  });

  document.getElementById('admin-payments-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="payment-reconcile"]');
    if (!button) return;
    const booking = bookingStore.getById(button.dataset.id);
    if (!booking || !window.confirm('Đánh dấu khoản này đã nhận trong bản demo? Chưa xác nhận với cổng thanh toán thật.')) return;
    bookingStore.update(booking.bookingId, { payment: { ...(booking.payment || {}), status: 'paid' } });
    persistOperations('Đối soát giao dịch demo', booking.bookingId, formatVND(booking.fare?.totalAmount));
  });

  document.getElementById('admin-payroll-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="driver-payout"]');
    if (!button) return;
    const driver = operationsState.drivers.find((item) => item.id === button.dataset.id);
    if (!driver) return;
    const amount = bookingsState
      .filter((booking) => booking.status === 'completed' && booking.driver?.name === driver.name)
      .reduce((sum, booking) => sum + Math.round((Number(booking.fare?.totalAmount) || 0) * 0.8), 0);
    const outstanding = amount - (driver.paidOut || 0);
    if (outstanding <= 0 || !window.confirm(`Xác nhận chi trả demo ${formatVND(outstanding)} cho ${driver.name}?`)) return;
    driver.paidOut = (driver.paidOut || 0) + outstanding;
    driver.walletBalance = Math.max(0, (driver.walletBalance || 0) - outstanding);
    persistOperations('Chi trả tài xế demo', driver.name, formatVND(outstanding));
  });

  document.getElementById('btn-add-promotion')?.addEventListener('click', () => {
    document.getElementById('promotion-code')?.focus();
  });
  document.getElementById('promotion-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = document.getElementById('promotion-code').value.trim().toUpperCase();
    const type = document.getElementById('promotion-type').value;
    const discountValue = Number(document.getElementById('promotion-value').value);
    const maxDiscount = Number(document.getElementById('promotion-cap').value) || 0;
    const description = document.getElementById('promotion-description').value.trim();
    if (!/^[A-Z0-9_-]{3,20}$/.test(code) || pricingState.promotions.some((promotion) => promotion.code === code)) {
      window.alert('Mã voucher phải có 3–20 ký tự chữ/số và chưa được sử dụng.');
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0 || (type === 'percentage' && discountValue > 100)) {
      window.alert('Mức giảm không hợp lệ. Voucher phần trăm tối đa 100%.');
      return;
    }
    pricingState.promotions.push({
      code,
      discountType: type,
      discountValue,
      ...(type === 'percentage' && maxDiscount > 0 ? { maxDiscount } : {}),
      description,
      active: true,
    });
    savePricingConfig(pricingState);
    event.currentTarget.reset();
    recordAudit('Phát hành voucher', code, description);
    renderAll();
    window.alert(`Đã phát hành ${code}. Mã sẽ được áp dụng bởi bộ tính cước trên trang đặt xe.`);
  });

  document.getElementById('admin-promotions-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="promotion-toggle"]');
    if (!button) return;
    const promotion = pricingState.promotions.find((item) => item.code === button.dataset.id);
    if (!promotion) return;
    promotion.active = promotion.active === false;
    savePricingConfig(pricingState);
    recordAudit(promotion.active ? 'Kích hoạt voucher' : 'Tạm dừng voucher', promotion.code, 'Đã cập nhật trạng thái áp dụng');
    renderAll();
  });

  document.getElementById('btn-save-pricing')?.addEventListener('click', () => {
    const rates = [];
    document.querySelectorAll('#admin-pricing-table tr[data-rate-id]').forEach((row) => {
      const values = {};
      row.querySelectorAll('[data-rate-field]').forEach((input) => {
        const value = Number(input.value);
        if (!input.value.trim() || !Number.isFinite(value) || value < 0) values.invalid = true;
        else values[input.dataset.rateField] = value;
      });
      rates.push({ modelId: row.dataset.rateId, values });
    });
    if (rates.some((item) => item.values.invalid)) {
      window.alert('Các mức giá phải là số hợp lệ từ 0 trở lên.');
      return;
    }

    const peakRanges = document.getElementById('pricing-peak-hours').value.trim();
    const peakPercent = Number(document.getElementById('pricing-peak-percent').value);
    const rainPercent = Number(document.getElementById('pricing-rain-percent').value);
    const nightPercent = Number(document.getElementById('pricing-night-percent').value);
    const hourlyFee = Number(document.getElementById('pricing-hourly-fee').value);
    const airportFee = Number(document.getElementById('pricing-airport-fee').value);
    const peakRangePattern = /^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d(?:,(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d)*$/;
    if ((document.getElementById('pricing-peak-enabled').checked && !peakRangePattern.test(peakRanges))
      || !Number.isFinite(peakPercent) || peakPercent < 0 || peakPercent > 300
      || !Number.isFinite(rainPercent) || rainPercent < 0 || rainPercent > 300
      || !Number.isFinite(nightPercent) || nightPercent < 0 || nightPercent > 300
      || !Number.isFinite(hourlyFee) || hourlyFee < 0
      || !Number.isFinite(airportFee) || airportFee < 0) {
      window.alert('Kiểm tra lại khung giờ, phụ phí (0–300%) và phí dịch vụ (không âm).');
      return;
    }
    const holidayDates = document.getElementById('pricing-holiday-dates').value
      .split(',')
      .map((date) => date.trim())
      .filter(Boolean);
    const validDate = (date) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
      const [year, month, day] = date.split('-').map(Number);
      const parsed = new Date(year, month - 1, day);
      return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
    };
    if (holidayDates.some((date) => !validDate(date))) {
      window.alert('Ngày lễ phải là ngày hợp lệ theo định dạng YYYY-MM-DD.');
      return;
    }

    rates.forEach(({ modelId, values }) => {
      const rate = pricingState.standardRates.find((item) => item.modelId === modelId);
      if (rate) Object.assign(rate, values);
    });
    pricingState.surcharges ||= {};
    pricingState.surcharges.peakHours = {
      enabled: document.getElementById('pricing-peak-enabled').checked,
      ranges: peakRanges,
      percentage: peakPercent,
    };
    pricingState.surcharges.rain = {
      enabled: document.getElementById('pricing-rain-enabled').checked,
      percentage: rainPercent,
    };
    pricingState.surcharges.holidaySurcharge ||= { percentage: 15 };
    pricingState.surcharges.holidaySurcharge.dates = holidayDates;
    pricingState.surcharges.nightSurcharge ||= {};
    pricingState.surcharges.nightSurcharge.percentage = nightPercent;
    pricingState.surcharges.serviceFees = {
      hourly: hourlyFee,
      airport: airportFee,
    };
    savePricingConfig(pricingState);
    operationsState.settings.rainMode = pricingState.surcharges.rain.enabled;
    saveAdminOperations(operationsState);
    recordAudit('Cập nhật bảng giá', 'Biểu giá', 'Lưu giá theo xe, giờ cao điểm và phụ phí thời tiết');
    renderAll();
    window.alert('Đã lưu bảng giá chung. Thay đổi được đọc bởi bộ tính cước trên trang đặt xe.');
  });

  document.getElementById('btn-save-operations-settings')?.addEventListener('click', () => {
    const threshold = Number(document.getElementById('setting-low-battery').value);
    if (!Number.isInteger(threshold) || threshold < 5 || threshold > 50) {
      window.alert('Ngưỡng pin phải từ 5% đến 50%.');
      return;
    }
    operationsState.settings.lowBatteryThreshold = threshold;
    operationsState.settings.rainMode = document.getElementById('setting-rain-mode').checked;
    pricingState.surcharges ||= {};
    pricingState.surcharges.rain ||= { percentage: 0 };
    pricingState.surcharges.rain.enabled = operationsState.settings.rainMode;
    savePricingConfig(pricingState);
    saveAdminOperations(operationsState);
    recordAudit('Cập nhật thông số vận hành', 'Cấu hình', `Pin thấp ${threshold}% · ${operationsState.settings.rainMode ? 'bật phụ phí mưa' : 'tắt phụ phí mưa'}`);
    renderAll();
  });

  document.getElementById('btn-clear-audit')?.addEventListener('click', () => {
    if (!window.confirm('Xóa toàn bộ nhật ký thao tác cục bộ?')) return;
    operationsState.auditLogs = [];
    saveAdminOperations(operationsState);
    renderAll();
  });

  document.getElementById('staff-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('staff-name').value.trim();
    const email = document.getElementById('staff-email').value.trim().toLocaleLowerCase('vi');
    if (operationsState.staff.some((staff) => staff.email.toLocaleLowerCase('vi') === email)) {
      window.alert('Email này đã có trong danh sách nhân viên.');
      return;
    }
    const role = document.getElementById('staff-role').value;
    operationsState.staff.push({
      id: `USR-${Date.now().toString().slice(-6)}`,
      name,
      email,
      role,
      active: true,
    });
    event.currentTarget.reset();
    persistOperations('Thêm nhân viên demo', email, `Vai trò: ${role}`);
  });

  document.getElementById('admin-staff-table')?.addEventListener('change', (event) => {
    const select = event.target.closest('.staff-role-select');
    if (!select) return;
    const staff = operationsState.staff.find((item) => item.id === select.dataset.id);
    if (!staff) return;
    staff.role = select.value;
    persistOperations('Thay đổi vai trò demo', staff.email, `Vai trò mới: ${select.value}`);
  });

  document.getElementById('admin-staff-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="staff-toggle"]');
    if (!button) return;
    const staff = operationsState.staff.find((item) => item.id === button.dataset.id);
    if (!staff) return;
    if (staff.id === 'USR-ADMIN') {
      window.alert('Không thể vô hiệu hóa tài khoản quản trị mẫu.');
      return;
    }
    staff.active = !staff.active;
    persistOperations(staff.active ? 'Kích hoạt nhân viên demo' : 'Vô hiệu hóa nhân viên demo', staff.email, 'Đã cập nhật trạng thái');
  });

  document.getElementById('crm-customer-search')?.addEventListener('input', renderCustomers);
  function renderAll() {
    bookingsState = bookingStore.getAll();
    operationsState = getAdminOperations();
    pricingState = getPricingConfig();
    renderKPI();
    renderRecentOrders();
    renderOrdersTable();
    renderFleetGrid();
    renderDriversTable();
    renderPromotions();
    renderSystemInfo();
    renderDispatch();
    renderCustomers();
    renderFinance();
  }

  document.getElementById('admin-orders-table-body')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (!id) return;

    if (action === 'complete' || action === 'cancel') {
      const nextStatus = action === 'complete' ? 'completed' : 'cancelled';
      const label = STATUS_MAP[nextStatus].text.toLocaleLowerCase('vi');
      if (!window.confirm(`Bạn có chắc muốn chuyển đơn ${id} sang trạng thái "${label}"?`)) return;
      bookingStore.updateStatus(id, nextStatus);
    } else if (action === 'delete') {
      if (!window.confirm(`Xóa đơn ${id} khỏi lịch sử đặt xe? Thao tác này sẽ đồng bộ sang trang khách hàng.`)) return;
      bookingStore.remove(id);
    }
    renderAll();
  });

  document.querySelectorAll('.btn-admin-filter').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.btn-admin-filter').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      currentFilter = button.dataset.statusFilter || 'all';
      renderOrdersTable();
    });
  });

  searchTableInput?.addEventListener('input', () => renderOrdersTable());
  document.getElementById('admin-global-search')?.addEventListener('input', (event) => {
    if (searchTableInput) searchTableInput.value = event.target.value;
    selectTab('bookings');
    renderOrdersTable();
  });
  document.getElementById('btn-view-all-orders')?.addEventListener('click', () => selectTab('bookings'));

  const modal = document.getElementById('admin-create-booking-modal');
  const form = document.getElementById('admin-create-booking-form');
  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };
  document.getElementById('btn-open-create-booking-modal')?.addEventListener('click', () => {
    if (!modal) return;
    const scheduleInput = document.getElementById('admin-new-schedule');
    if (scheduleInput && !scheduleInput.value) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - (now.getMinutes() % 5));
      scheduleInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    modal.style.display = 'flex';
  });
  document.getElementById('btn-close-create-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-create')?.addEventListener('click', closeModal);

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const readValue = (id) => document.getElementById(id).value.trim();
    const scheduledAt = new Date(readValue('admin-new-schedule'));
    if (Number.isNaN(scheduledAt.getTime())) {
      window.alert('Vui lòng chọn thời gian đón hợp lệ.');
      return;
    }

    const name = readValue('admin-new-name');
    const amount = Number(readValue('admin-new-amount'));
    const model = readValue('admin-new-car');
    const selectedCar = carsInitialData.find((car) => car.name === model);
    const driverName = readValue('admin-new-driver');
    const booking = bookingStore.add({
      customer: { name, phone: readValue('admin-new-phone') },
      serviceType: 'point-to-point',
      vehicle: { model, seats: selectedCar?.seats || 4, licensePlate: '' },
      driver: driverName ? { name: driverName } : null,
      route: {
        pickupLocation: readValue('admin-new-pickup'),
        destinationLocation: readValue('admin-new-dest'),
        distanceKm: 0,
        estimatedDurationMin: 0,
      },
      schedule: {
        pickupDate: `${scheduledAt.getFullYear()}-${String(scheduledAt.getMonth() + 1).padStart(2, '0')}-${String(scheduledAt.getDate()).padStart(2, '0')}`,
        pickupTime: `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`,
      },
      fare: { basePrice: amount, distanceCost: 0, totalAmount: amount, currency: 'VND' },
      payment: { method: readValue('admin-new-payment'), status: 'pending' },
      status: readValue('admin-new-status'),
      note: readValue('admin-new-note'),
    });

    renderAll();
    closeModal();
    form.reset();
    window.alert(`Đã tạo đơn ${booking.bookingId}. Thông tin đã đồng bộ với lịch sử đặt xe.`);
  });

  document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
    if (!window.confirm('Bạn có chắc chắn muốn đăng xuất khỏi bảng quản trị?')) return;
    localStorage.removeItem('admin_authenticated');
    window.location.href = 'admin-login.html';
  });

  window.addEventListener('storage', (event) => {
    if (event.key === 'taxivinfast_bookings') renderAll();
    if (event.key === 'taxivinfast_admin_operations' || event.key === 'taxivinfast_pricing_config') renderAll();
  });

  renderAll();
});
