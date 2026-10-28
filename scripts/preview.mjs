import path from 'node:path';

const directory = path.resolve(import.meta.dir, '../rendered');
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 4173,
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    if (pathname === '/') return Response.redirect('http://127.0.0.1:4173/kb');
    const file = path.resolve(directory, '.' + pathname, path.extname(pathname) ? '' : 'index.html');
    if (!file.startsWith(directory + path.sep)) return new Response('Forbidden', { status: 403 });
    if (!await Bun.file(file).exists()) return new Response('Not found', { status: 404 });
    return new Response(Bun.file(file));
  },
});
console.log(`KB preview: ${server.url}kb/incidents/4471-review`);
