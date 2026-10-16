import { AUTH_USER_KEY, createAuthClient, isDriverUser, saveAuthToken } from './auth-client.js';

const DEMO_DRIVER = {
  name: 'Tài xế demo',
  email: 'driver@taxivinfast.com',
  phone: '0903123456',
  password: '123456',
  role: 'driver',
};
const authClient = createAuthClient();
const form = document.getElementById('driver-login-form');
const emailInput = document.getElementById('driver-login-email');
const passwordInput = document.getElementById('driver-login-password');
const errorElement = document.getElementById('driver-login-error');
const submitButton = form.querySelector('button[type="submit"]');
const defaultButtonText = submitButton.textContent;

if (new URLSearchParams(window.location.search).get('error') === 'driver-only') {
  errorElement.textContent = 'Tài khoản hiện tại là tài khoản khách. Hãy đăng nhập riêng bằng tài khoản tài xế.';
}

function getLocalAccount(email, password) {
  const users = JSON.parse(localStorage.getItem('taxi-users') || '[]');
  if (!users.some((user) => user.email.toLowerCase() === DEMO_DRIVER.email)) {
    users.push(DEMO_DRIVER);
    localStorage.setItem('taxi-users', JSON.stringify(users));
  }
  return users.find((user) => (
    user.email.toLowerCase() === email.toLowerCase()
    && user.password === password
  )) || null;
}

function saveDriverUser(user) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify({
    name: user.name || user.fullname || 'Tài xế',
    email: user.email || emailInput.value.trim(),
    phone: user.phone || '',
    role: 'driver',
  }));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorElement.textContent = '';
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !emailInput.validity.valid || !password) {
    errorElement.textContent = 'Vui lòng nhập email hợp lệ và mật khẩu.';
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Đang xác thực...';
  try {
    let result;
    try {
      result = await authClient.login({ email, password });
    } catch (apiError) {
      const localAccount = getLocalAccount(email, password);
      if (!localAccount) {
        if (apiError.message.includes('không đúng')) throw apiError;
        throw new Error('Không thể kết nối máy chủ đăng nhập. Với tài khoản demo, hãy kiểm tra đúng email và mật khẩu.');
      }
      result = { accessToken: 'local-demo-token', user: localAccount };
    }

    if (!isDriverUser(result.user)) {
      throw new Error('Tài khoản này không có quyền tài xế. Hãy dùng tài khoản khách ở trang đăng nhập khách hàng.');
    }

    saveDriverUser(result.user);
    saveAuthToken(result.accessToken);
    window.location.replace('driver.html');
  } catch (error) {
    errorElement.textContent = error.message || 'Không thể đăng nhập khu vực tài xế.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = defaultButtonText;
  }
});
