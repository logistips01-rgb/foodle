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
 *        data/posts.json       todo lo leído, acumulado (Instagram solo da lo reciente), SIN los textos
 *        data/pies.enc         los textos (pies), cifrados con FB_APP_SECRET (foodle/pies.js)
 *        data/foodle.json      lo que sale en la web (con ciudad y restaurante o cocina)
 *        data/pendientes.json  lo que las reglas no han sabido clasificar, para revisar
 *      data/recetas.json     las recetas: de los cocineros de foodle/recetas.json y las de los foodies
 *                            hechas en casa (nombre del plato, categoría, ingredientes; sin el texto)
 *   6. Genera las páginas por ciudad y comida (/madrid/, /madrid/tapas/…) y sitemap.xml (foodle/paginas.js).
 *
 * Uso:
 *   node foodle/actualizar.js            # 15 publicaciones por foodie ya conocido, 50 si es nuevo
 *   node foodle/actualizar.js 100        # 100 por foodie (todos)
 *   node foodle/actualizar.js --sin-osm  # sin OpenStreetMap
 *   node foodle/actualizar.js --minutos 105 --solo-nuevos  # cargas grandes por tandas: solo foodies nuevos, para a los 105 min
 *
 * Node 20+ (fetch nativo). Sin dependencias.
 */

const fs = require('fs');
const path = require('path');
const { clasificar } = require('./reglas');
const { publicacionesDe, estadoToken, shortcode } = require('./instagram');
const { enriquecer } = require('./osm');
const { generar } = require('./paginas');
const pies = require('./pies');
const { clasificarReceta } = require('./platos');

const RAIZ = path.join(__dirname, '..');
const DATA = path.join(RAIZ, 'data');
const F = {
  foodies: path.join(__dirname, 'foodies.json'),
  manual: path.join(__dirname, 'manual.json'),
  correcciones: path.join(__dirname, 'correcciones.json'),
  excluidos: path.join(__dirname, 'excluidos.json'),
  cocineros: path.join(__dirname, 'recetas.json'),
  recetas: path.join(DATA, 'recetas.json'),
  posts: path.join(DATA, 'posts.json'),
  web: path.join(DATA, 'foodle.json'),
  pendientes: path.join(DATA, 'pendientes.json'),
  lectura: path.join(DATA, 'lectura.json'), // dónde se paró la última lectura, para seguir desde ahí
};

const leer = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return def; } };
const escribir = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 1) + '\n');

const args = process.argv.slice(2);
// Lo antiguo ya está en data/posts.json: cada día basta con lo reciente. Pedir menos
// publicaciones gasta mucho menos del límite horario de la API de Meta.
// Un número suelto = publicaciones por foodie (el que va detrás de --minutos no cuenta).
const MAX_FIJO = args.find((a, i) => /^\d+$/.test(a) && args[i - 1] !== '--minutos');
const MAX_DIARIO = 15, MAX_NUEVO = 50;
// Foodies «historico» (foodies.json): ya no publican, pero sus recomendaciones valen. Se leen una vez (hasta 150)
// y no se vuelven a pedir ni avisan de que llevan más de 90 días sin publicar.
const MAX_HISTORICO = 150;
const sinOsm = args.includes('--sin-osm');
// --minutos N: deja de leer Instagram a los N minutos y termina normal (clasifica, guarda y genera páginas).
// Para cargas grandes por tandas: la siguiente ejecución sigue con los foodies que falten.
const iMin = args.indexOf('--minutos');
const LIMITE_MS = iMin >= 0 ? parseFloat(args[iMin + 1]) * 60000 : Infinity;
const INICIO = Date.now();
// --solo-nuevos: solo lee los foodies que aún no tienen nada guardado (para cargas por tandas).
const SOLO_NUEVOS = args.includes('--solo-nuevos');

// Lo que se publica de una receta: el plato, la categoría y los ingredientes (para buscar), nunca el texto.
function fichaReceta(k, p, r) {
  return {
    id: k, url: p.url, creador: p.creador, fecha: p.fecha || null, likes: p.likes ?? null, tipo: p.tipo || null,
    plato: r.plato, categoria: r.categoria || null, ingredientes: r.ingredientes || [], etiquetas: r.etiquetas || [],
  };
}

(async () => {
  fs.mkdirSync(DATA, { recursive: true });
  const foodies = leer(F.foodies, []);
  // Cuentas de recetas (sección foodle.es/recetas/): se leen igual que los foodies, pero no salen en "Dónde comer".
  const cocineros = leer(F.cocineros, []);
  const esCocinero = new Set(cocineros.map((c) => c.usuario.replace(/^@/, '').toLowerCase()));
  const manual = leer(F.manual, []);
  const correcciones = leer(F.correcciones, {});
  const posts = leer(F.posts, {}); // clave: shortcode. Sin los pies: van cifrados en data/pies.enc
  // Los textos de las publicaciones no se publican (ver foodle/pies.js). Si quedan pies antiguos en
  // posts.json, se pasan al archivo cifrado.
  const textos = pies.cargar();
  if (pies.ilegible()) {
    // Con una clave equivocada se perderían los textos y se reclasificaría todo sin ellos: mejor parar.
    const txt = 'FB_APP_SECRET no descifra data/pies.enc: no es la clave de la app. Revisa el secreto en GitHub (Meta → Configuración → Básica).';
    console.log(`   ⚠️  ${txt}`);
    if (process.env.AVISOS_FILE) fs.appendFileSync(process.env.AVISOS_FILE, `- ${txt}\n`);
    process.exit(1);
  }
  if (!textos) console.log('\n(Sin FB_APP_SECRET: no puedo leer los pies cifrados; uso la última clasificación guardada)');
  for (const [k, p] of Object.entries(posts)) {
    if (p.pie != null) { if (textos && !(k in textos)) textos[k] = p.pie; delete p.pie; }
  }

  // Avisos para Manuel: se muestran en el registro y, en GitHub, el flujo los convierte en un aviso (issue)
  // que le llega por correo. AVISOS_FILE lo pone el flujo; en local no hace falta.
  const aviso = (txt) => {
    console.log(`   ⚠️  ${txt}`);
    if (process.env.AVISOS_FILE) fs.appendFileSync(process.env.AVISOS_FILE, `- ${txt}\n`);
  };

  // 1. Instagram
  if (process.env.FB_TOKEN) {
    // Aviso temprano: el token debe ser el de Página (no caduca) y hay que renovarlo antes de "datos hasta".
    try {
      const t = await estadoToken();
      const dias = t.datosHasta ? Math.round((new Date(t.datosHasta) - Date.now()) / 864e5) : null;
      console.log(`\n🔑 Token ${t.tipo || '?'} · ${t.valido ? 'válido' : 'NO válido'} · caduca: ${t.caduca || '?'} · acceso a datos hasta ${t.datosHasta || '?'}${dias != null ? ` (${dias} días)` : ''}`);
      if (t.tipo && t.tipo !== 'PAGE') aviso('El FB_TOKEN no es el token de Página: caducará pronto. Renuévalo (README → Token sin caducidad).');
      if (dias != null && dias < 30) aviso(`Quedan ${dias} días para que Meta corte el acceso a los datos (${t.datosHasta}): renueva el token (README → Token sin caducidad).`);
    } catch (_) { /* si falla, ya lo dirá la primera llamada */ }
    const conocidos = new Set(Object.values(posts).map((p) => String(p.creador || '').toLowerCase()));
    console.log(`\n📸 Leyendo ${foodies.length} foodies y ${cocineros.length} cocineros (${MAX_FIJO ? `${MAX_FIJO} publicaciones c/u` : `${MAX_DIARIO} publicaciones c/u, ${MAX_NUEVO} si es nuevo`})…`);
    let leidos = 0;
    // Orden: primero los cocineros (pocos), luego los foodies empezando donde se paró la última vez,
    // para que con el límite de tiempo no se queden siempre sin leer los últimos de la lista.
    const desde = String(leer(F.lectura, {}).siguiente || '').toLowerCase();
    let i0 = foodies.findIndex((f) => f.usuario.replace(/^@/, '').toLowerCase() === desde);
    if (i0 < 0) i0 = 0;
    const orden = [...cocineros, ...foodies.slice(i0), ...foodies.slice(0, i0)];
    let siguiente = null;
    for (const f of orden) {
      const u = f.usuario.replace(/^@/, '');
      if (Date.now() - INICIO > LIMITE_MS) {
        siguiente = esCocinero.has(u.toLowerCase()) ? foodies[i0] && foodies[i0].usuario : u;
        console.log(`  ⏱️  Límite de tiempo: paro aquí (sigue en la próxima ejecución desde @${String(siguiente).replace(/^@/, '')})`);
        break;
      }
      if (leer(F.excluidos, []).some((x) => String(x).replace(/^@/, '').toLowerCase() === u.toLowerCase())) continue;
      if (SOLO_NUEVOS && conocidos.has(u.toLowerCase())) continue;
      if (f.historico && conocidos.has(u.toLowerCase())) continue;
      const max = f.historico ? MAX_HISTORICO : MAX_FIJO ? parseInt(MAX_FIJO, 10) : (conocidos.has(u.toLowerCase()) ? MAX_DIARIO : MAX_NUEVO);
      try {
        const res = await publicacionesDe(u, max);
        if (!res) { console.log(`  ⚠️  @${u}: no existe o no es cuenta profesional — lo salto`); continue; }
        let nuevos = 0;
        for (const p of res.posts) {
          const k = shortcode(p.url) || p.id;
          if (!posts[k]) nuevos++;
          const { pie, ...resto } = p;
          if (textos) textos[k] = pie;
          posts[k] = { ...posts[k], ...resto, origen: 'api' };
        }
        console.log(`  @${u}: ${res.posts.length} leídas · ${nuevos} nuevas`);
        // Guarda cada 5 foodies: si la ejecución se corta (límites de tiempo), la siguiente sigue donde se quedó
        // (los ya leídos cuentan como conocidos y solo se piden 15 publicaciones).
        if (++leidos % 5 === 0) { escribir(F.posts, posts); if (textos) pies.guardar(textos); }
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
    escribir(F.lectura, { siguiente: siguiente ? String(siguiente).replace(/^@/, '') : null });
  } else {
    console.log('\n(Sin FB_TOKEN: no leo Instagram, solo manual.json y lo ya guardado)');
  }

  // Creadores que han pedido salir de Foodle: se borra todo lo suyo, también lo antiguo.
  const excluidos = new Set(leer(F.excluidos, []).map((u) => String(u).replace(/^@/, '').toLowerCase()));
  for (const [k, p] of Object.entries(posts)) {
    if (excluidos.has(String(p.creador || '').toLowerCase())) { delete posts[k]; if (textos) delete textos[k]; }
  }

  // Norma de foodies (ver foodle/comprobar.js): avisa de los que llevan más de 90 días sin publicar.
  const { esConstante } = require('./comprobar');
  for (const f of [...foodies, ...cocineros]) {
    if (f.historico) continue;
    const u = f.usuario.replace(/^@/, '').toLowerCase();
    const fechas = Object.values(posts).filter((p) => String(p.creador || '').toLowerCase() === u).map((p) => p.fecha).filter(Boolean);
    if (fechas.length && !esConstante(fechas, fechas.length >= 30)) {
      const dias = Math.round((Date.now() - new Date(fechas.sort().pop())) / 864e5);
      console.log(`  ⚠️  @${u}: lleva ${dias} días sin publicar (la norma pide menos de 90)`);
    }
  }

  // 2. Manuales
  for (const m of manual) {
    const k = shortcode(m.url);
    if (!k) { console.log(`  ⚠️  enlace manual no válido: ${m.url}`); continue; }
    if (textos && !(k in textos)) textos[k] = m.pie || '';
    const { pie: _pie, ...sinPie } = m;
    posts[k] = { ...posts[k], id: k, ...sinPie, creador: (m.creador || (posts[k] && posts[k].creador) || '').replace(/^@/, ''), origen: posts[k] && posts[k].origen === 'api' ? 'api' : 'manual' };
  }
  // 3. Clasificar (con el pie si se puede descifrar; si no, la última clasificación guardada en "clasif")
  const web = [], pendientes = [], recetas = [];
  // Ciudad de cada foodie local (foodies.json → "ciudad"): se usa si el pie no dice ninguna.
  const ciudadDe = Object.fromEntries(foodies.filter((f) => f.ciudad).map((f) => [f.usuario.replace(/^@/, '').toLowerCase(), f.ciudad]));
  for (const [k, p] of Object.entries(posts)) {
    const pie = textos ? textos[k] : undefined;
    const cocinero = esCocinero.has(String(p.creador || '').toLowerCase());
    // Receta (nombre del plato, categoría, ingredientes): con el pie si se puede; si no, la última guardada.
    if (pie != null) p.receta = clasificarReceta(pie, { cocinero }) || undefined;
    if (cocinero) {
      // Los cocineros solo salen en recetas.
      const r = p.receta && { ...p.receta, ...(correcciones[k] || {}) };
      if (r && !r.oculta) recetas.push(fichaReceta(k, p, r));
      continue;
    }
    const auto = pie != null || !p.clasif
      ? clasificar({ ...p, pie: pie || '' }, { ciudadPorDefecto: ciudadDe[String(p.creador || '').toLowerCase()] })
      : p.clasif;
    p.clasif = auto;
    // Lo escrito a mano (en manual.json o correcciones.json) manda sobre las reglas.
    const aMano = Object.fromEntries(Object.entries(p).filter(([c]) => c !== 'clasif' && c in auto && p[c] != null));
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
    // El "nivel" (top / mixto…) lo deduce la máquina: no se publica como si fuera la opinión del foodie.
    delete ficha.nivel;
    if (ficha.oculta) continue;
    // Recetas y comida hecha en casa (la de la abuela…) no son un sitio al que ir: no salen en la web.
    const valida = ficha.visible === true || (!ficha.casa && ficha.ciudad && (ficha.nombre || ficha.cocina));
    // …pero si son recetas, van a la sección de recetas.
    if (ficha.casa && !valida && p.receta) recetas.push(fichaReceta(k, p, p.receta));
    delete ficha.casa;
    if (valida) web.push(ficha);
    else pendientes.push({ id: k, url: p.url, creador: p.creador, fecha: p.fecha, sugerido: auto });
  }
  escribir(F.posts, posts);
  if (textos) pies.guardar(textos);

  // 4. OpenStreetMap
  if (!sinOsm) {
    const n = await enriquecer(web);
    console.log(`\n🗺️  OpenStreetMap: ${n} consultas nuevas`);
  }

  // 5. Guardar
  web.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  escribir(F.web, web.map(({ visible, ...f }) => f));
  escribir(F.pendientes, pendientes);
  recetas.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  escribir(F.recetas, {
    cocineros: cocineros.map((c) => {
      const u = c.usuario.replace(/^@/, '');
      return { usuario: u, destacada: !!c.destacada, recetas: recetas.filter((r) => r.creador.toLowerCase() === u.toLowerCase()).length };
    }),
    recetas,
  });

  // 6. Páginas por ciudad y comida para buscadores (+ sitemap.xml) y lista de ciudades para la portada.
  const pags = generar(web);
  escribir(path.join(DATA, 'ciudades.json'), pags.ciudades.map(([nombre, slug, n]) => ({ nombre, slug, n })));
  console.log(`\n🔎 ${pags.paginas} páginas para buscadores`);

  const ciudades = {};
  web.forEach((f) => { ciudades[f.ciudad] = (ciudades[f.ciudad] || 0) + 1; });
  console.log(`\n✅ ${Object.keys(posts).length} publicaciones guardadas · ${web.length} en la web · ${pendientes.length} pendientes de revisar · ${recetas.length} recetas`);
  console.log('   Por ciudad:', Object.entries(ciudades).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · ') || '—');
})().catch((e) => {
  console.error('\n💥 Error:', e.message);
  process.exit(1);
});
