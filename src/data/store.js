/**
 * LỚP KHO DỮ LIỆU ĐƠN ĐẶT TAXI (Booking Store)
 * ------------------------------------------------------------
 * - Dùng chung cho trang Đặt xe (booking.js), trang Lịch sử chuyến
 *   (bookings-loader.js) và trang Quản trị (admin.js).
 * - Dữ liệu được lưu trong LocalStorage để dữ liệu tồn tại qua các lần
 *   tải lại trang. Lần đầu tiên sẽ nạp dữ liệu mẫu từ file bookings.json.
 * - Toàn bộ hàm xử lý dữ liệu đều là hàm thuần (pure function) kết hợp với
 *   một "storage adapter" nên có thể kiểm thử tự động bằng Node.js.
 */

export const STORAGE_KEY = 'taxivinfast_bookings';

/** 5 trạng thái đơn theo đúng yêu cầu dự án (mục 34) */
export const BOOKING_STATUSES = [
  { value: 'pending', text: 'Chờ xác nhận', tone: 'warning', icon: '⏳' },
  { value: 'confirmed', text: 'Đã xác nhận', tone: 'info', icon: '👍' },
  { value: 'in_progress', text: 'Đang thực hiện', tone: 'primary', icon: '🚗' },
  { value: 'completed', text: 'Hoàn thành', tone: 'success', icon: '✅' },
  { value: 'cancelled', text: 'Đã hủy', tone: 'danger', icon: '✕' },
];

/** Ánh xạ nhanh value -> thông tin hiển thị */
export const STATUS_MAP = Object.fromEntries(BOOKING_STATUSES.map((s) => [s.value, s]));

/** Nhãn tiếng Việt của loại dịch vụ */
export const SERVICE_TYPE_LABELS = {
  'point-to-point': 'Điểm đến điểm',
  hourly: 'Thuê theo giờ',
  intercity: 'Đi tỉnh / đường dài',
  airport: 'Đưa đón sân bay',
};

/** Nhãn tiếng Việt của phương thức thanh toán */
export const PAYMENT_LABELS = {
  cash: 'Tiền mặt',
  momo: 'Ví MoMo / ZaloPay',
  zalopay: 'Ví ZaloPay',
  vnpay: 'VNPAY',
  card: 'Thẻ ngân hàng',
  banking: 'Chuyển khoản QR',
};

/* ====================== HÀM TIỆN ÍCH (thuần) ====================== */

/** Định dạng tiền Việt Nam, ví dụ: 109600 -> "109.600 đ" */
export function formatVND(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' đ';
}

/** Loại bỏ ký tự đặc biệt trong HTML để tránh lỗi XSS khi chèn innerHTML */
export function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Chuẩn hóa số điện thoại về dạng 10 số bắt đầu bằng 0 */
export function normalizePhone(raw) {
  let phone = String(raw ?? '').replace(/[^\d+]/g, '');
  if (phone.startsWith('+84')) phone = '0' + phone.slice(3);
  // Dạng "84 912 345 678" (11 chữ số) -> "0912345678"
  if (phone.startsWith('84') && phone.length === 11) phone = '0' + phone.slice(2);
  return phone;
}

/** Chỉ giữ lại các chữ số (dùng để tìm kiếm theo số điện thoại) */
export function onlyDigits(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}

/** Thông tin hiển thị của một trạng thái (có fallback nếu dữ liệu lạ) */
export function statusMeta(value) {
  return STATUS_MAP[value] || { value, text: value || 'Không rõ', tone: 'secondary', icon: '•' };
}

/** Nhãn loại dịch vụ */
export function serviceTypeLabel(value) {
  return SERVICE_TYPE_LABELS[value] || value || 'Không rõ';
}

/** Nhãn phương thức thanh toán */
export function paymentMethodLabel(value) {
  return PAYMENT_LABELS[value] || String(value || '').toUpperCase() || 'Không rõ';
}

/** Định dạng ngày giờ kiểu Việt Nam, ví dụ: "28/09/2026 08:30" */
export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return String(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Ngày hôm nay theo định dạng YYYY-MM-DD (giờ địa phương) */
export function todayISO(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* ====================== LỌC & THỐNG KÊ (thuần) ====================== */

/**
 * Tìm kiếm & lọc danh sách đơn (mục 36 & 37)
 * @param {Array} bookings danh sách đơn
 * @param {Object} options { keyword, status }
 * @returns {Array} danh sách đơn đã lọc (luôn trả về mảng mới)
 */
export function filterBookings(bookings, options = {}) {
  const list = Array.isArray(bookings) ? bookings : [];
  const { keyword = '', status = 'all' } = options;

  const text = String(keyword).trim().toLowerCase();
  const digits = onlyDigits(text);

  return list.filter((booking) => {
    if (status && status !== 'all' && booking.status !== status) return false;
    if (!text) return true;

    const haystack = [
      booking.bookingId,
      booking.customer?.name,
      booking.customer?.phone,
      booking.vehicle?.model,
      booking.vehicle?.licensePlate,
      booking.driver?.name,
      booking.route?.pickupLocation,
      booking.route?.destinationLocation,
      booking.note,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (haystack.includes(text)) return true;
    // Cho phép tìm theo số điện thoại kể cả khi người dùng gõ có khoảng trắng
    return Boolean(digits) && onlyDigits(booking.customer?.phone).includes(digits);
  });
}

/**
 * Tính toàn số liệu tổng quan cho Dashboard (mục 32)
 * @param {Array} bookings danh sách đơn
 * @param {string} today chuỗi YYYY-MM-DD để đếm đơn trong ngày
 */
export function computeStats(bookings, today = todayISO()) {
  const list = Array.isArray(bookings) ? bookings : [];
  const byStatus = Object.fromEntries(BOOKING_STATUSES.map((s) => [s.value, 0]));

  let revenue = 0;
  let cancelledCount = 0;
  let todayCount = 0;

  for (const booking of list) {
    if (Object.prototype.hasOwnProperty.call(byStatus, booking.status)) {
      byStatus[booking.status] += 1;
    }
    if (booking.status === 'cancelled') cancelledCount += 1;
    else revenue += Number(booking.fare?.totalAmount) || 0;

    const created = booking.schedule?.createdDate;
    if (created && String(created).slice(0, 10) === today) todayCount += 1;
  }

  const activeCount = list.length - cancelledCount;

  return {
    total: list.length,
    byStatus,
    revenue,
    todayCount,
    cancelledCount,
    activeCount,
    averageFare: activeCount > 0 ? Math.round(revenue / activeCount) : 0,
  };
}

/** Sinh mã đơn tự tăng, ví dụ: VF-2026-9826 -> VF-2026-9827 */
export function nextBookingId(bookings, year = new Date().getFullYear()) {
  const prefix = `VF-${year}-`;
  const max = (Array.isArray(bookings) ? bookings : []).reduce((acc, booking) => {
    const id = String(booking?.bookingId || '');
    if (!id.startsWith(prefix)) return acc;
    const number = parseInt(id.slice(prefix.length), 10);
    return Number.isFinite(number) && number > acc ? number : acc;
  }, 9820);
  return prefix + (max + 1);
}

/* ====================== STORAGE ADAPTER ====================== */

/** Bộ nhớ tạm dùng khi LocalStorage không khả dụng (chế độ ẩn danh, test) */
export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(String(key), String(value)),
    removeItem: (key) => map.delete(key),
  };
}

/** Lấy LocalStorage nếu dùng được, ngược lại trả về bộ nhớ tạm */
export function resolveStorage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      const probe = '__taxivinfast_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    /* Trình duyệt chặn storage -> dùng bộ nhớ tạm */
  }
  return createMemoryStorage();
}

/* ====================== BOOKING STORE ====================== */

/**
 * Tạo kho dữ liệu đơn đặt taxi
 * @param {Object} options { storage, seed, now }
 * @returns {Object} các hàm đọc / ghi / cập nhật / xóa / tìm kiếm / thống kê
 */
export function createBookingStore(options = {}) {
  const storage = options.storage || resolveStorage();
  const seed = Array.isArray(options.seed) ? options.seed : [];
  const now = options.now || (() => new Date());

  function read() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      console.warn('Dữ liệu đơn trong LocalStorage bị lỗi, sẽ nạp lại dữ liệu mẫu.', error);
      return null;
    }
  }

  function write(bookings) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(bookings));
      return true;
    } catch (error) {
      console.warn('Không thể lưu dữ liệu đơn vào LocalStorage.', error);
      return false;
    }
  }

  /** Lấy toàn bộ đơn, tự nạp dữ liệu mẫu khi chưa có dữ liệu nào trong storage */
  function getAll() {
    const existing = read();
    // `null` = chưa có dữ liệu (lần chạy đầu / storage lỗi) -> nạp dữ liệu mẫu
    // `[]`   = người dùng đã xóa hết đơn -> giữ nguyên, không nạp lại dữ liệu mẫu
    if (existing) return existing;
    const seeded = seed.map((booking) => ({ ...booking }));
    write(seeded);
    return seeded;
  }

  /** Lấy một đơn theo mã */
  function getById(id) {
    return getAll().find((booking) => booking.bookingId === id) || null;
  }

  /** Thêm một đơn mới (tự sinh mã nếu chưa có) */
  function add(booking) {
    const list = getAll();
    const createdAt = now().toISOString();
    const status = STATUS_MAP[booking?.status] ? booking.status : 'pending';

    const newBooking = {
      ...booking,
      bookingId: booking?.bookingId || nextBookingId(list, now().getFullYear()),
      status,
      statusText: booking?.statusText || statusMeta(status).text,
      createdAt: booking?.createdAt || createdAt,
      schedule: { ...(booking?.schedule || {}), createdDate: booking?.schedule?.createdDate || createdAt },
    };

    list.unshift(newBooking);
    write(list);
    return newBooking;
  }

  /** Cập nhật một đơn theo mã */
  function update(id, patch) {
    const list = getAll();
    const index = list.findIndex((booking) => booking.bookingId === id);
    if (index === -1) return null;
    list[index] = { ...list[index], ...patch };
    write(list);
    return list[index];
  }

  /** Cập nhật trạng thái đơn (mục 34) */
  function updateStatus(id, status) {
    if (!STATUS_MAP[status]) return null;
    const current = getById(id);
    if (!current) return null;

    const patch = { status, statusText: statusMeta(status).text, updatedAt: now().toISOString() };

    // Đơn hoàn thành thì coi như đã thu tiền, đơn hủy thì hoàn lại trạng thái
    if (status === 'completed' || status === 'cancelled') {
      patch.payment = { ...(current.payment || {}), status: status === 'completed' ? 'paid' : 'refunded' };
    }

    return update(id, patch);
  }

  /** Xóa một đơn khỏi LocalStorage (mục 35) */
  function remove(id) {
    const list = getAll();
    const next = list.filter((booking) => booking.bookingId !== id);
    if (next.length === list.length) return false;
    write(next);
    return true;
  }

  /** Khôi phục lại dữ liệu mẫu ban đầu (phục vụ buổi demo) */
  function reset() {
    const seeded = seed.map((booking) => ({ ...booking }));
    write(seeded);
    return seeded;
  }

  return { getAll, getById, add, update, updateStatus, remove, reset, search: filterBookings, stats: computeStats };
}
