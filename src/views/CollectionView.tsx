import { useCallback, useEffect, useState } from 'react'
import type { CollectionEntry } from '../types'
import { listCollection, removeCollection } from '../db'

interface CollectionViewProps {
  /** 点击「回原文」 */
  onJump: (entry: CollectionEntry) => void
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CollectionView({ onJump }: CollectionViewProps) {
  const [entries, setEntries] = useState<CollectionEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(() => {
    void listCollection().then((list) => {
      setEntries(list)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const handleDelete = async (entry: CollectionEntry) => {
    await removeCollection(entry.char, entry.bookId)
    reload()
  }

  return (
    <div className="page">
      <h2 className="page-title">生字本</h2>
      <p className="page-hint">长按阅读页里的字就能收藏到这里，集中对照复习。</p>

      {loaded && entries.length === 0 ? (
        <div className="empty-state">还没有收藏任何字。阅读时长按不认识的字，选「收藏到生字本」。</div>
      ) : (
        <ul className="char-list">
          {entries.map((entry) => (
            <li key={`${entry.char}-${entry.bookId}`} className="char-card">
              <div className="char-row">
                <div className="char-cell">
                  <span className="char-big">{entry.char}</span>
                  <span className="char-label">草书</span>
                </div>
                <div className="char-cell char-kai">
                  <span className="char-big">{entry.char}</span>
                  <span className="char-label">楷书</span>
                </div>
                <div className="char-info">
                  <div className="char-book">《{entry.bookTitle}》</div>
                  <div className="char-date">{formatTime(entry.createdAt)}</div>
                </div>
              </div>
              <div className="char-actions">
                <button className="btn-plain" onClick={() => onJump(entry)}>
                  回原文
                </button>
                <button className="btn-plain danger" onClick={() => void handleDelete(entry)}>
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
