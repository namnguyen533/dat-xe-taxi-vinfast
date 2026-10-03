import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  const usernameInput = document.getElementById('admin-username');
  const passwordInput = document.getElementById('admin-password');
  const btnTogglePwd = document.getElementById('btn-toggle-pwd');
  const errorMsg = document.getElementById('login-error-msg');

  // Toggle show/hide password
  if (btnTogglePwd && passwordInput) {
    btnTogglePwd.addEventListener('click', () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        btnTogglePwd.textContent = '🙈';
      } else {
        passwordInput.type = 'password';
        btnTogglePwd.textContent = '👁️';
      }
    });
  }

  // Handle Submit Form
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = usernameInput.value.trim();
      const pwd = passwordInput.value.trim();

      // Kiểm tra mật khẩu (Mặc định admin / 123456)
      if ((user === 'admin' || user === 'admin@taxivinfast.com') && pwd === '123456') {
        // Lưu cờ đăng nhập thành công
        localStorage.setItem('admin_authenticated', 'true');
        localStorage.setItem('admin_user', JSON.stringify({
          name: 'Nguyễn Quản Trị',
          role: 'Super Admin',
          avatar: 'https://i.pravatar.cc/150?img=68'
        }));

        // Ẩn thông báo lỗi nếu có
        if (errorMsg) errorMsg.style.display = 'none';

        const requestedNext = new URLSearchParams(window.location.search).get('next');
        const destination = requestedNext === 'danhsachchuyen.html'
          ? 'danhsachchuyen.html'
          : 'admin.html';
        alert(`🎉 Đăng nhập Admin thành công! Chuyển hướng tới ${destination === 'admin.html' ? 'bảng quản trị' : 'lịch sử chuyến đi'}...`);
        window.location.href = destination;
      } else {
        if (errorMsg) {
          errorMsg.textContent = '❌ Tên đăng nhập hoặc mật khẩu không chính xác (Thử: admin / 123456)';
          errorMsg.style.display = 'block';
        }
      }
    });
  }
});
