import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rm } from 'node:fs/promises';

// Bun supplies the bundler; Svelte and mdsvex execute the exported kb components.
export async function buildKb(root, dependencies = root) {
  // Dependency location is selected by the caller (normal install or managed tool environment).
  const load = async (name, entry) => {
    const file = entry
      ? path.join(dependencies, 'node_modules', name, entry)
      : Bun.resolveSync(name, dependencies);
    return import(pathToFileURL(file).href);
  };
  const compiler = await load('svelte', 'compiler/index.js');
  const { compile: markdown } = await load('mdsvex', 'dist/main.js');
  const { parse } = await load('acorn', 'dist/acorn.mjs');
  const transpiler = new Bun.Transpiler({ loader: 'ts' });
  const css = new Map();
  const routes = [...new Bun.Glob('src/routes/**/+page.svx').scanSync(root)].sort();
  const routeOf = (file) => '/' + file.replaceAll('\\', '/').replace('src/routes/', '').replace('/+page.svx', '');
  const output = path.join(root, 'rendered');

  // Expand the export's eager Vite globs structurally, after TypeScript erasure.
  // Both default JSON imports and namespace page metadata imports keep their semantics.
  function expandGlobs(source) {
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const replacements = [];
    const imports = [];
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
          && node.callee.object.type === 'MetaProperty'
          && node.callee.object.meta.name === 'import'
          && node.callee.property.name === 'glob') {
        const [pattern, options] = node.arguments;
        if (pattern.type !== 'Literal' || typeof pattern.value !== 'string'
            || options?.type !== 'ObjectExpression') throw new Error('Expected a static eager glob');
        const settings = Object.fromEntries(options.properties.map((p) => [p.key.name, p.value.value]));
        if (!settings.eager) throw new Error('Only eager globs occur in this kb export');
        const matches = [...new Bun.Glob(pattern.value.replace(/^\//, '')).scanSync(root)].sort();
        const values = matches.map((file) => {
          const identifier = `__kb_glob_${imports.length}`;
          const specifier = JSON.stringify(path.join(root, file).replaceAll('\\', '/'));
          imports.push(settings.import === 'default'
            ? `import ${identifier} from ${specifier};`
            : `import * as ${identifier} from ${specifier};`);
          return `${JSON.stringify('/' + file.replaceAll('\\', '/'))}: ${identifier}`;
        });
        replacements.push({ start: node.start, end: node.end, text: `{${values.join(',')}}` });
        return;
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') walk(value);
      }
    }
    walk(ast);
    for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
      source = source.slice(0, replacement.start) + replacement.text + source.slice(replacement.end);
    }
    return imports.join('\n') + '\n' + source;
  }

  function plugin(server) {
    return {
      name: 'support-kb',
      setup(build) {
        build.onResolve({ filter: /^#lib\// }, (args) => ({
          path: Bun.resolveSync(path.join(root, 'src/lib', args.path.slice(5)), root),
        }));
        build.onResolve({ filter: /^#client\/constants$/ }, () => ({
          path: path.join(dependencies, 'node_modules/svelte/src/internal/client/constants.js'),
        }));
        build.onResolve({ filter: /^[^./\\]|^[A-Za-z]:/ }, async (args) => {
          if (path.isAbsolute(args.path) || args.path.startsWith('node:') || args.path.startsWith('#')) return;
          const parts = args.path.split('/');
          const name = parts[0].startsWith('@') ? parts.splice(0, 2).join('/') : parts.shift();
          const manifest = await Bun.file(path.join(dependencies, 'node_modules', name, 'package.json')).json();
          const key = parts.length ? './' + parts.join('/') : '.';
          let entry = manifest.exports?.[key] ?? (key === '.' ? manifest.exports : undefined);
          while (entry && typeof entry === 'object') {
            entry = Array.isArray(entry) ? entry[0]
              : (!server && entry.browser) || entry.import || entry.default || entry.node;
          }
          entry ??= parts.length ? parts.join('/') : manifest.module ?? manifest.main ?? 'index.js';
          if (typeof entry !== 'string') throw new Error(`No runtime export for ${args.path}`);
          return { path: path.join(dependencies, 'node_modules', name, entry) };
        });
        build.onLoad({ filter: /\.(svx|svelte)$/ }, async (args) => {
          let source = await Bun.file(args.path).text();
          if (args.path.endsWith('.svx')) {
            source = (await markdown(source, {
              filename: args.path,
              layout: { runbook: path.join(root, 'src/lib/layouts/runbook.svelte').replaceAll('\\', '/') },
            })).code;
          }
          const compiled = compiler.compile(source, {
            filename: args.path,
            generate: server ? 'server' : 'client',
            css: 'external',
            modernAst: true,
          });
          if (compiled.css) css.set(args.path, compiled.css.code);
          for (const warning of compiled.warnings) {
            console.warn(`${args.path}: ${warning.code}: ${warning.message}`);
          }
          return { contents: expandGlobs(compiled.js.code), loader: 'js', resolveDir: path.dirname(args.path) };
        });
        build.onLoad({ filter: /\.(ts|js)$/ }, async (args) => {
          if (!args.path.startsWith(path.join(root, 'src'))) return;
          const source = transpiler.transformSync(await Bun.file(args.path).text());
          return { contents: expandGlobs(source), loader: 'js', resolveDir: path.dirname(args.path) };
        });
      },
    };
  }

  const imports = routes.map((file, index) => `import Page${index} from ${JSON.stringify(path.join(root, file).replaceAll('\\', '/'))};`).join('\n');
  const pages = routes.map((file, index) => `${JSON.stringify(routeOf(file))}: Page${index}`).join(',');
  const temporary = path.join(root, '.render-build', crypto.randomUUID());
  await Bun.write(path.join(temporary, 'server.ts'), `import { render } from 'svelte/server';\n${imports}\nexport default () => Object.entries({${pages}}).map(([route, Page]) => { const result = render(Page); return { route, head: result.head, body: result.body }; });\n`);
  await Bun.write(path.join(temporary, 'client.ts'), `import { hydrate } from 'svelte';\n${imports}\nconst Page = ({${pages}})[location.pathname.replace(/\\/$/, '')];\nif (!Page) throw new Error('Unknown kb route');\nhydrate(Page, { target: document.body });\n`);

  async function bundle(server) {
    const result = await Bun.build({
      entrypoints: [path.join(temporary, server ? 'server.ts' : 'client.ts')],
      outdir: server ? temporary : path.join(output, 'assets'),
      naming: server ? 'server.mjs' : 'kb.js',
      target: server ? 'bun' : 'browser',
      conditions: server ? ['svelte', 'node'] : ['svelte', 'browser'],
      plugins: [plugin(server)],
      minify: !server,
    });
    if (!result.success) throw new AggregateError(result.logs, 'KB build failed');
  }
  await bundle(true);
  await bundle(false);
  const server = await import(pathToFileURL(path.join(temporary, 'server.mjs')).href + `?build=${Date.now()}`);
  const rendered = server.default();
  await Bun.write(path.join(output, 'assets/kb.css'), [...css.values()].join('\n'));
  for (const page of rendered) {
    const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${page.head}<link rel="stylesheet" href="/assets/kb.css"><script type="module" src="/assets/kb.js"></script></head><body>${page.body}</body></html>\n`;
    await Bun.write(path.join(output, page.route, 'index.html'), html);
  }
  await rm(temporary, { recursive: true });
  return rendered.map((page) => ({ route: page.route, bytes: page.body.length }));
}

if (import.meta.main) {
  console.log(await buildKb(path.resolve(import.meta.dir, '..')));
}
