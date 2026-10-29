'use strict';

/**
 * Foodle — ¿este foodie cumple la norma para entrar?
 *
 * Norma (igual para todas las ciudades):
 *   1. Cuenta profesional (si no, Business Discovery no la lee).
 *   2. Ha publicado en los últimos 90 días.
 *   3. Al menos la mitad de sus últimas 30 publicaciones hablan de un sitio o de una comida concreta
 *      (las reglas sacan restaurante, cuenta del local o tipo de cocina). Fuera los que publican de todo.
 *   4. Con --ciudad: esa es su ciudad mayoritaria (o un municipio de su área, p. ej. Alcobendas → Madrid).
 *
 * Uso:
 *   node foodle/comprobar.js --ciudad Madrid usuario1 usuario2 …
 *   node foodle/comprobar.js --lista           # comprueba los de foodle/foodies.json con su ciudad
 *   … --json salida.json                       # además guarda el detalle
 *
 * Gasta una consulta de Business Discovery por cuenta (30 publicaciones): con muchas, espera al límite.
 */

const fs = require('fs');
const path = require('path');
const { graph, IG_USER_ID } = require('./instagram');
const { clasificar, PERTENECE } = require('./reglas');

const NORMA = { dias: 90, minUtil: 0.5, muestra: 30 };

async function comprobar(usuario, ciudad = null) {
  const u = usuario.replace(/^@/, '');
  let bd;
  try {
    bd = (await graph(`/${IG_USER_ID}`, {
      fields: `business_discovery.username(${u}){username,followers_count,media_count,media.limit(${NORMA.muestra}){caption,timestamp}}`,
    })).business_discovery;
  } catch (e) {
    if (e.code === 110 || /invalid user id/i.test(e.message)) return { usuario: u, ok: false, motivo: 'no es profesional o no existe' };
    return { usuario: u, ok: false, motivo: `error: ${e.message}` };
  }
  const media = (bd.media && bd.media.data) || [];
  const ultimo = (media[0] && media[0].timestamp || '').slice(0, 10) || null;
  const dias = ultimo ? Math.round((Date.now() - new Date(ultimo)) / 864e5) : null;

  let utiles = 0;
  const ciudades = {};
  for (const m of media) {
    const c = clasificar({ pie: m.caption || '', creador: u });
    if (c.nombre || c.ig_local || c.cocina) utiles++;
    if (c.ciudad) {
      const grande = PERTENECE[c.ciudad] || c.ciudad;
      ciudades[grande] = (ciudades[grande] || 0) + 1;
    }
  }
  const util = media.length ? utiles / media.length : 0;
  const mayoritaria = Object.entries(ciudades).sort((a, b) => b[1] - a[1])[0];
  const res = {
    usuario: bd.username, seguidores: bd.followers_count, ultimo, util: Math.round(util * 100),
    ciudad: mayoritaria ? mayoritaria[0] : null, deCiudad: ciudad ? (ciudades[ciudad] || 0) : null, muestra: media.length,
  };
  if (dias == null || dias > NORMA.dias) return { ...res, ok: false, motivo: `sin publicar desde hace ${dias ?? '∞'} días` };
  if (util < NORMA.minUtil) return { ...res, ok: false, motivo: `solo ${res.util} % de recomendaciones` };
  if (ciudad && res.ciudad !== ciudad) return { ...res, ok: false, motivo: `su ciudad es ${res.ciudad || 'desconocida'}, no ${ciudad}` };
  return { ...res, ok: true, motivo: 'cumple' };
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
    const ciudad = val('--ciudad');
    const salida = val('--json');
    let lista;
    if (args.includes('--lista')) {
      lista = JSON.parse(fs.readFileSync(path.join(__dirname, 'foodies.json'), 'utf8')).map((f) => [f.usuario, f.ciudad || null]);
    } else {
      lista = args.filter((a) => !a.startsWith('--')).map((u) => [u, ciudad]);
    }
    const out = [];
    for (const [u, c] of lista) {
      const r = await comprobar(u, c);
      out.push(r);
      console.log(`${r.ok ? '✅' : '❌'} ${String(r.usuario).padEnd(28)} ${r.seguidores != null ? String(r.seguidores).padStart(8) + ' seg' : '            '} · último ${r.ultimo || '—'} · ${r.util ?? '—'} % recomendaciones · ciudad ${r.ciudad || '—'} · ${r.motivo}`);
      if (salida) fs.writeFileSync(salida, JSON.stringify(out, null, 1));
    }
    const ok = out.filter((r) => r.ok);
    console.log(`\n${ok.length} de ${out.length} cumplen la norma.`);
  })().catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { comprobar, NORMA };
