// Service worker «Password Gate»: отдаёт расшифрованный сайт из кэша браузера по адресам ./site/…
// Файлы в кэш кладёт экран входа (index.html) после верного кода.
// Нет файла в кэше (кэш очистили или код не вводили) — страницы отправляем на экран входа.
// Копируется в сборку скриптом gate/protect.py как есть.

const SITE = new URL('site/', self.registration.scope).href;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = event.request.url.split('#')[0].split('?')[0];
  if (event.request.method !== 'GET' || !url.startsWith(SITE)) return; // всё остальное — как обычно
  event.respondWith(serve(event.request, url));
});

async function serve(request, url) {
  const key = url.endsWith('/') ? url + 'index.html' : url;
  const hit = await caches.match(key);
  if (!hit) {
    if (request.mode === 'navigate') return Response.redirect(self.registration.scope, 302);
    return new Response('Not found', { status: 404 });
  }

  // Видео и аудио просят файл кусками (Range) — Safari без этого не играет
  const range = request.headers.get('range');
  if (!range) return hit;
  const buf = await hit.arrayBuffer();
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  const size = buf.byteLength;
  let start = match && match[1] ? Number(match[1]) : 0;
  let end = match && match[2] ? Number(match[2]) : size - 1;
  if (match && !match[1] && match[2]) {
    start = Math.max(0, size - Number(match[2])); // «последние N байт»
    end = size - 1;
  }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
