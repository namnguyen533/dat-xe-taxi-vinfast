/**
 * TRANG LỊCH SỬ CHUYẾN XE (góc nhìn của khách hàng)
 * ------------------------------------------------------------
 * Đọc dữ liệu đơn đặt taxi từ LocalStorage (dùng chung module store với
 * trang Đặt xe và trang Quản trị), cho phép xem thống kê nhanh,
 * tìm kiếm theo tên / số điện thoại / mã đơn, xem chi tiết từng chuyến,
 * hủy chuyến xe và đánh giá chất lượng chuyến đi.
 */
import './style.css';
import { bookingStore, computeStats, filterBookings, formatVND } from './data/booking-store.js';
import {
  bindModalClose,
  closeBookingDetail,
  BOOKINGS_TABLE_COLUMNS,
  bookingsTableRowsHtml,
  emptyRowHtml,
  openBookingDetail,
  toast,
} from './bookings-view.js';

const state = { keyword: '', status: 'all' };

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('bookings-table-body');
  const searchInput = document.getElementById('booking-search-input');
  const statusFilter = document.getElementById('booking-status-filter');
  const emptyMessage = document.getElementById('history-empty-message');
  if (!tbody) return;

  // Elements cho Modal Hủy chuyến
  const cancelModal = document.getElementById('cancel-trip-modal');
  const cancelBookingIdEl = document.getElementById('cancel-modal-booking-id');
  const cancelForm = document.getElementById('cancel-trip-form');
  const btnCloseCancel = document.getElementById('btn-close-cancel-modal');
  const btnAbortCancel = document.getElementById('btn-abort-cancel');
  const radioReasonOther = document.getElementById('radio-reason-other');
  const otherReasonGroup = document.getElementById('other-reason-group');
  const otherReasonInput = document.getElementById('cancel-other-reason-input');

  // Elements cho Modal Đánh giá
  const reviewModal = document.getElementById('review-trip-modal');
  const reviewBookingIdEl = document.getElementById('review-modal-booking-id');
  const reviewDriverNameEl = document.getElementById('review-modal-driver-name');
  const reviewForm = document.getElementById('review-trip-form');
  const btnCloseReview = document.getElementById('btn-close-review-modal');
  const btnAbortReview = document.getElementById('btn-abort-review');
  const starBtns = document.querySelectorAll('#star-rating-group .star-btn');
  const ratingScoreText = document.getElementById('rating-score-text');
  const reviewCommentInput = document.getElementById('review-comment-input');

  let currentActionBookingId = null;
  let currentSelectedRating = 5;

  const RATING_LABELS = {
    1: '1 sao - Rất không hài lòng',
    2: '2 sao - Cần cải thiện',
    3: '3 sao - Bình thường',
    4: '4 sao - Hài lòng',
    5: '5 sao - Rất tuyệt vời',
  };

  /** Cập nhật thẻ thống kê tổng quan */
  function renderStats(bookings) {
    const stats = computeStats(bookings);
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    set('stat-total-count', stats.total);
    set('stat-completed-count', stats.byStatus.completed);
    set('stat-moving-count', stats.byStatus.in_progress + stats.byStatus.confirmed);
    set('stat-pending-count', stats.byStatus.pending);
    set('stat-total-revenue', formatVND(stats.revenue));
  }

  /** Vẽ danh sách chuyến đã lọc */
  function renderTable() {
    const all = bookingStore.getAll();
    const filtered = filterBookings(all, { keyword: state.keyword, status: state.status });

    tbody.innerHTML = bookingsTableRowsHtml(filtered, { showActions: false });
    if (emptyMessage) emptyMessage.style.display = filtered.length === 0 ? 'block' : 'none';
  }

  function renderAll() {
    renderStats(bookingStore.getAll());
    renderTable();
  }

  // =========================================================================
  // XỬ LÝ HỦY CHUYẾN XE (CANCEL TRIP)
  // =========================================================================
  function openCancelModal(bookingId) {
    const booking = bookingStore.getById(bookingId);
    if (!booking) return;

    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      toast('Chuyến xe này không thể hủy do tài xế đang di chuyển hoặc đã hoàn thành.', 'warning');
      return;
    }

    currentActionBookingId = bookingId;
    if (cancelBookingIdEl) cancelBookingIdEl.textContent = `#${bookingId}`;
    if (cancelForm) cancelForm.reset();
    if (otherReasonGroup) otherReasonGroup.style.display = 'none';
    if (cancelModal) cancelModal.style.display = 'flex';
  }

  function closeCancelModal() {
    if (cancelModal) cancelModal.style.display = 'none';
    currentActionBookingId = null;
  }

  document.querySelectorAll('input[name="cancel_reason"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (otherReasonGroup) {
        otherReasonGroup.style.display = radio.value === 'other' ? 'block' : 'none';
        if (radio.value === 'other') otherReasonInput?.focus();
      }
    });
  });

  cancelForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentActionBookingId) return;

    const selectedRadio = document.querySelector('input[name="cancel_reason"]:checked');
    let reason = selectedRadio ? selectedRadio.value : 'Khách hàng yêu cầu hủy';
    if (reason === 'other') {
      reason = (otherReasonInput?.value || '').trim() || 'Lý do khác từ khách hàng';
    }

    bookingStore.updateStatus(currentActionBookingId, 'cancelled');
    bookingStore.update(currentActionBookingId, {
      cancellationReason: reason,
      cancelledAt: new Date().toISOString(),
    });

    closeCancelModal();
    closeBookingDetail();
    renderAll();
    toast(`Đã hủy chuyến xe #${currentActionBookingId} thành công.`, 'info');
  });

  btnCloseCancel?.addEventListener('click', closeCancelModal);
  btnAbortCancel?.addEventListener('click', closeCancelModal);
  cancelModal?.addEventListener('click', (e) => {
    if (e.target === cancelModal) closeCancelModal();
  });

  // =========================================================================
  // XỬ LÝ ĐÁNH GIÁ CHUYẾN ĐI (RATING & REVIEW)
  // =========================================================================
  function setStarRating(score) {
    currentSelectedRating = score;
    starBtns.forEach((btn) => {
      const r = Number(btn.dataset.rating);
      btn.classList.toggle('active', r <= score);
    });
    if (ratingScoreText) {
      ratingScoreText.textContent = RATING_LABELS[score] || `${score} sao`;
    }
  }

  starBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const score = Number(btn.dataset.rating);
      setStarRating(score);
    });
  });

  function openReviewModal(bookingId) {
    const booking = bookingStore.getById(bookingId);
    if (!booking) return;

    currentActionBookingId = bookingId;
    if (reviewBookingIdEl) reviewBookingIdEl.textContent = `#${bookingId}`;
    if (reviewDriverNameEl) reviewDriverNameEl.textContent = booking.driver?.name || 'Tài xế VinFast';
    if (reviewCommentInput) reviewCommentInput.value = booking.review || '';

    // Khởi tạo số sao hiện tại
    setStarRating(booking.rating || 5);

    // Điền lại các tag đã chọn trước đó (nếu có)
    const existingTags = booking.ratingTags || ['Xe sạch sẽ, không mùi', 'Tài xế thân thiện, lịch sự', 'Lái xe an toàn, đúng luật'];
    document.querySelectorAll('input[name="rating_tag"]').forEach((chk) => {
      chk.checked = existingTags.includes(chk.value);
    });

    if (reviewModal) reviewModal.style.display = 'flex';
  }

  function closeReviewModal() {
    if (reviewModal) reviewModal.style.display = 'none';
    currentActionBookingId = null;
  }

  reviewForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentActionBookingId) return;

    const checkedTags = [...document.querySelectorAll('input[name="rating_tag"]:checked')].map((c) => c.value);
    const comment = (reviewCommentInput?.value || '').trim();

    bookingStore.update(currentActionBookingId, {
      rating: currentSelectedRating,
      review: comment,
      ratingTags: checkedTags,
      reviewedAt: new Date().toISOString(),
    });

    closeReviewModal();
    closeBookingDetail();
    renderAll();
    toast(`Cảm ơn bạn đã gửi đánh giá ${currentSelectedRating} sao cho chuyến đi!`, 'success');
  });

  btnCloseReview?.addEventListener('click', closeReviewModal);
  btnAbortReview?.addEventListener('click', closeReviewModal);
  reviewModal?.addEventListener('click', (e) => {
    if (e.target === reviewModal) closeReviewModal();
  });

  // =========================================================================
  // GẮN SỰ KIỆN CLICK TRÊN BẢNG & POPUP CHI TIẾT
  // =========================================================================
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    if (!id) return;

    if (action === 'detail') {
      const booking = bookingStore.getById(id);
      if (booking) openBookingDetail(booking);
      else toast('Không tìm thấy thông tin chuyến xe này.', 'warning');
    } else if (action === 'cancel') {
      openCancelModal(id);
    } else if (action === 'review') {
      openReviewModal(id);
    }
  });

  // Tìm kiếm theo tên / số điện thoại / mã đơn
  searchInput?.addEventListener('input', (event) => {
    state.keyword = event.target.value;
    renderTable();
  });

  // Lọc theo trạng thái
  statusFilter?.addEventListener('click', (event) => {
    const button = event.target.closest('.btn-filter-status');
    if (!button) return;
    statusFilter.querySelectorAll('.btn-filter-status').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.status = button.dataset.status || 'all';
    renderTable();
  });

  // Đóng popup chi tiết
  bindModalClose();

  renderAll();
  window.addEventListener('storage', renderAll);
});
