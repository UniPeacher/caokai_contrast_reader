import { useCallback, useEffect, useRef, useState } from 'react'
import type { BookRecord } from '../types'
import { listBooks, deleteBook } from '../db'
import { importEpubBlob } from '../importBook'

interface ShelfViewProps {
  onOpen: (bookId: string) => void
}

export function ShelfView({ onOpen }: ShelfViewProps) {
  const [books, setBooks] = useState<BookRecord[]>([])
  const [importing, setImporting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(() => {
    void listBooks().then(setBooks)
  }, [])

  useEffect(() => {
    reload()
    // 预装书籍在后台导入完成时刷新书架
    const onImported = () => reload()
    window.addEventListener('books-changed', onImported)
    return () => window.removeEventListener('books-changed', onImported)
  }, [reload])

  // 封面 blob URL 的生命周期管理
  const [coverUrls, setCoverUrls] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    const map = new Map<string, string>()
    for (const b of books) {
      if (b.cover) map.set(b.id, URL.createObjectURL(b.cover))
    }
    setCoverUrls(map)
    return () => {
      for (const url of map.values()) URL.revokeObjectURL(url)
    }
  }, [books])

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return
    setError(null)
    let ok = 0
    let failed = 0
    for (const file of Array.from(files)) {
      setImporting(file.name)
      try {
        await importEpubBlob(file)
        ok++
      } catch (e) {
        console.error('导入失败', file.name, e)
        failed++
      }
    }
    setImporting(null)
    if (failed) setError(`${ok} 本导入成功，${failed} 本失败（仅支持未加密 EPUB）`)
    if (fileRef.current) fileRef.current.value = ''
    reload()
  }

  const handleDelete = async (book: BookRecord) => {
    if (!window.confirm(`删除《${book.title}》？\n\n阅读进度和这本书收藏的生字会一并删除，书籍文件需要重新导入。`)) return
    await deleteBook(book.id)
    reload()
  }

  return (
    <div className="page">
      <h2 className="page-title">书架</h2>
      <p className="page-hint">导入 EPUB 后，正文会用手机的草书字体显示；点按段落切换楷书对照，长按单字可放大收藏。</p>

      <input
        ref={fileRef}
        type="file"
        accept=".epub,application/epub+zip"
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <button className="btn-primary import-btn" onClick={() => fileRef.current?.click()} disabled={!!importing}>
        {importing ? `正在导入：${importing}` : '＋ 导入 EPUB'}
      </button>

      {error && <div className="form-error">{error}</div>}

      {books.length === 0 && !importing ? (
        <div className="empty-state">书架还是空的，先导入一本 EPUB 试试吧。</div>
      ) : (
        <ul className="book-list">
          {books.map((b) => (
            <li key={b.id} className="book-card">
              <button className="book-main" onClick={() => onOpen(b.id)}>
                {coverUrls.get(b.id) ? (
                  <img className="book-cover" src={coverUrls.get(b.id)} alt="" />
                ) : (
                  <div className="book-cover book-cover-ph">{b.title.slice(0, 1)}</div>
                )}
                <div className="book-info">
                  <div className="book-title">{b.title}</div>
                  <div className="book-meta">
                    {b.author || '佚名'} · {b.spineCount} 章
                    {b.lastSpine != null ? ` · 读到第 ${b.lastSpine + 1} 章` : ' · 未开始'}
                  </div>
                </div>
              </button>
              <button
                className="book-delete"
                aria-label={`删除 ${b.title}`}
                onClick={() => void handleDelete(b)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
