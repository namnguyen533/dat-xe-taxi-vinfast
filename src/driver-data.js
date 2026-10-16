export const DRIVER_SETTINGS_KEY = 'taxivinfast_driver_settings';
export const DRIVER_WALLET_KEY = 'taxivinfast_driver_wallet';
export const DRIVER_FLOW_KEY = 'taxivinfast_driver_flow';

export function getDriverBookings(bookings, driverName) {
  return bookings.filter((booking) => (
    booking.driver?.name === driverName
    || (booking.status === 'pending' && !booking.driver?.name)
  ));
}

export function getDriverEarnings(bookings, driverName, commissionRate = 0.2) {
  return bookings
    .filter((booking) => booking.status === 'completed' && booking.driver?.name === driverName)
    .reduce((summary, booking) => {
      const gross = Number(booking.fare?.totalAmount) || 0;
      const platformFee = Math.round(gross * commissionRate);
      summary.trips += 1;
      summary.gross += gross;
      summary.fees += platformFee;
      summary.net += gross - platformFee;
      return summary;
    }, { trips: 0, gross: 0, fees: 0, net: 0 });
}

export function getDriverSettings(storage, email, defaults = {}) {
  const saved = JSON.parse(storage.getItem(DRIVER_SETTINGS_KEY) || '{}');
  const settings = saved[email] || {};
  return {
    fullName: defaults.fullName || '',
    phone: defaults.phone || '',
    vehicle: 'VinFast VF 5 Plus',
    plate: '51K-882.19',
    bankName: '',
    bankAccount: '',
    licenseExpiry: '',
    vehiclePaperExpiry: '',
    rating: 5,
    language: 'vi',
    notifications: true,
    sound: true,
    ...settings,
  };
}

export function saveDriverSettings(storage, email, settings) {
  const saved = JSON.parse(storage.getItem(DRIVER_SETTINGS_KEY) || '{}');
  saved[email] = settings;
  storage.setItem(DRIVER_SETTINGS_KEY, JSON.stringify(saved));
}

export function getDriverWallet(storage, email) {
  const saved = JSON.parse(storage.getItem(DRIVER_WALLET_KEY) || '{}');
  return saved[email] || { withdrawals: [], balancePending: 0 };
}

export function saveDriverWallet(storage, email, wallet) {
  const saved = JSON.parse(storage.getItem(DRIVER_WALLET_KEY) || '{}');
  saved[email] = wallet;
  storage.setItem(DRIVER_WALLET_KEY, JSON.stringify(saved));
}
