import './style.css';

// 1. Hàm đọc dữ liệu JSON bằng JavaScript (fetch API + async/await)
async function fetchBookingsData() {
  try {
    const response = await fetch('/data/bookings.json');
    if (!response.ok) {
      throw new Error(`Lỗi HTTP: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Không thể đọc dữ liệu từ file bookings.json:', error);
    return [];
  }
}

// Format tiền tệ VND
function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
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

// 2. Hàm hiển thị dữ liệu ra giao diện HTML (Bảng chuyến xe & Thống kê)
function renderBookingsUI(bookings) {
  const tbody = document.getElementById('bookings-table-body');
  if (!tbody) return;

  // Thống kê nhanh
  const totalCount = bookings.length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const movingCount = bookings.filter(b => b.status === 'in_progress' || b.status === 'driver_assigned').length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.fare.totalAmount || 0), 0);

  document.getElementById('stat-total-count').textContent = totalCount;
  document.getElementById('stat-completed-count').textContent = completedCount;
  document.getElementById('stat-moving-count').textContent = movingCount;
  document.getElementById('stat-total-revenue').textContent = formatVND(totalRevenue);

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
          <strong>${b.customer.name}</strong>
          <span>📱 ${b.customer.phone}</span>
        </div>
      </td>
      <td>
        <span class="car-badge-sm">${b.vehicle.model}</span>
      </td>
      <td>
        <div class="driver-info-cell">
          <strong>${b.driver.name}</strong>
          <span class="plate">${b.vehicle.licensePlate}</span>
        </div>
      </td>
      <td>
        <div class="route-cell">
          <span class="from">🟢 ${b.route.pickupLocation}</span>
          <span class="to">🔴 ${b.route.destinationLocation}</span>
        </div>
      </td>
      <td>
        <strong class="price-text">${formatVND(b.fare.totalAmount)}</strong>
        <span class="pay-method">${b.payment.method.toUpperCase()}</span>
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
        b.customer.name.toLowerCase().includes(keyword) ||
        b.customer.phone.includes(keyword) ||
        b.route.pickupLocation.toLowerCase().includes(keyword) ||
        b.route.destinationLocation.toLowerCase().includes(keyword)
      );
      renderBookingsUI(filtered);
    });
  }

  // Xử lý Lọc theo trạng thái
  const statusBtns = document.querySelectorAll('.btn-filter-status');
  statusBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      statusBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const status = btn.getAttribute('data-status');
      if (status === 'all') {
        renderBookingsUI(rawBookings);
      } else {
        const filtered = rawBookings.filter(b => b.status === status);
        renderBookingsUI(filtered);
      }
    });
  });

  // Đóng Modal
  const modal = document.getElementById('booking-detail-modal');
  const btnClose = document.getElementById('btn-close-detail');
  const btnDone = document.getElementById('btn-done-detail');

  if (btnClose) btnClose.addEventListener('click', () => modal.style.display = 'none');
  if (btnDone) btnDone.addEventListener('click', () => modal.style.display = 'none');
});

