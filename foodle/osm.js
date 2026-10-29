'use strict';

/**
 * Foodle — enriquecido con OpenStreetMap (Nominatim).
 *
 * Busca dirección y coordenadas de cada restaurante (gratis, sin API key):
 *   - lat, lng   → para "cómo llegar"
 *   - direccion  → calle + localidad
 *
 * Respeta la norma de Nominatim: 1 consulta/segundo y User-Agent identificativo.
 * Guarda los resultados (también los "no encontrado") en data/osm.json para no
 * repetir consultas cada día.
 */

const fs = require('fs');
const path = require('path');

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const HEADERS = {
  // Nominatim exige identificar la aplicación.
  'User-Agent': 'Foodle/1.0 (agregador de restaurantes; github.com/logistips01-rgb/foodle)',
  'Accept-Language': 'es',
};
const CACHE_FILE = path.join(__dirname, '..', 'data', 'osm.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clave = (nombre, ciudad) => `${String(nombre).toLowerCase()}|${String(ciudad).toLowerCase()}`;

async function geocodificar(nombre, ciudad, dirPie = null) {
  // La dirección del pie (📍 Av. de Juan Carlos I, 44, 50009 Zaragoza) acierta mucho más que el
  // nombre: los locales pequeños casi nunca están en OpenStreetMap por su nombre.
  const intentos = [
    ...(dirPie ? [dirPie.toLowerCase().includes(String(ciudad).toLowerCase()) ? `${dirPie}, España` : `${dirPie}, ${ciudad}, España`] : []),
    `${nombre}, ${ciudad}, España`,
    `${nombre} ${ciudad}`,
  ];
  for (const q of intentos) {
    const url = new URL(NOMINATIM);
    url.search = new URLSearchParams({
      q, format: 'json', limit: '1', addressdetails: '1', countrycodes: 'es',
    });
    let data;
    try {
      const r = await fetch(url, { headers: HEADERS });
      data = await r.json();
    } catch (_) { data = null; }
    await sleep(1100); // 1 req/seg (con margen)
    if (Array.isArray(data) && data.length) {
      const hit = data[0];
      const a = hit.address || {};
      const loc = a.city || a.town || a.village || a.municipality || '';
      // Si el resultado cae en otra ciudad, es un falso positivo: mejor sin mapa.
      if (loc && ciudad && !loc.toLowerCase().includes(ciudad.toLowerCase().split(' ')[0])) continue;
      const calle = [a.road, a.house_number].filter(Boolean).join(' ');
      const direccion = [calle, loc || ciudad].filter(Boolean).join(', ') || (hit.display_name || '').split(',').slice(0, 2).join(',');
      return { lat: Number(hit.lat), lng: Number(hit.lon), direccion };
    }
  }
  return null;
}

/**
 * Añade lat/lng/direccion a las fichas que tengan nombre y ciudad.
 * Como mucho `max` consultas nuevas por ejecución (el resto, mañana): ~1 s cada una.
 */
async function enriquecer(fichas, max = 150) {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (_) { cache = {}; }
  let nuevas = 0;
  for (const f of fichas) {
    if (!f.nombre || !f.ciudad) continue;
    // Con dirección en el pie, la clave es la dirección (un mismo nombre puede tener varios locales).
    const k = f.dir_pie ? clave(f.dir_pie, f.ciudad) : clave(f.nombre, f.ciudad);
    if (!(k in cache)) {
      if (nuevas >= max) continue;
      cache[k] = await geocodificar(f.nombre, f.ciudad, f.dir_pie);
      nuevas++;
    }
    if (cache[k]) Object.assign(f, cache[k]);
    else if (f.dir_pie) f.direccion = f.dir_pie; // sin mapa, pero al menos la dirección escrita
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
  return nuevas;
}

module.exports = { enriquecer, geocodificar };
