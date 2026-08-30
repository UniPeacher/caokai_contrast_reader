export interface GestureHandlers {
  /** 轻点（位移小、时间短） */
  onTap: (target: Element, x: number, y: number) => void
  /** 长按（按住不动 450ms），返回指下坐标供取字 */
  onLongPress: (x: number, y: number) => void
}

const LONG_PRESS_MS = 450
const MOVE_TOLERANCE = 12
const TAP_MAX_MS = 400

/**
 * 内容区的点按/长按手势。
 * 自己实现而不是用 click 事件：长按不能触发 click，滚动要取消点按，
 * 还要在长按时抑制原生的文字选择/上下文菜单。
 */
export function attachGestures(el: HTMLElement, handlers: GestureHandlers): () => void {
  let startX = 0
  let startY = 0
  let startTime = 0
  let moved = false
  let longPressConsumed = false
  let timer: number | null = null

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    startX = e.clientX
    startY = e.clientY
    startTime = Date.now()
    moved = false
    longPressConsumed = false
    clearTimer()
    timer = window.setTimeout(() => {
      timer = null
      if (moved) return
      longPressConsumed = true
      try {
        navigator.vibrate?.(20)
      } catch {
        /* 设备不支持振动则忽略 */
      }
      handlers.onLongPress(startX, startY)
    }, LONG_PRESS_MS)
  }

  const onMove = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOLERANCE) {
      moved = true
      clearTimer()
    }
  }

  const onUp = (e: PointerEvent) => {
    clearTimer()
    if (longPressConsumed) {
      longPressConsumed = false
      return
    }
    const elapsed = Date.now() - startTime
    if (!moved && elapsed < TAP_MAX_MS) {
      handlers.onTap(e.target as Element, e.clientX, e.clientY)
    }
  }

  const onContextMenu = (e: Event) => e.preventDefault()

  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', clearTimer)
  el.addEventListener('contextmenu', onContextMenu)

  return () => {
    clearTimer()
    el.removeEventListener('pointerdown', onDown)
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', clearTimer)
    el.removeEventListener('contextmenu', onContextMenu)
  }
}
