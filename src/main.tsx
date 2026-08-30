import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
// 只引楷体常规字重（97 个 unicode-range 分片，浏览器只下载用到的分片）
import 'lxgw-wenkai-webfont/lxgwwenkai-regular.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
