/**
 * 单字定位与高亮工具。
 * 段落内的偏移一律用 Unicode 码位（code point）计数，避免代理对（生僻字）错位。
 */

export interface CharHit {
  char: string
  /** 字符所在的段落单元 */
  para: HTMLElement
  /** 段落内码位偏移 */
  cpOffset: number
}

function caretRangeFromPoint(x: number, y: number): Range | null {
  const d = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  if (typeof d.caretRangeFromPoint === 'function') {
    return d.caretRangeFromPoint(x, y)
  }
  if (typeof d.caretPositionFromPoint === 'function') {
    const pos = d.caretPositionFromPoint(x, y)
    if (!pos) return null
    const range = document.createRange()
    range.setStart(pos.offsetNode, pos.offset)
    range.collapse(true)
    return range
  }
  return null
}

const cpLength = (s: string) => Array.from(s).length

function isWhitespace(cp: number): boolean {
  return /\s/u.test(String.fromCodePoint(cp))
}

/** 取屏幕坐标下的字符及其在段落内的码位偏移 */
export function charAtPoint(x: number, y: number): CharHit | null {
  const range = caretRangeFromPoint(x, y)
  if (!range) return null
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return null
  const textNode = node as Text
  const parent = textNode.parentElement
  const para = parent?.closest<HTMLElement>('[data-pi]')
  if (!para) return null

  const text = textNode.data
  let unitOffset = Math.min(range.startOffset, Math.max(text.length - 1, 0))
  let cp = text.codePointAt(unitOffset)
  if (cp === undefined && unitOffset > 0) {
    unitOffset -= 1
    cp = text.codePointAt(unitOffset)
  }
  if (cp === undefined) return null

  // 落在空白上时向前后各找一个非空白字符
  if (isWhitespace(cp)) {
    const candidates = [unitOffset - 1, unitOffset + 1]
    for (const cand of candidates) {
      const c = text.codePointAt(cand)
      if (c !== undefined && !isWhitespace(c)) {
        unitOffset = cand
        cp = c
        break
      }
    }
    if (isWhitespace(cp)) return null
  }

  const paraText = para.textContent ?? ''
  const cpOffset = cpOffsetBefore(para, textNode, unitOffset)
  return { char: String.fromCodePoint(cp), para, cpOffset: Math.min(cpOffset, Math.max(cpLength(paraText) - 1, 0)) }
}

/** 目标文本节点内 unitOffset 之前，段落里累积了多少码位 */
function cpOffsetBefore(para: HTMLElement, target: Text, unitOffset: number): number {
  let count = 0
  const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text
    if (t === target) return count + cpLength(t.data.slice(0, unitOffset))
    count += cpLength(t.data)
  }
  return count
}

/**
 * 在段落里高亮第 cpOffset 个码位对应的字符：把它包进 span.char-hl。
 * 返回该 span（调用方负责之后清理）。
 */
export function highlightCharInPara(para: HTMLElement, cpOffset: number): HTMLElement | null {
  let seen = 0
  const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const textNode = n as Text
    const len = cpLength(textNode.data)
    if (seen + len > cpOffset) {
      const localCp = cpOffset - seen
      let unitStart = 0
      let index = 0
      for (const ch of textNode.data) {
        if (index === localCp) break
        unitStart += ch.length
        index++
      }
      const chLen = Array.from(textNode.data)[localCp]?.length ?? 1
      const tail = unitStart + chLen < textNode.data.length ? textNode.splitText(unitStart + chLen) : null
      const charNode = unitStart > 0 ? textNode.splitText(unitStart) : textNode
      const span = document.createElement('span')
      span.className = 'char-hl'
      charNode.parentNode?.insertBefore(span, charNode)
      span.appendChild(charNode)
      void tail
      return span
    }
    seen += len
  }
  return null
}
