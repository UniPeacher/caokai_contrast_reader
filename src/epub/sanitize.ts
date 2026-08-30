/**
 * 章节渲染前的清理：
 * - 删除脚本/样式/媒体等无关节点
 * - 剥离所有 style/class/id 属性 —— 这是本阅读器的命门：
 *   EPUB 自带的 font-family 若不剥掉，会覆盖「系统草书字体」，点按对照就失去意义
 * - 把含文本的块级元素标记为「段落单元」（data-pi），作为点按交互的最小单位
 * - 图片改写为 blob URL（由调用方提供解析函数，并在离开章节时 revoke）
 */

const SKIP_TAGS = [
  'script', 'style', 'link', 'meta', 'title', 'head', 'base', 'noscript',
  'iframe', 'frame', 'object', 'embed', 'video', 'audio', 'source', 'track',
  'svg', 'canvas', 'map', 'area', 'form', 'input', 'button', 'select',
  'textarea', 'option', 'aside', 'nav',
]

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li', 'dd', 'dt',
  'pre', 'figcaption', 'td', 'th', 'caption', 'div', 'section', 'article',
  'header', 'footer', 'main', 'figure', 'ul', 'ol', 'table', 'tbody',
  'thead', 'tfoot', 'tr', 'dl', 'hr',
])

const KEEP_ATTRS = new Set(['src', 'alt', 'colspan', 'rowspan'])

export interface RenderedChapter {
  html: string
  /** 段落单元数量（= 最大 data-pi + 1） */
  paraCount: number
  /** 本章创建的 blob URL，离开章节时调用方负责 revoke */
  blobUrls: string[]
}

export type ImageResolver = (src: string) => Promise<Blob | null>

function isBlock(el: Element): boolean {
  return BLOCK_TAGS.has(el.tagName.toLowerCase())
}

/** 把 body 顶层连续的行内/文本节点包进 <p>，避免游离文本无法成为段落单元 */
function wrapStrayContent(doc: Document, body: HTMLElement): void {
  let buffer: Node[] = []
  const flush = () => {
    if (!buffer.length) return
    const hasContent = buffer.some(
      (n) => (n.nodeType === 3 && (n.textContent ?? '').trim()) || n.nodeType === 1,
    )
    if (hasContent) {
      const p = doc.createElement('p')
      buffer[0].parentNode?.insertBefore(p, buffer[0])
      for (const n of buffer) p.appendChild(n)
    }
    buffer = []
  }
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType === 1 && isBlock(node as Element)) flush()
    else buffer.push(node)
  }
  flush()
}

export async function renderChapter(
  xhtml: string,
  resolveImage: ImageResolver,
): Promise<RenderedChapter> {
  const doc = new DOMParser().parseFromString(xhtml, 'text/html')
  const body = doc.body

  // 1. 删除无关节点
  const skipSelector = SKIP_TAGS.map((t) => t).join(',')
  body.querySelectorAll(skipSelector).forEach((el) => el.remove())

  // 2. 游离行内内容包进段落
  wrapStrayContent(doc, body)

  // 3. 剥离属性（保留 src/alt/跨行列）
  body.querySelectorAll('*').forEach((el) => {
    if (el.tagName === 'A') el.removeAttribute('href')
    for (const attr of Array.from(el.attributes)) {
      if (!KEEP_ATTRS.has(attr.name)) el.removeAttribute(attr.name)
    }
  })

  // 4. 标记段落单元：不含块级后代的块级元素，且有实际文本
  let paraIndex = 0
  for (const el of Array.from(body.querySelectorAll('*'))) {
    if (!isBlock(el)) continue
    const hasBlockChild = Array.from(el.children).some(isBlock)
    // children 里没有块级子元素即可（querySelectorAll 全量扫描开销大，children 一层足够：
    // 若嵌套的块在更深层，其父链上必有直接块级子元素）
    if (hasBlockChild) continue
    const text = el.textContent?.trim() ?? ''
    if (text) {
      el.setAttribute('data-pi', String(paraIndex))
      el.classList.add('para')
      paraIndex++
    }
  }

  // 5. 图片 -> blob URL
  const blobUrls: string[] = []
  const imgs = Array.from(body.querySelectorAll('img'))
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src')
      if (!src || src.startsWith('data:')) return
      try {
        const blob = await resolveImage(src)
        if (blob) {
          const url = URL.createObjectURL(blob)
          img.setAttribute('src', url)
          img.removeAttribute('srcset')
          blobUrls.push(url)
        } else {
          img.remove()
        }
      } catch {
        img.remove()
      }
    }),
  )

  return { html: body.innerHTML, paraCount: paraIndex, blobUrls }
}
