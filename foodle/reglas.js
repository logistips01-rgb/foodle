'use strict';

/**
 * Foodle — clasificador por reglas (sin API de IA).
 *
 * Lee el pie de una publicación de Instagram y saca:
 *   - restaurante → línea "📍 …" o primera @mención que no sea el propio foodie
 *   - ciudad      → diccionario de ciudades (más peso si va en #hashtag o en la línea 📍)
 *   - zona        → barrios de las ciudades que los tienen (de momento Zaragoza)
 *   - cocina      → palabras clave
 *   - precio      → "€ por persona / menú / ticket" o palabras (barato, caro…)
 *   - nivel       → nota "x/10" o palabras (brutal, decepción…)
 *   - publi       → #publi, colaboración, invitación…
 *
 * Lo que las reglas no aciertan se corrige en foodle/correcciones.json, y si
 * un fallo se repite, se mejora aquí la regla.
 */

/* ───────────────────────── utilidades ───────────────────────── */

/** minúsculas y sin tildes, para comparar. */
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Nº de apariciones de `alias` como palabra completa en `texto` (ya normalizado). */
function cuenta(texto, alias) {
  const re = new RegExp(`(^|[^a-z0-9ñ])${escRe(alias)}(?=$|[^a-z0-9ñ])`, 'g');
  return (texto.match(re) || []).length;
}

/* ───────────────────────── ciudades ───────────────────────── */

// Nombre visible → alias (normalizados). Los hashtags se miran aparte (#zaragozafood…).
const CIUDADES = {
  Zaragoza: ['zaragoza', 'zgz', 'zaragozana', 'zaragozano'],
  Huesca: ['huesca'],
  Teruel: ['teruel'],
  Calatayud: ['calatayud'],
  Jaca: ['jaca'],
  Tarazona: ['tarazona'],
  Barbastro: ['barbastro'],
  Alcañiz: ['alcaniz'],
  Ejea: ['ejea de los caballeros', 'ejea'],
  Utebo: ['utebo'],
  Cuarte: ['cuarte de huerva'],
  Madrid: ['madrid'],
  Barcelona: ['barcelona', 'bcn'],
  Valencia: ['valencia'],
  Sevilla: ['sevilla'],
  Bilbao: ['bilbao'],
  'San Sebastián': ['san sebastian', 'donostia'],
  Málaga: ['malaga'],
  Logroño: ['logrono'],
  Pamplona: ['pamplona', 'iruna'],
  Alicante: ['alicante'],
  Murcia: ['murcia'],
  Granada: ['granada'],
  Córdoba: ['cordoba'],
  Valladolid: ['valladolid'],
  Salamanca: ['salamanca'],
  Santander: ['santander'],
  Oviedo: ['oviedo'],
  Gijón: ['gijon'],
  'A Coruña': ['a coruna', 'la coruna', 'coruna'],
  Vigo: ['vigo'],
  Palma: ['palma de mallorca'],
  Cádiz: ['cadiz'],
  Burgos: ['burgos'],
  León: ['leon'],
  Toledo: ['toledo'],
  Soria: ['soria'],
  Lleida: ['lleida', 'lerida'],
  Tarragona: ['tarragona'],
  Castellón: ['castellon'],
  Girona: ['girona'],
  'Vitoria': ['vitoria', 'gasteiz'],
};

// Barrios / zonas por ciudad. Solo se usan si la ciudad ya está decidida.
const BARRIOS = {
  Zaragoza: {
    'El Tubo': ['el tubo', 'eltubo'],
    'Casco Histórico': ['casco historico', 'casco viejo', 'casco antiguo'],
    'La Magdalena': ['la magdalena', 'magdalena'],
    'San Miguel': ['san miguel'],
    'El Gancho': ['el gancho', 'san pablo'],
    'Plaza del Pilar': ['plaza del pilar', 'el pilar'],
    'Independencia': ['paseo independencia', 'independencia'],
    'Sagasta': ['sagasta'],
    'Gran Vía': ['gran via'],
    'Romareda': ['romareda'],
    'Universidad': ['universidad'],
    'Delicias': ['delicias'],
    'Actur': ['actur'],
    'Las Fuentes': ['las fuentes'],
    'San José': ['san jose'],
    'Torrero': ['torrero'],
    'La Almozara': ['almozara'],
    'Oliver': ['oliver'],
    'Valdefierro': ['valdefierro'],
    'Valdespartera': ['valdespartera'],
    'Arcosur': ['arcosur'],
    'Rosales del Canal': ['rosales del canal'],
    'Montecanal': ['montecanal'],
    'Miralbueno': ['miralbueno'],
    'Parque Venecia': ['parque venecia'],
    'La Jota': ['la jota'],
    'Santa Isabel': ['santa isabel'],
    'Expo / Ranillas': ['ranillas', 'expo'],
  },
};

/* ───────────────────────── cocina ───────────────────────── */

const COCINAS = {
  Arroces: ['arroz', 'arroces', 'paella', 'paellas', 'arroz meloso', 'arroz negro', 'fideua'],
  Marisco: ['marisco', 'mariscos', 'marisqueria', 'gambas', 'gamba roja', 'langostinos', 'ostras', 'bogavante', 'centollo', 'percebes'],
  Pescado: ['pescado', 'pescados', 'merluza', 'rodaballo', 'besugo', 'lubina', 'bacalao'],
  Asador: ['asador', 'brasa', 'parrilla', 'chuleton', 'chuletones', 'chuleta', 'entrecot', 'lechazo', 'cochinillo'],
  Aragonesa: ['ternasco', 'migas', 'borrajas', 'aragonesa', 'aragones', 'cocina aragonesa', 'longaniza de graus'],
  Tapas: ['tapas', 'tapeo', 'tapa', 'pinchos', 'pintxos', 'raciones', 'vermut', 'vermu', 'croquetas'],
  Tradicional: ['tradicional', 'casero', 'casera', 'de cuchara', 'cocido', 'menu del dia', 'comida casera', 'guiso'],
  // Ojo: "gastronómico" a secas no vale (menús gastronómicos, propuestas gastronómicas…).
  'Alta cocina': ['michelin', 'estrella michelin', 'menu degustacion', 'soles repsol', 'sol repsol', 'alta cocina'],
  Hamburguesas: ['hamburguesa', 'hamburguesas', 'burger', 'burgers', 'smash'],
  Italiana: ['pizza', 'pizzas', 'pizzeria', 'pasta', 'trattoria', 'italiano', 'italiana', 'carbonara', 'burrata'],
  Japonesa: ['sushi', 'ramen', 'japones', 'japonesa', 'izakaya', 'nigiri', 'gyozas', 'udon'],
  Asiática: ['asiatico', 'asiatica', 'wok', 'dim sum', 'thai', 'tailandes', 'coreano', 'coreana', 'chino', 'vietnamita', 'bao'],
  Mexicana: ['tacos', 'taqueria', 'mexicano', 'mexicana', 'burrito', 'nachos'],
  Brunch: ['brunch', 'desayuno', 'desayunos', 'tostadas', 'pancakes', 'tortitas'],
  Dulce: ['pasteleria', 'tarta', 'tartas', 'cheesecake', 'helado', 'heladeria', 'churros', 'croissant', 'cruasan', 'pastel', 'dulces', 'cafeteria'],
  Bocadillos: ['bocadillo', 'bocadillos', 'bocata', 'bocatas', 'sandwich', 'sandwiches'],
  Vegetariana: ['vegano', 'vegana', 'vegetariano', 'vegetariana', 'plant based'],
  Internacional: ['peruano', 'peruana', 'ceviche', 'libanes', 'griego', 'griega', 'indio', 'india', 'argentino', 'venezolano', 'arepas'],
};

/* ───────────────────────── publicidad / nivel ───────────────────────── */

// Ojo: igual que en la versión de YouTube, solo cuenta si la publi es DEL LOCAL,
// no los patrocinios fijos del creador. Por eso no miramos "código descuento" a secas.
const PUBLI = [
  /#publi\b/, /#publicidad\b/, /#ad\b/, /#colab\b/, /#colaboracion\b/, /#sponsored\b/,
  /\bpublicidad\b/, /\bcolaboracion\b/, /\ben colaboracion con\b/,
  /\binvitacion\b/, /\bnos invitaron\b/, /\bnos han invitado\b/, /\bme invitaron\b/, /\binvitados por\b/,
  /\bpatrocinado\b/, /\bcontenido patrocinado\b/,
];

const NIVEL_TOP = ['brutal', 'espectacular', 'increible', 'el mejor', 'la mejor', 'los mejores', 'las mejores', 'imprescindible', 'top', 'de 10', 'joya', 'sitiazo', 'una pasada', 'buenisimo', 'buenisima'];
const NIVEL_MIX = ['regular', 'decepcion', 'decepcionante', 'flojo', 'floja', 'no repetiria', 'no volveria', 'no volveremos', 'mejorable', 'caro para lo que', 'normalito', 'no me convencio'];

/* ───────────────────────── extracción ───────────────────────── */

/** Handle de Instagram → nombre legible (casa_pedro.zgz → Casa Pedro). */
function nombreDeHandle(h) {
  let s = h.replace(/^@/, '').replace(/[._]+/g, ' ').trim();
  // Quita sufijos de ciudad típicos de los handles de restaurantes.
  s = s.replace(/\s+(zgz|zaragoza|huesca|teruel|madrid|bcn|restaurante|restaurantes|rest|oficial|official)$/i, '').trim();
  // restauranteelcandelas → Elcandelas, restaurantetxalupa → Txalupa (prefijo pegado).
  s = s.replace(/^(restaurante|restaurant|rte|bar|taberna)(?=[a-z]{4,}$)/i, '').trim();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "CANÍBAL ROYAL" → "Caníbal Royal" (los pies en mayúsculas se leen mal en la web). */
function sinMayusculas(s) {
  if (s !== s.toUpperCase() || !/\p{Lu}{3}/u.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a, c) => a + c.toUpperCase());
}

// La línea 📍 muchas veces es solo la dirección: entonces no es el nombre del local.
const ES_DIRECCION = /^(c\/|c\.|calle|cl\.|avda|av\.|avenida|pl\.|plaza|plza|paseo|p\.?º|pº|camino|ctra|carretera|trav|tr\.|ronda|andador|glorieta|cc |centro comercial|poligono|parque|pza)/;

/** Línea(s) de ubicación: "📍 Casa Pedro, Calle X, Zaragoza". */
function lineasUbicacion(pie) {
  return String(pie || '')
    .split(/\n/)
    .filter((l) => /📍|ubicacion:|direccion:|donde:/i.test(norm(l)) || l.includes('📍'))
    .map((l) => l.replace(/.*?(📍|ubicaci[oó]n:|direcci[oó]n:|d[oó]nde:)\s*/i, '').trim())
    // Fuera las que son una pregunta ("📍¿Con cuál empezarías tú?") o una fecha ("📍 26 SEPTIEMBRE · …").
    .filter((l) => l && !/^[¿?]/.test(l) && !/\?\s*$/.test(l) && !/^\d/.test(l));
}

// Palabras que, en minúscula y antes de una coma, NO son una cuenta de Instagram.
const NO_HANDLE = new Set(['pero', 'porque', 'aunque', 'tambien', 'ademas', 'entonces', 'verdad', 'claro', 'bueno', 'vale', 'mientras', 'despues', 'luego', 'ahora', 'siempre', 'nunca', 'gracias', 'zaragoza', 'madrid', 'huesca', 'teruel', 'espana', 'precio', 'precios', 'menu', 'carta', 'horario', 'ubicacion', 'direccion', 'reserva', 'reservas']);

/**
 * Cuentas de Instagram citadas en el pie.
 * Business Discovery devuelve los pies SIN la @ de las menciones ("Apunta fendo.restaurante , uno de…"),
 * así que además de "@cuenta" se reconocen:
 *   - palabras con punto o guion bajo por dentro: nativo_zgz, fendo.restaurante (no webs ni correos)
 *   - palabras en minúscula seguidas de " ," / " :" / " ." — el hueco que deja la mención quitada
 */
function menciones(pie) {
  const txt = String(pie || '');
  const out = [];
  const add = (h) => { h = h.replace(/\.+$/, ''); if (!out.some((x) => x.toLowerCase() === h.toLowerCase())) out.push(h); };
  const re = /(^|[^\p{L}\p{N}._@\/])(@?)([A-Za-z0-9._]{3,30})(?=([\s\S]{0,2}))/gu;
  let m;
  while ((m = re.exec(txt))) {
    const [, , arroba, h, sig] = m;
    if (arroba) { add('@' + h); continue; }
    if (/^[\d._]+$/.test(h) || /^www\./i.test(h) || /\.(com|es|net|org|eus|cat|info|shop)$/i.test(h)) continue;
    if (h !== h.toLowerCase()) continue;
    const interno = /[a-z0-9][._][a-z0-9]/.test(h);
    const hueco = /^ [,:]/.test(sig) && /^[a-z][a-z0-9._]{3,}$/.test(h) && !NO_HANDLE.has(h);
    if (interno || hueco) add('@' + h);
  }
  return out;
}

function detectarCiudad(pieN, ubicN, hashtags) {
  let mejor = null, mejorPuntos = 0;
  for (const [ciudad, alias] of Object.entries(CIUDADES)) {
    let p = 0;
    for (const a of alias) {
      p += cuenta(pieN, a);
      p += 2 * cuenta(ubicN, a);
      const sinEsp = a.replace(/\s+/g, '');
      p += 2 * hashtags.filter((h) => h === sinEsp || (sinEsp.length >= 4 && h.startsWith(sinEsp))).length;
    }
    if (p > mejorPuntos) { mejor = ciudad; mejorPuntos = p; }
  }
  return mejor;
}

function detectarBarrio(ciudad, texto) {
  const barrios = BARRIOS[ciudad];
  if (!barrios) return null;
  for (const [barrio, alias] of Object.entries(barrios)) {
    if (alias.some((a) => cuenta(texto, a) > 0)) return barrio;
  }
  return null;
}

function detectarCocina(texto) {
  let mejor = null, mejorPuntos = 0;
  for (const [cocina, palabras] of Object.entries(COCINAS)) {
    const p = palabras.reduce((s, w) => s + cuenta(texto, w), 0);
    if (p > mejorPuntos) { mejor = cocina; mejorPuntos = p; }
  }
  return mejor;
}

function rangoPrecio(euros) {
  if (euros < 15) return '€';
  if (euros < 30) return '€€';
  if (euros < 60) return '€€€';
  return '€€€€';
}

/** Precio por persona si el pie lo dice; si no, por palabras. */
function detectarPrecio(texto, pie = '') {
  // Línea "💰 29,90-35 €": el primer número es el precio por persona.
  const linea = String(pie).split(/\n/).find((l) => l.includes('💰'));
  const n0 = linea && linea.match(/(\d{1,3}(?:[.,]\d{1,2})?)/);
  if (n0) {
    const n = parseFloat(n0[1].replace(',', '.'));
    if (n > 0) return { precio: rangoPrecio(n), precio_aprox: `${n}€/persona` };
  }
  // "25€ por persona", "menú 18€", "salimos a 30 euros", "ticket medio 35€", "35€/pax"
  const re = /(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)\s*(?:\/|por|x)?\s*(persona|pers|pax|cabeza)?/g;
  let m, aprox = null;
  while ((m = re.exec(texto))) {
    const n = parseFloat(m[1].replace(',', '.'));
    const antes = texto.slice(Math.max(0, m.index - 30), m.index);
    if (m[2] || /(menu|ticket|salimos|salio|pagamos|por persona|precio medio|cada uno)/.test(antes)) {
      aprox = n;
      break;
    }
  }
  if (aprox != null) return { precio: rangoPrecio(aprox), precio_aprox: `${aprox}€/persona` };
  if (/(barato|economico|precio de risa|calidad.precio)/.test(texto)) return { precio: '€', precio_aprox: null };
  if (/(\bcaro\b|\bcara\b|de lujo|para una ocasion especial)/.test(texto)) return { precio: '€€€', precio_aprox: null };
  return { precio: null, precio_aprox: null };
}

function detectarNivel(texto) {
  const nota = texto.match(/(\d{1,2}(?:[.,]\d)?)\s*\/\s*10\b/);
  if (nota) {
    const n = parseFloat(nota[1].replace(',', '.'));
    if (n >= 9) return 'top';
    if (n >= 7) return 'rec';
    return 'mix';
  }
  const mix = NIVEL_MIX.reduce((s, w) => s + cuenta(texto, w), 0);
  const top = NIVEL_TOP.reduce((s, w) => s + cuenta(texto, w), 0);
  if (mix > top) return 'mix';
  if (top >= 2) return 'top';
  return 'rec';
}

/**
 * Clasifica una publicación.
 * @param {{pie:string, creador:string}} post
 * @returns ficha con nombre, ig_local, ciudad, zona, cocina, precio, precio_aprox, nivel, publi, tags
 */
function clasificar(post) {
  const pie = String(post.pie || '');
  const pieN = norm(pie);
  const ubic = lineasUbicacion(pie);
  const ubicN = norm(ubic.join(' \n '));
  const hashtags = (pieN.match(/#[a-z0-9ñ_]+/g) || []).map((h) => h.slice(1));
  const creador = norm(post.creador).replace(/^@/, '');

  // Restaurante: primero la línea 📍; si no, la primera @mención que no sea el foodie.
  const mencs = menciones(pie).filter((m) => norm(m.slice(1)) !== creador);
  const mencUbic = menciones(ubic.join(' '))[0] || null;
  let nombre = null, ig_local = null;
  if (mencUbic) {
    ig_local = mencUbic.slice(1);
    nombre = nombreDeHandle(mencUbic);
  } else if (ubic.length) {
    // "Nola Smoke. C. de Ildefonso…", "Las Foodtrucks: Parque San Pablo…" → lo de antes del corte.
    const primera = ubic[0].split(/[,(|·:–]|\s-\s|\.\s/)[0].replace(/[^\p{L}\p{N}' &.]/gu, '').replace(/\.$/, '').trim();
    // Si la línea 📍 solo dice la ciudad o es una dirección, no es un nombre.
    const pn = norm(primera);
    if (primera.length > 2 && !Object.values(CIUDADES).flat().includes(pn) && !ES_DIRECCION.test(norm(ubic[0]))) nombre = sinMayusculas(primera);
  }
  if (!ig_local && mencs.length) {
    ig_local = mencs[0].slice(1);
    if (!nombre) nombre = nombreDeHandle(mencs[0]);
  }

  const ciudad = detectarCiudad(pieN, ubicN, hashtags);
  const zona = ciudad ? detectarBarrio(ciudad, `${ubicN}\n${pieN}`) : null;
  const cocina = detectarCocina(pieN + ' ' + hashtags.join(' '));
  const { precio, precio_aprox } = detectarPrecio(pieN, pie);
  const nivel = detectarNivel(pieN);
  const publi = PUBLI.some((re) => re.test(pieN));

  const tags = [];
  if (publi) tags.push('📣 Publicidad');
  if (/(perro|pet friendly|petfriendly|dog friendly)/.test(pieN)) tags.push('pet-friendly');
  if (/(sin gluten|celiac|gluten free)/.test(pieN)) tags.push('Sin gluten');
  if (/michelin/.test(pieN)) tags.push('Michelin');

  return { nombre, ig_local, ciudad, zona, cocina, precio, precio_aprox, nivel, publi, tags };
}

module.exports = { clasificar, menciones, norm, CIUDADES, COCINAS };
