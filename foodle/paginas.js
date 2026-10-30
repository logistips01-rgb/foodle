'use strict';

/**
 * Foodle — páginas estáticas para buscadores (SEO).
 *
 * La portada carga los datos con JavaScript: para Google es casi una página vacía. Aquí se generan
 * páginas con el contenido ya escrito en el HTML, una por ciudad y una por ciudad × comida:
 *
 *   /madrid/              "Dónde comer en Madrid según los foodies"
 *   /madrid/tapas/        "Tapas en Madrid según los foodies"
 *
 * Se regeneran en cada actualización (foodle/actualizar.js) junto con sitemap.xml. Las carpetas que se
 * generaron la vez anterior y ya no tocan (p. ej. una ciudad que se queda sin recomendaciones) se borran:
 * la lista está en data/paginas.json.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DOMINIO = 'https://foodle.es';
const MIN_CIUDAD = 5;   // recomendaciones mínimas para tener página de ciudad
const MIN_COCINA = 4;   // … y de ciudad × comida
const MAX_FICHAS = 80;  // fichas por página (las mejor valoradas)
// Carpetas del repo que nunca se pueden pisar.
const RESERVADAS = new Set(['data', 'foodle', 'img', '.github', 'node_modules']);


const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Primero las más populares (me gusta): un dato de Instagram, no una opinión atribuida al foodie.
const ordenar = (a, b) => (b.likes || 0) - (a.likes || 0);

// Título por tipo de comida: "Tapas en Madrid", "Sushi en Madrid", "Comida italiana en Madrid"…
function tituloComida(cocina, ciudad) {
  const nombres = {
    'Sushi y japonesa': 'Sushi y comida japonesa', Italiana: 'Comida italiana', Mexicana: 'Comida mexicana',
    Asiática: 'Comida asiática', Aragonesa: 'Cocina aragonesa', Tradicional: 'Cocina tradicional',
    Internacional: 'Comida internacional', Vegetariana: 'Comida vegetariana', Dulce: 'Dulces y postres',
    Arroces: 'Arroces y paellas', Brasa: 'Brasa y asadores', 'Alta cocina': 'Alta cocina',
  };
  return `${nombres[cocina] || cocina} en ${ciudad}`;
}

function ficha(r) {
  const meta = [r.cocina, r.local, r.zona, r.precio_aprox || r.precio].filter(Boolean).map(esc).join(' · ');
  return `<li class="ficha">
        <a class="nombre" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.nombre || r.cocina || 'Recomendación')}</a>
        <p class="meta">${meta}</p>
        ${r.direccion ? `<p class="dir">📍 ${esc(r.direccion)}</p>` : ''}
        <p class="por">Recomendado por <a href="${esc(r.url)}" target="_blank" rel="noopener">@${esc(r.creador)}</a>${r.fecha ? ` · ${esc(r.fecha)}` : ''}</p>
      </li>`;
}

function pagina({ ruta, titulo, h1, descripcion, intro, migas, enlaces, fichas, buscar }) {
  const url = `${DOMINIO}/${ruta}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: h1, url,
    numberOfItems: fichas.length,
    itemListElement: fichas.slice(0, 30).map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.nombre || r.cocina, url: r.url })),
  };
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(titulo)}</title>
    <meta name="description" content="${esc(descripcion)}" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" href="/img/logo.svg" type="image/svg+xml" />
    <meta name="theme-color" content="#d42f34" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Foodle" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(titulo)}" />
    <meta property="og:description" content="${esc(descripcion)}" />
    <meta property="og:image" content="${DOMINIO}/img/compartir.png" />
    <link href="/fuentes/inter.css" rel="stylesheet" />
    <script type="application/ld+json">${JSON.stringify(ld)}</script>
    <style>
      :root { --bg: #f4f3f1; --card: #fff; --border: #e2dfdb; --text: #141414; --dim: #5f5b57; --faint: #8d8883; --accent: #d42f34; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--text); font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.5; -webkit-font-smoothing: antialiased; }
      a { color: inherit; }
      header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px clamp(16px,3vw,42px); }
      .brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 900; font-size: 28px; letter-spacing: -0.055em; text-decoration: none; }
      .brand img { width: 30px; height: 30px; }
      .btn { display: inline-block; padding: 10px 18px; border-radius: 999px; background: var(--accent); color: #fff; font-weight: 700; text-decoration: none; font-size: 15px; }
      main { max-width: 980px; margin: 0 auto; padding: 4px 16px 50px; }
      .migas { font-size: 13px; color: var(--faint); margin: 0 0 10px; }
      .migas a { color: var(--dim); }
      h1 { font-size: clamp(28px,5vw,42px); letter-spacing: -0.03em; line-height: 1.12; margin: 0 0 10px; }
      .intro { color: var(--dim); font-size: 17px; margin: 0 0 20px; max-width: 720px; }
      .enlaces { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 26px; padding: 0; list-style: none; }
      .enlaces a { display: inline-block; padding: 7px 14px; border: 1px solid var(--border); border-radius: 999px; background: var(--card); text-decoration: none; font-size: 14px; color: var(--dim); }
      .enlaces a:hover { border-color: var(--accent); color: var(--accent); }
      .lista { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(280px,100%),1fr)); gap: 12px; }
      .ficha { position: relative; background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
      .ficha .nombre { display: block; font-weight: 700; font-size: 17px; text-decoration: none; line-height: 1.25; }
      .ficha .nombre:hover { color: var(--accent); }
      .ficha p { margin: 6px 0 0; font-size: 13.5px; color: var(--dim); }
      .ficha .por { color: var(--faint); font-size: 12.5px; }
      .ficha .por a { color: var(--accent); text-decoration: none; font-weight: 600; }
      .mas { text-align: center; margin: 28px 0 0; }
      footer { text-align: center; padding: 24px 16px; color: var(--faint); font-size: 12.5px; border-top: 1px solid var(--border); }
      footer a { color: var(--accent); }
    </style>
  </head>
  <body>
    <header>
      <a class="brand" href="/"><img src="/img/logo.svg" alt="" />foodle</a>
      <a class="btn" href="/?q=${encodeURIComponent(buscar)}">Buscar en Foodle</a>
    </header>
    <main>
      <p class="migas">${migas}</p>
      <h1>${esc(h1)}</h1>
      <p class="intro">${intro}</p>
      ${enlaces.length ? `<ul class="enlaces">${enlaces.map(([t, h]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('')}</ul>` : ''}
      <ol class="lista">
      ${fichas.map(ficha).join('\n      ')}
      </ol>
      <p class="mas"><a class="btn" href="/?q=${encodeURIComponent(buscar)}">Ver todas y filtrar en Foodle</a></p>
    </main>
    <footer>
      <p>Foodle reúne recomendaciones públicas de foodies de Instagram. Cada ficha enlaza a la publicación original; el contenido y las opiniones son de sus creadores.</p>
      <p><a href="/">Inicio</a> · <a href="/privacidad.html">Privacidad y borrado de datos</a> · <a href="/aviso-legal.html">Aviso legal</a></p>
    </footer>
  </body>
</html>
`;
}

/** Genera las páginas y el sitemap a partir de las fichas de la web. Devuelve cuántas páginas hay. */
function generar(web) {
  const porCiudad = {};
  for (const r of web) if (r.ciudad) (porCiudad[r.ciudad] = porCiudad[r.ciudad] || []).push(r);
  const ciudades = Object.keys(porCiudad).filter((c) => porCiudad[c].length >= MIN_CIUDAD && !RESERVADAS.has(slug(c)))
    .sort((a, b) => porCiudad[b].length - porCiudad[a].length);

  const hoy = new Date().toISOString().slice(0, 10);
  const urls = [{ loc: `${DOMINIO}/`, freq: 'daily', prio: '1.0' }];
  const rutas = [];
  const escribir = (ruta, html) => {
    fs.mkdirSync(path.join(RAIZ, ruta), { recursive: true });
    fs.writeFileSync(path.join(RAIZ, ruta, 'index.html'), html);
    rutas.push(ruta);
  };
  const enlacesCiudades = ciudades.slice(0, 12).map((c) => [c, `/${slug(c)}/`]);

  for (const c of ciudades) {
    const todas = porCiudad[c].slice().sort(ordenar);
    const foodies = new Set(todas.map((r) => r.creador)).size;
    const cocinas = {};
    todas.forEach((r) => { if (r.cocina) (cocinas[r.cocina] = cocinas[r.cocina] || []).push(r); });
    const conPagina = Object.keys(cocinas).filter((k) => cocinas[k].length >= MIN_COCINA).sort((a, b) => cocinas[b].length - cocinas[a].length);
    const sc = slug(c);

    escribir(sc, pagina({
      ruta: `${sc}/`,
      titulo: `Dónde comer en ${c} según los foodies | Foodle`,
      h1: `Dónde comer en ${c} según los foodies`,
      descripcion: `${todas.length} restaurantes y bares de ${c} recomendados por ${foodies} foodies de Instagram${conPagina.length ? `: ${conPagina.slice(0, 5).map((k) => k.toLowerCase()).join(', ')} y más` : ''}.`,
      intro: `${todas.length} sitios de ${esc(c)} recomendados por ${foodies} foodies de Instagram. Cada ficha enlaza a la publicación original.`,
      migas: `<a href="/">Foodle</a> › ${esc(c)}`,
      enlaces: conPagina.map((k) => [tituloComida(k, c).replace(` en ${c}`, ''), `/${sc}/${slug(k)}/`]),
      fichas: todas.slice(0, MAX_FICHAS),
      buscar: c,
    }));
    urls.push({ loc: `${DOMINIO}/${sc}/`, freq: 'daily', prio: '0.8' });

    for (const k of conPagina) {
      const lista = cocinas[k];
      const t = tituloComida(k, c);
      escribir(`${sc}/${slug(k)}`, pagina({
        ruta: `${sc}/${slug(k)}/`,
        titulo: `${t} según los foodies | Foodle`,
        h1: `${t} según los foodies`,
        descripcion: `${lista.length} sitios de ${k.toLowerCase()} en ${c} recomendados por foodies de Instagram, con barrio, tipo de local y precio.`,
        intro: `${lista.length} sitios recomendados por foodies de Instagram.`,
        migas: `<a href="/">Foodle</a> › <a href="/${sc}/">${esc(c)}</a> › ${esc(k)}`,
        enlaces: conPagina.filter((x) => x !== k).slice(0, 10).map((x) => [x, `/${sc}/${slug(x)}/`]),
        fichas: lista.slice(0, MAX_FICHAS),
        buscar: `${c} ${k}`,
      }));
      urls.push({ loc: `${DOMINIO}/${sc}/${slug(k)}/`, freq: 'daily', prio: '0.6' });
    }
  }
  urls.push({ loc: `${DOMINIO}/privacidad.html`, freq: 'yearly', prio: '0.2' });
  urls.push({ loc: `${DOMINIO}/aviso-legal.html`, freq: 'yearly', prio: '0.1' });

  // Borra las carpetas generadas la vez anterior que ya no tocan.
  const listaF = path.join(RAIZ, 'data', 'paginas.json');
  let antes = [];
  try { antes = JSON.parse(fs.readFileSync(listaF, 'utf8')); } catch (_) { /* primera vez */ }
  for (const r of antes) {
    if (!rutas.includes(r) && !RESERVADAS.has(r.split('/')[0])) {
      fs.rmSync(path.join(RAIZ, r, 'index.html'), { force: true });
      try { fs.rmdirSync(path.join(RAIZ, r)); } catch (_) { /* tiene subcarpetas vivas */ }
    }
  }
  fs.writeFileSync(listaF, JSON.stringify(rutas.sort(), null, 1) + '\n');

  fs.writeFileSync(path.join(RAIZ, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${hoy}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.prio}</priority></url>`).join('\n')}
</urlset>
`);
  return { paginas: rutas.length, ciudades: ciudades.map((c) => [c, slug(c), porCiudad[c].length]) };
}

module.exports = { generar, slug };
