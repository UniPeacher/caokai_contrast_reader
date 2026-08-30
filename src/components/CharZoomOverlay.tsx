import { useEffect } from 'react'
import { SIMPLIFIED_FONTS, ensureBuiltinFonts } from '../fonts'

interface CharZoomOverlayProps {
  char: string
  collected: boolean
  onCollect: () => void
  onClose: () => void
}

/** 长按单字弹出的大字号草楷对照视图，同时用简繁组全部字体渲染同一个字，方便对比字形差异 */
export function CharZoomOverlay({ char, collected, onCollect, onClose }: CharZoomOverlayProps) {
  // 打开时批量注册简繁组字体（幂等，已注册的跳过）
  useEffect(() => {
    void ensureBuiltinFonts(SIMPLIFIED_FONTS)
  }, [])

  return (
    <div className="overlay-mask" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="char-pair">
          <div className="char-box">
            <span className="char-big">{char}</span>
            <span className="char-label">草书（当前）</span>
          </div>
          <div className="char-box char-kai">
            <span className="char-big">{char}</span>
            <span className="char-label">楷书</span>
          </div>
        </div>

        <div className="font-compare">
          <div className="font-compare-title">简繁字体对比</div>
          <div className="font-compare-grid">
            {SIMPLIFIED_FONTS.map((f) => (
              <div className="font-cell" key={f.key}>
                <span
                  className="char-big"
                  style={{ fontFamily: `'${f.family}', system-ui, sans-serif` }}
                >
                  {char}
                </span>
                <span className="char-label">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overlay-actions">
          <button className="btn-primary" onClick={onCollect} disabled={collected}>
            {collected ? '已在生字本' : '收藏到生字本'}
          </button>
          <button className="btn-plain" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
