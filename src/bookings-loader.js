/**
 * TRANG LỊCH SỬ CHUYẾN XE (góc nhìn của khách hàng)
 * ------------------------------------------------------------
 * Đọc dữ liệu đơn đặt taxi từ LocalStorage (dùng chung module store với
 * trang Đặt xe và trang Quản trị), cho phép xem thống kê nhanh,
 * tìm kiếm theo tên / số điện thoại / mã đơn và xem chi tiết từng chuyến.
 */
import './style.css';
import { bookingStore, computeStats, filterBookings, formatVND } from './data/booking-store.js';
import {
  bindModalClose,
  BOOKINGS_TABLE_COLUMNS,
  bookingsTableRowsHtml,
  emptyRowHtml,
  openBookingDetail,
} from './bookings-view.js';

<<<<<<< HEAD
const state = { keyword: '', status: 'all' };
=======
// 1. Hàm đọc dữ liệu JSON bằng JavaScript (fetch API + async/await)
// 1. Hàm đọc dữ liệu JSON bằng JavaScript an toàn (Tránh lỗi HTTP 500 / 404)
async function fetchBookingsData() {
  try {
    const response = await fetch('/data/bookings.json');
    if (!response.ok) {
      throw new Error(`Lỗi HTTP: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Không thể fetch /data/bookings.json, tự động dùng dữ liệu nạp sẵn:', error);
    return bookingsLocalData;
  }
}
>>>>>>> 7d61d14 (update lại giao diện và sửa lỗi)

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('bookings-table-body');
  const searchInput = document.getElementById('booking-search-input');
  const statusFilter = document.getElementById('booking-status-filter');
  const emptyMessage = document.getElementById('history-empty-message');
  if (!tbody) return;

<<<<<<< HEAD
  /** Cập nhật thẻ thống kê tổng quan (mục 32 - phiên bản khách hàng) */
  function renderStats(bookings) {
    const stats = computeStats(bookings);
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    set('stat-total-count', stats.total);
    set('stat-completed-count', stats.byStatus.completed);
    set('stat-moving-count', stats.byStatus.in_progress + stats.byStatus.confirmed);
    set('stat-pending-count', stats.byStatus.pending);
    set('stat-total-revenue', formatVND(stats.revenue));
  }

  /** Vẽ danh sách chuyến đã lọc */
  function renderTable() {
    const all = bookingStore.getAll();
    const filtered = filterBookings(all, { keyword: state.keyword, status: state.status });

    tbody.innerHTML = bookingsTableRowsHtml(filtered);
    if (emptyMessage) emptyMessage.style.display = filtered.length === 0 ? 'block' : 'none';
=======
  // Thống kê nhanh
  const totalCount = bookings.length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const movingCount = bookings.filter(b => b.status === 'in_progress' || b.status === 'driver_assigned').length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.fare ? (b.fare.totalAmount || 0) : 0), 0);

  const totalEl = document.getElementById('stat-total-count');
  const compEl = document.getElementById('stat-completed-count');
  const movEl = document.getElementById('stat-moving-count');
  const revEl = document.getElementById('stat-total-revenue');

  if (totalEl) totalEl.textContent = totalCount;
  if (compEl) compEl.textContent = completedCount;
  if (movEl) movEl.textContent = movingCount;
  if (revEl) revEl.textContent = formatVND(totalRevenue);

  if (bookings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4">Không tìm thấy dữ liệu chuyến xe phù hợp.</td>
      </tr>
    `;
    return;
  }

  // Chuyển đổi mảng đối tượng JSON thành chuỗi tr HTML
  const rowsHtml = bookings.map(b => `
    <tr>
      <td><strong class="booking-id-tag">${b.bookingId}</strong></td>
      <td>
        <div class="user-info-cell">
          <strong>${b.customer ? b.customer.name : 'Khách hàng'}</strong>
          <span>📱 ${b.customer ? b.customer.phone : 'N/A'}</span>
        </div>
      </td>
      <td>
        <span class="car-badge-sm">${b.vehicle ? b.vehicle.model : 'VF Car'}</span>
      </td>
      <td>
        <div class="driver-info-cell">
          <strong>${b.driver ? b.driver.name : 'Tài xế'}</strong>
          <span class="plate">${b.vehicle ? b.vehicle.licensePlate : ''}</span>
        </div>
      </td>
      <td>
        <div class="route-cell">
          <span class="from">🟢 ${b.route ? b.route.pickupLocation : ''}</span>
          <span class="to">🔴 ${b.route ? b.route.destinationLocation : ''}</span>
        </div>
      </td>
      <td>
        <strong class="price-text">${formatVND(b.fare ? b.fare.totalAmount : 0)}</strong>
        <span class="pay-method">${b.payment ? b.payment.method.toUpperCase() : 'CASH'}</span>
      </td>
      <td>
        ${getStatusBadge(b.status, b.statusText)}
      </td>
      <td>
        <button type="button" class="btn-detail-view" data-id="${b.bookingId}">Chi tiết</button>
      </td>
    </tr>
  `).join('');

  tbody.innerHTML = rowsHtml;

  // Gắn sự kiện xem chi tiết
  document.querySelectorAll('.btn-detail-view').forEach(btn => {
    btn.addEventListener('click', () => {
      const bId = btn.getAttribute('data-id');
      const item = bookings.find(x => x.bookingId === bId);
      if (item) showDetailModal(item);
    });
  });
}

// 3. Hiển thị Popup Modal thông tin chi tiết chuyến xe
function showDetailModal(item) {
  const modal = document.getElementById('booking-detail-modal');
  const detailId = document.getElementById('detail-id');
  const content = document.getElementById('modal-detail-content');
  if (!modal || !detailId || !content) return;

  detailId.textContent = `#${item.bookingId}`;
  content.innerHTML = `
    <div class="receipt-body">
      <div class="receipt-item"><span>Họ và tên khách:</span> <strong>${item.customer.name}</strong></div>
      <div class="receipt-item"><span>Số điện thoại:</span> <strong>${item.customer.phone}</strong></div>
      <div class="receipt-item"><span>Email:</span> <span>${item.customer.email || 'N/A'}</span></div>
      <hr />
      <div class="receipt-item"><span>Mẫu xe đặt:</span> <strong>${item.vehicle.model} (${item.vehicle.seats} chỗ)</strong></div>
      <div class="receipt-item"><span>Tài xế đón:</span> <strong>${item.driver.name} (${item.driver.phone})</strong></div>
      <div class="receipt-item"><span>Biển số xe:</span> <strong class="car-badge-sm">${item.vehicle.licensePlate}</strong></div>
      <hr />
      <div class="receipt-item"><span>Điểm đón:</span> <span>${item.route.pickupLocation}</span></div>
      <div class="receipt-item"><span>Điểm đến:</span> <span>${item.route.destinationLocation}</span></div>
      <div class="receipt-item"><span>Khoảng cách:</span> <span>${item.route.distanceKm} km (~${item.route.estimatedDurationMin} phút)</span></div>
      <div class="receipt-item"><span>Thời gian đón:</span> <span>${item.schedule.pickupTime} - ${item.schedule.pickupDate}</span></div>
      <hr />
      <div class="receipt-item"><span>Mã giảm giá áp dụng:</span> <span>${item.fare.discountCode || 'Không có'}</span></div>
      <div class="receipt-item total"><span>Tổng chi phí:</span> <strong class="receipt-price">${formatVND(item.fare.totalAmount)}</strong></div>
      <div class="receipt-item"><span>Ghi chú:</span> <em>${item.note || 'Không có ghi chú'}</em></div>
    </div>
  `;

  modal.style.display = 'flex';
}

// Khởi chạy script
document.addEventListener('DOMContentLoaded', async () => {
  let rawBookings = await fetchBookingsData();
  renderBookingsUI(rawBookings);

  // Xử lý ô Tìm kiếm
  const searchInput = document.getElementById('booking-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const keyword = e.target.value.toLowerCase().trim();
      const filtered = rawBookings.filter(b => 
        b.bookingId.toLowerCase().includes(keyword) ||
        (b.customer && b.customer.name.toLowerCase().includes(keyword)) ||
        (b.customer && b.customer.phone.includes(keyword)) ||
        (b.route && b.route.pickupLocation.toLowerCase().includes(keyword)) ||
        (b.route && b.route.destinationLocation.toLowerCase().includes(keyword))
      );
      renderBookingsUI(filtered);
    });
>>>>>>> 7d61d14 (update lại giao diện và sửa lỗi)
  }

  function renderAll() {
    renderStats(bookingStore.getAll());
    renderTable();
  }

  // Xem chi tiết một chuyến (mục 34)
  tbody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="detail"]');
    if (!button) return;
    const booking = bookingStore.getById(button.dataset.id);
    if (booking) openBookingDetail(booking);
    else tbody.innerHTML = emptyRowHtml(BOOKINGS_TABLE_COLUMNS, 'Không tìm thấy chuyến xe này nữa.');
  });

  // Tìm kiếm theo tên / số điện thoại / mã đơn (mục 36 & 37)
  searchInput?.addEventListener('input', (event) => {
    state.keyword = event.target.value;
    renderTable();
  });

  // Lọc theo trạng thái
  statusFilter?.addEventListener('click', (event) => {
    const button = event.target.closest('.btn-filter-status');
    if (!button) return;
    statusFilter.querySelectorAll('.btn-filter-status').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.status = button.dataset.status || 'all';
    renderTable();
  });

  // Đóng popup chi tiết
  bindModalClose();

  renderAll();
  window.addEventListener('storage', renderAll);
});
