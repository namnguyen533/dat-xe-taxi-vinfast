import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        cars: resolve(import.meta.dirname, 'cars.html'),
        carDetail: resolve(import.meta.dirname, 'car-detail.html'),
        booking: resolve(import.meta.dirname, 'booking.html'),
        danhsachchuyen: resolve(import.meta.dirname, 'danhsachchuyen.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
});
