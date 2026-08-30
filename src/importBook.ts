import type { BookRecord } from './types'
import { openEpub } from './epub/parse'
import { putBook } from './db'

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `bk-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * 导入一本 EPUB（解析元数据并存库），返回书籍记录。
 * ShelfView 的手动导入和首启预装共用这条路径。
 */
export async function importEpubBlob(blob: Blob, fixedId?: string): Promise<BookRecord> {
  const buf = await blob.arrayBuffer()
  const parsed = await openEpub(buf)
  const record: BookRecord = {
    id: fixedId ?? makeId(),
    title: parsed.title,
    author: parsed.author,
    cover: parsed.cover,
    epub: new Blob([buf], { type: 'application/epub+zip' }),
    spineCount: parsed.spine.length,
    addedAt: Date.now(),
  }
  await putBook(record)
  window.dispatchEvent(new CustomEvent('books-changed', { detail: { id: record.id } }))
  return record
}
