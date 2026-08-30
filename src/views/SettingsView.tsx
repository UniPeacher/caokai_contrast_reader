import { useRef, useState } from 'react'
import type { Settings } from '../types'

/** 内置草书字体按字形分组：简繁类 / 繁体类，选中类后由下拉选具体字体 */
const FONT_GROUPS: {
  key: string
  label: string
  default: Settings['cursiveSource']
  fonts: { value: Settings['cursiveSource']; label: string }[]
}[] = [
  {
    key: 'simplified',
    label: '内置·简繁',
    default: 'builtin-jf',
    fonts: [
      { value: 'builtin-jf', label: '简入繁出' },
      { value: 'builtin-zdf', label: '周东芬草书' },
      { value: 'builtin-hczp', label: '汉呈张平草书' },
      { value: 'builtin-bzfh', label: '标准草书符号' },
      { value: 'builtin-swm', label: '汉仪孙万民草书' },
      { value: 'builtin-sgc', label: '孙过庭草书' },
      { value: 'builtin-yrz', label: '于右任标准草书' },
    ],
  },
  {
    key: 'traditional',
    label: '内置·繁体',
    default: 'builtin-yb',
    fonts: [
      { value: 'builtin-yb', label: '原版' },
      { value: 'builtin-sgt', label: '孙过庭书谱' },
    ],
  },
]

function fontGroupOf(source: Settings['cursiveSource']): string | null {
  if (
    source === 'builtin-jf' ||
    source === 'builtin-zdf' ||
    source === 'builtin-hczp' ||
    source === 'builtin-bzfh' ||
    source === 'builtin-swm' ||
    source === 'builtin-sgc' ||
    source === 'builtin-yrz'
  )
    return 'simplified'
  if (source === 'builtin-yb' || source === 'builtin-sgt') return 'traditional'
  return null
}

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
          内置草书字体按字形分为「简繁」（简入繁出、周东芬草书）和「繁体」（原版、孙过庭书谱）两类，
          选中类别后用下拉选择具体字体；也可以跟随手机系统字体，或上传自己的字体文件。
        </p>
        <div className="segmented">
          {FONT_GROUPS.map((g) => (
            <button
              key={g.key}
              className={fontGroupOf(settings.cursiveSource) === g.key ? 'seg-btn active' : 'seg-btn'}
              onClick={() =>
                onChange({
                  cursiveSource: fontGroupOf(settings.cursiveSource) === g.key ? settings.cursiveSource : g.default,
                })
              }
            >
              {g.label}
            </button>
          ))}
          <button
            className={settings.cursiveSource === 'system' ? 'seg-btn active' : 'seg-btn'}
            onClick={() => onChange({ cursiveSource: 'system' })}
          >
            跟随系统
          </button>
          <button
            className={settings.cursiveSource === 'custom' ? 'seg-btn active' : 'seg-btn'}
            onClick={() => onChange({ cursiveSource: 'custom' })}
          >
            自定义上传
          </button>
        </div>
        {fontGroupOf(settings.cursiveSource) && (
          <div className="font-group-select">
            <select
              className="font-select"
              value={settings.cursiveSource}
              onChange={(e) => onChange({ cursiveSource: e.target.value as Settings['cursiveSource'] })}
            >
              {FONT_GROUPS.find((g) => g.key === fontGroupOf(settings.cursiveSource))!.fonts.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <span className="setting-hint">选择该类别下的具体字体</span>
          </div>
        )}
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
