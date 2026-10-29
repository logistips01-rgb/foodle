'use strict';

/**
 * Foodle — actualización diaria.
 *
 *   1. Lee las últimas publicaciones de cada foodie de foodle/foodies.json
 *      (Business Discovery; se salta si no hay FB_TOKEN).
 *   2. Añade las publicaciones metidas a mano en foodle/manual.json.
 *   3. Clasifica todo con reglas (foodle/reglas.js) y aplica foodle/correcciones.json.
 *   4. Busca dirección y coordenadas en OpenStreetMap (con caché).
 *   5. Escribe:
 *        data/posts.json       todo lo leído, acumulado (Instagram solo da lo reciente)
 *        data/foodle.json      lo que sale en la web (con ciudad y restaurante o cocina)
 *        data/pendientes.json  lo que las reglas no han sabido clasificar, para revisar
 *
 * Uso:
 *   node foodle/actualizar.js            # 15 publicaciones por foodie ya conocido, 50 si es nuevo
 *   node foodle/actualizar.js 100        # 100 por foodie (todos)
 *   node foodle/actualizar.js --sin-osm  # sin OpenStreetMap
 *
 * Node 20+ (fetch nativo). Sin dependencias.
 */

const fs = require('fs');
const path = require('path');
const { clasificar } = require('./reglas');
const { publicacionesDe, estadoToken, shortcode } = require('./instagram');
const { enriquecer } = require('./osm');

const RAIZ = path.join(__dirname, '..');
const DATA = path.join(RAIZ, 'data');
const F = {
  foodies: path.join(__dirname, 'foodies.json'),
  manual: path.join(__dirname, 'manual.json'),
  correcciones: path.join(__dirname, 'correcciones.json'),
  excluidos: path.join(__dirname, 'excluidos.json'),
  posts: path.join(DATA, 'posts.json'),
  web: path.join(DATA, 'foodle.json'),
  pendientes: path.join(DATA, 'pendientes.json'),
};

const leer = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return def; } };
const escribir = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 1) + '\n');

const args = process.argv.slice(2);
// Lo antiguo ya está en data/posts.json: cada día basta con lo reciente. Pedir menos
// publicaciones gasta mucho menos del límite horario de la API de Meta.
const MAX_FIJO = args.find((a) => /^\d+$/.test(a));
const MAX_DIARIO = 15, MAX_NUEVO = 50;
const sinOsm = args.includes('--sin-osm');

(async () => {
  fs.mkdirSync(DATA, { recursive: true });
  const foodies = leer(F.foodies, []);
  const manual = leer(F.manual, []);
  const correcciones = leer(F.correcciones, {});
  const posts = leer(F.posts, {}); // clave: shortcode

  // 1. Instagram
  if (process.env.FB_TOKEN) {
    // Aviso temprano: el token debe ser el de Página (no caduca) y hay que renovarlo antes de "datos hasta".
    try {
      const t = await estadoToken();
      const dias = t.datosHasta ? Math.round((new Date(t.datosHasta) - Date.now()) / 864e5) : null;
      console.log(`\n🔑 Token ${t.tipo || '?'} · ${t.valido ? 'válido' : 'NO válido'} · caduca: ${t.caduca || '?'} · acceso a datos hasta ${t.datosHasta || '?'}${dias != null ? ` (${dias} días)` : ''}`);
      if (t.tipo && t.tipo !== 'PAGE') console.log('   ⚠️  No es el token de Página: caducará pronto. Ver README → Token sin caducidad.');
      if (dias != null && dias < 15) console.log('   ⚠️  Queda poco para que Meta corte el acceso: renueva el token (README → Token sin caducidad).');
    } catch (_) { /* si falla, ya lo dirá la primera llamada */ }
    const conocidos = new Set(Object.values(posts).map((p) => String(p.creador || '').toLowerCase()));
    console.log(`\n📸 Leyendo ${foodies.length} foodies (${MAX_FIJO ? `${MAX_FIJO} publicaciones c/u` : `${MAX_DIARIO} publicaciones c/u, ${MAX_NUEVO} si es nuevo`})…`);
    for (const f of foodies) {
      const u = f.usuario.replace(/^@/, '');
      if (leer(F.excluidos, []).some((x) => String(x).replace(/^@/, '').toLowerCase() === u.toLowerCase())) continue;
      const max = MAX_FIJO ? parseInt(MAX_FIJO, 10) : (conocidos.has(u.toLowerCase()) ? MAX_DIARIO : MAX_NUEVO);
      try {
        const res = await publicacionesDe(u, max);
        if (!res) { console.log(`  ⚠️  @${u}: no existe o no es cuenta profesional — lo salto`); continue; }
        let nuevos = 0;
        for (const p of res.posts) {
          const k = shortcode(p.url) || p.id;
          if (!posts[k]) nuevos++;
          posts[k] = { ...posts[k], ...p, origen: 'api' };
        }
        console.log(`  @${u}: ${res.posts.length} leídas · ${nuevos} nuevas`);
      } catch (e) {
        console.log(`  💥 @${u}: ${e.message}`);
        if (e.code === 190) {
          // Pista sin revelar el token: un token de Página bueno empieza por "EAA" y tiene ~190-200 caracteres.
          const t = String(process.env.FB_TOKEN || '').trim().replace(/^["']|["']$/g, '');
          console.log(`  FB_TOKEN: ${t.length} caracteres · ${t.startsWith('EAA') ? 'empieza por EAA' : 'NO empieza por EAA'}${/\s/.test(t) ? ' · tiene espacios o saltos de línea dentro' : ''}`);
          throw new Error('El token de Facebook ha caducado o no es válido (FB_TOKEN).');
        }
      }
    }
  } else {
    console.log('\n(Sin FB_TOKEN: no leo Instagram, solo manual.json y lo ya guardado)');
  }

  // Creadores que han pedido salir de Foodle: se borra todo lo suyo, también lo antiguo.
  const excluidos = new Set(leer(F.excluidos, []).map((u) => String(u).replace(/^@/, '').toLowerCase()));
  for (const [k, p] of Object.entries(posts)) {
    if (excluidos.has(String(p.creador || '').toLowerCase())) delete posts[k];
  }

  // 2. Manuales
  for (const m of manual) {
    const k = shortcode(m.url);
    if (!k) { console.log(`  ⚠️  enlace manual no válido: ${m.url}`); continue; }
    posts[k] = { ...posts[k], id: k, pie: '', ...m, creador: (m.creador || (posts[k] && posts[k].creador) || '').replace(/^@/, ''), origen: posts[k] && posts[k].origen === 'api' ? 'api' : 'manual' };
  }
  escribir(F.posts, posts);

  // 3. Clasificar
  const web = [], pendientes = [];
  // Ciudad de cada foodie local (foodies.json → "ciudad"): se usa si el pie no dice ninguna.
  const ciudadDe = Object.fromEntries(foodies.filter((f) => f.ciudad).map((f) => [f.usuario.replace(/^@/, '').toLowerCase(), f.ciudad]));
  for (const [k, p] of Object.entries(posts)) {
    const auto = clasificar(p, { ciudadPorDefecto: ciudadDe[String(p.creador || '').toLowerCase()] });
    // Lo escrito a mano (en manual.json o correcciones.json) manda sobre las reglas.
    const aMano = Object.fromEntries(Object.entries(p).filter(([c]) => c in auto && p[c] != null));
    const ficha = {
      id: k,
      url: p.url,
      creador: p.creador,
      fecha: p.fecha || null,
      likes: p.likes ?? null,
      comentarios: p.comentarios ?? null,
      tipo: p.tipo || null,
      ...auto,
      ...aMano,
      ...(correcciones[k] || {}),
    };
    if (ficha.oculta) continue;
    const valida = ficha.visible === true || (ficha.ciudad && (ficha.nombre || ficha.cocina));
    if (valida) web.push(ficha);
    else pendientes.push({ id: k, url: p.url, creador: p.creador, fecha: p.fecha, sugerido: auto, pie: String(p.pie || '').slice(0, 400) });
  }

  // 4. OpenStreetMap
  if (!sinOsm) {
    const n = await enriquecer(web);
    console.log(`\n🗺️  OpenStreetMap: ${n} consultas nuevas`);
  }

  // 5. Guardar
  web.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  escribir(F.web, web.map(({ visible, ...f }) => f));
  escribir(F.pendientes, pendientes);

  const ciudades = {};
  web.forEach((f) => { ciudades[f.ciudad] = (ciudades[f.ciudad] || 0) + 1; });
  console.log(`\n✅ ${Object.keys(posts).length} publicaciones guardadas · ${web.length} en la web · ${pendientes.length} pendientes de revisar`);
  console.log('   Por ciudad:', Object.entries(ciudades).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · ') || '—');
})().catch((e) => {
  console.error('\n💥 Error:', e.message);
  process.exit(1);
});
