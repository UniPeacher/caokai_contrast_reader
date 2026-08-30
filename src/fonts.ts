/**
 * 内置草书字体注册与元数据（单一来源）。
 * App.tsx 按当前选择注册字体；CharZoomOverlay 放大对比时批量注册简繁组字体。
 */

export interface FontDef {
  key: string
  family: string
  file: string
  label: string
  group: 'simplified' | 'traditional'
}

const BASE = import.meta.env.BASE_URL

export const BUILTIN_FONTS: FontDef[] = [
  { key: 'builtin-jf', family: 'CaoShuJF', file: 'caoshu-jf.ttf', label: '简入繁出', group: 'simplified' },
  { key: 'builtin-zdf', family: 'CaoShuZDF', file: 'caoshu-zdf.ttf', label: '周东芬草书', group: 'simplified' },
  { key: 'builtin-hczp', family: 'CaoShuHCZP', file: 'caoshu-hczp.ttf', label: '汉呈张平草书', group: 'simplified' },
  { key: 'builtin-bzfh', family: 'CaoShuBZFH', file: 'caoshu-bzfh.ttf', label: '标准草书符号', group: 'simplified' },
  { key: 'builtin-swm', family: 'CaoShuSWM', file: 'caoshu-swm.ttf', label: '汉仪孙万民草书', group: 'simplified' },
  { key: 'builtin-sgc', family: 'CaoShuSGC', file: 'caoshu-sgc.ttf', label: '孙过庭草书', group: 'simplified' },
  { key: 'builtin-yrz', family: 'CaoShuYRZ', file: 'caoshu-yrz.ttf', label: '于右任标准草书', group: 'simplified' },
  { key: 'builtin-yb', family: 'CaoShuYB', file: 'caoshu-yb.ttf', label: '原版', group: 'traditional' },
  { key: 'builtin-sgt', family: 'CaoShuSGT', file: 'caoshu-sgt.ttf', label: '孙过庭书谱', group: 'traditional' },
]

/** 简繁组字体（放大对比时使用） */
export const SIMPLIFIED_FONTS = BUILTIN_FONTS.filter((f) => f.group === 'simplified')

export function fontUrl(file: string): string {
  return `${BASE}fonts/${file}`
}

/** 已注册过的字体族，避免重复加载 */
const registeredFonts = new Set<string>()

export async function ensureFont(family: string, url: string): Promise<void> {
  if (registeredFonts.has(family)) return
  const face = new FontFace(family, `url(${url})`)
  await face.load()
  document.fonts.add(face)
  registeredFonts.add(family)
}

/** 批量注册一组内置字体（幂等，单个失败不影响其他） */
export async function ensureBuiltinFonts(fonts: FontDef[]): Promise<void> {
  await Promise.all(
    fonts.map((f) => ensureFont(f.family, fontUrl(f.file)).catch((e) => console.error('字体加载失败', f.label, e))),
  )
}
