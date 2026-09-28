/**
 * KHO DỮ LIỆU ĐƠN ĐẶT TAXI DÙNG CHUNG CHO TOÀN BỘ WEBSITE
 * ------------------------------------------------------------
 * Nạp dữ liệu mẫu từ file bookings.json rồi tạo một kho dữ liệu duy nhất
 * mà các trang Đặt xe / Lịch sử chuyến / Quản trị cùng sử dụng.
 */
import seedBookings from './bookings.json';
import { createBookingStore } from './store.js';

export const bookingStore = createBookingStore({ seed: seedBookings });

export * from './store.js';
