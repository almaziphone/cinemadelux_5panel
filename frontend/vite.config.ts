import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        timeout: 600000, // 10 минут для больших файлов
        proxyTimeout: 600000,
        // Исключаем загрузку файлов из прокси - они будут отправляться напрямую
        bypass: (req) => {
          // Если это запрос на загрузку файла, не проксируем (будет использован прямой URL)
          if (req.url?.includes('/admin/premieres/upload')) {
            return false; // Не проксируем, но это не сработает, так как мы используем прямой URL
          }
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            // Логируем только ошибки
            console.error('Proxy error:', err);
          });
          // Убрали логирование всех запросов
        }
      }
    }
  }
})
