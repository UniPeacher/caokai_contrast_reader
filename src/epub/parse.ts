import JSZip from 'jszip'

export interface SpineItem {
  /** 内容文档在 zip 内的完整路径（已归一化） */
  href: string
  title?: string
}

export interface TocEntry {
  title: string
  spineIndex: number
}

export interface EpubBook {
  zip: JSZip
  title: string
  author: string
  cover?: Blob
  spine: SpineItem[]
  toc: TocEntry[]
  /** OPF 所在目录，用于解析章节内相对路径 */
  opfDir: string
}

function localAll(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter((el) => el.localName === name)
}

function firstLocal(root: Document | Element, name: string): Element | undefined {
  return localAll(root, name)[0]
}

export function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** 以 baseDir 为基准解析相对路径，返回归一化的 zip 内路径 */
export function joinPath(baseDir: string, href: string): string {
  const clean = decodeSafe(href.split('#')[0])
  const stack = baseDir ? baseDir.split('/').filter(Boolean) : []
  for (const part of clean.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

export function dirOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

async function readBlob(zip: JSZip, path: string, type: string): Promise<Blob | undefined> {
  const file = zip.file(path)
  if (!file) return undefined
  const data = await file.async('arraybuffer')
  return new Blob([data], { type })
}

export async function openEpub(data: ArrayBuffer): Promise<EpubBook> {
  const zip = await JSZip.loadAsync(data)

  // 1. container.xml -> OPF 路径
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('不是有效的 EPUB 文件（缺少 container.xml）')
  const containerDoc = new DOMParser().parseFromString(await containerFile.async('text'), 'application/xml')
  const opfPath = firstLocal(containerDoc, 'rootfile')?.getAttribute('full-path')
  if (!opfPath || !zip.file(opfPath)) throw new Error('不是有效的 EPUB 文件（缺少 OPF）')
  const opfDir = dirOf(opfPath)

  // 2. OPF -> 元数据 / manifest / spine
  const opf = new DOMParser().parseFromString(await zip.file(opfPath)!.async('text'), 'application/xml')
  const title = firstLocal(opf, 'title')?.textContent?.trim() || '未知书名'
  const author = firstLocal(opf, 'creator')?.textContent?.trim() || ''

  interface ManifestItem { href: string; mediaType: string; properties: string }
  const manifest = new Map<string, ManifestItem>()
  for (const el of localAll(opf, 'item')) {
    const id = el.getAttribute('id')
    const href = el.getAttribute('href')
    if (!id || !href) continue
    manifest.set(id, {
      href: joinPath(opfDir, href),
      mediaType: el.getAttribute('media-type') ?? '',
      properties: el.getAttribute('properties') ?? '',
    })
  }

  const spine: SpineItem[] = []
  const spineIndexByHref = new Map<string, number>()
  for (const el of localAll(opf, 'itemref')) {
    const idref = el.getAttribute('idref')
    const item = idref ? manifest.get(idref) : undefined
    if (!item) continue
    if (!spineIndexByHref.has(item.href)) spineIndexByHref.set(item.href, spine.length)
    spine.push({ href: item.href })
  }
  if (!spine.length) throw new Error('这本书没有可读的章节内容')

  // 3. 封面
  let cover: Blob | undefined
  const coverItem =
    Array.from(manifest.values()).find((m) => m.properties.split(/\s+/).includes('cover-image')) ??
    (() => {
      const meta = localAll(opf, 'meta').find((m) => m.getAttribute('name') === 'cover')
      return meta?.getAttribute('content') ? manifest.get(meta.getAttribute('content')!) : undefined
    })()
  if (coverItem) cover = await readBlob(zip, coverItem.href, coverItem.mediaType || 'image/jpeg')

  // 4. 目录（EPUB3 nav 优先，回退 EPUB2 ncx）
  const toc: TocEntry[] = []
  const addToc = (titleText: string, href: string) => {
    const idx = spineIndexByHref.get(href)
    if (idx !== undefined && titleText) toc.push({ title: titleText, spineIndex: idx })
  }

  const navItem = Array.from(manifest.values()).find((m) => m.properties.split(/\s+/).includes('nav'))
  let ncxParsed = false
  if (navItem) {
    const navFile = zip.file(navItem.href)
    if (navFile) {
      const navDoc = new DOMParser().parseFromString(await navFile.async('text'), 'text/html')
      const navDir = dirOf(navItem.href)
      for (const a of Array.from(navDoc.querySelectorAll('a[href]'))) {
        addToc(a.textContent?.trim() ?? '', joinPath(navDir, a.getAttribute('href')!))
      }
      ncxParsed = toc.length > 0
    }
  }
  if (!ncxParsed) {
    const ncxItem =
      Array.from(manifest.values()).find((m) => m.mediaType === 'application/x-dtbncx+xml') ??
      (() => {
        const tocId = firstLocal(opf, 'spine')?.getAttribute('toc')
        return tocId ? manifest.get(tocId) : undefined
      })()
    if (ncxItem) {
      const ncxFile = zip.file(ncxItem.href)
      if (ncxFile) {
        const ncx = new DOMParser().parseFromString(await ncxFile.async('text'), 'application/xml')
        const ncxDir = dirOf(ncxItem.href)
        for (const np of localAll(ncx, 'navPoint')) {
          const label = firstLocal(np, 'text')?.textContent?.trim() ?? ''
          const src = firstLocal(np, 'content')?.getAttribute('src') ?? ''
          if (src) addToc(label, joinPath(ncxDir, src))
        }
      }
    }
  }

  // 目录标题回填到 spine
  for (const entry of toc) {
    if (spine[entry.spineIndex] && !spine[entry.spineIndex].title) {
      spine[entry.spineIndex].title = entry.title
    }
  }

  return { zip, title, author, cover, spine, toc, opfDir }
}

/** 读取某一章的原始 XHTML 文本 */
export async function loadChapterText(book: EpubBook, spineIndex: number): Promise<string> {
  const item = book.spine[spineIndex]
  const file = book.zip.file(item.href)
  if (!file) throw new Error(`章节文件缺失：${item.href}`)
  return file.async('text')
}

/** 解析章节内的图片相对路径，返回 zip 内的 Blob（找不到返回 null） */
export async function resolveImage(
  book: EpubBook,
  chapterDir: string,
  src: string,
): Promise<Blob | null> {
  if (!src || src.startsWith('data:')) return null
  const path = joinPath(chapterDir, src)
  const file = book.zip.file(path)
  if (!file) return null
  const data = await file.async('arraybuffer')
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const type =
    ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
  return new Blob([data], { type })
}
