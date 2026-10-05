const DEFAULT_AUTH_API_URL = 'http://127.0.0.1:3000';
const AUTH_API_URL = (import.meta.env?.VITE_AUTH_API_URL || DEFAULT_AUTH_API_URL).replace(/\/$/, '');

export const AUTH_TOKEN_KEY = 'taxi-vinfast-auth-token';
export const AUTH_USER_KEY = 'taxi-current-user';

export function hasAuthSession(sessionStorage = globalThis.sessionStorage, localStorage = globalThis.localStorage) {
  return Boolean(
    sessionStorage?.getItem(AUTH_TOKEN_KEY)
    || localStorage?.getItem(AUTH_TOKEN_KEY),
  );
}

export function clearAuthSession(sessionStorage = globalThis.sessionStorage, localStorage = globalThis.localStorage) {
  sessionStorage?.removeItem(AUTH_TOKEN_KEY);
  localStorage?.removeItem(AUTH_TOKEN_KEY);
  localStorage?.removeItem(AUTH_USER_KEY);
}

function getErrorMessage(body) {
  if (typeof body?.message === 'string') return body.message;
  if (typeof body?.error === 'string') return body.error;
  if (typeof body?.errors?.email === 'string') return body.errors.email;
  return '';
}

export function createAuthClient({ baseUrl = AUTH_API_URL, fetchImpl = fetch } = {}) {
  async function request(endpoint, credentials) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
    } catch (error) {
      throw new Error('Không thể kết nối máy chủ đăng nhập. Hãy kiểm tra API đang chạy.', { cause: error });
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('Máy chủ đăng nhập trả về dữ liệu không hợp lệ.', { cause: error });
    }

    if (!response.ok) {
      const message = getErrorMessage(result);
      if (message === 'Email already exists') {
        throw new Error('Email này đã được đăng ký.');
      }
      if (message === 'Incorrect password' || message === 'Cannot find user') {
        throw new Error('Email hoặc mật khẩu không đúng.');
      }
      throw new Error(message || 'Không thể xác thực tài khoản. Vui lòng thử lại.');
    }

    if (typeof result?.accessToken !== 'string' || !result.accessToken) {
      throw new Error('Máy chủ đăng nhập không trả về mã phiên hợp lệ.');
    }

    return result;
  }

  return {
    register: (account) => request('register', account),
    login: (credentials) => request('login', credentials),
  };
}

export function saveAuthToken(token, storage = globalThis.sessionStorage) {
  if (!storage || typeof storage.setItem !== 'function') {
    throw new Error('Không thể lưu phiên đăng nhập trên thiết bị này.');
  }
  storage.setItem(AUTH_TOKEN_KEY, token);
}
