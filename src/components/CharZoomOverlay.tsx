interface CharZoomOverlayProps {
  char: string
  bookTitle: string
  collected: boolean
  onCollect: () => void
  onClose: () => void
}

/** 长按单字弹出的大字号草楷对照视图 */
export function CharZoomOverlay({ char, bookTitle, collected, onCollect, onClose }: CharZoomOverlayProps) {
  return (
    <div className="overlay-mask" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="char-pair">
          <div className="char-box">
            <span className="char-big">{char}</span>
            <span className="char-label">草书</span>
          </div>
          <div className="char-box char-kai">
            <span className="char-big">{char}</span>
            <span className="char-label">楷书</span>
          </div>
        </div>
        <div className="overlay-meta">来自《{bookTitle}》</div>
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
