'use strict';

/**
 * Foodle — resumen de la actualización: el antes y el después.
 *
 * Compara los datos de la última versión guardada en git (antes) con los que acaba de generar
 * foodle/actualizar.js (después) y escribe un resumen en Markdown por la salida estándar.
 * El flujo diario lo publica como comentario en el issue «Foodle: resumen diario» (llega por correo).
 *
 * Uso:  node foodle/resumen.js [ref]     (ref: versión de git con la que comparar; por defecto HEAD)
 *
 * Solo usa datos que ya son públicos en la web (nombre del sitio, ciudad, @creador, plato): nunca los pies.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const REF = process.argv[2] || 'HEAD';

function antes(rel, def) {
  try { return JSON.parse(execFileSync('git', ['show', `${REF}:${rel}`], { cwd: RAIZ, maxBuffer: 1 << 29 }).toString()); } catch (_) { return def; }
}
function ahora(rel, def) {
  try { return JSON.parse(fs.readFileSync(path.join(RAIZ, rel), 'utf8')); } catch (_) { return def; }
}
function sitemap(txt) { return (String(txt || '').match(/<loc>/g) || []).length; }
function sitemapAntes() { try { return sitemap(execFileSync('git', ['show', `${REF}:sitemap.xml`], { cwd: RAIZ }).toString()); } catch (_) { return 0; } }
function sitemapAhora() { try { return sitemap(fs.readFileSync(path.join(RAIZ, 'sitemap.xml'), 'utf8')); } catch (_) { return 0; } }

// En GitHub, «@usuario» avisa a la cuenta de GitHub con ese nombre: los usuarios de Instagram van entre comillas de código.
const at = (u) => `\`@${u}\``;
const n = (x) => Number(x || 0).toLocaleString('es-ES');
const dif = (a, b) => { const d = b - a; return d === 0 ? '=' : `${d > 0 ? '+' : '−'}${n(Math.abs(d))}`; };
const contar = (lista, clave) => lista.reduce((m, x) => { const k = clave(x); if (k) m[k] = (m[k] || 0) + 1; return m; }, {});

const A = {
  web: antes('data/foodle.json', []), posts: antes('data/posts.json', {}), pend: antes('data/pendientes.json', []),
  rec: antes('data/recetas.json', { recetas: [] }), foodies: antes('foodle/foodies.json', []), mapa: sitemapAntes(),
};
const D = {
  web: ahora('data/foodle.json', []), posts: ahora('data/posts.json', {}), pend: ahora('data/pendientes.json', []),
  rec: ahora('data/recetas.json', { recetas: [] }), foodies: ahora('foodle/foodies.json', []), mapa: sitemapAhora(),
};
const cA = contar(A.web, (f) => f.ciudad), cD = contar(D.web, (f) => f.ciudad);
const ciudadesPag = (c) => Object.values(c).filter((x) => x >= 10).length; // mismo mínimo que foodle/paginas.js

const idsA = new Set(A.web.map((f) => f.id));
const idsD = new Set(D.web.map((f) => f.id));
const nuevas = D.web.filter((f) => !idsA.has(f.id));
const fuera = A.web.filter((f) => !idsD.has(f.id)).length;
const recA = new Set((A.rec.recetas || []).map((r) => r.id));
const recNuevas = (D.rec.recetas || []).filter((r) => !recA.has(r.id));

const hoy = new Date().toISOString().slice(0, 10);
const out = [];
out.push(`## 📊 Foodle · ${hoy.split('-').reverse().join('/')}`);
out.push('');
out.push('| | Antes | Después | Cambio |');
out.push('|---|---:|---:|---:|');
const fila = (t, a, b) => out.push(`| ${t} | ${n(a)} | ${n(b)} | **${dif(a, b)}** |`);
fila('📍 Recomendaciones en la web', A.web.length, D.web.length);
fila('🍳 Recetas', (A.rec.recetas || []).length, (D.rec.recetas || []).length);
fila('🏙️ Ciudades con página', ciudadesPag(cA), ciudadesPag(cD));
fila('🔎 Páginas en el sitemap', A.mapa, D.mapa);
fila('👤 Foodies en la lista', A.foodies.length, D.foodies.length);
fila('📸 Publicaciones leídas', Object.keys(A.posts).length, Object.keys(D.posts).length);
fila('🕵️ Pendientes de revisar', A.pend.length, D.pend.length);
out.push('');

// Ciudades que más cambian (siempre las 5 primeras de la web, aunque no cambien).
const todas = [...new Set([...Object.keys(cA), ...Object.keys(cD)])];
const top = Object.entries(cD).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
const cambian = todas.filter((c) => (cD[c] || 0) !== (cA[c] || 0)).sort((a, b) => Math.abs((cD[b] || 0) - (cA[b] || 0)) - Math.abs((cD[a] || 0) - (cA[a] || 0)));
const mostrar = [...new Set([...top, ...cambian.slice(0, 10)])];
out.push('### Por ciudad');
out.push('');
out.push('| Ciudad | Antes | Después | Cambio |');
out.push('|---|---:|---:|---:|');
for (const c of mostrar) out.push(`| ${c} | ${n(cA[c])} | ${n(cD[c])} | ${dif(cA[c] || 0, cD[c] || 0)} |`);
const nuevasCiudades = todas.filter((c) => (cD[c] || 0) >= 10 && (cA[c] || 0) < 10);
if (nuevasCiudades.length) out.push('', `🆕 Ciudades que estrenan página: ${nuevasCiudades.join(', ')}`);
out.push('');

out.push(`### 🆕 ${n(nuevas.length)} recomendaciones nuevas${fuera ? ` · ${n(fuera)} salen de la web` : ''}`);
out.push('');
if (nuevas.length) {
  const porFoodie = Object.entries(contar(nuevas, (f) => f.creador)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  out.push(`Quién más aporta: ${porFoodie.map(([u, k]) => `${at(u)} (${k})`).join(' · ')}`);
  out.push('');
  for (const f of nuevas.slice(0, 12)) {
    const nombre = f.nombre || (f.ig_local ? `\`@${f.ig_local}\`` : f.cocina) || 'Sitio';
    out.push(`- [${nombre}](${f.url}) · ${f.ciudad}${f.cocina ? ` · ${f.cocina}` : ''} · ${at(f.creador)}`);
  }
  if (nuevas.length > 12) out.push(`- … y ${n(nuevas.length - 12)} más`);
  out.push('');
}

if (recNuevas.length) {
  out.push(`### 🍳 ${n(recNuevas.length)} recetas nuevas`);
  out.push('');
  for (const r of recNuevas.slice(0, 8)) out.push(`- [${r.plato}](${r.url}) · ${r.categoria || '—'} · ${at(r.creador)}`);
  if (recNuevas.length > 8) out.push(`- … y ${n(recNuevas.length - 8)} más`);
  out.push('');
}

const sig = ahora('data/lectura.json', {}).siguiente;
out.push(sig ? `_La lectura de mañana empieza por ${at(sig)} (hoy no dio tiempo a leer a todos)._` : '_Hoy se ha leído a todos los foodies._');

process.stdout.write(out.join('\n') + '\n');
