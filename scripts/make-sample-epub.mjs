/**
 * 生成一本测试用 EPUB（samples/sample.epub），内容为公版古文。
 * 运行：npm run sample
 */
import JSZip from 'jszip'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = path.join(root, 'samples')
await mkdir(outDir, { recursive: true })

const chapters = [
  {
    file: 'ch1.xhtml',
    title: '桃花源记',
    content: `
      <p>晋太元中，武陵人捕鱼为业。缘溪行，忘路之远近。忽逢桃花林，夹岸数百步，中无杂树，芳草鲜美，落英缤纷。渔人甚异之，复前行，欲穷其林。</p>
      <p>林尽水源，便得一山，山有小口，仿佛若有光。便舍船，从口入。初极狭，才通人。复行数十步，豁然开朗。土地平旷，屋舍俨然，有良田、美池、桑竹之属。阡陌交通，鸡犬相闻。其中往来种作，男女衣着，悉如外人。黄发垂髫，并怡然自乐。</p>
      <p>见渔人，乃大惊，问所从来。具答之。便要还家，设酒杀鸡作食。村中闻有此人，咸来问讯。自云先世避秦时乱，率妻子邑人来此绝境，不复出焉，遂与外人间隔。问今是何世，乃不知有汉，无论魏晋。此人一一为具言所闻，皆叹惋。余人各复延至其家，皆出酒食。停数日，辞去。此中人语云："不足为外人道也。"</p>
      <p>既出，得其船，便扶向路，处处志之。及郡下，诣太守，说如此。太守即遣人随其往，寻向所志，遂迷，不复得路。</p>
      <p>南阳刘子骥，高尚士也，闻之，欣然规往。未果，寻病终。后遂无问津者。</p>
    `,
  },
  {
    file: 'ch2.xhtml',
    title: '陋室铭',
    content: `
      <p>山不在高，有仙则名。水不在深，有龙则灵。斯是陋室，惟吾德馨。苔痕上阶绿，草色入帘青。谈笑有鸿儒，往来无白丁。可以调素琴，阅金经。无丝竹之乱耳，无案牍之劳形。南阳诸葛庐，西蜀子云亭。孔子云：何陋之有？</p>
    `,
  },
  {
    file: 'ch3.xhtml',
    title: '爱莲说',
    content: `
      <p>水陆草木之花，可爱者甚蕃。晋陶渊明独爱菊。自李唐来，世人甚爱牡丹。予独爱莲之出淤泥而不染，濯清涟而不妖，中通外直，不蔓不枝，香远益清，亭亭净植，可远观而不可亵玩焉。</p>
      <p>予谓菊，花之隐逸者也；牡丹，花之富贵者也；莲，花之君子者也。噫！菊之爱，陶后鲜有闻。莲之爱，同予者何人？牡丹之爱，宜乎众矣。</p>
    `,
  },
]

const zip = new JSZip()
// mimetype 必须是第一个条目且不压缩
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

zip.file(
  'META-INF/container.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
)

for (const ch of chapters) {
  zip.file(
    `OEBPS/${ch.file}`,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${ch.title}</title></head>
<body>
  <h2>${ch.title}</h2>
  ${ch.content.trim()}
</body>
</html>`,
  )
}

zip.file(
  'OEBPS/nav.xhtml',
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目录</h1>
    <ol>
      ${chapters.map((c, i) => `<li><a href="${c.file}">${c.title}</a></li>`).join('\n      ')}
    </ol>
  </nav>
</body>
</html>`,
)

zip.file(
  'OEBPS/content.opf',
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:contrast-reader-sample</dc:identifier>
    <dc:title>草楷对照·古文小品（样例书）</dc:title>
    <dc:creator>contrast_reader</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">2026-08-30T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${chapters.map((c, i) => `<item id="ch${i + 1}" href="${c.file}" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine>
    ${chapters.map((c, i) => `<itemref idref="ch${i + 1}"/>`).join('\n    ')}
  </spine>
</package>`,
)

const buf = await zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' })
const out = path.join(outDir, 'sample.epub')
await writeFile(out, buf)
console.log('样例书已生成 →', out)
