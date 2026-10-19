import {
  AUTH_USER_KEY,
  clearAuthSession,
  hasAuthSession,
  isDriverUser,
} from './auth-client.js';

const ACTION_SELECTOR = 'a[href="dangnhap.html"], a[href="dki.html"], button.btn-login, button.btn-register';

export function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
    return user && typeof user === 'object' ? user : {};
  } catch {
    return {};
  }
}

export function closeAllUserDropdowns() {
  document.querySelectorAll('.user-badge-dropdown').forEach((menu) => {
    menu.hidden = true;
  });
  document.querySelectorAll('.user-badge-btn').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
  });
}

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const item = document.createElement('div');
  item.className = `toast-item ${type}`;
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => {
    item.classList.add('hide');
    setTimeout(() => item.remove(), 300);
  }, 2600);
}

function createUserBadge(actions) {
  const user = getCurrentUser();
  const displayName = (user.name && user.name.trim()) ? user.name.trim() : (user.email ? user.email.split('@')[0] : 'Khách hàng');
  const displayEmail = user.email || user.phone || 'Tài khoản TaxiVinFast';

  const wrap = document.createElement('div');
  wrap.className = 'user-account-badge-wrap';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'user-badge-btn';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `
    <span class="user-avatar-icon">👤</span>
    <span class="user-display-name">${escapeText(displayName)}</span>
    <span class="badge-caret">▾</span>
  `;

  const dropdown = document.createElement('div');
  dropdown.className = 'user-badge-dropdown';
  dropdown.hidden = true;
  dropdown.innerHTML = `
    <div class="dropdown-header">
      <span class="user-avatar-large">👤</span>
      <div class="user-header-text">
        <strong class="user-name-title">${escapeText(displayName)}</strong>
        <span class="user-sub-info">${escapeText(displayEmail)}</span>
      </div>
    </div>
    <div class="dropdown-sep"></div>
    <a href="danhsachchuyen.html" class="dropdown-item">📋 Lịch sử chuyến xe</a>
    <a href="booking.html" class="dropdown-item">🚕 Đặt chuyến xe mới</a>
    <div class="dropdown-sep"></div>
    <button type="button" class="dropdown-item text-danger btn-logout-action">🚪 Đăng xuất</button>
  `;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = dropdown.hidden;
    closeAllUserDropdowns();
    dropdown.hidden = !isHidden;
    btn.setAttribute('aria-expanded', String(!isHidden));
  });

  const logoutBtn = dropdown.querySelector('.btn-logout-action');
  logoutBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearAuthSession();
    closeAllUserDropdowns();
    renderAccountActions(actions);
    showToast('Đã đăng xuất tài khoản thành công.', 'info');
    if (window.location.pathname.endsWith('booking.html')) {
      setTimeout(() => {
        window.location.href = 'dangnhap.html?next=booking.html';
      }, 700);
    }
  });

  wrap.append(btn, dropdown);
  return wrap;
}

function escapeText(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderAccountActions(actionElements = null) {
  const actions = actionElements || [...document.querySelectorAll(ACTION_SELECTOR)];
  const authenticated = hasAuthSession();

  actions.forEach((action) => {
    action.hidden = authenticated;
    if (authenticated) {
      action.style.display = 'none';
    } else {
      action.style.display = '';
    }
  });

  document.querySelectorAll('.user-account-badge-wrap').forEach((el) => el.remove());
  document.querySelectorAll('.account-profile').forEach((el) => el.remove());

  if (!authenticated) return;

  const headerActionsContainers = new Set(
    actions.map((action) => action.closest('.header-actions')).filter(Boolean),
  );

  headerActionsContainers.forEach((container) => {
    container.append(createUserBadge(actions));
  });
}

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  const actions = [...document.querySelectorAll(ACTION_SELECTOR)];
  renderAccountActions(actions);
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.user-account-badge-wrap')) {
    closeAllUserDropdowns();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAllUserDropdowns();
  }
});
