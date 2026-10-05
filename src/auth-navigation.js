import {
  AUTH_USER_KEY,
  clearAuthSession,
  hasAuthSession,
} from './auth-client.js';

const ACTION_SELECTOR = 'a[href="dangnhap.html"], a[href="dki.html"], button.btn-login, button.btn-register';
const PROFILE_MENU_ID = 'account-menu';

function getCurrentUser() {
  const user = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
  return user && typeof user === 'object' ? user : {};
}

function closeProfileMenus(exceptMenu) {
  document.querySelectorAll('.account-menu').forEach((menu) => {
    if (menu !== exceptMenu) {
      menu.hidden = true;
      menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
    }
  });
}

function createProfileMenu(actions) {
  const profile = document.createElement('div');
  profile.className = 'account-profile';

  const button = document.createElement('button');
  button.className = 'account-profile-button';
  button.type = 'button';
  button.setAttribute('aria-label', 'Tài khoản');
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', PROFILE_MENU_ID);
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5Z"/></svg>';

  const menu = document.createElement('div');
  menu.className = 'account-menu';
  menu.id = PROFILE_MENU_ID;
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const user = getCurrentUser();
  const identity = document.createElement('div');
  identity.className = 'account-menu-identity';
  const name = document.createElement('strong');
  name.textContent = typeof user.name === 'string' && user.name.trim() ? user.name : 'Tài khoản của tôi';
  identity.append(name);
  if (typeof user.email === 'string' && user.email) {
    const email = document.createElement('span');
    email.textContent = user.email;
    identity.append(email);
  }

  const switchAccount = document.createElement('a');
  switchAccount.href = 'dangnhap.html';
  switchAccount.className = 'account-menu-action';
  switchAccount.textContent = 'Đổi tài khoản';
  switchAccount.setAttribute('role', 'menuitem');
  switchAccount.addEventListener('click', () => clearAuthSession());

  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'account-menu-action';
  logout.textContent = 'Đăng xuất';
  logout.setAttribute('role', 'menuitem');
  logout.addEventListener('click', () => {
    clearAuthSession();
    renderAccountActions(actions);
  });

  menu.append(identity, switchAccount, logout);
  button.addEventListener('click', () => {
    const opening = menu.hidden;
    closeProfileMenus(menu);
    menu.hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
  });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  });

  profile.append(button, menu);
  return profile;
}

function renderAccountActions(actions) {
  const authenticated = hasAuthSession();
  actions.forEach((action) => {
    action.hidden = authenticated;
  });

  document.querySelectorAll('.account-profile').forEach((profile) => profile.remove());
  if (!authenticated) return;

  const headers = new Set([...actions].map((action) => action.closest('.header-actions')).filter(Boolean));
  headers.forEach((header) => header.append(createProfileMenu(actions)));
}

const actions = [...document.querySelectorAll(ACTION_SELECTOR)];
renderAccountActions(actions);

document.addEventListener('click', (event) => {
  if (!event.target.closest('.account-profile')) closeProfileMenus();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeProfileMenus();
});
