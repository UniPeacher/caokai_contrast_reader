import { useCallback, useEffect, useRef, useState } from 'react'
import type { BookRecord, JumpTarget, Settings } from '../types'
import { getBook, hasCollection, addCollection, putBook } from '../db'
import { openEpub, loadChapterText, resolveImage, dirOf, type EpubBook } from '../epub/parse'
import { renderChapter } from '../epub/sanitize'
import { attachGestures } from './gestures'
import { charAtPoint, highlightCharInPara } from './charutil'
import { CharZoomOverlay } from '../components/CharZoomOverlay'

interface ReaderViewProps {
  bookId: string
  /** 非 null 时跳到指定位置（生字本回跳）；null 时恢复上次阅读位置 */
  jump: JumpTarget | null
  settings: Settings
  onSettingsChange: (patch: Partial<Settings>) => void
  onBack: () => void
}

const MIN_FONT = 15
const MAX_FONT = 30

export function ReaderView({ bookId, jump, settings, onSettingsChange, onBack }: ReaderViewProps) {
  const [record, setRecord] = useState<BookRecord | null>(null)
  const [book, setBook] = useState<EpubBook | null>(null)
  const [chapter, setChapter] = useState<{ html: string; paraCount: number } | null>(null)
  const [spineIndex, setSpineIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(false)
  const [overlay, setOverlay] = useState<{ char: string; paraIndex: number; cpOffset: number } | null>(null)
  const [overlayCollected, setOverlayCollected] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<EpubBook | null>(null)
  const recordRef = useRef<BookRecord | null>(null)
  const spineRef = useRef(0)
  const modeRef = useRef(settings.compareMode)
  const restoreRef = useRef<{ ratio?: number; jump?: JumpTarget } | null>(null)
  const compareRef = useRef<{ para: HTMLElement; node: HTMLElement } | null>(null)
  const highlightRef = useRef<HTMLElement | null>(null)
  const blobUrlsRef = useRef<string[]>([])

  useEffect(() => {
    modeRef.current = settings.compareMode
  }, [settings.compareMode])

  // ---------- 记录读写 ----------

  const patchRecord = useCallback((patch: Partial<BookRecord>) => {
    const rec = recordRef.current
    if (!rec) return
    const next = { ...rec, ...patch }
    recordRef.current = next
    setRecord(next)
    void putBook(next)
  }, [])

  const saveProgressNow = useCallback(() => {
    const doc = document.documentElement
    const max = doc.scrollHeight - window.innerHeight
    patchRecord({
      lastSpine: spineRef.current,
      lastScrollRatio: max > 0 ? doc.scrollTop / max : 0,
    })
  }, [patchRecord])

  // ---------- 章节内装饰（点按痕迹 / 对照副本 / 高亮字） ----------

  const removeCompare = useCallback(() => {
    const cur = compareRef.current
    if (cur) {
      cur.node.remove()
      compareRef.current = null
    }
  }, [])

  const removeHighlight = useCallback(() => {
    const span = highlightRef.current
    if (!span) return
    const parent = span.parentNode
    while (span.firstChild) parent?.insertBefore(span.firstChild, span)
    span.remove()
    parent?.normalize()
    highlightRef.current = null
  }, [])

  const clearAllKai = useCallback(() => {
    contentRef.current?.querySelectorAll('.kai').forEach((el) => el.classList.remove('kai'))
    removeCompare()
  }, [removeCompare])

  const toggleCompare = useCallback(
    (para: HTMLElement) => {
      const cur = compareRef.current
      if (cur && cur.para === para) {
        removeCompare()
        return
      }
      removeCompare()
      const node = document.createElement('div')
      node.className = 'compare-copy'
      node.textContent = para.textContent
      para.insertAdjacentElement('afterend', node)
      compareRef.current = { para, node }
    },
    [removeCompare],
  )

  // ---------- 章节加载 ----------

  const loadChapter = useCallback(
    async (b: EpubBook, index: number) => {
      setLoading(true)
      removeCompare()
      removeHighlight()
      for (const url of blobUrlsRef.current) URL.revokeObjectURL(url)
      blobUrlsRef.current = []
      try {
        const xhtml = await loadChapterText(b, index)
        const dir = dirOf(b.spine[index].href)
        const rendered = await renderChapter(xhtml, (src) => resolveImage(b, dir, src))
        blobUrlsRef.current = rendered.blobUrls
        spineRef.current = index
        setSpineIndex(index)
        setChapter({ html: rendered.html, paraCount: rendered.paraCount })
        patchRecord({ lastSpine: index })
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [patchRecord, removeCompare, removeHighlight],
  )

  const goTo = useCallback(
    (index: number) => {
      const b = bookRef.current
      if (!b) return
      const clamped = Math.min(Math.max(index, 0), b.spine.length - 1)
      restoreRef.current = { ratio: 0 }
      void loadChapter(b, clamped)
    },
    [loadChapter],
  )

  // ---------- 挂载：开书 ----------

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rec = await getBook(bookId)
        if (!rec) {
          setError('找不到这本书，可能已被删除。')
          setLoading(false)
          return
        }
        recordRef.current = rec
        setRecord(rec)
        const buf = await rec.epub.arrayBuffer()
        const b = await openEpub(buf)
        if (cancelled) return
        bookRef.current = b
        setBook(b)
        const requested = jump?.spineIndex ?? rec.lastSpine ?? 0
        const clamped = Math.min(Math.max(requested, 0), b.spine.length - 1)
        restoreRef.current = jump
          ? { jump }
          : rec.lastSpine === clamped
            ? { ratio: rec.lastScrollRatio ?? 0 }
            : null
        await loadChapter(b, clamped)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
      saveProgressNow()
      for (const url of blobUrlsRef.current) URL.revokeObjectURL(url)
      blobUrlsRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])

  // ---------- 章节渲染完成后：恢复位置 / 跳转高亮 ----------

  useEffect(() => {
    if (!chapter) return
    const raf = requestAnimationFrame(() => {
      const container = contentRef.current
      if (!container) return
      const r = restoreRef.current
      restoreRef.current = null
      if (r?.jump?.paraIndex != null) {
        const para = container.querySelector<HTMLElement>(`[data-pi="${r.jump.paraIndex}"]`)
        if (para) {
          para.scrollIntoView({ block: 'center' })
          if (r.jump.highlight && r.jump.charOffset != null) {
            removeHighlight()
            highlightRef.current = highlightCharInPara(para, r.jump.charOffset)
            window.setTimeout(() => removeHighlight(), 2600)
          }
        }
      } else if (r && typeof r.ratio === 'number') {
        const doc = document.documentElement
        window.scrollTo(0, r.ratio * (doc.scrollHeight - window.innerHeight))
      } else {
        window.scrollTo(0, 0)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [chapter, removeHighlight])

  // ---------- 手势（挂一次，内部只走 ref / setState） ----------

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    return attachGestures(el, {
      onTap(target) {
        const copy = target.closest('.compare-copy')
        if (copy) {
          removeCompare()
          return
        }
        const para = target.closest<HTMLElement>('[data-pi]')
        if (!para) return
        if (modeRef.current === 'toggle') {
          para.classList.toggle('kai')
        } else {
          toggleCompare(para)
        }
      },
      onLongPress(x, y) {
        const hit = charAtPoint(x, y)
        if (!hit) return
        const paraIndex = Number(hit.para.dataset.pi)
        if (!Number.isFinite(paraIndex)) return
        setOverlay({ char: hit.char, paraIndex, cpOffset: hit.cpOffset })
      },
    })
  }, [removeCompare, toggleCompare])

  // 对照模式切换时清掉旧痕迹
  useEffect(() => {
    contentRef.current?.querySelectorAll('.kai').forEach((el) => el.classList.remove('kai'))
    removeCompare()
  }, [settings.compareMode, removeCompare])

  // ---------- 阅读进度：滚动防抖保存 + 切后台兜底 ----------

  useEffect(() => {
    let timer: number | null = null
    const onScroll = () => {
      if (timer !== null) return
      timer = window.setTimeout(() => {
        timer = null
        saveProgressNow()
      }, 800)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveProgressNow()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (timer !== null) clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [saveProgressNow])

  // ---------- 生字收藏 ----------

  useEffect(() => {
    if (!overlay) return
    let alive = true
    void hasCollection(overlay.char, bookId).then((v) => {
      if (alive) setOverlayCollected(v)
    })
    return () => {
      alive = false
    }
  }, [overlay, bookId])

  const collectChar = useCallback(async () => {
    if (!overlay) return
    await addCollection({
      char: overlay.char,
      bookId,
      bookTitle: recordRef.current?.title ?? '',
      spineIndex: spineRef.current,
      paraIndex: overlay.paraIndex,
      charOffset: overlay.cpOffset,
      createdAt: Date.now(),
    })
    setOverlayCollected(true)
  }, [overlay, bookId])

  // ---------- 工具栏动作 ----------

  const changeFont = (delta: number) => {
    const next = Math.min(Math.max(settings.fontSize + delta, MIN_FONT), MAX_FONT)
    if (next !== settings.fontSize) onSettingsChange({ fontSize: next })
  }

  const chapterTitle = book?.spine[spineIndex]?.title ?? `第 ${spineIndex + 1} 节`
  const spineCount = book?.spine.length ?? 0
  const tocEntries =
    book && book.toc.length > 0
      ? book.toc
      : (book?.spine.map((s, i) => ({ title: s.title ?? `第 ${i + 1} 节`, spineIndex: i })) ?? [])

  if (error && !chapter) {
    return (
      <div className="reader-error">
        <p>出错了：{error}</p>
        <button className="btn-primary" onClick={onBack}>
          返回
        </button>
      </div>
    )
  }

  return (
    <div className="reader">
      <header className="reader-top">
        <button className="bar-btn" onClick={onBack}>
          ‹ 返回
        </button>
        <div className="reader-titles">
          <div className="reader-book">{record?.title ?? '…'}</div>
          <div className="reader-chapter">{chapterTitle}</div>
        </div>
        <button className="bar-btn" onClick={clearAllKai}>
          还原
        </button>
        <button
          className="bar-btn"
          onClick={() => onSettingsChange({ compareMode: settings.compareMode === 'toggle' ? 'compare' : 'toggle' })}
        >
          {settings.compareMode === 'toggle' ? '→对照' : '→还原'}
        </button>
      </header>

      <div
        ref={contentRef}
        className="reader-content"
        style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
        dangerouslySetInnerHTML={{ __html: chapter?.html ?? '' }}
      />

      {loading && <div className="reader-loading">加载中…</div>}

      <footer className="reader-bottom">
        <button disabled={spineIndex <= 0} onClick={() => goTo(spineIndex - 1)}>
          上一章
        </button>
        <button onClick={() => setTocOpen(true)}>目录</button>
        <button onClick={() => changeFont(-1)}>A－</button>
        <button onClick={() => changeFont(1)}>A＋</button>
        <span className="reader-progress">
          {spineCount ? `${spineIndex + 1}/${spineCount}` : '–'}
        </span>
        <button disabled={spineCount === 0 || spineIndex >= spineCount - 1} onClick={() => goTo(spineIndex + 1)}>
          下一章
        </button>
      </footer>

      {tocOpen && (
        <div className="drawer-mask" onClick={() => setTocOpen(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <h3>目录</h3>
            <ul>
              {tocEntries.map((entry, i) => (
                <li key={`${entry.spineIndex}-${i}`}>
                  <button
                    className={entry.spineIndex === spineIndex ? 'toc-item current' : 'toc-item'}
                    onClick={() => {
                      setTocOpen(false)
                      goTo(entry.spineIndex)
                    }}
                  >
                    {entry.title}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}

      {overlay && (
        <CharZoomOverlay
          char={overlay.char}
          collected={overlayCollected}
          onCollect={() => void collectChar()}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  )
}
