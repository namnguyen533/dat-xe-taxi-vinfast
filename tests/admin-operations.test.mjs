import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { ADMIN_OPERATIONS_KEY, getAdminOperations, saveAdminOperations } from '../src/data/admin-operations.js';
import { PRICING_STORAGE_KEY, getPricingConfig, savePricingConfig } from '../src/data/pricing-store.js';
import { calculateTripFare } from '../src/price-calculator.js';

const require = createRequire(import.meta.url);
const pricingSeed = require('../src/data/pricing.json');

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test('admin operations initialize demo fleet, drivers, complaints, and persist changes', () => {
  const storage = memoryStorage();
  const state = getAdminOperations(storage);

  assert.equal(state.fleet.length, 6);
  assert.ok(state.drivers.length > 0);
  assert.ok(state.complaints.length > 0);
  assert.equal(state.settings.lowBatteryThreshold, 25);

  state.settings.lowBatteryThreshold = 20;
  saveAdminOperations(state, storage);
  assert.equal(getAdminOperations(storage).settings.lowBatteryThreshold, 20);
  assert.ok(storage.getItem(ADMIN_OPERATIONS_KEY));
});

test('pricing config changes are persisted and used by trip fare calculation', () => {
  const storage = memoryStorage();
  const config = getPricingConfig(storage);
  const vf5 = config.standardRates.find((rate) => rate.modelId === 'vf5');
  vf5.baseFare = 20000;
  vf5.rateUnder25km = 15000;
  config.promotions.push({
    code: 'TEST20',
    discountType: 'percentage',
    discountValue: 20,
    maxDiscount: 50000,
    description: 'Test promotion',
    active: true,
  });
  config.surcharges.peakHours = {
    enabled: true,
    ranges: '17:00-20:00',
    percentage: 10,
  };
  savePricingConfig(config, storage);

  const reloadedConfig = getPricingConfig(storage);
  const fare = calculateTripFare({
    distanceKm: 10,
    vehicleModel: 'VF 5 Plus',
    pickupTime: '18:00',
    couponCode: 'TEST20',
    pricingConfig: reloadedConfig,
  });

  assert.equal(reloadedConfig.standardRates.find((rate) => rate.modelId === 'vf5').baseFare, 20000);
  assert.equal(fare.baseFare, 20000);
  assert.equal(fare.peakSurcharge, 15500);
  assert.ok(fare.discount > 0);
  assert.ok(storage.getItem(PRICING_STORAGE_KEY));
});

test('inactive voucher is not applied by the shared fare calculator', () => {
  const config = structuredClone(pricingSeed);
  const promotion = config.promotions.find((item) => item.code === 'VINFAST20');
  promotion.active = false;

  const fare = calculateTripFare({
    distanceKm: 10,
    couponCode: 'VINFAST20',
    pricingConfig: config,
  });

  assert.equal(fare.discount, 0);
});
