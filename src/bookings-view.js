/**
 * CÁC HÀM DÙNG CHUNG ĐỂ HIỂN THỊ DANH SÁCH ĐƠN ĐẶT TAXI
 * ------------------------------------------------------------
 * Được dùng bởi cả trang Lịch sử chuyến (bookings-loader.js) và
 * trang Quản trị (admin.js) để tránh lặp lại mã HTML.
 */
import {
  BOOKING_STATUSES,
  escapeHtml,
  formatDateTime,
  formatVND,
  paymentMethodLabel,
  serviceTypeLabel,
  statusMeta,
} from './data/store.js';

/** Badge trạng thái */
export function statusBadgeHtml(status, statusText) {
  const meta = statusMeta(status);
  return `<span class="badge-status ${meta.tone}">${meta.icon} ${escapeHtml(statusText || meta.text)}</span>`;
}

/** Danh sách <option> cho ô chọn trạng thái */
export function statusOptionsHtml(selected) {
  return BOOKING_STATUSES.map(
    (status) =>
      `<option value="${status.value}"${status.value === selected ? ' selected' : ''}>${status.icon} ${status.text}</option>`,
  ).join('');
}

/** Số cột của bảng danh sách đơn (dùng cho hàng trống) */
export const BOOKINGS_TABLE_COLUMNS = 8;

/** Hàng trống khi không có dữ liệu */
export function emptyRowHtml(colspan, message) {
  return `<tr><td colspan="${colspan}" class="table-empty">${escapeHtml(message)}</td></tr>`;
}

/**
 * Hiển thị thanh tiến trình trực quan của chuyến đi (Trip Status Timeline)
 */
export function renderTimelineHtml(status, booking = null) {
  if (status === 'cancelled') {
    return `
      <div class="trip-timeline-container is-cancelled">
        <div class="timeline-cancelled-banner">
          <span class="cancel-icon">✕</span>
          <div class="cancel-text">
            <strong>Chuyến xe đã bị hủy</strong>
            <p>${escapeHtml(booking?.cancellationReason || 'Chuyến xe đã được hủy theo yêu cầu của khách hàng.')}</p>
          </div>
        </div>
      </div>
    `;
  }

  const steps = [
    { key: 'pending', label: 'Tiếp nhận đơn', icon: '📋', sub: 'Hệ thống đã nhận yêu cầu' },
    { key: 'confirmed', label: 'Đã xác nhận & Điều xe', icon: '⌛', sub: booking?.driver?.name ? `Tài xế: ${booking.driver.name}` : 'Đang chỉ định tài xế' },
    { key: 'in_progress', label: 'Đang di chuyển', icon: '🚗', sub: 'Tài xế đang chở bạn đến nơi' },
    { key: 'completed', label: 'Hoàn thành', icon: '🏁', sub: 'Đã tới điểm đến an toàn' },
  ];

  const statusOrder = ['pending', 'confirmed', 'in_progress', 'completed'];
  const currentIndex = statusOrder.indexOf(status);

  const stepsHtml = steps.map((step, idx) => {
    let stepClass = 'step-upcoming';
    if (idx < currentIndex) {
      stepClass = 'step-done';
    } else if (idx === currentIndex) {
      stepClass = 'step-active';
    }

    return `
      <div class="timeline-step ${stepClass}">
        <div class="timeline-step-icon">
          <span class="icon-sym">${idx < currentIndex ? '✓' : step.icon}</span>
        </div>
        <div class="timeline-step-content">
          <span class="timeline-step-title">${step.label}</span>
          <span class="timeline-step-sub">${step.sub}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="trip-timeline-wrapper">
      <div class="timeline-heading-label">
        <span class="pulse-indicator"></span>
        <span>Tiến trình chuyến xe thời gian thực</span>
      </div>
      <div class="trip-timeline-steps">
        ${stepsHtml}
      </div>
    </div>
  `;
}

/**
 * Sinh các <tr> cho bảng danh sách đơn
 * @param {Array} bookings danh sách đơn đã lọc
 * @param {Object} options { showActions } - bật cột thao tác admin
 */
export function bookingsTableRowsHtml(bookings, options = {}) {
  const { showActions = false } = options;

  if (!bookings || bookings.length === 0) {
    return emptyRowHtml(BOOKINGS_TABLE_COLUMNS, '🔍 Không tìm thấy đơn đặt taxi nào phù hợp.');
  }

  return bookings
    .map((booking) => {
      const customer = booking.customer || {};
      const vehicle = booking.vehicle || {};
      const driver = booking.driver || {};
      const route = booking.route || {};
      const schedule = booking.schedule || {};
      const fare = booking.fare || {};
      const id = escapeHtml(booking.bookingId);

      const statusCell = showActions
        ? `<select class="admin-status-select" data-id="${id}" aria-label="Cập nhật trạng thái đơn ${id}">${statusOptionsHtml(booking.status)}</select>`
        : statusBadgeHtml(booking.status, booking.statusText);

      let actionButtons = '';
      if (showActions) {
        actionButtons = `
          <button type="button" class="btn-detail-view" data-action="detail" data-id="${id}">Chi tiết</button>
          <button type="button" class="btn-delete-view" data-action="delete" data-id="${id}">Xóa</button>
        `;
      } else {
        // Customer view: Details + Cancel (if pending/confirmed) + Review (if completed)
        const canCancel = booking.status === 'pending' || booking.status === 'confirmed';
        const isCompleted = booking.status === 'completed';

        actionButtons = `
          <button type="button" class="btn-detail-view" data-action="detail" data-id="${id}">Chi tiết</button>
          ${canCancel ? `<button type="button" class="btn-cancel-view" data-action="cancel" data-id="${id}" title="Hủy chuyến xe">Hủy chuyến</button>` : ''}
          ${isCompleted ? `
            <button type="button" class="btn-review-view ${booking.rating ? 'has-rated' : ''}" data-action="review" data-id="${id}">
              ${booking.rating ? `⭐ ${booking.rating}★` : '⭐ Đánh giá'}
            </button>
          ` : ''}
        `;
      }

      return `
        <tr data-id="${id}">
          <td>
            <strong class="booking-id-tag">${id}</strong>
            <span class="booking-created">${formatDateTime(schedule.createdDate)}</span>
          </td>
          <td>
            <div class="user-info-cell">
              <strong>${escapeHtml(customer.name || 'Khách hàng')}</strong>
              <span>📱 ${escapeHtml(customer.phone || '—')}</span>
            </div>
          </td>
          <td>
            <span class="car-badge-sm">${escapeHtml(vehicle.model || 'VF Car')}</span>
            <span class="pay-method">${escapeHtml(serviceTypeLabel(booking.serviceType))}</span>
          </td>
          <td>
            <div class="driver-info-cell">
              <strong>${escapeHtml(driver.name || 'Chưa điều xe')}</strong>
              <span class="plate">${escapeHtml(vehicle.licensePlate || '')}</span>
            </div>
          </td>
          <td>
            <div class="route-cell">
              <span class="from">🟢 ${escapeHtml(route.pickupLocation || '—')}</span>
              <span class="to">🔴 ${escapeHtml(route.destinationLocation || '—')}</span>
              <span class="plate">${route.distanceKm ?? 0} km · ~${route.estimatedDurationMin ?? 0} phút</span>
            </div>
          </td>
          <td>
            <strong class="price-text">${formatVND(fare.totalAmount || 0)}</strong>
            <span class="pay-method">${escapeHtml(paymentMethodLabel(booking.payment?.method))}</span>
          </td>
          <td>${statusCell}</td>
          <td class="table-actions">${actionButtons}</td>
        </tr>`;
    })
    .join('');
}

/**
 * Nội dung chi tiết một đơn đặt taxi (kèm timeline, tài xế, hủy, đánh giá)
 */
export function bookingDetailHtml(booking, options = {}) {
  const customer = booking.customer || {};
  const vehicle = booking.vehicle || {};
  const driver = booking.driver || {};
  const route = booking.route || {};
  const schedule = booking.schedule || {};
  const fare = booking.fare || {};
  const payment = booking.payment || {};

  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';
  const isCompleted = booking.status === 'completed';

  const rows = [
    ['Họ và tên khách', escapeHtml(customer.name || '—')],
    ['Số điện thoại', escapeHtml(customer.phone || '—')],
    ['Email', escapeHtml(customer.email || 'Không cung cấp')],
    ['Loại dịch vụ', escapeHtml(serviceTypeLabel(booking.serviceType))],
    ['Mẫu xe đặt', `${escapeHtml(vehicle.model || '—')}${vehicle.seats ? ` (${escapeHtml(vehicle.seats)} chỗ)` : ''}`],
    ['Biển số xe', escapeHtml(vehicle.licensePlate || 'Chưa cấp')],
    ['Tài xế phụ trách', driver.name ? `${escapeHtml(driver.name)} (${escapeHtml(driver.phone || '')})` : 'Đang điều phối tài xế'],
    ['Điểm đón', escapeHtml(route.pickupLocation || '—')],
    ['Điểm đến', escapeHtml(route.destinationLocation || '—')],
    ['Khoảng cách / Thời gian', `${route.distanceKm ?? 0} km (~${route.estimatedDurationMin ?? 0} phút)`],
    ['Thời gian đón', `${escapeHtml(schedule.pickupDate || '—')} ${escapeHtml(schedule.pickupTime || '')}`],
    ['Thời gian đặt', formatDateTime(schedule.createdDate)],
    ['Phương thức thanh toán', `${escapeHtml(paymentMethodLabel(payment.method))} ${payment.status === 'paid' ? '<span class="badge-paid">✓ Đã thanh toán</span>' : '<span class="badge-unpaid">Chưa thanh toán</span>'}`],
    ['Mã giảm giá', escapeHtml(fare.discountCode || 'Không có')],
  ];

  // Khối đánh giá chuyến đi (nếu có)
  let reviewSectionHtml = '';
  if (isCompleted) {
    if (booking.rating) {
      reviewSectionHtml = `
        <div class="detail-review-card">
          <div class="review-stars-row">
            <span class="stars-gold">${'★'.repeat(booking.rating)}${'☆'.repeat(5 - booking.rating)}</span>
            <strong>(${booking.rating}/5 sao)</strong>
          </div>
          ${booking.review ? `<p class="review-quote">"${escapeHtml(booking.review)}"</p>` : ''}
          ${booking.ratingTags && booking.ratingTags.length ? `
            <div class="review-tags-list">
              ${booking.ratingTags.map(tag => `<span class="tag-pill">✓ ${escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}
          <small class="text-muted">Đã gửi đánh giá lúc: ${formatDateTime(booking.reviewedAt)}</small>
        </div>
      `;
    } else {
      reviewSectionHtml = `
        <div class="detail-review-prompt">
          <p>Chuyến đi đã hoàn thành! Bạn thấy dịch vụ thế nào?</p>
          <button type="button" class="btn-review-now" data-action="review" data-id="${escapeHtml(booking.bookingId)}">⭐ Đánh giá chuyến đi này</button>
        </div>
      `;
    }
  }

  // Khối hủy chuyến (nếu chuyến chưa khởi hành)
  let cancelActionHtml = '';
  if (canCancel) {
    cancelActionHtml = `
      <div class="detail-cancel-box">
        <span>Bạn muốn thay đổi kế hoạch?</span>
        <button type="button" class="btn-cancel-from-detail" data-action="cancel" data-id="${escapeHtml(booking.bookingId)}">
          🚫 Hủy chuyến xe này
        </button>
      </div>
    `;
  }

  return `
    <div class="receipt-body">
      <!-- 1. Thanh tiến trình trực quan -->
      ${renderTimelineHtml(booking.status, booking)}

      <hr />

      <!-- 2. Thông tin chi tiết -->
      <div class="receipt-item"><span>Trạng thái:</span> ${statusBadgeHtml(booking.status, booking.statusText)}</div>
      ${rows.map(([label, value]) => `<div class="receipt-item"><span>${label}:</span> <strong>${value}</strong></div>`).join('')}
      <hr />
      <div class="receipt-item"><span>Giá mở cửa:</span> <span>${formatVND(fare.basePrice || 0)}</span></div>
      <div class="receipt-item"><span>Cước quãng đường:</span> <span>${formatVND(fare.distanceCost || 0)}</span></div>
      ${fare.discountAmount ? `<div class="receipt-item text-success"><span>Khuyến mãi:</span> <span>- ${formatVND(fare.discountAmount)}</span></div>` : ''}
      <div class="receipt-item total"><span>Tổng chi phí:</span> <strong class="receipt-price">${formatVND(fare.totalAmount || 0)}</strong></div>
      <div class="receipt-item"><span>Ghi chú:</span> <em>${escapeHtml(booking.note || 'Không có ghi chú')}</em></div>

      <!-- 3. Đánh giá hoặc Hủy chuyến -->
      ${reviewSectionHtml}
      ${cancelActionHtml}

      ${options.actionsHtml || ''}
    </div>`;
}

/** Mở popup chi tiết đơn */
export function openBookingDetail(booking, options = {}) {
  const modal = document.getElementById('booking-detail-modal');
  const detailId = document.getElementById('detail-id');
  const content = document.getElementById('modal-detail-content');
  if (!modal || !detailId || !content) return;

  detailId.textContent = `#${booking.bookingId}`;
  content.innerHTML = bookingDetailHtml(booking, options);
  modal.style.display = 'flex';
  modal.dataset.bookingId = booking.bookingId;
}

/** Đóng popup chi tiết */
export function closeBookingDetail() {
  const modal = document.getElementById('booking-detail-modal');
  if (modal) {
    modal.style.display = 'none';
    delete modal.dataset.bookingId;
  }
}

/** Gắn sự kiện đóng popup (nút đóng + bấm ra ngoài + phím Esc) */
export function bindModalClose() {
  const modal = document.getElementById('booking-detail-modal');
  if (!modal) return;

  document.getElementById('btn-close-detail')?.addEventListener('click', closeBookingDetail);
  document.getElementById('btn-done-detail')?.addEventListener('click', closeBookingDetail);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeBookingDetail();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeBookingDetail();
  });
}

/** Hiển thị thông báo nhỏ góc phải màn hình */
export function toast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const item = document.createElement('div');
  item.className = `toast-item ${type}`;
  item.textContent = message;
  container.appendChild(item);

  setTimeout(() => {
    item.classList.add('hide');
    setTimeout(() => item.remove(), 300);
  }, 2600);
}
