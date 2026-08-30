/**
 * 生成 PWA 图标（public/icons/*.png）。
 * 设计：墨色圆角底 + 上（草书感波线）/下（楷书感直线）两笔，抽象表达「草→楷」。
 * 只用形状不嵌文字，避免字体依赖。运行：npm run icons
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = path.join(root, 'public', 'icons')
await mkdir(outDir, { recursive: true })

/** 主体图形（512 画布坐标） */
function artwork(scale = 1, offset = 0) {
  // scale/offset 用于 maskable 版：把图形缩进安全区
  const cx = 256
  const s = (v) => cx + (v - cx) * scale + offset
  return `
    <g>
      <!-- 草书感的一笔：流动波线 -->
      <path
        d="M ${s(120)} ${s(215)} C ${s(170)} ${s(140)}, ${s(225)} ${s(250)}, ${s(285)} ${s(185)} S ${s(380)} ${s(150)}, ${s(392)} ${s(205)}"
        fill="none" stroke="#e2543c" stroke-width="${30 * scale}" stroke-linecap="round"
      />
      <!-- 楷书感的一笔：端正横线 -->
      <line x1="${s(128)}" y1="${s(322)}" x2="${s(384)}" y2="${s(322)}"
        stroke="#f2ead9" stroke-width="${30 * scale}" stroke-linecap="round" />
      <!-- 两个小点，像落款印 -->
      <circle cx="${s(352)}" cy="${s(322) - 52 * scale}" r="${7 * scale}" fill="#f2ead9" opacity="0.9" />
    </g>`
}

function iconSvg({ maskable = false } = {}) {
  const bgRect = maskable
    ? '<rect x="0" y="0" width="512" height="512" fill="url(#bg)"/>'
    : '<rect x="32" y="32" width="448" height="448" rx="96" fill="url(#bg)"/>'
  const scale = maskable ? 0.62 : 1
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2a231c"/>
      <stop offset="1" stop-color="#4a3d2e"/>
    </linearGradient>
  </defs>
  ${bgRect}
  ${artwork(scale)}
</svg>`
}

// 非 maskable 版其实不需要外层再垫底，直接导出
async function render(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(outDir, file))
  console.log('生成', file)
}

const normal = iconSvg()
const maskable = iconSvg({ maskable: true })

await render(normal, 512, 'icon-512.png')
await render(normal, 192, 'icon-192.png')
await render(maskable, 512, 'icon-maskable-512.png')
await render(maskable, 192, 'icon-maskable-192.png')
await render(maskable, 180, 'apple-touch-icon-180.png')
console.log('图标全部生成完毕 →', outDir)
