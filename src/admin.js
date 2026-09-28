/**
 * TRANG QUẢN TRỊ (ADMIN) - DASHBOARD & QUẢN LÝ ĐƠN ĐẶT TAXI
 * ------------------------------------------------------------
 * Mục 32: Dashboard hiển thị tổng quan số lượng đơn
 * Mục 33: Danh sách đơn đặt taxi
 * Mục 34: Xem chi tiết một đơn đặt taxi
 * Mục 35: Cập nhật trạng thái đơn (Chờ xác nhận / Đã xác nhận / Đang thực hiện / Hoàn thành / Đã hủy)
 * Mục 36: Xóa đơn đặt taxi khỏi LocalStorage
 * Mục 37: Tìm kiếm đơn theo tên hoặc số điện thoại
 */
import './style.css';
import {
  BOOKING_STATUSES,
  bookingStore,
  computeStats,
  escapeHtml,
  filterBookings,
  formatVND,
  STORAGE_KEY,
} from './data/booking-store.js';
import {
  bindModalClose,
  bookingsTableRowsHtml,
  closeBookingDetail,
  openBookingDetail,
  statusOptionsHtml,
  toast,
} from './bookings-view.js';

/** Trạng thái bộ lọc hiện tại */
const state = {
  keyword: '',
  status: 'all',
};

const els = {};

/** Khởi tạo trang quản trị */
document.addEventListener('DOMContentLoaded', () => {
  els.statsGrid = document.getElementById('admin-stats-grid');
  els.distribution = document.getElementById('admin-distribution');
  els.tableBody = document.getElementById('admin-bookings-body');
  els.listCount = document.getElementById('admin-list-count');
  els.searchInput = document.getElementById('admin-search-input');
  els.statusFilter = document.getElementById('admin-status-filter');
  els.updatedAt = document.getElementById('admin-updated-at');
  els.storageNote = document.getElementById('admin-storage-note');
  els.btnRefresh = document.getElementById('btn-admin-refresh');
  els.btnReset = document.getElementById('btn-admin-reset');

  checkStorageSupport();
  buildFilterButtons();
  bindEvents();
  render();
});

/** Cảnh báo nếu LocalStorage không khả dụng (chế độ ẩn danh / trình duyệt cũ) */
function checkStorageSupport() {
  if (!els.storageNote) return;
  let available = false;
  try {
    const probe = '__taxivinfast_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  if (!available) {
    els.storageNote.textContent = '⚠️ LocalStorage bị chặn, dữ liệu chỉ tồn tại trong phiên làm việc';
    els.storageNote.classList.add('warning');
  }
}

/** Gắn toàn bộ sự kiện của trang */
function bindEvents() {
  // Tìm kiếm theo tên / số điện thoại / mã đơn
  els.searchInput?.addEventListener('input', (event) => {
    state.keyword = event.target.value;
    renderTable();
  });

  // Lọc theo trạng thái
  els.statusFilter?.addEventListener('click', (event) => {
    const button = event.target.closest('.btn-filter-status');
    if (!button) return;
    els.statusFilter.querySelectorAll('.btn-filter-status').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.status = button.dataset.status || 'all';
    renderTable();
  });

  // Nút làm mới
  els.btnRefresh?.addEventListener('click', () => {
    render();
    toast('Đã làm mới danh sách đơn.', 'info');
  });

  // Nút khôi phục dữ liệu mẫu (chuẩn bị dữ liệu cho buổi demo)
  els.btnReset?.addEventListener('click', () => {
    if (!window.confirm('Khôi phục dữ liệu mẫu? Toàn bộ đơn đã thêm/sửa/xóa sẽ mất.')) return;
    bookingStore.reset();
    state.keyword = '';
    state.status = 'all';
    if (els.searchInput) els.searchInput.value = '';
    els.statusFilter?.querySelectorAll('.btn-filter-status').forEach((item) => {
      item.classList.toggle('active', item.dataset.status === 'all');
    });
    render();
    toast('Đã khôi phục dữ liệu mẫu từ file bookings.json.');
  });

  // Sự kiện dùng chung cho bảng & popup chi tiết
  document.addEventListener('change', (event) => {
    const select = event.target.closest('.admin-status-select');
    if (!select) return;
    handleUpdateStatus(select.dataset.id, select.value);
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'detail') handleViewDetail(id);
    if (action === 'delete') handleDelete(id);
  });

  // Đóng popup chi tiết
  bindModalClose();
}

/** Vẽ lại toàn bộ trang (dashboard + bảng) */
function render() {
  const bookings = bookingStore.getAll();
  renderStats(bookings);
  renderDistribution(bookings);
  renderFilterCounts(bookings);
  renderTable();
  updateTimestamp();
  if (els.storageNote) els.storageNote.title = `Khóa lưu trữ: ${STORAGE_KEY}`;
}

/** Dựng nút lọc kèm số đơn từ danh sách trạng thái */
function buildFilterButtons() {
  if (!els.statusFilter) return;

  els.statusFilter.innerHTML = [
    `<button type="button" class="btn-filter-status active" data-status="all">Tất cả<span class="btn-filter-count" data-count="all">0</span></button>`,
    ...BOOKING_STATUSES.map(
      (status) => `<button type="button" class="btn-filter-status" data-status="${status.value}">
        ${status.icon} ${escapeHtml(status.text)}<span class="btn-filter-count ${status.tone}" data-count="${status.value}">0</span>
      </button>`,
    ),
  ].join('');
}

/** Cập nhật số đơn hiển thị trên từng nút lọc */
function renderFilterCounts(all) {
  if (!els.statusFilter) return;
  const counts = computeStats(all).byStatus;
  els.statusFilter.querySelectorAll('.btn-filter-count').forEach((badge) => {
    const key = badge.dataset.count;
    badge.textContent = key === 'all' ? all.length : counts[key] || 0;
  });
}

/** Mục 32: Dashboard tổng quan số lượng đơn */
function renderStats(bookings) {
  if (!els.statsGrid) return;
  const stats = computeStats(bookings);

  const cards = [
    { icon: '🧾', tone: 'primary', value: stats.total, label: 'Tổng số đơn' },
    { icon: '⏳', tone: 'warning', value: stats.byStatus.pending, label: 'Chờ xác nhận' },
    { icon: '👍', tone: 'info', value: stats.byStatus.confirmed, label: 'Đã xác nhận' },
    { icon: '🚗', tone: 'primary', value: stats.byStatus.in_progress, label: 'Đang thực hiện' },
    { icon: '✅', tone: 'success', value: stats.byStatus.completed, label: 'Hoàn thành' },
    { icon: '✕', tone: 'danger', value: stats.byStatus.cancelled, label: 'Đã hủy' },
    { icon: '📅', tone: 'today', value: stats.todayCount, label: 'Đơn đặt hôm nay' },
    { icon: '💰', tone: 'money', value: formatVND(stats.revenue), label: 'Tổng doanh thu', isMoney: true },
  ];

  els.statsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="admin-stat-card ${card.tone}">
          <span class="admin-stat-icon">${card.icon}</span>
          <div class="admin-stat-body">
            <strong class="admin-stat-value${card.isMoney ? ' money' : ''}">${escapeHtml(card.value)}</strong>
            <span class="admin-stat-label">${escapeHtml(card.label)}</span>
          </div>
        </article>`,
    )
    .join('');
}

/** Thanh phân bố tỷ lệ trạng thái đơn + chú giải */
function renderDistribution(bookings) {
  if (!els.distribution) return;

  if (!bookings.length) {
    els.distribution.innerHTML = '';
    return;
  }

  const counts = computeStats(bookings).byStatus;
  const segments = BOOKING_STATUSES.filter((status) => counts[status.value] > 0);

  const bar = segments
    .map((status) => {
      const percent = (counts[status.value] / bookings.length) * 100;
      return `<span class="admin-dist-seg ${status.tone}" style="width: ${percent.toFixed(2)}%" title="${escapeHtml(status.text)}: ${counts[status.value]} đơn"></span>`;
    })
    .join('');

  const legend = BOOKING_STATUSES.map((status) => {
    const count = counts[status.value] || 0;
    const percent = bookings.length ? Math.round((count / bookings.length) * 100) : 0;
    return `<span class="admin-dist-legend-item ${count ? '' : 'is-empty'}">
        <i class="admin-dist-dot ${status.tone}"></i>
        <span class="admin-dist-legend-text">${status.icon} ${escapeHtml(status.text)}</span>
        <b>${count}</b>
        <em>${percent}%</em>
      </span>`;
  }).join('');

  els.distribution.innerHTML = `
    <div class="admin-dist-head">
      <h2 class="admin-dist-title">📈 Tỷ lệ trạng thái đơn</h2>
      <span class="admin-dist-total">${bookings.length} đơn</span>
    </div>
    <div class="admin-dist-bar">${bar}</div>
    <div class="admin-dist-legend">${legend}</div>`;
}

/** Mục 33 + 36 + 37: Vẽ bảng danh sách đơn đã lọc */
function renderTable() {
  if (!els.tableBody) return;
  const all = bookingStore.getAll();
  const filtered = filterBookings(all, { keyword: state.keyword, status: state.status });

  els.tableBody.innerHTML = bookingsTableRowsHtml(filtered, { showActions: true });

  if (els.listCount) {
    const scope = state.status === 'all' ? 'toàn bộ' : 'theo bộ lọc';
    els.listCount.textContent = `${filtered.length} / ${all.length} đơn (${scope})`;
  }
}

function updateTimestamp() {
  if (!els.updatedAt) return;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  els.updatedAt.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  els.updatedAt.title = now.toLocaleString('vi-VN');
}

/** Mục 34: Xem chi tiết một đơn (kèm công cụ cập nhật trạng thái & xóa) */
function handleViewDetail(id) {
  const booking = bookingStore.getById(id);
  if (!booking) {
    toast('Không tìm thấy đơn này trong hệ thống.', 'error');
    render();
    return;
  }

  const actionsHtml = `
    <div class="admin-detail-actions">
      <label class="admin-detail-status">
        <span>Cập nhật trạng thái:</span>
        <select class="admin-status-select" data-id="${escapeHtml(id)}">${statusOptionsHtml(booking.status)}</select>
      </label>
      <button type="button" class="btn-delete-view" data-action="delete" data-id="${escapeHtml(id)}">🗑️ Xóa đơn này</button>
    </div>`;

  openBookingDetail(booking, { actionsHtml });
}

/** Mục 35: Cập nhật trạng thái đơn */
function handleUpdateStatus(id, status) {
  const updated = bookingStore.updateStatus(id, status);
  if (!updated) {
    toast('Cập nhật trạng thái thất bại, đơn không tồn tại.', 'error');
    render();
    return;
  }
  toast(`Đã cập nhật đơn ${id} → ${updated.statusText}.`);
  render();

  // Nếu đang mở popup chi tiết thì làm mới nội dung popup
  const modal = document.getElementById('booking-detail-modal');
  if (modal?.dataset.bookingId === id) handleViewDetail(id);
}

/** Mục 36: Xóa đơn khỏi LocalStorage */
function handleDelete(id) {
  const booking = bookingStore.getById(id);
  if (!booking) {
    toast('Đơn này không còn tồn tại.', 'error');
    render();
    return;
  }
  if (!window.confirm(`Xóa đơn ${id} của khách "${booking.customer?.name || 'Khách hàng'}"?`)) return;

  const removed = bookingStore.remove(id);
  if (!removed) {
    toast('Xóa đơn thất bại.', 'error');
    return;
  }

  closeBookingDetail();
  render();
  toast(`Đã xóa đơn ${id} khỏi hệ thống.`, 'info');
}
