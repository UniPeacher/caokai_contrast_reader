import { useCallback, useEffect, useState } from 'react'
import type { CollectionEntry, Settings } from './types'
import { getSettings, saveSettings } from './db'
import { preloadBooks } from './preload'
import { ShelfView } from './views/ShelfView'
import { CollectionView } from './views/CollectionView'
import { SettingsView } from './views/SettingsView'
import { ReaderView } from './reader/ReaderView'

type Tab = 'shelf' | 'collection' | 'settings'

/** 已注册过的字体族，避免重复加载 */
const registeredFonts = new Set<string>()

async function ensureFont(family: string, url: string): Promise<void> {
  if (registeredFonts.has(family)) return
  const face = new FontFace(family, `url(${url})`)
  await face.load()
  document.fonts.add(face)
  registeredFonts.add(family)
}

type View =
  | { name: Tab }
  | { name: 'reader'; bookId: string; jump: null; from: Tab }
  | { name: 'reader-jump'; bookId: string; entry: CollectionEntry; from: Tab }

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [view, setView] = useState<View>({ name: 'shelf' })
  const [readerKey, setReaderKey] = useState(0)

  useEffect(() => {
    void getSettings().then(setSettings)
    // 预装默认书籍（后台进行，完成后书架自动刷新）
    void preloadBooks()
  }, [])

  // 主题
  useEffect(() => {
    if (!settings) return
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      root.dataset.theme =
        settings.theme === 'auto' ? (mq.matches ? 'dark' : 'light') : settings.theme
    }
    apply()
    if (settings.theme !== 'auto') return
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings?.theme])

  // 草书字体：内置（简入繁出/原版）按需注册，或用户上传的自定义字体
  useEffect(() => {
    const src = settings?.cursiveSource
    if (src === 'builtin-jf') {
      ensureFont('CaoShuJF', `${import.meta.env.BASE_URL}fonts/caoshu-jf.ttf`).catch((e) =>
        console.error('内置草书字体加载失败', e),
      )
    } else if (src === 'builtin-yb') {
      ensureFont('CaoShuYB', `${import.meta.env.BASE_URL}fonts/caoshu-yb.ttf`).catch((e) =>
        console.error('内置草书字体加载失败', e),
      )
    } else if (src === 'custom' && settings?.customFontBlob) {
      void (async () => {
        try {
          const buf = await settings.customFontBlob!.arrayBuffer()
          const face = new FontFace('CustomCursive', buf)
          await face.load()
          document.fonts.add(face)
        } catch (e) {
          console.error('自定义字体加载失败', e)
        }
      })()
    }
  }, [settings?.cursiveSource, settings?.customFontBlob])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      void saveSettings(next)
      return next
    })
  }, [])

  const openReader = useCallback((bookId: string, from: Tab) => {
    setReaderKey((k) => k + 1)
    setView({ name: 'reader', bookId, jump: null, from })
  }, [])

  const jumpToEntry = useCallback((entry: CollectionEntry, from: Tab) => {
    setReaderKey((k) => k + 1)
    setView({ name: 'reader-jump', bookId: entry.bookId, entry, from })
  }, [])

  if (!settings) {
    return <div className="boot">加载中…</div>
  }

  if (view.name === 'reader' || view.name === 'reader-jump') {
    const from = view.from
    const jump =
      view.name === 'reader-jump'
        ? {
            spineIndex: view.entry.spineIndex,
            paraIndex: view.entry.paraIndex,
            charOffset: view.entry.charOffset,
            highlight: true,
          }
        : null
    return (
      <div className={`app-root cursive-${settings.cursiveSource}`}>
        <ReaderView
          key={readerKey}
          bookId={view.bookId}
          jump={jump}
          settings={settings}
          onSettingsChange={updateSettings}
          onBack={() => setView({ name: from })}
        />
      </div>
    )
  }

  const tab = view.name
  return (
    <div className={`app-root cursive-${settings.cursiveSource}`}>
      <div className="app-shell">
        <main className="app-main">
          {tab === 'shelf' && <ShelfView onOpen={(bookId) => openReader(bookId, 'shelf')} />}
          {tab === 'collection' && (
            <CollectionView onJump={(entry) => jumpToEntry(entry, 'collection')} />
          )}
          {tab === 'settings' && <SettingsView settings={settings} onChange={updateSettings} />}
        </main>
        <nav className="tabbar">
          <button className={tab === 'shelf' ? 'tab-btn active' : 'tab-btn'} onClick={() => setView({ name: 'shelf' })}>
            书架
          </button>
          <button
            className={tab === 'collection' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setView({ name: 'collection' })}
          >
            生字本
          </button>
          <button className={tab === 'settings' ? 'tab-btn active' : 'tab-btn'} onClick={() => setView({ name: 'settings' })}>
            设置
          </button>
        </nav>
      </div>
    </div>
  )
}
