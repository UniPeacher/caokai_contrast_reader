import { useRef, useState } from 'react'
import type { Settings } from '../types'

interface SettingsViewProps {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={opt.value === value ? 'seg-btn active' : 'seg-btn'}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
          {opt.hint && <span className="seg-hint">{opt.hint}</span>}
        </button>
      ))}
    </div>
  )
}

export function SettingsView({ settings, onChange }: SettingsViewProps) {
  const fontFileRef = useRef<HTMLInputElement>(null)
  const [fontMsg, setFontMsg] = useState<string | null>(null)

  const handleFontFile = async (file: File | undefined) => {
    if (!file) return
    try {
      // 先验证这个文件确实是能用的字体
      const buf = await file.arrayBuffer()
      const blob = new Blob([buf])
      const family = `__font_check_${Date.now()}`
      const face = new FontFace(family, buf)
      await face.load()
      onChange({ customFontBlob: blob, cursiveSource: 'custom' })
      setFontMsg(`已上传「${file.name}」（${Math.round(file.size / 1024)} KB），已启用为草书字体`)
    } catch {
      setFontMsg('这个文件不是有效的字体文件，请上传 .ttf / .otf / .woff2')
    }
    if (fontFileRef.current) fontFileRef.current.value = ''
  }

  return (
    <div className="page">
      <h2 className="page-title">设置</h2>

      <section className="setting-group">
        <h3>对照模式</h3>
        <p className="setting-hint">点按段落时发生什么</p>
        <Segmented
          value={settings.compareMode}
          onChange={(v) => onChange({ compareMode: v })}
          options={[
            { value: 'toggle', label: '还原模式', hint: '点一下变楷书，再点还原' },
            { value: 'compare', label: '对照模式', hint: '段落下方显示楷书对照' },
          ]}
        />
      </section>

      <section className="setting-group">
        <h3>草书字体</h3>
        <p className="setting-hint">
          默认使用内置的「草书 1.00（简入繁出）」：简体繁体字形都覆盖，读简体书推荐用它；
          「原版」只含繁体字形，适合读繁体书；也可以改回跟随手机系统字体，或上传自己的字体文件。
        </p>
        <Segmented
          value={settings.cursiveSource}
          onChange={(v) => onChange({ cursiveSource: v })}
          options={[
            { value: 'builtin-jf', label: '内置·简入繁出', hint: '推荐' },
            { value: 'builtin-yb', label: '内置·原版', hint: '仅繁体字形' },
            { value: 'system', label: '跟随系统' },
            { value: 'custom', label: '自定义上传' },
          ]}
        />
        {settings.cursiveSource === 'custom' && (
          <div className="custom-font-box">
            <input
              ref={fontFileRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff2"
              hidden
              onChange={(e) => void handleFontFile(e.target.files?.[0])}
            />
            <button className="btn-plain" onClick={() => fontFileRef.current?.click()}>
              {settings.customFontBlob ? '重新上传字体文件' : '上传字体文件'}
            </button>
            {settings.customFontBlob && (
              <button
                className="btn-plain danger"
                onClick={() => {
                  onChange({ customFontBlob: undefined })
                  setFontMsg('已清除自定义字体文件')
                }}
              >
                清除
              </button>
            )}
            {settings.customFontBlob && (
              <p className="setting-hint">已保存（{Math.round(settings.customFontBlob.size / 1024)} KB）</p>
            )}
            {fontMsg && <p className="setting-hint">{fontMsg}</p>}
          </div>
        )}
      </section>

      <section className="setting-group">
        <h3>字号</h3>
        <div className="range-row">
          <input
            type="range"
            min={15}
            max={30}
            step={1}
            value={settings.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          />
          <span className="range-value">{settings.fontSize}px</span>
        </div>
      </section>

      <section className="setting-group">
        <h3>行距</h3>
        <div className="range-row">
          <input
            type="range"
            min={1.4}
            max={2.6}
            step={0.1}
            value={settings.lineHeight}
            onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
          />
          <span className="range-value">{settings.lineHeight.toFixed(1)}</span>
        </div>
      </section>

      <section className="setting-group">
        <h3>外观</h3>
        <Segmented
          value={settings.theme}
          onChange={(v) => onChange({ theme: v })}
          options={[
            { value: 'auto', label: '跟随系统' },
            { value: 'light', label: '浅色' },
            { value: 'dark', label: '深色' },
          ]}
        />
      </section>

      <section className="setting-group">
        <h3>关于</h3>
        <p className="setting-hint">
          草楷对比阅读器 v0.1.0 —— 书籍全部保存在本机浏览器（IndexedDB）里，服务器不保存任何数据。
          内置楷体为开源字体「霞鹜文楷」（SIL OFL 许可）。
        </p>
      </section>
    </div>
  )
}
