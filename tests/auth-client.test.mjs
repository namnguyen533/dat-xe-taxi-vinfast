import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  clearAuthSession,
  createAuthClient,
  hasAuthSession,
  saveAuthToken,
} from '../src/auth-client.js';

function response(body, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

test('registration posts account details to JSON Server Auth and returns the token', async () => {
  let request;
  const client = createAuthClient({
    baseUrl: 'http://localhost:3000/',
    fetchImpl: async (...args) => {
      request = args;
      return response({ accessToken: 'jwt-token', user: { id: 1, email: 'rider@example.com' } });
    },
  });

  const account = {
    name: 'Nguyễn An',
    phone: '0912345678',
    email: 'rider@example.com',
    password: 'secret1',
  };
  const result = await client.register(account);

  assert.equal(request[0], 'http://localhost:3000/register');
  assert.equal(request[1].method, 'POST');
  assert.equal(request[1].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request[1].body), account);
  assert.equal(result.accessToken, 'jwt-token');
});

test('login sends credentials to the login endpoint', async () => {
  let requestUrl;
  const client = createAuthClient({
    baseUrl: 'http://localhost:3000',
    fetchImpl: async (url) => {
      requestUrl = url;
      return response({ accessToken: 'jwt-token', user: { id: 1 } });
    },
  });

  await client.login({ email: 'rider@example.com', password: 'secret1' });
  assert.equal(requestUrl, 'http://localhost:3000/login');
});

test('authentication errors are reported in Vietnamese', async () => {
  const client = createAuthClient({
    baseUrl: 'http://localhost:3000',
    fetchImpl: async () => response({ error: 'Email already exists' }, false),
  });

  await assert.rejects(client.register({}), { message: 'Email này đã được đăng ký.' });
});

test('invalid server responses and connection errors are surfaced', async () => {
  const missingTokenClient = createAuthClient({
    fetchImpl: async () => response({ user: { id: 1 } }),
  });
  await assert.rejects(missingTokenClient.login({}), /không trả về mã phiên hợp lệ/);

  const offlineClient = createAuthClient({
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  await assert.rejects(offlineClient.login({}), /Không thể kết nối máy chủ đăng nhập/);
});

test('auth token is saved under the session key', () => {
  const entries = new Map();
  saveAuthToken('jwt-token', {
    setItem: (key, value) => entries.set(key, value),
  });

  assert.equal(entries.get(AUTH_TOKEN_KEY), 'jwt-token');
});

test('authentication state is detected from session or persistent storage', () => {
  const emptyStorage = { getItem: () => null };
  const sessionStorage = { getItem: (key) => key === AUTH_TOKEN_KEY ? 'jwt-token' : null };
  const localStorage = { getItem: (key) => key === AUTH_TOKEN_KEY ? 'jwt-token' : null };

  assert.equal(hasAuthSession(emptyStorage, emptyStorage), false);
  assert.equal(hasAuthSession(sessionStorage, emptyStorage), true);
  assert.equal(hasAuthSession(emptyStorage, localStorage), true);
});

test('logging out clears the session, persistent token, and current account', () => {
  const sessionEntries = new Map([[AUTH_TOKEN_KEY, 'session-token']]);
  const localEntries = new Map([
    [AUTH_TOKEN_KEY, 'persistent-token'],
    [AUTH_USER_KEY, '{"email":"rider@example.com"}'],
  ]);
  const storage = (entries) => ({
    removeItem: (key) => entries.delete(key),
  });

  clearAuthSession(storage(sessionEntries), storage(localEntries));

  assert.equal(sessionEntries.has(AUTH_TOKEN_KEY), false);
  assert.equal(localEntries.has(AUTH_TOKEN_KEY), false);
  assert.equal(localEntries.has(AUTH_USER_KEY), false);
});
