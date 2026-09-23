import './style.css'

// JavaScript functionality will be added here
console.log('TaxiVinFast website loaded');

// Set minimum date to today for booking form
const dateInput = document.getElementById('date');
let today = '';
if (dateInput) {
  today = new Date().toISOString().split('T')[0];
  dateInput.setAttribute('min', today);
  dateInput.value = today;
}

// Set default time to current time + 30 minutes
const timeInput = document.getElementById('time');
let defaultTime = '';
if (timeInput) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  defaultTime = `${hours}:${minutes}`;
  timeInput.value = defaultTime;
}

// Handle booking type change
const bookingTypeRadios = document.querySelectorAll('input[name="bookingType"]');
if (bookingTypeRadios.length > 0) {
  bookingTypeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      const dateField = document.getElementById('date');
      const timeField = document.getElementById('time');
      
      if (this.value === 'now') {
        // Set to current time + 30 minutes
        const now = new Date();
        now.setMinutes(now.getMinutes() + 30);
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeField.value = `${hours}:${minutes}`;
        dateField.value = today;
      }
      // For 'schedule', let user choose date/time
    });
  });
}

// Handle form submission
const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
  bookingForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Get form data
    const formData = new FormData(bookingForm);
    const bookingData = {
      pickup: formData.get('pickup'),
      dropoff: formData.get('dropoff'),
      date: formData.get('date'),
      time: formData.get('time'),
      bookingType: formData.get('bookingType'),
      phone: formData.get('phone'),
      name: formData.get('name'),
      email: formData.get('email'),
      car: formData.get('car'),
      notes: formData.get('notes')
    };
    
    // Validate phone number
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(bookingData.phone)) {
      alert('Số điện thoại phải có 10 số');
      return;
    }
    
    // Validate time is at least 30 minutes in the future
    const selectedDateTime = new Date(`${bookingData.date}T${bookingData.time}`);
    const minDateTime = new Date();
    minDateTime.setMinutes(minDateTime.getMinutes() + 30);
    
    if (selectedDateTime < minDateTime) {
      alert('Thời gian đón phải ít nhất 30 phút từ hiện tại');
      return;
    }
    
    // Store booking data in localStorage for confirmation page
    localStorage.setItem('bookingData', JSON.stringify(bookingData));
    
    // Redirect to confirmation page
    window.location.href = 'confirm.html';
  });
}

// Load booking data on confirmation page
if (window.location.pathname.includes('confirm.html')) {
  const bookingData = JSON.parse(localStorage.getItem('bookingData'));
  if (bookingData) {
    // Populate confirmation page with booking data
    const elements = {
      'confirm-pickup': bookingData.pickup,
      'confirm-dropoff': bookingData.dropoff,
      'confirm-date': bookingData.date,
      'confirm-time': bookingData.time,
      'confirm-phone': bookingData.phone,
      'confirm-name': bookingData.name,
      'confirm-email': bookingData.email || 'Không cung cấp',
      'confirm-notes': bookingData.notes || 'Không có',
      'confirm-car': bookingData.car,
      'confirm-bookingType': bookingData.bookingType === 'now' ? 'Đặt ngay' : 'Đặt trước'
    };
    
    for (const [id, value] of Object.entries(elements)) {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    }
    
    // Calculate estimated price (mock calculation)
    const carPrices = {
      'vf3': 10000,
      'vf5': 12000,
      'vf6': 15000,
      'vf7': 18000,
      'vf8': 22000,
      'vf9': 28000
    };
    
    const estimatedDistance = 15; // Mock distance in km
    const estimatedPrice = carPrices[bookingData.car] * estimatedDistance;
    const priceElement = document.getElementById('confirm-price');
    if (priceElement) {
      priceElement.textContent = estimatedPrice.toLocaleString('vi-VN') + 'đ';
    }
  }
  
  // Handle confirm button click
  const confirmBtn = document.getElementById('confirmBookingBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', function() {
      // In a real application, this would send data to server
      alert('Đặt xe thành công! Chúng tôi sẽ liên hệ với bạn sớm nhất để xác nhận chuyến đi.');
      
      // Clear localStorage
      localStorage.removeItem('bookingData');
      
      // Redirect to home page
      window.location.href = 'index.html';
    });
  }
}