import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import os from 'node:os'

// 部署在子路径时设置环境变量 BASE_PATH，例如 BASE_PATH=/contrast-reader/
const BASE = process.env.BASE_PATH || '/'

/**
 * 开发期在终端打印局域网二维码，手机扫码即可访问。
 */
function lanQrPlugin(): Plugin {
  return {
    name: 'lan-qr',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        import('qrcode').then(async ({ default: QR }) => {
          const nets = os.networkInterfaces()
          const urls: string[] = []
          for (const list of Object.values(nets)) {
            for (const net of list ?? []) {
              if (net.family !== 'IPv4' || net.internal) continue
              urls.push(`http://${net.address}:${server.config.server.port ?? 5173}/`)
            }
          }
          if (!urls.length) return
          const line = '─'.repeat(46)
          console.log(`\n${line}\n📱 手机连同一 Wi-Fi，扫码访问：\n`)
          for (const url of urls) {
            console.log(await QR.toString(url, { type: 'terminal', small: true }))
            console.log(`   ${url}\n`)
          }
          console.log(line)
        })
      })
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    lanQrPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon-180.png'],
      manifest: {
        name: '草楷对比阅读器',
        short_name: '草楷阅读',
        description: '导入 EPUB，正文以系统草书字体呈现，点按段落切换楷书对照，帮助学会认草书。',
        lang: 'zh-CN',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#f6f3ec',
        theme_color: '#a63d2f',
        icons: [
          { src: `${BASE}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${BASE}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${BASE}icons/icon-maskable-192.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: `${BASE}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            // 内置草书/楷书字体：首次下载后永久缓存
            urlPattern: /\.(?:ttf|otf|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
})
