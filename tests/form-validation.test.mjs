/**
 * KIỂM THỬ TỰ ĐỘNG CHO VIỆC KIỂM TRA DỮ LIỆU FORM ĐẶT XE (mục 38)
 * Chạy bằng: npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePhone } from '../src/data/store.js';
import { NAME_PATTERN, PHONE_PATTERN, summarizeErrors, validateBookingForm } from '../src/form-validation.js';

const TODAY = '2026-09-28';

/** Dữ liệu form hợp lệ, dùng làm mẫu để rồi sửa từng trường một */
function validForm(overrides = {}) {
  return {
    name: 'Nguyễn Văn Minh',
    phone: '0912 345 678',
    pickup: 'Sân bay Tân Sơn Nhất, TPHCM',
    destination: 'Landmark 81, Bình Thạnh',
    date: '2026-09-29',
    time: '08:30',
    note: 'Đón tại cột số 5',
    ...overrides,
  };
}

const check = (overrides) => validateBookingForm(validForm(overrides), { today: TODAY });

/* ---------------- Trường hợp hợp lệ ---------------- */

test('form đầy đủ dữ liệu đúng định dạng thì hợp lệ', () => {
  const result = check();
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('form không nhập ghi chú vẫn hợp lệ (ghi chú không bắt buộc)', () => {
  const result = check({ note: '' });
  assert.equal(result.valid, true);
});

test('họ tên có dấu tiếng Việt và số điện thoại có khoảng trắng vẫn được chấp nhận', () => {
  const result = check({ name: 'Bùi Khánh Linh', phone: '0968 246 135' });
  assert.equal(result.valid, true);
  assert.equal(result.values.phone, '0968246135', 'số điện thoại phải được chuẩn hóa về 10 chữ số');
});

/* ---------------- Trường hợp để trống (dữ liệu rỗng) ---------------- */

test('bỏ trống toàn bộ form thì báo lỗi đủ 6 trường bắt buộc', () => {
  const result = validateBookingForm({}, { today: TODAY });
  assert.equal(result.valid, false);
  for (const field of ['name', 'phone', 'pickup', 'destination', 'date', 'time']) {
    assert.ok(result.errors[field], `phải báo lỗi cho trường ${field}`);
  }
  assert.equal(result.errors.note, undefined, 'ghi chú không bắt buộc nên không được báo lỗi');
});

test('bỏ trống từng trường bắt buộc sẽ báo lỗi tương ứng', () => {
  for (const field of ['name', 'phone', 'pickup', 'destination', 'date', 'time']) {
    const result = check({ [field]: '   ' });
    assert.equal(result.valid, false, `form thiếu ${field} phải không hợp lệ`);
    assert.ok(result.errors[field]);
  }
});

test('dữ liệu null / undefined không làm hỏng hàm kiểm tra', () => {
  const result = validateBookingForm({ name: null, phone: undefined }, { today: TODAY });
  assert.equal(result.valid, false);
  assert.ok(result.errors.name);
  assert.ok(result.errors.phone);
});

/* ---------------- Trường hợp nhập sai định dạng ---------------- */

test('số điện thoại sai định dạng bị từ chối', () => {
  const invalidPhones = ['0912345', '09123456789', '1900232389', 'abcdefghij', '0912abc456'];
  for (const phone of invalidPhones) {
    const result = check({ phone });
    assert.equal(result.valid, false, `số điện thoại "${phone}" phải bị từ chối`);
    assert.ok(result.errors.phone);
  }
});

test('số điện thoại Việt Nam hợp lệ luôn khớp với mẫu kiểm tra', () => {
  for (const phone of ['0912345678', '0381234567', '0987654321']) {
    assert.equal(PHONE_PATTERN.test(normalizePhone(phone)), true, `${phone} phải hợp lệ`);
  }
});

test('họ tên chứa ký tự lạ bị từ chối', () => {
  const invalidNames = ['A', 'Nguyễn 123', '$$$', 'Nam@abc.com', '<script>alert(1)</script>'];
  for (const name of invalidNames) {
    const result = check({ name });
    assert.equal(result.valid, false, `họ tên "${name}" phải bị từ chối`);
    assert.ok(result.errors.name);
  }
});

test('họ tên hợp lệ khớp với mẫu kiểm tra', () => {
  for (const name of ['Nguyễn Văn Minh', "Bùi Thị Hoàng Anh", 'Le Van A']) {
    assert.equal(NAME_PATTERN.test(name), true, `${name} phải hợp lệ`);
  }
});

test('điểm đón và điểm đến trùng nhau bị từ chối', () => {
  const result = check({ destination: 'sân bay tân sơn nhất, tphcm' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.destination.includes('trùng nhau'));
});

test('ngày đón sai định dạng hoặc nằm trong quá khứ bị từ chối', () => {
  assert.ok(check({ date: '28-09-2026' }).errors.date, 'sai định dạng ngày');
  assert.ok(check({ date: '2026-13-45' }).errors.date, 'ngày không tồn tại');
  assert.ok(check({ date: '2026-09-27' }).errors.date, 'ngày trong quá khứ');
  assert.equal(check({ date: '2026-09-28', time: '23:59' }).errors.date, undefined, 'hôm nay vẫn hợp lệ');
});

test('giờ đón sai định dạng bị từ chối', () => {
  for (const time of ['25:00', '8:30', 'abc', '12:60']) {
    assert.ok(check({ time }).errors.time, `giờ "${time}" phải bị từ chối`);
  }
});

test('giờ đón đã qua trong ngày hôm nay bị từ chối', () => {
  const now = new Date();
  const pastTime = `${String(Math.max(0, now.getHours() - 1)).padStart(2, '0')}:00`;
  const result = check({ date: TODAY, time: pastTime });
  assert.ok(result.errors.time, 'giờ đón trong quá khứ phải bị từ chối');
});

test('ghi chú quá 300 ký tự bị từ chối', () => {
  assert.equal(check({ note: 'a'.repeat(300) }).valid, true);
  assert.ok(check({ note: 'a'.repeat(301) }).errors.note);
});

/* ---------------- Tiện ích đi kèm ---------------- */

test('summarizeErrors gộp thông điệp lỗi thành một chuỗi', () => {
  const { errors } = validateBookingForm({}, { today: TODAY });
  const summary = summarizeErrors(errors);
  assert.ok(summary.length > 0);
  assert.equal(summary, Object.values(errors).join('\n'));
  assert.equal(summarizeErrors({}), '');
});
