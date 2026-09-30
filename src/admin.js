import './style.css';
import bookingsInitialData from './data/bookings.json';
import carsInitialData from './data/cars.json';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Kiểm tra quyền truy cập (Auth Guard)
  const isAuth = localStorage.getItem('admin_authenticated');
  if (isAuth !== 'true') {
    // Nếu chưa đăng nhập -> Chuyển hướng về trang đăng nhập admin
    window.location.href = 'admin-login.html';
    return;
  }

  // Cập nhật tên hiển thị admin
  const storedUser = localStorage.getItem('admin_user');
  if (storedUser) {
    try {
      const u = JSON.parse(storedUser);
      const nameEl = document.getElementById('admin-display-name');
      if (nameEl) nameEl.textContent = u.name;
    } catch (e) {}
  }

  // 2. Đồng hồ Live Clock
  const clockEl = document.getElementById('live-clock');
  function updateClock() {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('vi-VN');
  }
  setInterval(updateClock, 1000);
  updateClock();

  // 3. Quản lý trạng thái dữ liệu (State Management with LocalStorage)
  let bookingsState = JSON.parse(localStorage.getItem('admin_bookings_data')) || bookingsInitialData;
  let carsState = JSON.parse(localStorage.getItem('admin_cars_data')) || carsInitialData;

  function saveState() {
    localStorage.setItem('admin_bookings_data', JSON.stringify(bookingsState));
  }

  // Helper Format VND
  const fmtVND = (amt) => new Intl.NumberFormat('vi-VN').format(amt || 0) + ' đ';

  // 4. Tab Navigation Logic
  const tabBtns = document.querySelectorAll('.sidebar-tab-btn');
  const tabContents = document.querySelectorAll('.admin-tab-content');
  const pageTitle = document.getElementById('page-heading-title');

  const tabTitleMap = {
    dashboard: '📊 Bảng Điều Khiển Tổng Quan KPI',
    bookings: '🚕 Quản Lý Danh Sách Đơn Đặt Xe',
    fleet: '🚗 Quản Lý Đội Xe Điện VinFast',
    drivers: '👨‍✈️ Quản Lý Đội Ngũ Tài Xế',
    vouchers: '🏷️ Quản Lý Mã Khuyến Mãi & Bảng Giá',
    settings: '⚙️ Cài Đặt Hệ Thống & Cấu Hình'
  };

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(`tab-view-${targetTab}`);

      if (targetContent) targetContent.classList.add('active');
      if (pageTitle && tabTitleMap[targetTab]) pageTitle.textContent = tabTitleMap[targetTab];
    });
  });

  // 5. Render Thống Kê KPI
  function renderKPI() {
    const revEl = document.getElementById('kpi-revenue');
    const totalBookingsEl = document.getElementById('kpi-total-bookings');
    const liveCountBadge = document.getElementById('live-orders-count');

    const totalRevenue = bookingsState.reduce((sum, b) => sum + (b.fare ? b.fare.totalAmount || 0 : 0), 0) + 1840000000;
    const totalBookings = bookingsState.length + 1240;
    const activeOrdersCount = bookingsState.filter(b => b.status === 'driver_assigned' || b.status === 'in_progress').length;

    if (revEl) revEl.textContent = fmtVND(totalRevenue);
    if (totalBookingsEl) totalBookingsEl.textContent = `${totalBookings} Chuyến`;
    if (liveCountBadge) liveCountBadge.textContent = activeOrdersCount;
  }

  // 6. Render Bảng Đơn Hàng Admin
  function renderOrdersTable(filterStatus = 'all', keyword = '') {
    const tbody = document.getElementById('admin-orders-table-body');
    const dashTbody = document.getElementById('dashboard-recent-orders');

    if (!tbody) return;

    // Lọc theo trạng thái và từ khóa tìm kiếm
    let filtered = bookingsState.filter(b => {
      const matchStatus = (filterStatus === 'all') || (b.status === filterStatus);
      const kw = keyword.toLowerCase().trim();
      const matchKw = !kw || 
        b.bookingId.toLowerCase().includes(kw) ||
        (b.customer && b.customer.name.toLowerCase().includes(kw)) ||
        (b.customer && b.customer.phone.includes(kw)) ||
        (b.route && b.route.pickupLocation.toLowerCase().includes(kw));

      return matchStatus && matchKw;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Không tìm thấy đơn hàng nào.</td></tr>`;
      return;
    }

    const rowsHtml = filtered.map(b => {
      let statusBadge = `<span class="badge-status secondary">${b.statusText || b.status}</span>`;
      if (b.status === 'completed') statusBadge = `<span class="badge-status success">✓ Hoàn thành</span>`;
      if (b.status === 'in_progress') statusBadge = `<span class="badge-status primary">🚗 Đang chạy</span>`;
      if (b.status === 'driver_assigned') statusBadge = `<span class="badge-status warning">⌛ Đang điều xe</span>`;

      return `
        <tr>
          <td><strong class="booking-id-tag">${b.bookingId}</strong></td>
          <td>
            <div class="user-info-cell">
              <strong>${b.customer ? b.customer.name : 'Khách hàng'}</strong>
              <span>📱 ${b.customer ? b.customer.phone : ''}</span>
            </div>
          </td>
          <td><span class="car-badge-sm">${b.vehicle ? b.vehicle.model : 'VF Car'}</span></td>
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
          <td><strong class="price-text">${fmtVND(b.fare ? b.fare.totalAmount : 0)}</strong></td>
          <td>${statusBadge}</td>
          <td>
            <div class="action-buttons-cell">
              ${b.status !== 'completed' ? `<button class="btn-sm-action approve" data-id="${b.bookingId}" title="Hoàn thành chuyến">✓ Duyệt</button>` : ''}
              <button class="btn-sm-action delete" data-id="${b.bookingId}" title="Xóa đơn">🗑️ Xóa</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;

    // Hiển thị xem nhanh trên Dashboard
    if (dashTbody) {
      dashTbody.innerHTML = filtered.slice(0, 4).map(b => `
        <tr>
          <td><strong class="booking-id-tag">${b.bookingId}</strong></td>
          <td><strong>${b.customer ? b.customer.name : ''}</strong></td>
          <td><span class="car-badge-sm">${b.vehicle ? b.vehicle.model : ''}</span></td>
          <td><span class="route-truncate">${b.route ? b.route.pickupLocation : ''}</span></td>
          <td><strong class="price-text">${fmtVND(b.fare ? b.fare.totalAmount : 0)}</strong></td>
          <td><span class="badge-status success">${b.statusText || 'OK'}</span></td>
        </tr>
      `).join('');
    }

    // Gắn sự kiện duyệt & xóa đơn
    tbody.querySelectorAll('.approve').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = bookingsState.find(x => x.bookingId === id);
        if (item) {
          item.status = 'completed';
          item.statusText = 'Hoàn thành';
          saveState();
          renderOrdersTable(filterStatus, keyword);
          renderKPI();
        }
      });
    });

    tbody.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm(`Bạn có chắc chắn muốn xóa đơn hàng #${id}?`)) {
          bookingsState = bookingsState.filter(x => x.bookingId !== id);
          saveState();
          renderOrdersTable(filterStatus, keyword);
          renderKPI();
        }
      });
    });
  }

  // 7. Render Đội Xe Fleet Tab
  function renderFleetGrid() {
    const fleetGrid = document.getElementById('admin-fleet-grid');
    if (!fleetGrid) return;

    fleetGrid.innerHTML = carsState.map(car => `
      <div class="fleet-admin-card">
        <img src="${car.image}" alt="${car.name}" class="fleet-admin-img" onerror="this.src='/src/assets/vf5.jpg'" />
        <div class="fleet-admin-body">
          <h4>${car.name}</h4>
          <p class="car-type">${car.category} (${car.seats} chỗ)</p>
          <div class="fleet-specs">
            <span>🔋 Pin: ${car.specs ? car.specs.battery : 'Lithium'}</span>
            <span>🛣️ ${car.specs ? car.specs.range : '300 km'}</span>
          </div>
          <div class="fleet-footer-status">
            <span class="badge-status success">🟢 Sẵn sàng phục vụ</span>
            <button class="btn-sm-action edit" onclick="alert('Đã cập nhật trạng thái xe ${car.name}');">⚡ Cấu hình</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // 8. Render Tài Xế Tab
  function renderDriversTable() {
    const tbody = document.getElementById('admin-drivers-table');
    if (!tbody) return;

    const drivers = [
      { name: 'Trần Thanh Sơn', phone: '0903 112 233', car: 'VinFast VF 5 Plus', plate: '51K-882.19', rating: '4.9 ⭐', trips: 142, status: 'Đang chạy' },
      { name: 'Lê Hoàng Nam', phone: '0977 445 566', car: 'VinFast VF 8', plate: '30H-991.82', rating: '5.0 ⭐', trips: 210, status: 'Đang chạy' },
      { name: 'Đặng Văn Hùng', phone: '0918 887 766', car: 'VinFast VF 3', plate: '51L-123.45', rating: '4.8 ⭐', trips: 89, status: 'Sẵn sàng' },
      { name: 'Nguyễn Hoàng Đức', phone: '0933 665 544', car: 'VinFast VF 9', plate: '51K-999.99', rating: '5.0 ⭐', trips: 175, status: 'Sẵn sàng' }
    ];

    tbody.innerHTML = drivers.map(d => `
      <tr>
        <td><strong>${d.name}</strong></td>
        <td>${d.phone}</td>
        <td><span class="car-badge-sm">${d.car}</span></td>
        <td><strong class="plate">${d.plate}</strong></td>
        <td><span class="text-warning">${d.rating}</span></td>
        <td><strong>${d.trips} chuyến</strong></td>
        <td><span class="badge-status success">${d.status}</span></td>
        <td><button class="btn-sm-action" onclick="alert('Xem chi tiết tài xế ${d.name}');">Xem</button></td>
      </tr>
    `).join('');
  }

  // 9. Xử lý Lọc & Tìm kiếm
  const filterBtns = document.querySelectorAll('.btn-admin-filter');
  let currentFilter = 'all';

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-status-filter');
      renderOrdersTable(currentFilter, searchTableInput ? searchTableInput.value : '');
    });
  });

  const searchTableInput = document.getElementById('booking-search-table');
  if (searchTableInput) {
    searchTableInput.addEventListener('input', (e) => {
      renderOrdersTable(currentFilter, e.target.value);
    });
  }

  // 10. Modal Tạo Đơn Hàng Mới Từ Admin
  const modalCreate = document.getElementById('admin-create-booking-modal');
  const btnOpenCreate = document.getElementById('btn-open-create-booking-modal');
  const btnCloseCreate = document.getElementById('btn-close-create-modal');
  const btnCancelCreate = document.getElementById('btn-cancel-create');
  const formCreate = document.getElementById('admin-create-booking-form');

  if (btnOpenCreate) btnOpenCreate.addEventListener('click', () => modalCreate.style.display = 'flex');
  if (btnCloseCreate) btnCloseCreate.addEventListener('click', () => modalCreate.style.display = 'none');
  if (btnCancelCreate) btnCancelCreate.addEventListener('click', () => modalCreate.style.display = 'none');

  if (formCreate) {
    formCreate.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('admin-new-name').value.trim();
      const phone = document.getElementById('admin-new-phone').value.trim();
      const pickup = document.getElementById('admin-new-pickup').value.trim();
      const dest = document.getElementById('admin-new-dest').value.trim();
      const car = document.getElementById('admin-new-car').value;
      const driver = document.getElementById('admin-new-driver').value;
      const amount = parseInt(document.getElementById('admin-new-amount').value, 10) || 150000;
      const status = document.getElementById('admin-new-status').value;

      const newBooking = {
        bookingId: 'VF-ADM-' + Math.floor(1000 + Math.random() * 9000),
        customer: { name, phone, email: `${name.toLowerCase().replace(/\s+/g, '')}@gmail.com` },
        serviceType: 'point-to-point',
        vehicle: { model: car, seats: 5, licensePlate: '51K-ADM88' },
        driver: { name: driver, phone: '0903 112 233', rating: 5.0 },
        route: { pickupLocation: pickup, destinationLocation: dest, distanceKm: 15, estimatedDurationMin: 30 },
        schedule: { pickupDate: '2026-09-30', pickupTime: '15:30' },
        fare: { basePrice: 12000, distanceCost: amount - 12000, totalAmount: amount },
        payment: { method: 'cash', status: 'paid' },
        status: status,
        statusText: status === 'completed' ? 'Hoàn thành' : 'Đang điều xe'
      };

      bookingsState.unshift(newBooking);
      saveState();
      renderOrdersTable(currentFilter);
      renderKPI();

      modalCreate.style.display = 'none';
      formCreate.reset();
      alert(`🎉 Đã tạo mới đơn đặt xe #${newBooking.bookingId} thành công!`);
    });
  }

  // 11. Đăng xuất Admin
  const btnLogout = document.getElementById('btn-admin-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi Bảng Quản Trị?')) {
        localStorage.removeItem('admin_authenticated');
        window.location.href = 'admin-login.html';
      }
    });
  }

  // Khởi chạy dữ liệu Admin ban đầu
  renderKPI();
  renderOrdersTable();
  renderFleetGrid();
  renderDriversTable();
});
