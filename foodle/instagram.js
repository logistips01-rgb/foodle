'use strict';

/**
 * Foodle — lectura de Instagram con la API OFICIAL de Meta
 * (API de Instagram con inicio de sesión con Facebook + Business Discovery).
 *
 * Solo funciona con cuentas profesionales (creador/empresa). Da pie, fecha,
 * permalink, likes y nº de comentarios; NO da ubicación (eso lo saca reglas.js).
 * Nada de scraping: si una cuenta no es profesional, se salta.
 *
 * Variables de entorno:
 *   FB_TOKEN       token de usuario de Facebook (instagram_basic,
 *                  instagram_manage_insights, pages_read_engagement…)
 *   FB_APP_SECRET  clave secreta de la app (firma las llamadas: appsecret_proof)
 *   IG_USER_ID     (opcional) cuenta profesional propia desde la que se consulta
 */

const crypto = require('crypto');

const GRAPH = 'https://graph.facebook.com/v23.0';
// Cuenta profesional propia desde la que se hacen las consultas (@arrocesdebandera).
const IG_USER_ID = process.env.IG_USER_ID || '17841437741882903';

const CAMPOS_MEDIA = 'id,caption,timestamp,permalink,like_count,comments_count,media_type,media_product_type';

function proof(token) {
  const secret = process.env.FB_APP_SECRET;
  return secret ? crypto.createHmac('sha256', secret).update(token).digest('hex') : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LIMITE = /^(4|17|32|613)$/; // límites de uso de la app / del usuario

// Uso de la app en la última hora, en % (cabecera x-app-usage). Business Discovery con
// 50 publicaciones gasta ~4 % de "total_time" por llamada: con muchos foodies se agota.
let uso = 0;

async function graph(ruta, params = {}, intento = 0) {
  const token = process.env.FB_TOKEN;
  if (!token) throw new Error('Falta FB_TOKEN');
  // Frena antes de llegar al límite en vez de chocar con él.
  if (uso >= 80) {
    console.log(`  ⏳ uso de la API al ${uso} %: espero 5 min…`);
    await sleep(5 * 60 * 1000);
    uso = 0;
  }
  const url = new URL(GRAPH + ruta);
  const p = proof(token);
  url.search = new URLSearchParams({ ...params, access_token: token, ...(p ? { appsecret_proof: p } : {}) });
  const r = await fetch(url);
  try {
    const u = JSON.parse(r.headers.get('x-app-usage') || '{}');
    uso = Math.max(u.call_count || 0, u.total_time || 0, u.total_cputime || 0);
  } catch (_) { /* sin cabecera */ }
  const data = await r.json();
  if (!r.ok || data.error) {
    const e = data.error || {};
    // Límite alcanzado: se recupera solo en la hora siguiente. Espera y reintenta (máx. 1 h).
    if (LIMITE.test(String(e.code)) && intento < 12) {
      console.log(`  ⏳ límite de la API (#${e.code}): espero 5 min (intento ${intento + 1}/12)…`);
      await sleep(5 * 60 * 1000);
      uso = 0;
      return graph(ruta, params, intento + 1);
    }
    const err = new Error(`Graph ${ruta}: (#${e.code || r.status}) ${e.message || 'error'}`);
    err.code = e.code;
    throw err;
  }
  return data;
}

/**
 * Últimas publicaciones de un foodie (hasta `max`, paginando).
 * Devuelve { perfil, posts } o null si la cuenta no existe / no es profesional.
 */
async function publicacionesDe(username, max = 50) {
  const u = username.replace(/^@/, '');
  const posts = [];
  let perfil = null;
  let after = null;
  while (posts.length < max) {
    const lim = Math.min(50, max - posts.length);
    const media = `media.limit(${lim})${after ? `.after(${after})` : ''}{${CAMPOS_MEDIA}}`;
    let data;
    try {
      data = await graph(`/${IG_USER_ID}`, {
        fields: `business_discovery.username(${u}){username,name,followers_count,media_count,${media}}`,
      });
    } catch (e) {
      // 110 / 100 "Invalid user id": no existe o no es cuenta profesional.
      if (/invalid user id|cannot find|does not exist/i.test(e.message) || e.code === 110) return null;
      throw e;
    }
    const bd = data.business_discovery;
    perfil = perfil || { username: bd.username, nombre: bd.name || bd.username, seguidores: bd.followers_count || null };
    const m = bd.media || {};
    posts.push(...(m.data || []));
    after = m.paging && m.paging.cursors && m.paging.next ? m.paging.cursors.after : null;
    if (!after) break;
  }
  return {
    perfil,
    posts: posts.map((p) => ({
      id: p.id,
      creador: perfil.username,
      pie: p.caption || '',
      fecha: (p.timestamp || '').slice(0, 10),
      url: p.permalink,
      likes: p.like_count ?? null,
      comentarios: p.comments_count ?? null,
      tipo: p.media_product_type === 'REELS' ? 'reel' : (p.media_type || '').toLowerCase(),
    })),
  };
}

/**
 * Convierte un token corto (1-2 h) en uno largo (60 días) y, a partir de él,
 * en el token de la Página, que no caduca. Business Discovery funciona con ambos.
 */
async function tokenSinCaducidad(appId) {
  const corto = process.env.FB_TOKEN;
  const largo = await (await fetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: process.env.FB_APP_SECRET,
    fb_exchange_token: corto,
  }))).json();
  if (!largo.access_token) throw new Error(`Intercambio de token: ${JSON.stringify(largo.error || largo)}`);
  const paginas = await (await fetch(`${GRAPH}/me/accounts?` + new URLSearchParams({
    fields: 'name,access_token,instagram_business_account{id,username}',
    access_token: largo.access_token,
  }))).json();
  const pag = (paginas.data || []).find((p) => p.instagram_business_account && p.instagram_business_account.id === IG_USER_ID)
    || (paginas.data || [])[0];
  return { usuario: largo.access_token, pagina: pag ? pag.access_token : null, nombrePagina: pag ? pag.name : null };
}

/** Saca el shortcode de un enlace de Instagram (/p/XXX/, /reel/XXX/). */
function shortcode(url) {
  const m = String(url || '').match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Uso de la API en la última hora (%), según la última respuesta. */
const usoApi = () => uso;

module.exports = { publicacionesDe, tokenSinCaducidad, shortcode, graph, usoApi, IG_USER_ID };
