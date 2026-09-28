/**
 * KIỂM TRA DỮ LIỆU FORM ĐẶT XE
 * ------------------------------------------------------------
 * Tách riêng thành module thuần (không phụ thuộc DOM) để có thể
 * kiểm thử tự động bằng Node.js cho các trường hợp:
 * - Để trống trường bắt buộc
 * - Nhập sai định dạng (số điện thoại, họ tên, ngày, giờ)
 * - Nhập trùng điểm đón và điểm đến
 * - Ngày đón nằm trong quá khứ
 */
import { normalizePhone, todayISO } from './data/store.js';

/** Số điện thoại Việt Nam hợp lệ: 10 chữ số bắt đầu bằng 0 */
export const PHONE_PATTERN = /^0\d{9}$/;

/** Họ tên: chữ cái (có dấu) + khoảng trắng + dấu nháy, tối đa 50 ký tự */
export const NAME_PATTERN = /^[\p{L}][\p{L}\s.'’-]{1,49}$/u;

/** Định dạng giờ HH:MM */
export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Định dạng ngày YYYY-MM-DD */
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const MESSAGES = {
  name: 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự chữ cái).',
  phone: 'Số điện thoại không hợp lệ, cần đúng 10 chữ số bắt đầu bằng 0.',
  pickup: 'Vui lòng nhập điểm đón.',
  destination: 'Vui lòng nhập điểm đến.',
  sameLocation: 'Điểm đón và điểm đến không được trùng nhau.',
  date: 'Vui lòng chọn ngày đón.',
  dateFormat: 'Ngày đón không hợp lệ.',
  datePast: 'Ngày đón không được nằm trong quá khứ.',
  time: 'Vui lòng chọn giờ đón.',
  timeFormat: 'Giờ đón không hợp lệ.',
  timePast: 'Giờ đón phải sau thời điểm hiện tại.',
  note: 'Ghi chú không được vượt quá 300 ký tự.',
};

/** Thông điệp lỗi theo trường */
export const VALIDATION_MESSAGES = MESSAGES;

/**
 * Kiểm tra toàn bộ dữ liệu form đặt xe
 * @param {Object} input { name, phone, pickup, destination, date, time, note }
 * @param {Object} options { today } - chuỗi YYYY-MM-DD (dùng cho test)
 * @returns {{ valid: boolean, errors: Object<string,string>, values: Object }}
 */
export function validateBookingForm(input = {}, options = {}) {
  const today = options.today || todayISO();
  const values = {
    name: String(input.name ?? '').trim().replace(/\s+/g, ' '),
    phone: normalizePhone(input.phone),
    pickup: String(input.pickup ?? '').trim(),
    destination: String(input.destination ?? '').trim(),
    date: String(input.date ?? '').trim(),
    time: String(input.time ?? '').trim(),
    note: String(input.note ?? '').trim(),
  };

  const errors = {};

  if (!values.name) errors.name = MESSAGES.name;
  else if (!NAME_PATTERN.test(values.name)) errors.name = MESSAGES.name;

  if (!values.phone) errors.phone = MESSAGES.phone;
  else if (!PHONE_PATTERN.test(values.phone)) errors.phone = MESSAGES.phone;

  if (!values.pickup) errors.pickup = MESSAGES.pickup;
  if (!values.destination) errors.destination = MESSAGES.destination;
  if (values.pickup && values.destination && values.pickup.toLowerCase() === values.destination.toLowerCase()) {
    errors.destination = MESSAGES.sameLocation;
  }

  if (!values.date) errors.date = MESSAGES.date;
  else if (!DATE_PATTERN.test(values.date)) errors.date = MESSAGES.dateFormat;
  else if (values.date < today) errors.date = MESSAGES.datePast;

  if (!values.time) errors.time = MESSAGES.time;
  else if (!TIME_PATTERN.test(values.time)) errors.time = MESSAGES.timeFormat;
  else if (values.date === today && values.time < currentTimeHM()) errors.time = MESSAGES.timePast;

  if (values.note.length > 300) errors.note = MESSAGES.note;

  return { valid: Object.keys(errors).length === 0, errors, values };
}

/** Giờ hiện tại theo định dạng HH:MM */
function currentTimeHM(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Gộp các lỗi thành một câu thông báo cho alert */
export function summarizeErrors(errors = {}) {
  const messages = Object.values(errors);
  if (messages.length === 0) return '';
  return messages.join('\n');
}
