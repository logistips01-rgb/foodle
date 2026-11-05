'use strict';

/**
 * Foodle — ¿este foodie cumple la norma para entrar?
 *
 * Norma (igual para todas las ciudades): que sea un foodie activo que va a bares y restaurantes.
 *   1. Cuenta profesional (si no, Business Discovery no la lee).
 *   2. Activo: ha publicado algo en los últimos 90 días (cambio del 05/11/2026; antes, en cada uno de los últimos
 *      3 meses). Las recomendaciones de quien deja de publicar se quedan en la web.
 *   3. Foodie: va a bares y restaurantes (más del 15 % de recetas o comida hecha en casa lo deja fuera), y no es un
 *      local o negocio (lo dice su biografía: restaurante, reservas, delivery, tiendas…).
 * La ciudad NO es requisito: cada publicación se cataloga en su ciudad. Se informa de la ciudad
 * mayoritaria para ponerla en foodies.json como pista (pies que no dicen ciudad).
 *
 * Uso:
 *   node foodle/comprobar.js usuario1 usuario2 …
 *   node foodle/comprobar.js --lista           # comprueba los de foodle/foodies.json
 *   … --json salida.json                       # además guarda el detalle
 *
 * Gasta una consulta de Business Discovery por cuenta (30 publicaciones): con muchas, espera al límite.
 */

const fs = require('fs');
const path = require('path');
const { graph, IG_USER_ID } = require('./instagram');
const { clasificar, PERTENECE } = require('./reglas');

// diasMax: días como mucho desde la última publicación; minFoodie: parte mínima de
// publicaciones sobre sitios o comida, solo para descartar cuentas que no son de comida; maxRecetas: parte
// máxima de recetas o comida hecha en casa (se buscan foodies que van a bares y restaurantes, no cocineros).
const NORMA = { diasMax: 90, minFoodie: 0.2, maxRecetas: 0.15, muestra: 30 };

/** ¿Sigue activo? Al menos una publicación en los últimos NORMA.diasMax días. ("llena" se mantiene por compatibilidad.) */
function esConstante(fechas, llena) { // eslint-disable-line no-unused-vars
  return fechas.some((f) => (Date.now() - new Date(f)) / 864e5 < NORMA.diasMax);
}

async function comprobar(usuario) {
  const u = usuario.replace(/^@/, '');
  let bd;
  try {
    bd = (await graph(`/${IG_USER_ID}`, {
      fields: `business_discovery.username(${u}){username,biography,followers_count,media_count,media.limit(${NORMA.muestra}){caption,timestamp}}`,
    })).business_discovery;
  } catch (e) {
    if (e.code === 110 || /invalid user id/i.test(e.message)) return { usuario: u, ok: false, motivo: 'no es profesional o no existe' };
    return { usuario: u, ok: false, motivo: `error: ${e.message}` };
  }
  const media = (bd.media && bd.media.data) || [];
  const ultimo = (media[0] && media[0].timestamp || '').slice(0, 10) || null;
  const dias = ultimo ? Math.round((Date.now() - new Date(ultimo)) / 864e5) : null;
  const constante = esConstante(media.map((m) => m.timestamp).filter(Boolean), media.length >= NORMA.muestra);

  let utiles = 0, recetas = 0;
  const ciudades = {};
  for (const m of media) {
    const c = clasificar({ pie: m.caption || '', creador: u });
    if (c.casa) recetas++;
    else if (c.nombre || c.ig_local || c.cocina) utiles++; // las recetas no cuentan: no son sitios
    if (c.ciudad) {
      const grande = PERTENECE[c.ciudad] || c.ciudad;
      ciudades[grande] = (ciudades[grande] || 0) + 1;
    }
  }
  const util = media.length ? utiles / media.length : 0;
  const mayoritaria = Object.entries(ciudades).sort((a, b) => b[1] - a[1])[0];
  const res = {
    usuario: bd.username, bio: String(bd.biography || '').replace(/\s+/g, ' ').slice(0, 90), seguidores: bd.followers_count, ultimo, util: Math.round(util * 100),
    ciudad: mayoritaria ? mayoritaria[0] : null, muestra: media.length,
  };
  if (!constante) return { ...res, ok: false, motivo: dias != null ? `no publica desde hace ${dias} días` : 'no tiene publicaciones' };
  if (media.length && recetas / media.length > NORMA.maxRecetas) return { ...res, ok: false, motivo: `publica recetas, no visita sitios (${Math.round(100 * recetas / media.length)} % recetas)` };
  if (util < NORMA.minFoodie) return { ...res, ok: false, motivo: `no parece de comida (${res.util} %)` };
  // Un restaurante o una tienda publica mucho de comida, pero no es un foodie: lo delata su biografía.
  if (/\b(restaurante|restaurant|reservas?|delivery|a domicilio|pedidos|tiendas?|nuestra carta|nuestro local|abrimos|horario|franquicia|obrador|take ?away)\b/i.test(bd.biography || ''))
    return { ...res, ok: false, motivo: 'parece un local o un negocio, no un foodie (ver su biografía)' };
  return { ...res, ok: true, motivo: 'cumple' };
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
    const salida = val('--json');
    let lista;
    if (args.includes('--lista')) {
      lista = JSON.parse(fs.readFileSync(path.join(__dirname, 'foodies.json'), 'utf8')).map((f) => f.usuario);
    } else {
      lista = args.filter((a) => !a.startsWith('--'));
    }
    const out = [];
    for (const u of lista) {
      const r = await comprobar(u);
      out.push(r);
      console.log(`${r.ok ? '✅' : '❌'} ${String(r.usuario).padEnd(28)} ${r.seguidores != null ? String(r.seguidores).padStart(8) + ' seg' : '            '} · último ${r.ultimo || '—'} · ${r.util ?? '—'} % de comida · ciudad ${r.ciudad || '—'} · ${r.motivo}${r.bio ? `\n     ${r.bio}` : ''}`);
      if (salida) fs.writeFileSync(salida, JSON.stringify(out, null, 1));
    }
    const ok = out.filter((r) => r.ok);
    console.log(`\n${ok.length} de ${out.length} cumplen la norma.`);
  })().catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { comprobar, esConstante, NORMA };
