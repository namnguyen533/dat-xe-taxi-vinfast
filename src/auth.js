import { createAuthClient, saveAuthToken } from './auth-client.js';

const authClient = createAuthClient();

function setFieldError(input, errorElement, message) {
  input.classList.toggle('invalid', Boolean(message));
  errorElement.textContent = message;
  errorElement.style.display = message ? 'block' : 'none';
}

function setGlobalError(errorElement, message) {
  errorElement.textContent = message;
  errorElement.style.display = message ? 'block' : 'none';
}

function setSubmitting(form, isSubmitting) {
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? 'Đang xử lý...' : submitButton.dataset.defaultText;
}

function initializeRegistration() {
  const form = document.querySelector('#registerForm');
  if (!form) return;

  const fields = {
    name: form.querySelector('#register-fullname'),
    phone: form.querySelector('#register-phone'),
    email: form.querySelector('#register-email'),
    password: form.querySelector('#register-password'),
    confirmation: form.querySelector('#register-confirm-password'),
  };
  const errors = {
    name: form.querySelector('#reg-fullname-error'),
    phone: form.querySelector('#reg-phone-error'),
    email: form.querySelector('#reg-email-error'),
    password: form.querySelector('#reg-password-error'),
    confirmation: form.querySelector('#reg-confirm-error'),
    global: form.querySelector('#reg-global-error'),
  };
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.dataset.defaultText = submitButton.textContent;

  form.addEventListener('input', (event) => {
    const entry = Object.entries(fields).find(([, input]) => input === event.target);
    if (entry) setFieldError(entry[1], errors[entry[0]], '');
    setGlobalError(errors.global, '');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const phone = fields.phone.value.replace(/[\s()-]/g, '');
    const validationErrors = {
      name: fields.name.value.trim().length < 2 ? 'Vui lòng nhập họ tên hợp lệ.' : '',
      phone: /^(?:0\d{9}|\+84\d{9})$/.test(phone) ? '' : 'Vui lòng nhập số điện thoại hợp lệ.',
      email: fields.email.value.trim() && fields.email.validity.valid ? '' : 'Vui lòng nhập email hợp lệ.',
      password: fields.password.value.length >= 6 ? '' : 'Mật khẩu phải có ít nhất 6 ký tự.',
      confirmation: fields.password.value === fields.confirmation.value ? '' : 'Mật khẩu nhập lại không khớp.',
    };

    for (const [key, input] of Object.entries(fields)) {
      setFieldError(input, errors[key], validationErrors[key]);
    }
    setGlobalError(errors.global, '');

    if (Object.values(validationErrors).some(Boolean)) return;

    setSubmitting(form, true);
    try {
      const result = await authClient.register({
        name: fields.name.value.trim(),
        phone: fields.phone.value.trim(),
        email: fields.email.value.trim(),
        password: fields.password.value,
      });
      saveAuthToken(result.accessToken);
      window.location.assign('index.html');
    } catch (error) {
      setGlobalError(errors.global, error.message);
    } finally {
      setSubmitting(form, false);
    }
  });
}

function initializeLogin() {
  const form = document.querySelector('#loginForm');
  if (!form) return;

  const email = form.querySelector('#login-email');
  const password = form.querySelector('#login-password');
  const emailError = form.querySelector('#login-email-error');
  const passwordError = form.querySelector('#login-password-error');
  const globalError = form.querySelector('#login-global-error');
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.dataset.defaultText = submitButton.textContent;

  form.addEventListener('input', (event) => {
    if (event.target === email) setFieldError(email, emailError, '');
    if (event.target === password) setFieldError(password, passwordError, '');
    setGlobalError(globalError, '');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const emailMessage = email.value.trim() && email.validity.valid ? '' : 'Vui lòng nhập email hợp lệ.';
    const passwordMessage = password.value ? '' : 'Vui lòng nhập mật khẩu.';
    setFieldError(email, emailError, emailMessage);
    setFieldError(password, passwordError, passwordMessage);
    setGlobalError(globalError, '');

    if (emailMessage || passwordMessage) return;

    setSubmitting(form, true);
    try {
      const result = await authClient.login({
        email: email.value.trim(),
        password: password.value,
      });
      saveAuthToken(result.accessToken);
      window.location.assign('index.html');
    } catch (error) {
      setGlobalError(globalError, error.message);
    } finally {
      setSubmitting(form, false);
    }
  });
}

initializeRegistration();
initializeLogin();