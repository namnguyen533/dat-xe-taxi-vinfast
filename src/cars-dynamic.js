import './style.css';

// Hàm đọc dữ liệu JSON bằng JavaScript (async/await + fetch API)
async function fetchCarsData() {
  try {
    const response = await fetch('/data/cars.json');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const carsList = await response.json();
    return carsList;
  } catch (error) {
    console.error('Lỗi khi đọc file cars.json:', error);
    return [];
  }
}

// Hàm hiển thị danh sách xe lên giao diện HTML
function renderCarsUI(cars, containerId = 'cars-grid-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (cars.length === 0) {
    container.innerHTML = '<p class="no-data">Không có dữ liệu xe để hiển thị.</p>';
    return;
  }

  // Chuyển đổi mảng đối tượng JSON thành chuỗi HTML
  const htmlContent = cars.map(car => `
    <div class="car-card" data-category="${car.category}">
      <div class="car-image">
        <img src="${car.image}" alt="${car.name}" class="car-img" onerror="this.src='/src/assets/vf5.jpg'">
      </div>
      <div class="car-info">
        <div class="car-badge-header">
          <h3 class="car-name">${car.name}</h3>
          ${car.badge ? `<span class="badge-tag">${car.badge}</span>` : ''}
        </div>
        <p class="car-type">${car.category} (${car.seats} chỗ) - ${car.segment}</p>
        <p class="car-desc">${car.description}</p>
        
        <div class="car-specs">
          <span class="spec">🔋 Pin: ${car.specs.battery}</span>
          <span class="spec">🛣️ Quãng đường: ${car.specs.range}</span>
          <span class="spec">⚡ Công suất: ${car.specs.power}</span>
        </div>

        <div class="car-features-list">
          ${car.features.map(feat => `<span class="feat-item">✓ ${feat}</span>`).join('')}
        </div>

        <div class="car-price">
          <span class="price-label">Loại xe:</span>
          <span class="price-value">${car.seats} Chỗ Điển Hình</span>
        </div>

        <div class="car-actions">
          <a href="car-detail.html?id=${car.id}" class="btn-view">Xem chi tiết</a>
          <a href="booking.html?model=${encodeURIComponent(car.name)}" class="btn-book">Đặt xe ngay</a>
        </div>
      </div>
    </div>
  `).join('');

  container.innerHTML = htmlContent;
}

// Chạy hàm sau khi DOM đã tải xong
document.addEventListener('DOMContentLoaded', async () => {
  const carsData = await fetchCarsData();
  renderCarsUI(carsData);

  // Bộ lọc danh sách xe
  const filterBtns = document.querySelectorAll('.car-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterVal = btn.getAttribute('data-filter');
      if (filterVal === 'all') {
        renderCarsUI(carsData);
      } else {
        const filtered = carsData.filter(car => 
          car.seats === parseInt(filterVal, 10) || 
          car.category.toLowerCase().includes(filterVal.toLowerCase())
        );
        renderCarsUI(filtered);
      }
    });
  });
});

