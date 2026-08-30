export type CompareMode = 'toggle' | 'compare'
export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Settings {
  /** 正文字号 px */
  fontSize: number
  /** 正文行距 */
  lineHeight: number
  theme: ThemeMode
  /** 对照模式：toggle=点按段落切换楷书/草书；compare=段落下方显示楷书对照 */
  compareMode: CompareMode
  /** 草书来源：内置字体（简繁类：简入繁出/周东芬/汉呈张平/标准草书符号/汉仪孙万民/孙过庭草书/于右任；繁体类：原版/孙过庭书谱）/ 跟随系统 / 自定义上传 */
  cursiveSource:
    | 'builtin-jf'
    | 'builtin-yb'
    | 'builtin-sgt'
    | 'builtin-zdf'
    | 'builtin-hczp'
    | 'builtin-bzfh'
    | 'builtin-swm'
    | 'builtin-sgc'
    | 'builtin-yrz'
    | 'system'
    | 'custom'
  /** 上传的草书字体文件（ttf/otf/woff2），存 IndexedDB */
  customFontBlob?: Blob
}

export interface BookRecord {
  id: string
  title: string
  author: string
  cover?: Blob
  epub: Blob
  spineCount: number
  addedAt: number
  lastSpine?: number
  lastScrollRatio?: number
}

export interface CollectionEntry {
  char: string
  bookId: string
  bookTitle: string
  spineIndex: number
  paraIndex: number
  /** 段落内的码位（code point）偏移 */
  charOffset: number
  createdAt: number
}

export interface JumpTarget {
  spineIndex: number
  paraIndex?: number
  charOffset?: number
  highlight?: boolean
}
