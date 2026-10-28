import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Дневник спокойного материнства',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

/**
 * Диагностика белого экрана на телефоне: ловит ошибки JS и незагрузившиеся файлы до запуска приложения.
 * Если приложение не запустилось за 8 с — показывает ошибки на экране и шлёт их в лог сервера
 * (только текст ошибки, файл и браузер — без данных пользователя). Выполняется раньше любых скриптов Next.
 */
const BOOT_GUARD = `(function(){
  // Только мини-приложение: у юр. страниц и предпросмотра нет отметки о запуске.
  if(location.pathname!=='/app') return;
  var errs=[];
  function add(s){ if(errs.length<10) errs.push(String(s).slice(0,400)); }
  window.addEventListener('error',function(e){
    var t=e.target;
    if(t&&t!==window&&(t.src||t.href)) add('load failed: '+(t.src||t.href));
    else add((e.message||'error')+' @ '+(e.filename||'')+':'+(e.lineno||'')+':'+(e.colno||''));
  },true);
  window.addEventListener('unhandledrejection',function(e){ var r=e.reason; add('rejection: '+(r&&(r.stack||r.message)||r)); });
  ['warn','error'].forEach(function(k){
    var orig=console[k];
    console[k]=function(){ try{ add(k+': '+Array.prototype.map.call(arguments,function(a){ return a&&a.stack?a.stack:String(a); }).join(' ')); }catch(_){} return orig.apply(console,arguments); };
  });
  setTimeout(function(){
    var el=document.documentElement, mounted=el.getAttribute('data-app-mounted');
    var stage=(mounted?'mounted':'not-mounted')+' ready='+(el.getAttribute('data-tg-ready')||'no')+' state='+document.readyState+' tg='+(window.TelegramWebviewProxy?'ios':window.TelegramWebview?'android':window.external&&'notify' in window.external?'desktop':'none');
    // TODO: временно шлём отчёт при каждом открытии — ищем белый экран на iOS. Убрать после исправления.
    try{ fetch('/api/client-error',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stage:stage,errors:errs,ua:navigator.userAgent})}); }catch(_){}
    if(mounted) return;
    var d=document.createElement('div');
    d.style.cssText='position:fixed;inset:0;z-index:99999;background:#fff;color:#000;padding:16px;font:14px/1.4 -apple-system,sans-serif;overflow:auto';
    d.innerHTML='<p><b>Приложение не загрузилось.</b></p><p>Пришлите разработчику снимок этого экрана.</p>';
    var p=document.createElement('pre'); p.style.cssText='white-space:pre-wrap;font-size:12px';
    p.textContent=(errs.length?errs.join('\\n\\n'):'Ошибок не поймано.')+'\\n\\n'+navigator.userAgent;
    var b=document.createElement('button'); b.textContent='Перезагрузить'; b.style.cssText='margin-top:12px;padding:10px 16px;font-size:16px';
    b.onclick=function(){ location.reload(); };
    d.appendChild(p); d.appendChild(b); document.body.appendChild(d);
  },8000);
})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_GUARD }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
