/**
 * CÔNG CỤ MÔ PHỎNG TÍNH GIÁ CƯỚC CHUYẾN ĐI TAXI VINFAST
 * @param {Object} params Tham số đầu vào để tính giá cước
 * @param {number} params.distanceKm Quãng đường di chuyển (Km)
 * @param {number} params.basePrice Giá mở cửa dòng xe chọn (VND)
 * @param {number} params.perKmPrice Đơn giá cước theo Km (VND)
 * @param {string} [params.serviceType='point-to-point'] Loại dịch vụ: 'point-to-point', 'hourly', 'intercity', 'airport'
 * @param {string} [params.pickupTime='12:00'] Giờ đón (để tính phụ phí đêm 22h-05h)
 * @param {string} [params.couponCode=''] Mã giảm giá khuyến mãi (VD: 'VINFAST20', 'XEXANH')
 * @returns {Object} Đối tượng chi tiết bảng tính cước phí
 */
export function calculateTripFare({
  distanceKm = 0,
  basePrice = 12000,
  perKmPrice = 10000,
  serviceType = 'point-to-point',
  pickupTime = '12:00',
  couponCode = ''
}) {
  if (distanceKm <= 0) {
    return {
      baseFare: 0,
      distanceCost: 0,
      nightSurcharge: 0,
      serviceFee: 0,
      discount: 0,
      subtotal: 0,
      totalFare: 0,
      formattedTotal: '0 đ',
      breakdown: []
    };
  }

  // 1. Tính giá mở cửa (Mặc định cho 1 km đầu tiên)
  const baseFare = basePrice;

  // 2. Tính cước quãng đường (Km còn lại)
  const remainingKm = Math.max(0, distanceKm - 1);
  let distanceCost = remainingKm * perKmPrice;

  // Giảm giá 15% cho quãng đường đi tỉnh / đường dài (> 25 km)
  if (serviceType === 'intercity' || distanceKm > 25) {
    distanceCost *= 0.85;
  }

  // 3. Phụ phí loại dịch vụ
  let serviceFee = 0;
  if (serviceType === 'hourly') {
    serviceFee = 50000; // Phụ phí thuê theo giờ
  } else if (serviceType === 'airport') {
    serviceFee = 15000; // Phí sân bay / bến bãi
  }

  // 4. Tính Phụ phí đêm (22:00 - 05:00) +10%
  let nightSurcharge = 0;
  if (pickupTime) {
    const hour = parseInt(pickupTime.split(':')[0], 10);
    if (hour >= 22 || hour < 5) {
      nightSurcharge = (baseFare + distanceCost) * 0.10;
    }
  }

  // Tổng tiền trước giảm giá (Subtotal)
  const subtotal = baseFare + distanceCost + serviceFee + nightSurcharge;

  // 5. Tính giảm giá Khuyến mãi
  let discount = 0;
  const cleanCoupon = (couponCode || '').trim().toUpperCase();

  if (cleanCoupon === 'VINFAST20') {
    discount = Math.min(50000, subtotal * 0.20); // Giảm 20%, tối đa 50k
  } else if (cleanCoupon === 'XEXANH') {
    discount = 30000; // Giảm cố định 30k
  }

  // 6. Tổng tiền cuối cùng sau giảm giá
  const totalFare = Math.max(0, Math.round(subtotal - discount));

  // Format VND helper
  const formatVND = (amt) => new Intl.NumberFormat('vi-VN').format(Math.round(amt)) + ' đ';

  return {
    baseFare,
    distanceCost: Math.round(distanceCost),
    nightSurcharge: Math.round(nightSurcharge),
    serviceFee,
    discount: Math.round(discount),
    subtotal: Math.round(subtotal),
    totalFare,
    formattedTotal: formatVND(totalFare),
    breakdown: [
      { label: "Giá mở cửa", value: formatVND(baseFare) },
      { label: `Cước quãng đường (${distanceKm} km)`, value: formatVND(distanceCost) },
      nightSurcharge > 0 ? { label: "Phụ phí đêm (22h-5h +10%)", value: formatVND(nightSurcharge) } : null,
      serviceFee > 0 ? { label: "Phụ phí dịch vụ / Sân bay", value: formatVND(serviceFee) } : null,
      discount > 0 ? { label: `Giảm giá mã (${cleanCoupon})`, value: `- ${formatVND(discount)}`, isDiscount: true } : null
    ].filter(Boolean)
  };
}

