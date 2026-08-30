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
  /** 草书来源：内置简入繁出版（默认，简繁体都覆盖）/ 内置原版（仅繁体字形）/ 跟随系统 / 自定义上传 */
  cursiveSource: 'builtin-jf' | 'builtin-yb' | 'system' | 'custom'
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
