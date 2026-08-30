# 草楷对比阅读器（contrast_reader）

一个帮助你**通过阅读学会认草书**的手机 PWA 阅读器。

把手机的默认字体换成草书后，日常 App 里全是草书，但缺少「查证」的手段。这个阅读器让你导入 EPUB 图书：正文用手机的草书字体显示，**点按任意段落即可切换成楷书对照**，长按任意单字可放大对照并收藏进生字本——在读书中自然学会认草书。

## 功能

- 📚 **书架**：导入 EPUB（未加密），封面 / 作者 / 章节数展示，书籍全部保存在手机本地（IndexedDB），服务器不保存任何数据
- 🔄 **两种对照模式**（设置里切换，阅读器顶栏也可快速切换）：
  - **还原模式**：点一下段落变楷书，再点一下还原草书（先猜、再验证）
  - **对照模式**：段落保持草书，正下方插入楷书副本对照
- 🔍 **长按单字**：弹出大字号草楷并排视图，一键收藏
- 📖 **生字本**：收藏的字以大字号草楷对照集中复习，可回跳原文位置（自动定位并高亮该字）
- 📍 **进度记忆**：每本书记住读到哪一章、滚动到哪，重开接着读
- 🌗 深色 / 浅色 / 跟随系统主题，字号、行距可调
- 📱 PWA：部署到 HTTPS 后可「添加到主屏幕」、离线使用

## 本地运行

需要 Node.js ≥ 20。

```bash
npm install
npm run dev
```

`npm run dev` 默认带 `--host`，启动后终端会打印**局域网二维码**：手机连上同一个 Wi-Fi，扫码即可访问。

> 局域网 HTTP 下浏览器不允许注册 Service Worker（要求 HTTPS），所以开发期没有离线缓存和「添加到主屏幕」，功能本身不受影响。部署到 HTTPS 后完整体验自动生效。

其他命令：

```bash
npm run build     # 类型检查 + 构建到 dist/
npm run preview   # 本地预览构建产物
npm run icons     # 重新生成 PWA 图标（用 sharp 渲染 scripts/gen-icons.mjs 里的 SVG）
npm run sample    # 生成测试样例书 samples/sample.epub（公版古文）
```

## 部署

纯静态站点，无后端，三种方式任选。

### 方式一：自有服务器 + Docker（推荐）

服务器上拉取仓库后一条命令：

```bash
git clone <你的仓库地址> && cd contrast_reader
docker compose up -d --build
# 访问 http://服务器IP:8080 ，端口在 docker-compose.yml 里改
```

### 方式二：自有服务器 + nginx 静态托管

```bash
npm run build
# 把 dist/ 目录上传到服务器，nginx try_files 指向它即可
# （仓库里的 nginx.conf 可直接用）
```

### 方式三：GitHub Pages / Vercel 等静态托管

- **GitHub Pages**（部署在子路径时需要指定前缀）：
  ```bash
  BASE_PATH=/仓库名/ npm run build   # Windows: set BASE_PATH=/仓库名/ && npm run build
  # 把 dist/ 推到 gh-pages 分支
  ```
- **Vercel / Netlify**：框架选 Vite，构建命令 `npm run build`，输出目录 `dist`，零配置。

> ⚠️ **HTTPS 是硬要求**：Service Worker、添加到主屏幕、自定义字体上传的持久体验都依赖安全上下文。建议用 caddy（自动证书）或 nginx + certbot。

## 上传到 GitHub

```bash
git remote add origin git@github.com:<你>/<仓库名>.git
git push -u origin main
```

仓库自带 GitHub Actions（`.github/workflows/ci.yml`）：每次 push 自动类型检查 + 构建，保证随时可部署。

## 使用说明

| 操作 | 效果 |
|---|---|
| 点按段落 | 还原模式：楷书 ↔ 草书切换；对照模式：段落下方出现楷书对照 |
| 长按单字 | 大字号草楷对照浮层 → 可收藏到生字本 |
| 阅读页「还原」按钮 | 清除本章所有点按痕迹 |
| 阅读页「→对照 / →还原」 | 快速切换对照模式 |
| 生字本「回原文」 | 跳回收藏该字的位置并高亮 |

### 草书字体说明

默认使用**内置草书字体**「草书 1.00（简入繁出）」（喵闪字库来源，标注商用免费、版权归原作者），
简体繁体字形都覆盖，任何手机上效果一致，不依赖系统字体。设置里可切换：

- **内置·简入繁出**（默认）：简体码位映射到繁体草书字形，读简体书推荐
- **内置·原版**：仅繁体字形，适合读繁体书
- **跟随系统**：用手机主题商店替换的字体
- **自定义上传**：上传自己的 `.ttf/.otf`（存手机本地）

> 字体文件不入 git 仓库（授权原因）。部署时把 `caoshu-jf.ttf`、`caoshu-yb.ttf` 放到服务器
> `public/fonts/` 再构建，见 `public/fonts/README.md`；没放字体文件时应用会回退到系统字体，不会报错。

### 预装默认书籍（可选）

想让某些书「开箱即读」（首次打开 PWA 就在书架上）？把 EPUB 放进 `public/books/`（建议英文文件名），并在 `src/preload.ts` 的 `PRELOAD_BOOKS` 列表里登记文件名。首次启动时自动导入，删除后不会复活，文件缺失时静默跳过。

> `public/books/*.epub` 已被 .gitignore 排除：**受版权保护的书不要提交到公开仓库**。部署到自己的服务器时，把文件手动放到服务器同一目录再构建（Docker 构建会一并打包）。

### 哪里找 EPUB

任何**未加密**的 EPUB（Standard Ebooks、古腾堡计划、各阅读软件导出的无 DRM 书籍等）。

## 技术栈与目录结构

Vite + React + TypeScript + vite-plugin-pwa；EPUB 解析（jszip）与章节渲染为自研——**渲染前剥离原书全部样式**，保证「系统草书字体」不被书内 CSS 覆盖，这是本工具成立的前提；楷书使用开源字体[霞鹜文楷](https://github.com/lxgw/LxgwWenKai)（SIL OFL 许可，按 unicode-range 分片按需加载）。

```
src/
├─ App.tsx            # 视图切换：书架 | 生字本 | 设置 | 阅读器
├─ db.ts              # IndexedDB（书籍/设置/生字本）
├─ epub/
│  ├─ parse.ts        # container.xml → OPF → spine/目录/封面
│  └─ sanitize.ts     # 样式剥离、段落单元标记、图片 blob 化
├─ reader/
│  ├─ ReaderView.tsx  # 章节渲染、两种对照模式、目录、进度
│  ├─ gestures.ts     # 点按/长按手势识别
│  └─ charutil.ts     # 指下取字、生字高亮（码位级定位）
├─ views/             # 书架 / 生字本 / 设置
└─ components/        # 单字放大浮层
```

## 许可

- 代码：[MIT](./LICENSE)
- 内置字体「霞鹜文楷」：[SIL Open Font License](https://github.com/lxgw/LxgwWenKai/blob/master/OFL.txt)
