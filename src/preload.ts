import { getPreloadedDone, setPreloadedDone } from './db'
import { importEpubBlob } from './importBook'

/**
 * 预装默认书籍：public/books/ 下的 EPUB 会在首次启动时自动导入书架。
 * 文件不入 git 仓库（版权原因，见 .gitignore），部署时手动放到服务器同路径即可；
 * 文件缺失时静默跳过，下次启动再试。
 */
const PRELOAD_BOOKS = [
  'books/linhanda-zhongguo-gushi.epub',
  'books/xuegang-lishi-gushi.epub',
  'books/qianrushi-c-yuyan.epub',
]

export async function preloadBooks(): Promise<void> {
  const done = new Set(await getPreloadedDone())
  const newlyDone: string[] = []
  for (const file of PRELOAD_BOOKS) {
    if (done.has(file)) continue
    try {
      const res = await fetch(import.meta.env.BASE_URL + file)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      await importEpubBlob(blob, `pre:${file}`)
      newlyDone.push(file)
    } catch (e) {
      console.warn('[预装] 跳过（文件缺失或损坏）：', file, e)
    }
  }
  if (newlyDone.length) {
    await setPreloadedDone([...done, ...newlyDone])
  }
}
