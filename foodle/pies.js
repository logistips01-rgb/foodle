'use strict';

/**
 * Foodle — los pies (textos) de las publicaciones, guardados CIFRADOS.
 *
 * La web solo necesita lo que sacan las reglas (sitio, ciudad, cocina…) y el enlace a Instagram, así que
 * los textos de los foodies no se publican. Pero hay que conservarlos para volver a clasificar el histórico
 * cuando mejoran las reglas (la API solo da lo reciente). Por eso van en data/pies.enc, cifrados con
 * AES-256-GCM y una clave derivada de FB_APP_SECRET: en el repo y en foodle.es son ilegibles.
 *
 * Sin FB_APP_SECRET no se pueden leer ni escribir; actualizar.js usa entonces la última clasificación guardada.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const ARCHIVO = path.join(__dirname, '..', 'data', 'pies.enc');

function clave() {
  const secreto = String(process.env.FB_APP_SECRET || '').trim();
  return secreto ? crypto.createHash('sha256').update(`foodle-pies:${secreto}`).digest() : null;
}

/** Devuelve { id: pie } o null si no hay clave (o el archivo es de otra clave). */
function cargar() {
  const k = clave();
  if (!k) return null;
  let sobre;
  try { sobre = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); } catch (_) { return {}; }
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(sobre.iv, 'base64'));
    d.setAuthTag(Buffer.from(sobre.tag, 'base64'));
    const plano = Buffer.concat([d.update(Buffer.from(sobre.datos, 'base64')), d.final()]);
    return JSON.parse(zlib.gunzipSync(plano).toString('utf8'));
  } catch (_) {
    console.log('  ⚠️  data/pies.enc no se puede descifrar con esta FB_APP_SECRET: se empieza de cero.');
    return {};
  }
}

/** Guarda { id: pie } cifrado. Sin clave no hace nada. */
function guardar(pies) {
  const k = clave();
  if (!k) return false;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const datos = Buffer.concat([c.update(zlib.gzipSync(JSON.stringify(pies))), c.final()]);
  fs.writeFileSync(ARCHIVO, JSON.stringify({
    v: 1, nota: 'Pies de Instagram cifrados (AES-256-GCM). Ver foodle/pies.js.',
    iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), datos: datos.toString('base64'),
  }) + '\n');
  return true;
}

module.exports = { cargar, guardar };
