/**
 * KIỂM THỬ TỰ ĐỘNG CHO LỚP KHO DỮ LIỆU ĐƠN (src/data/store.js)
 * Chạy bằng: npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  BOOKING_STATUSES,
  computeStats,
  createBookingStore,
  createMemoryStorage,
  escapeHtml,
  filterBookings,
  formatVND,
  nextBookingId,
  normalizePhone,
  onlyDigits,
  statusMeta,
  STORAGE_KEY,
} from '../src/data/store.js';

const seedBookings = createRequire(import.meta.url)('../src/data/bookings.json');

const FIXED_NOW = new Date('2026-09-28T10:00:00');

function makeStore() {
  const storage = createMemoryStorage();
  return {
    storage,
    store: createBookingStore({ storage, seed: seedBookings, now: () => FIXED_NOW }),
  };
}

/* ---------------- Tiện ích ---------------- */

test('formatVND định dạng đúng tiền Việt Nam', () => {
  assert.equal(formatVND(109600), '109.600 đ');
  assert.equal(formatVND(0), '0 đ');
  assert.equal(formatVND('abc'), '0 đ');
});

test('escapeHtml chống chèn mã độc', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml(null), '');
});

test('normalizePhone chuẩn hóa số điện thoại Việt Nam', () => {
  assert.equal(normalizePhone('0912 345 678'), '0912345678');
  assert.equal(normalizePhone('+84 912 345 678'), '0912345678');
  assert.equal(normalizePhone('84 912 345 678'), '0912345678');
  assert.equal(normalizePhone('0912345678'), '0912345678');
  assert.equal(onlyDigits('0912-345-678'), '0912345678');
});

test('dữ liệu mẫu có đủ 5 trạng thái yêu cầu', () => {
  const statuses = new Set(seedBookings.map((booking) => booking.status));
  for (const status of BOOKING_STATUSES) {
    assert.ok(statuses.has(status.value), `Thiếu đơn mẫu ở trạng thái ${status.value}`);
  }
});

test('mọi đơn trong dữ liệu mẫu đều đủ trường bắt buộc', () => {
  for (const booking of seedBookings) {
    assert.ok(booking.bookingId, 'thiếu mã đơn');
    assert.ok(booking.customer?.name, `đơn ${booking.bookingId} thiếu tên khách`);
    assert.ok(booking.customer?.phone, `đơn ${booking.bookingId} thiếu số điện thoại`);
    assert.ok(booking.route?.pickupLocation, `đơn ${booking.bookingId} thiếu điểm đón`);
    assert.ok(booking.route?.destinationLocation, `đơn ${booking.bookingId} thiếu điểm đến`);
    assert.ok(Number(booking.fare?.totalAmount) > 0, `đơn ${booking.bookingId} thiếu tổng tiền`);
    assert.ok(BOOKING_STATUSES.some((status) => status.value === booking.status), 'trạng thái không hợp lệ');
  }
});

/* ---------------- Kho dữ liệu ---------------- */

test('lần đầu nạp dữ liệu mẫu từ bookings.json và lưu vào storage', () => {
  const { storage, store } = makeStore();
  const all = store.getAll();

  assert.equal(all.length, seedBookings.length);
  assert.ok(storage.getItem(STORAGE_KEY), 'phải ghi dữ liệu xuống storage');
});

test('đọc lại dữ liệu đã lưu (không ghi đè bằng dữ liệu mẫu)', () => {
  const { store } = makeStore();
  store.getAll();
  store.add({
    customer: { name: 'Khách Mới', phone: '0900000001' },
    route: { pickupLocation: 'A', destinationLocation: 'B' },
    fare: { totalAmount: 100000 },
  });

  assert.equal(store.getAll().length, seedBookings.length + 1);
});

test('thêm đơn mới sinh mã tự tăng, trạng thái mặc định là Chờ xác nhận', () => {
  const { store } = makeStore();
  const created = store.add({
    customer: { name: 'Nguyễn Test', phone: '0912000111' },
    route: { pickupLocation: 'Chợ Bến Thành', destinationLocation: 'Landmark 81' },
    fare: { totalAmount: 137000 },
  });

  assert.equal(created.bookingId, 'VF-2026-9827');
  assert.equal(created.status, 'pending');
  assert.equal(created.statusText, 'Chờ xác nhận');
  assert.equal(created.schedule.createdDate, FIXED_NOW.toISOString());
  assert.equal(store.getById(created.bookingId).customer.name, 'Nguyễn Test');
});

test('nextBookingId tăng dần theo mã đơn lớn nhất trong năm', () => {
  assert.equal(nextBookingId(seedBookings, 2026), 'VF-2026-9827');
  assert.equal(nextBookingId([], 2026), 'VF-2026-9821');
  assert.equal(nextBookingId(seedBookings, 2027), 'VF-2027-9821');
});

test('cập nhật trạng thái đủ 5 trạng thái (mục 34)', () => {
  const { store } = makeStore();
  const id = seedBookings[0].bookingId;

  for (const status of BOOKING_STATUSES) {
    const updated = store.updateStatus(id, status.value);
    assert.ok(updated, `cập nhật thất bại ở trạng thái ${status.value}`);
    assert.equal(updated.status, status.value);
    assert.equal(updated.statusText, status.text);
    assert.equal(store.getById(id).status, status.value, 'dữ liệu chưa được ghi xuống storage');
  }
});

test('đơn hoàn thành được đánh dấu đã thanh toán, đơn hủy được hoàn tiền', () => {
  const { store } = makeStore();
  const id = seedBookings[2].bookingId;

  store.updateStatus(id, 'completed');
  assert.equal(store.getById(id).payment.status, 'paid');

  store.updateStatus(id, 'cancelled');
  assert.equal(store.getById(id).payment.status, 'refunded');
});

test('từ chối trạng thái không hợp lệ', () => {
  const { store } = makeStore();
  const id = seedBookings[0].bookingId;
  const before = store.getById(id).status;

  assert.equal(store.updateStatus(id, 'khong-ton-tai'), null);
  assert.equal(store.getById(id).status, before);
});

test('xóa đơn khỏi LocalStorage (mục 35)', () => {
  const { storage, store } = makeStore();
  const id = seedBookings[0].bookingId;

  assert.equal(store.remove(id), true);
  assert.equal(store.getById(id), null);
  assert.equal(store.getAll().length, seedBookings.length - 1);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).length, seedBookings.length - 1);

  assert.equal(store.remove('VF-KHONG-CO'), false);
});

test('xóa hết đơn thì dữ liệu mẫu không bị nạp lại', () => {
  const { storage, store } = makeStore();
  for (const booking of [...store.getAll()]) store.remove(booking.bookingId);

  assert.deepEqual(store.getAll(), [], 'danh sách rỗng phải được giữ nguyên');
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).length, 0);
});

test('khôi phục dữ liệu mẫu sau khi đã thêm/xóa đơn', () => {
  const { store } = makeStore();
  store.add({ customer: { name: 'X', phone: '0900000002' }, route: {}, fare: { totalAmount: 1 } });
  store.remove(seedBookings[0].bookingId);

  const restored = store.reset();
  assert.equal(restored.length, seedBookings.length);
  assert.equal(store.getAll().length, seedBookings.length);
});

test('tự phục hồi khi dữ liệu trong storage bị hỏng', () => {
  const storage = createMemoryStorage();
  storage.setItem(STORAGE_KEY, '{khong-phai-json');
  const store = createBookingStore({ storage, seed: seedBookings, now: () => FIXED_NOW });

  assert.equal(store.getAll().length, seedBookings.length);
});

/* ---------------- Tìm kiếm (mục 36 & 37) ---------------- */

test('tìm kiếm theo tên khách không phân biệt hoa thường', () => {
  const result = filterBookings(seedBookings, { keyword: 'khánh linh' });
  assert.equal(result.length, 1);
  assert.equal(result[0].customer.name, 'Bùi Khánh Linh');

  const upperCase = filterBookings(seedBookings, { keyword: 'BÙI KHÁNH LINH' });
  assert.equal(upperCase.length, 1, 'tìm kiếm không phân biệt hoa thường');
});

test('tìm kiếm cũng nhận biết tên tài xế và biển số xe', () => {
  assert.ok(filterBookings(seedBookings, { keyword: 'Hoàng Đức' }).length >= 1);
  assert.ok(filterBookings(seedBookings, { keyword: '51K-882' }).length >= 1);
});

test('tìm kiếm theo số điện thoại (có hoặc không khoảng trắng)', () => {
  const spaced = filterBookings(seedBookings, { keyword: '0912 345 678' });
  const plain = filterBookings(seedBookings, { keyword: '0912345678' });
  const partial = filterBookings(seedBookings, { keyword: '0912' });

  assert.equal(spaced[0].bookingId, 'VF-2026-9821');
  assert.equal(plain[0].bookingId, 'VF-2026-9821');
  assert.ok(partial.length >= 1);
});

test('tìm kiếm theo mã đơn, tên xe và địa chỉ', () => {
  assert.equal(filterBookings(seedBookings, { keyword: 'VF-2026-9823' }).length, 1);
  assert.ok(filterBookings(seedBookings, { keyword: 'vf 8' }).length >= 1);
  assert.ok(filterBookings(seedBookings, { keyword: 'vũng tàu' }).length >= 1);
});

test('lọc theo trạng thái kết hợp với từ khóa', () => {
  const pending = filterBookings(seedBookings, { keyword: '', status: 'pending' });
  assert.ok(pending.length >= 1);
  assert.ok(pending.every((booking) => booking.status === 'pending'));

  const combined = filterBookings(seedBookings, { keyword: 'vũng', status: 'completed' });
  assert.equal(combined.length, 1);
  assert.equal(filterBookings(seedBookings, { keyword: 'vũng', status: 'cancelled' }).length, 0);
});

test('tìm kiếm không nhận dữ liệu rác vẫn trả về mảng rỗng', () => {
  assert.deepEqual(filterBookings(seedBookings, { keyword: 'khong-ton-tai-abc' }), []);
  assert.deepEqual(filterBookings(null, {}), []);
  assert.deepEqual(filterBookings(undefined, { keyword: 'a' }), []);
});

/* ---------------- Thống kê dashboard (mục 32) ---------------- */

test('tổng quan số lượng đơn tính đúng theo từng trạng thái', () => {
  const stats = computeStats(seedBookings, '2026-09-28');

  assert.equal(stats.total, seedBookings.length);
  const counted = Object.values(stats.byStatus).reduce((sum, value) => sum + value, 0);
  assert.equal(counted, seedBookings.length, 'tổng số đơn theo trạng thái phải bằng tổng số đơn');
  assert.ok(stats.todayCount >= 1, 'phải có ít nhất 1 đơn trong ngày 28/09/2026');
});

test('doanh thu không tính các đơn đã hủy', () => {
  const stats = computeStats(seedBookings, '2026-09-28');
  const expected = seedBookings
    .filter((booking) => booking.status !== 'cancelled')
    .reduce((sum, booking) => sum + booking.fare.totalAmount, 0);

  assert.equal(stats.revenue, expected);
  assert.equal(stats.cancelledCount, seedBookings.filter((b) => b.status === 'cancelled').length);
  assert.equal(stats.activeCount, seedBookings.length - stats.cancelledCount);
});

test('thống kê với danh sách rỗng không gây lỗi', () => {
  const stats = computeStats([], '2026-09-28');
  assert.equal(stats.total, 0);
  assert.equal(stats.revenue, 0);
  assert.equal(stats.averageFare, 0);
});

/* ---------------- Nhãn hiển thị ---------------- */

test('statusMeta trả về thông tin hiển thị đúng cho từng trạng thái', () => {
  for (const status of BOOKING_STATUSES) {
    const meta = statusMeta(status.value);
    assert.equal(meta.text, status.text);
    assert.equal(meta.tone, status.tone);
  }
  assert.equal(statusMeta('trang-thai-la').tone, 'secondary', 'trạng thái lạ phải có fallback');
});
