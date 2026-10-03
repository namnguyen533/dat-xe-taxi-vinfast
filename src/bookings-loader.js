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

const state = { keyword: '', status: 'all' };
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

// Mapping badge trạng thái
function getStatusBadge(status, text) {
  switch (status) {
    case 'completed':
      return `<span class="badge-status success">✓ ${text || 'Hoàn thành'}</span>`;
    case 'in_progress':
      return `<span class="badge-status primary">🚗 ${text || 'Đang di chuyển'}</span>`;
    case 'driver_assigned':
      return `<span class="badge-status warning">⌛ ${text || 'Đang điều xe'}</span>`;
    case 'confirmed':
      return `<span class="badge-status info">👍 ${text || 'Đã xác nhận'}</span>`;
    default:
      return `<span class="badge-status secondary">${text || status}</span>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('admin_authenticated') !== 'true') {
    window.location.replace('admin-login.html?next=danhsachchuyen.html');
    return;
  }

  const tbody = document.getElementById('bookings-table-body');
  const searchInput = document.getElementById('booking-search-input');
  const statusFilter = document.getElementById('booking-status-filter');
  const emptyMessage = document.getElementById('history-empty-message');
  if (!tbody) return;

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
