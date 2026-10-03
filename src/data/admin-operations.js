import bookingSeed from './bookings.json' with { type: 'json' };

export const ADMIN_OPERATIONS_KEY = 'taxivinfast_admin_operations';

const demoFleet = [
  { id: 'VF-001', plate: '51K-882.19', model: 'VinFast VF 5 Plus', stateOfCharge: 78, odometerKm: 18240, inspectionDue: '2027-02-10', insuranceDue: '2027-01-18', maintenanceDue: '2026-11-22', status: 'ready', lat: 10.801, lng: 106.702 },
  { id: 'VF-002', plate: '30H-991.82', model: 'VinFast VF 8', stateOfCharge: 24, odometerKm: 32650, inspectionDue: '2026-11-01', insuranceDue: '2027-03-14', maintenanceDue: '2026-10-28', status: 'charging', lat: 21.028, lng: 105.835 },
  { id: 'VF-003', plate: '51L-123.45', model: 'VinFast VF 3', stateOfCharge: 63, odometerKm: 12450, inspectionDue: '2027-05-16', insuranceDue: '2027-04-22', maintenanceDue: '2026-12-05', status: 'ready', lat: 10.776, lng: 106.701 },
  { id: 'VF-004', plate: '51K-999.99', model: 'VinFast VF 9', stateOfCharge: 17, odometerKm: 43880, inspectionDue: '2026-10-28', insuranceDue: '2026-12-09', maintenanceDue: '2026-10-15', status: 'maintenance', lat: 10.792, lng: 106.698 },
  { id: 'VF-005', plate: '60A-778.12', model: 'VinFast VF 7', stateOfCharge: 91, odometerKm: 21870, inspectionDue: '2027-03-18', insuranceDue: '2027-02-28', maintenanceDue: '2026-12-19', status: 'ready', lat: 10.814, lng: 106.724 },
  { id: 'VF-006', plate: '51H-234.56', model: 'VinFast VF 6', stateOfCharge: 46, odometerKm: 29710, inspectionDue: '2027-01-12', insuranceDue: '2027-01-30', maintenanceDue: '2026-11-08', status: 'ready', lat: 10.758, lng: 106.682 },
];

function createSeedState() {
  const driversByName = new Map();
  bookingSeed.forEach((booking) => {
    const driverName = booking.driver?.name?.trim();
    if (!driverName) return;
    const driver = driversByName.get(driverName) || {
      id: `DRV-${driversByName.size + 1}`,
      name: driverName,
      phone: booking.driver.phone || '',
      rating: Number(booking.driver.rating) || 5,
      approved: true,
      blocked: false,
      shift: 'on',
      walletBalance: 0,
      incentiveBalance: 0,
      penaltyBalance: 0,
      trips: 0,
      earnings: 0,
    };
    driver.trips += 1;
    if (booking.status === 'completed') {
      driver.earnings += Math.round((Number(booking.fare?.totalAmount) || 0) * 0.8);
    }
    driversByName.set(driverName, driver);
  });

  return {
    version: 1,
    fleet: demoFleet,
    drivers: [...driversByName.values()].map((driver) => ({
      ...driver,
      walletBalance: driver.earnings,
    })),
    complaints: [
      { id: 'CS-1001', bookingId: 'VF-2026-9822', customerName: 'Phạm Thị Hương', category: 'Trễ giờ đón', detail: 'Khách phản ánh xe đến muộn so với lịch hẹn.', status: 'open', createdAt: '2026-09-28T10:30:00' },
      { id: 'CS-1002', bookingId: 'VF-2026-9824', customerName: 'Vũ Anh Tuấn', category: 'Hóa đơn', detail: 'Đề nghị gửi lại hóa đơn điện tử sau chuyến đi.', status: 'investigating', createdAt: '2026-09-29T15:10:00' },
    ],
    blacklist: [],
    incidents: [],
    auditLogs: [],
    staff: [
      { id: 'USR-ADMIN', name: 'Quản trị viên', email: 'admin@taxivinfast.com', role: 'admin', active: true },
    ],
    settings: {
      lowBatteryThreshold: 25,
      rainMode: false,
    },
  };
}

export function getAdminOperations(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(ADMIN_OPERATIONS_KEY);
    if (!raw) {
      const initialState = createSeedState();
      storage?.setItem(ADMIN_OPERATIONS_KEY, JSON.stringify(initialState));
      return initialState;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.fleet) || !Array.isArray(parsed.drivers)) {
      throw new Error('Dữ liệu vận hành quản trị sai định dạng.');
    }
    parsed.complaints ||= [];
    parsed.blacklist ||= [];
    parsed.incidents ||= [];
    parsed.auditLogs ||= [];
    parsed.staff ||= [{ id: 'USR-ADMIN', name: 'Quản trị viên', email: 'admin@taxivinfast.com', role: 'admin', active: true }];
    parsed.settings ||= { lowBatteryThreshold: 25, rainMode: false };
    return parsed;
  } catch (error) {
    console.error('Không thể đọc dữ liệu vận hành quản trị đã lưu.', error);
    throw error;
  }
}

export function saveAdminOperations(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(ADMIN_OPERATIONS_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Không thể lưu dữ liệu vận hành quản trị.', error);
    throw error;
  }
  return state;
}
