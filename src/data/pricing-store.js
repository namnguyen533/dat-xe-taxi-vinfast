import pricingSeed from './pricing.json' with { type: 'json' };

export const PRICING_STORAGE_KEY = 'taxivinfast_pricing_config';

export function getPricingConfig(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(PRICING_STORAGE_KEY);
    if (!raw) return structuredClone(pricingSeed);
    const config = JSON.parse(raw);
    if (!config || !Array.isArray(config.standardRates) || !Array.isArray(config.promotions)) {
      throw new Error('Cấu hình giá cước đã lưu không đúng định dạng.');
    }
    return config;
  } catch (error) {
    console.error('Không thể đọc cấu hình giá cước đã lưu.', error);
    throw error;
  }
}

export function savePricingConfig(config, storage = globalThis.localStorage) {
  try {
    storage?.setItem(PRICING_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Không thể lưu cấu hình giá cước.', error);
    throw error;
  }
  return config;
}
