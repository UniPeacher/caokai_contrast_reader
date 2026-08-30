import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { BookRecord, CollectionEntry, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  fontSize: 20,
  lineHeight: 1.9,
  theme: 'auto',
  compareMode: 'toggle',
  cursiveSource: 'builtin-jf',
}

interface ContrastDB extends DBSchema {
  books: { key: string; value: BookRecord }
  // 'app' 键存 Settings，'preloaded' 键存 string[]（预装书籍导入标记）
  settings: { key: string; value: Settings | string[] }
  collection: {
    key: [string, string]
    value: CollectionEntry
    indexes: { 'by-created': number }
  }
}

let dbPromise: Promise<IDBPDatabase<ContrastDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ContrastDB>('contrast-reader', 1, {
      upgrade(db) {
        db.createObjectStore('books', { keyPath: 'id' })
        db.createObjectStore('settings')
        const col = db.createObjectStore('collection', { keyPath: ['char', 'bookId'] })
        col.createIndex('by-created', 'createdAt')
      },
    })
  }
  return dbPromise
}

// ---------- 书籍 ----------

export async function listBooks(): Promise<BookRecord[]> {
  const db = await getDb()
  const all = await db.getAll('books')
  return all.sort((a, b) => b.addedAt - a.addedAt)
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  const db = await getDb()
  return db.get('books', id)
}

export async function putBook(book: BookRecord): Promise<void> {
  const db = await getDb()
  await db.put('books', book)
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDb()
  // 同时清掉该书收藏的生字
  const tx = db.transaction(['books', 'collection'], 'readwrite')
  await Promise.all([
    tx.objectStore('books').delete(id),
    clearCollectionByBookInTx(tx, id),
    tx.done,
  ])
}

// ---------- 设置 ----------

export async function getSettings(): Promise<Settings> {
  try {
    const db = await getDb()
    const saved = await db.get('settings', 'app')
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDb()
  await db.put('settings', settings, 'app')
}

// ---------- 预装书籍标记（独立键，避免覆盖用户设置） ----------

export async function getPreloadedDone(): Promise<string[]> {
  try {
    const db = await getDb()
    return ((await db.get('settings', 'preloaded')) as string[] | undefined) ?? []
  } catch {
    return []
  }
}

export async function setPreloadedDone(files: string[]): Promise<void> {
  const db = await getDb()
  await db.put('settings', files, 'preloaded')
}

// ---------- 生字本 ----------

export async function listCollection(): Promise<CollectionEntry[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('collection', 'by-created')
  return all.reverse()
}

export async function hasCollection(char: string, bookId: string): Promise<boolean> {
  const db = await getDb()
  const hit = await db.getKey('collection', [char, bookId])
  return hit !== undefined
}

export async function addCollection(entry: CollectionEntry): Promise<void> {
  const db = await getDb()
  await db.put('collection', entry)
}

export async function removeCollection(char: string, bookId: string): Promise<void> {
  const db = await getDb()
  await db.delete('collection', [char, bookId])
}

async function clearCollectionByBookInTx(
  tx: { objectStore: (name: 'collection') => { delete: (key: [string, string]) => Promise<unknown>; getAll: () => Promise<CollectionEntry[]> } },
  bookId: string,
): Promise<void> {
  const store = tx.objectStore('collection')
  const all = await store.getAll()
  await Promise.all(all.filter((e) => e.bookId === bookId).map((e) => store.delete([e.char, e.bookId])))
}
