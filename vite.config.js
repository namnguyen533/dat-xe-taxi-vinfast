import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        booking: resolve(import.meta.dirname, 'booking.html'),
        cars: resolve(import.meta.dirname, 'cars.html'),
        carDetail: resolve(import.meta.dirname, 'car-detail.html'),
        giaodiendatxe: resolve(import.meta.dirname, 'src/giaodiendatxe.html'),
        danhsachchuyen: resolve(import.meta.dirname, 'danhsachchuyen.html'),
      },
    },
  },
});
