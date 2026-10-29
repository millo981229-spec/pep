#!/usr/bin/env node
// A portable, offline design preview built from the actual website components.
// This artifact does not provide authentication, an AI model, or a database.
import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.next/preview/곳곳-웹-미리보기.html');
const art = {};
for (const filename of await readdir(path.join(root, 'public/art'))) {
  if (!filename.endsWith('.svg')) continue;
  art[`/art/${filename}`] =
    `data:image/svg+xml;base64,${(await readFile(path.join(root, 'public/art', filename))).toString('base64')}`;
}
async function embedPhotos(directory, relative = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.join(relative, entry.name);
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await embedPhotos(filePath, relativePath);
      continue;
    }
    if (!/\.(jpe?g|png|webp)$/i.test(entry.name)) continue;
    const extension = path.extname(entry.name).toLowerCase();
    const mime =
      extension === '.png'
        ? 'image/png'
        : extension === '.webp'
          ? 'image/webp'
          : 'image/jpeg';
    const assetPath = `/photos/${relativePath.split(path.sep).join('/')}`;
    art[assetPath] =
      `data:${mime};base64,${(await readFile(filePath)).toString('base64')}`;
  }
}
await embedPhotos(path.join(root, 'public/photos'));

const fontDirectory = path.join(root, 'public/fonts');
const fonts = (await readdir(fontDirectory)).filter((name) =>
  name.endsWith('.woff2'),
);
const fontFile =
  fonts.find((name) => /subset|gotgot/i.test(name)) ||
  fonts.find((name) => /pretendard/i.test(name));
const font = fontFile
  ? `@font-face{font-family:GotgotPreview;src:url(data:font/woff2;base64,${(await readFile(path.join(fontDirectory, fontFile))).toString('base64')}) format('woff2');font-style:normal;font-weight:100 900;font-display:swap} :root{--font-pretendard:GotgotPreview;--font-sans:GotgotPreview} body,input,button,select,textarea{font-family:GotgotPreview,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}`
  : '';
const license = await readFile(
  path.join(fontDirectory, 'OFL.txt'),
  'utf8',
).catch(() => '');
const fontInfo = await readFile(
  path.join(fontDirectory, 'FONT_INFO.md'),
  'utf8',
).catch(() => '');
const sourceCss = await readFile(
  path.join(root, 'src/app/globals.css'),
  'utf8',
);
// Components use ordinary CSS classes; Tailwind's build directive is not needed here.
const css = sourceCss
  .replace(/@import\s+['"]tailwindcss['"];?/g, '')
  .replace(/@theme\s+inline\s*\{[^}]*\}/g, '');

const imageModule = `
  import React from 'react';
  const art = ${JSON.stringify(art)};
  export default function Image({src, alt = '', width, height, sizes, priority, quality, fill, unoptimized, loader, onError, ...rest}) {
    const source = typeof src === 'string' ? src : src?.src;
    const handleError = (event) => {
      const fallback = event.currentTarget.dataset.fallbackSrc;
      if (fallback) event.currentTarget.src = art[fallback] || fallback;
    };
    return React.createElement('img', {...rest, src: art[source] || source, alt, width, height, onError: handleError, loading: priority ? 'eager' : 'lazy', decoding: 'async'});
  }
`;
const linkModule = `
  import React from 'react';
  export default function Link({href, children, prefetch, replace, scroll, ...rest}) {
    const target = typeof href === 'string' ? href : href?.pathname || '/';
    return React.createElement('a', {...rest, href: target.startsWith('/') ? '#' + target : target}, children);
  }
`;
const navigationModule = `
  export function useRouter() {
    return {
      push(target) {
        const path = typeof target === 'string' ? target : target?.pathname || '/';
        window.location.hash = '#' + path;
      },
      replace(target) {
        const path = typeof target === 'string' ? target : target?.pathname || '/';
        window.location.replace('#' + path);
      },
      back() { window.history.back(); },
      forward() { window.history.forward(); },
      refresh() {},
      prefetch() { return Promise.resolve(); },
    };
  }
`;
const entry = `
  import React, {useEffect, useState} from 'react';
  import {createRoot} from 'react-dom/client';
  import {PlatformApp} from './src/components/platform-app';
  import {previewOffers} from './src/lib/catalog';
  import {regionalActivities} from './src/lib/regional-catalog';
  import {catalogPageSize,filterActivities} from './src/lib/catalog-filter';

  const json = (value, status = 200) => Promise.resolve(new Response(JSON.stringify(value), {status, headers:{'Content-Type':'application/json'}}));
  // The standalone file never sends credentials or user inputs to a remote service.
  window.fetch = async (input, init = {}) => {
    const raw = typeof input === 'string' ? input : input.url;
    const pathname = raw.split('?')[0];
    if (pathname === '/api/catalog') {
      const params=new URL(raw,'https://preview.local').searchParams;
      const requested=params.get('activityId');
      const filters={region:params.get('region')||'all',district:params.get('district')||'all',category:params.get('category')||'전체',query:params.get('query')||''};
      const filtered=requested?regionalActivities.filter(item=>item.id===requested):filterActivities(regionalActivities,filters);
      const page=Math.max(0,Number(params.get('page')||0));
      return json({activities:filtered.slice(page*catalogPageSize,(page+1)*catalogPageSize),offers:previewOffers,preview:true,hasMore:filtered.length>(page+1)*catalogPageSize});
    }
    if (pathname === '/api/session' && (!init.method || init.method === 'GET')) return json({configured:false,user:null});
    return json({error:'이 파일은 화면 미리보기입니다. 로그인·저장·실제 AI 추천·쿠폰 발급은 서버 연결 후 이용할 수 있어요.'},503);
  };
  const views = new Set(['home','explore','map','recommend','rewards','my']);
  function readRoute() {
    const key = window.location.hash.replace(/^#\\/?/,'');
    const value = key.split('?')[0];
    return {key: key || 'home', view: views.has(value) ? value : 'home'};
  }
  function OfflineWebsite() {
    const [route,setRoute] = useState(readRoute);
    useEffect(() => {const update=()=>{setRoute(readRoute());window.scrollTo({top:0,behavior:'instant'});};window.addEventListener('hashchange',update);return ()=>window.removeEventListener('hashchange',update);},[]);
    return <><aside className="offline-preview-banner" role="note"><strong>곳곳 · 웹 미리보기</strong><span>지역 정보 {regionalActivities.length}개 · 최신 일정·이용 정보 확인 필요 · 로그인·AI·마일리지 발급은 서버 연결 필요</span></aside><PlatformApp key={route.key} initialView={route.view}/></>;
  }
  createRoot(document.getElementById('root')).render(<OfflineWebsite/>);
`;
const bundle = await build({
  stdin: {
    contents: entry,
    resolveDir: root,
    sourcefile: 'offline-preview.tsx',
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  minify: true,
  jsx: 'automatic',
  platform: 'browser',
  target: ['es2022'],
  define: { 'process.env.NODE_ENV': '"production"' },
  tsconfig: path.join(root, 'tsconfig.json'),
  plugins: [
    {
      name: 'offline-next-components',
      setup(plugin) {
        plugin.onResolve(
          { filter: /^next\/(image|link|navigation)$/ },
          (args) => ({
            path: args.path,
            namespace: 'offline-components',
          }),
        );
        plugin.onLoad(
          { filter: /.*/, namespace: 'offline-components' },
          (args) => ({
            contents:
              args.path === 'next/image'
                ? imageModule
                : args.path === 'next/link'
                  ? linkModule
                  : navigationModule,
            loader: 'jsx',
            resolveDir: root,
          }),
        );
      },
    },
  ],
});

const extraCss = `.offline-preview-banner{padding:9px 20px;background:#153b7a;color:#fff;display:flex;justify-content:center;gap:16px;align-items:center;font-size:12px;line-height:1.6;text-align:center}.offline-preview-banner strong{white-space:nowrap}.offline-preview-banner span{opacity:.85}@media(max-width:600px){.offline-preview-banner{flex-direction:column;gap:0;padding:7px 14px;font-size:10px}}`;
const code = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="곳곳 지역활동 플랫폼의 오프라인 웹 미리보기. 실제 로그인, AI 추천, 쿠폰 발급 기능은 서버 연결이 필요합니다."><title>곳곳 | 웹 미리보기</title><style>${css}\n${font}\n${extraCss}</style></head><body><div id="root"></div><noscript>이 미리보기를 보려면 브라우저의 JavaScript를 켜주세요.</noscript><script>${code}</script><!-- Font provenance: ${fontInfo.replaceAll('--', '—')} --><!-- Font license: ${license.replaceAll('--', '—')} --></body></html>`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html, 'utf8');
console.log(`Preview: ${output}`);
console.log(`Bytes: ${Buffer.byteLength(html)}`);
