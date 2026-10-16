import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDriverBookings,
  getDriverEarnings,
  getDriverSettings,
  getDriverWallet,
  saveDriverSettings,
  saveDriverWallet,
} from '../src/driver-data.js';

function storageMock() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) || null,
    setItem: (key, value) => entries.set(key, String(value)),
  };
}

test('driver booking list includes only own trips and unassigned pending offers', () => {
  const bookings = [
    { bookingId: 'own', status: 'in_progress', driver: { name: 'Tài xế A' } },
    { bookingId: 'offer', status: 'pending', driver: null },
    { bookingId: 'assigned', status: 'pending', driver: { name: 'Tài xế B' } },
    { bookingId: 'unassigned-complete', status: 'completed', driver: null },
  ];

  assert.deepEqual(
    getDriverBookings(bookings, 'Tài xế A').map((booking) => booking.bookingId),
    ['own', 'offer'],
  );
});

test('driver income applies the 20 percent demo platform fee only to own completed trips', () => {
  const bookings = [
    { status: 'completed', driver: { name: 'Tài xế A' }, fare: { totalAmount: 100_000 } },
    { status: 'completed', driver: { name: 'Tài xế B' }, fare: { totalAmount: 70_000 } },
    { status: 'in_progress', driver: { name: 'Tài xế A' }, fare: { totalAmount: 50_000 } },
  ];

  assert.deepEqual(getDriverEarnings(bookings, 'Tài xế A'), {
    trips: 1,
    gross: 100_000,
    fees: 20_000,
    net: 80_000,
  });
});

test('driver settings and wallet persist per account', () => {
  const storage = storageMock();
  const settings = getDriverSettings(storage, 'driver@example.com', { fullName: 'Tài xế Demo' });
  settings.plate = '51A-123.45';
  saveDriverSettings(storage, 'driver@example.com', settings);
  assert.equal(getDriverSettings(storage, 'driver@example.com').plate, '51A-123.45');
  assert.equal(getDriverSettings(storage, 'other@example.com').plate, '51K-882.19');

  const wallet = { withdrawals: [{ id: 'WD-1', amount: 20_000, status: 'pending' }], balancePending: 0 };
  saveDriverWallet(storage, 'driver@example.com', wallet);
  assert.deepEqual(getDriverWallet(storage, 'driver@example.com'), wallet);
});
