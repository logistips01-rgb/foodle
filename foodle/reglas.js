'use strict';

/**
 * Foodle — clasificador por reglas (sin API de IA).
 *
 * Lee el pie de una publicación de Instagram y saca:
 *   - restaurante → línea "📍 …" o primera @mención que no sea el propio foodie
 *   - ciudad      → diccionario de ciudades (más peso si va en #hashtag o en la línea 📍)
 *   - zona        → barrios de las ciudades que los tienen (Zaragoza y Madrid)
 *   - cocina      → palabras clave (pizza, sushi, kebab, hamburguesas…)
 *   - local       → tipo de sitio: bar de tapas, a la carta, menú del día, degustación, cafetería…
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
  // Área metropolitana de Madrid (ver PERTENECE): si el pie nombra el municipio, gana a "Madrid".
  Alcobendas: ['alcobendas', 'la moraleja', 'moraleja', 'soto de la moraleja', 'arroyo de la vega', 'valdelasfuentes'],
  'San Sebastián de los Reyes': ['sanse', 'san sebastian de los reyes'],
  'Tres Cantos': ['tres cantos'],
  'Pozuelo': ['pozuelo de alarcon', 'pozuelo'],
  'Las Rozas': ['las rozas'],
  Majadahonda: ['majadahonda'],
  Boadilla: ['boadilla del monte', 'boadilla'],
  Getafe: ['getafe'],
  'Leganés': ['leganes'],
  'Alcorcón': ['alcorcon'],
  'Móstoles': ['mostoles'],
  Fuenlabrada: ['fuenlabrada'],
  'Alcalá de Henares': ['alcala de henares'],
  'Torrejón': ['torrejon de ardoz', 'torrejon'],
  Rivas: ['rivas vaciamadrid', 'rivas'],
  'Colmenar Viejo': ['colmenar viejo'],
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

// Municipio → ciudad grande a la que pertenece. "Restaurante en Alcobendas, Madrid" es Alcobendas.
const PERTENECE = Object.fromEntries(['Alcobendas', 'San Sebastián de los Reyes', 'Tres Cantos', 'Pozuelo', 'Las Rozas',
  'Majadahonda', 'Boadilla', 'Getafe', 'Leganés', 'Alcorcón', 'Móstoles', 'Fuenlabrada', 'Alcalá de Henares', 'Torrejón',
  'Rivas', 'Colmenar Viejo'].map((c) => [c, 'Madrid']));

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
  // Ojo con los alias cortos: "sol" casaría con "sol Repsol"; por eso "puerta del sol".
  Madrid: {
    'Malasaña': ['malasana', 'plaza del dos de mayo'],
    'Chueca': ['chueca'],
    'Lavapiés': ['lavapies', 'embajadores'],
    'La Latina': ['la latina', 'cava baja', 'cava alta'],
    'Sol': ['puerta del sol'],
    'Barrio de las Letras': ['barrio de las letras', 'huertas', 'plaza de santa ana'],
    'Austrias': ['madrid de los austrias', 'plaza mayor', 'mercado de san miguel'],
    'Ópera': ['plaza de oriente', 'barrio de opera'],
    'Gran Vía': ['gran via'],
    'Conde Duque': ['conde duque'],
    'Salamanca': ['barrio de salamanca', 'goya', 'serrano', 'velazquez', 'jorge juan', 'ortega y gasset'],
    'Chamberí': ['chamberi', 'ponzano', 'trafalgar', 'rios rosas', 'alonso cano'],
    'Retiro': ['el retiro', 'barrio del retiro', 'parque del retiro', 'ibiza', 'nino jesus'],
    'Argüelles / Moncloa': ['arguelles', 'moncloa'],
    'Tetuán': ['tetuan', 'bravo murillo'],
    'Chamartín': ['chamartin', 'prosperidad', 'castellana'],
    'Arganzuela': ['arganzuela', 'matadero', 'legazpi', 'delicias'],
    'Usera': ['usera'],
    'Carabanchel': ['carabanchel'],
    'Vallecas': ['vallecas'],
  },
  Alcobendas: {
    'La Moraleja': ['la moraleja', 'moraleja', 'soto de la moraleja'],
    'Arroyo de la Vega': ['arroyo de la vega'],
    'Valdelasfuentes': ['valdelasfuentes'],
    'Fuentelucha': ['fuentelucha'],
    'Diversia': ['diversia'],
    'Río Norte': ['rio norte'],
    'Centro': ['centro de alcobendas', 'calle marques de la valdavia', 'plaza del pueblo'],
  },
};

/* ───────────────────────── cocina ───────────────────────── */

const COCINAS = {
  Arroces: ['arroz', 'arroces', 'arroceria', 'arrocerias', 'paella', 'paellas', 'paellera', 'arroz meloso', 'arroz negro', 'arroz caldoso', 'arroz al horno', 'a banda', 'senyoret', 'socarrat', 'fideua', 'fideuas'],
  Marisco: ['marisco', 'mariscos', 'marisqueria', 'gambas', 'gamba roja', 'langostinos', 'ostras', 'bogavante', 'centollo', 'percebes'],
  Pescado: ['pescado', 'pescados', 'merluza', 'rodaballo', 'besugo', 'lubina', 'bacalao'],
  // Chuletón y torreznos van aparte: son de lo más buscado. Si empatan con Brasa, gana el chuletón.
  'Chuletón': ['chuleton', 'chuletones', 'txuleta', 'txuleton', 'chuleta de vaca', 'vaca vieja', 'vaca madurada', 'carne madurada', 'dry aged', 'entrecot', 'lomo alto', 'lomo bajo', 'ojo de bife'],
  Torreznos: ['torrezno', 'torreznos', 'torreznitos', 'torrezno de soria'],
  Brasa: ['asador', 'brasa', 'brasas', 'braseria', 'parrilla', 'parrillada', 'lechazo', 'cochinillo', 'cordero asado', 'carne a la brasa'],
  Aragonesa: ['ternasco', 'migas', 'borrajas', 'aragonesa', 'aragones', 'cocina aragonesa', 'longaniza de graus'],
  Tapas: ['tapas', 'tapeo', 'tapa', 'pinchos', 'pintxos', 'raciones', 'vermut', 'vermu', 'croquetas'],
  Tradicional: ['tradicional', 'casero', 'casera', 'de cuchara', 'cocido', 'comida casera', 'guiso'],
  // Ojo: "gastronómico" a secas no vale (menús gastronómicos, propuestas gastronómicas…).
  'Alta cocina': ['michelin', 'estrella michelin', 'menu degustacion', 'soles repsol', 'sol repsol', 'alta cocina'],
  Hamburguesas: ['hamburguesa', 'hamburguesas', 'burger', 'burgers', 'smash'],
  // La pizza va aparte de la italiana: es lo que la gente busca ("¿dónde hay buena pizza?").
  Pizza: ['pizza', 'pizzas', 'pizzeria', 'pizzerias', 'napolitana', 'focaccia'],
  Italiana: ['pasta', 'trattoria', 'italiano', 'italiana', 'carbonara', 'burrata', 'risotto', 'lasana', 'tiramisu'],
  'Sushi y japonesa': ['sushi', 'ramen', 'japones', 'japonesa', 'izakaya', 'nigiri', 'nigiris', 'gyozas', 'udon', 'omakase', 'nikkei', 'uramaki', 'makis', 'sashimi'],
  Kebab: ['kebab', 'kebabs', 'kebap', 'doner', 'durum', 'shawarma', 'falafel'],
  Asiática: ['asiatico', 'asiatica', 'wok', 'dim sum', 'thai', 'tailandes', 'coreano', 'coreana', 'chino', 'vietnamita', 'bao'],
  Mexicana: ['tacos', 'taqueria', 'mexicano', 'mexicana', 'burrito', 'nachos'],
  Brunch: ['brunch', 'desayuno', 'desayunos', 'tostadas', 'pancakes', 'tortitas'],
  Dulce: ['pasteleria', 'tarta', 'tartas', 'cheesecake', 'helado', 'heladeria', 'churros', 'croissant', 'cruasan', 'pastel', 'dulces'],
  Bocadillos: ['bocadillo', 'bocadillos', 'bocata', 'bocatas', 'sandwich', 'sandwiches'],
  Vegetariana: ['vegano', 'vegana', 'vegetariano', 'vegetariana', 'plant based'],
  Internacional: ['peruano', 'peruana', 'ceviche', 'libanes', 'griego', 'griega', 'indio', 'india', 'argentino', 'venezolano', 'arepas'],
};

/* ───────────────────────── tipo de local ───────────────────────── */

// Qué clase de sitio es (independiente de la cocina). En orden de prioridad: gana el
// primero que aparezca, salvo "Restaurante a la carta", que es lo que queda por defecto.
const LOCALES = [
  ['Buffet libre', ['buffet', 'bufet', 'bufe', 'buffet libre', 'bufet libre', 'all you can eat', 'tenedor libre', 'barra libre de sushi']],
  ['Menú degustación', ['menu degustacion', 'menu largo', 'menu corto', 'pases', 'omakase', 'estrella michelin', 'soles repsol', 'sol repsol']],
  ['Menú del día', ['menu del dia', 'menu diario', 'menu de mediodia', 'menu de diario', 'menu entre semana', 'menu de la semana']],
  ['Street food', ['food truck', 'foodtruck', 'food trucks', 'foodtrucks', 'gastroneta', 'gastronetas', 'street food', 'streetfood', 'puesto', 'mercado']],
  ['Para llevar', ['para llevar', 'take away', 'takeaway', 'a domicilio', 'delivery', 'glovo', 'just eat', 'uber eats']],
  ['Cafetería', ['cafeteria', 'cafeterias', 'cafe de especialidad', 'brunch', 'desayuno', 'desayunos', 'merienda', 'pasteleria', 'obrador', 'heladeria']],
  ['Bar de tapas', ['bar', 'bares', 'barra', 'tapas', 'tapeo', 'pinchos', 'pintxos', 'vermut', 'vermu', 'taberna', 'tasca', 'raciones', 'cerveceria']],
];

function detectarLocal(texto) {
  for (const [local, palabras] of LOCALES) {
    if (palabras.some((w) => cuenta(texto, w) > 0)) return local;
  }
  if (/(restaurante|carta|reserva|cena|comida|comer)/.test(texto)) return 'Restaurante a la carta';
  return null;
}

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
const ES_DIRECCION = /^(c\/|c\.|calle|cl\.|avda|av\.|avenida|pl\.|plaza|plza|paseo|p\.?º|pº|camino|ctra|carretera|trav|tr\.|ronda|andador|glorieta|cc |centro comercial|poligono|parque|pza|carrer|placa|passeig|avinguda|rua|rúa|kalea)/;

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
  // "San Sebastián de los Reyes" contiene "San Sebastián" (Donostia): se cambia por "sanse" antes de contar.
  const sanse = (t) => t.replace(/san sebastian de los reyes/g, 'sanse');
  pieN = sanse(pieN); ubicN = sanse(ubicN);
  hashtags = hashtags.map((h) => h.replace(/^sansebastiandelosreyes/, 'sanse'));
  const puntos = {};
  for (const [ciudad, alias] of Object.entries(CIUDADES)) {
    let p = 0;
    for (const a of alias) {
      p += cuenta(pieN, a);
      p += 2 * cuenta(ubicN, a);
      const sinEsp = a.replace(/\s+/g, '');
      p += 2 * hashtags.filter((h) => h === sinEsp || (sinEsp.length >= 4 && h.startsWith(sinEsp))).length;
    }
    if (p > 0) puntos[ciudad] = p;
  }
  let mejor = null, mejorPuntos = 0;
  for (const [c, p] of Object.entries(puntos)) if (p > mejorPuntos) { mejor = c; mejorPuntos = p; }
  // Si gana la ciudad grande pero se nombra uno de sus municipios, el municipio es más preciso.
  const hijos = Object.entries(puntos).filter(([c]) => PERTENECE[c] === mejor).sort((a, b) => b[1] - a[1]);
  if (hijos.length) mejor = hijos[0][0];
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
    // Los arroces pesan el doble: "paella de marisco con gambas y langostinos" es un arroz, no marisco.
    const p = palabras.reduce((s, w) => s + cuenta(texto, w), 0) * (cocina === 'Arroces' ? 2 : 1);
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
 * @param {{ciudadPorDefecto?:string}} opciones  ciudad del foodie, si es local (foodies.json → "ciudad")
 * @returns ficha con nombre, ig_local, ciudad, zona, dir_pie, cocina, local, precio, precio_aprox, nivel, publi, tags
 */
// Palabras que indican viaje o que el sitio está fuera: entonces no se supone la ciudad del foodie.
const FUERA = new RegExp('\\b(?:' + [
  'gastroviaje', 'viaje', 'excursion', 'escapada', 'ruta por', 'road trip', 'pueblo', 'pirineo',
  'navarra', 'asturias', 'cantabria', 'galicia', 'andalucia', 'cataluna', 'euskadi', 'pais vasco', 'la rioja', 'castilla',
  'valencia', 'madrid', 'barcelona', 'portugal', 'francia', 'italia', 'alemania', 'munich', 'londres', 'paris', 'roma',
  'nueva york', 'japon', 'mexico', 'dominicana',
  // …ni si es un producto de supermercado, que no es ningún sitio.
  'supermercado', 'en el super', 'del super', 'mercadona', 'lidl', 'carrefour', 'alcampo', 'eroski', 'aldi', 'unide',
].join('|') + ')(?:s|es)?\\b');

function clasificar(post, { ciudadPorDefecto = null } = {}) {
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
  // "📍 santabelindabrasa / Av. de Juan Carlos I…": la primera palabra suelta, en minúscula y sin
  // espacios, es la cuenta del local con la @ quitada.
  const suelta = !mencUbic && ubic.length && (ubic[0].match(/^([a-z0-9][a-z0-9._]{3,29})(?:\s*(?:[\/,·|–-]|$)|\s+en\s|\s+(?=[A-ZÁÉÍÓÚÑ0-9]))/) || [])[1];
  if (suelta && !NO_HANDLE.has(suelta) && !Object.values(CIUDADES).flat().includes(suelta)) {
    ig_local = suelta;
    nombre = nombreDeHandle(suelta);
  } else if (mencUbic) {
    ig_local = mencUbic.slice(1);
    nombre = nombreDeHandle(mencUbic);
  } else if (ubic.length) {
    // "Nola Smoke. C. de Ildefonso…", "Las Foodtrucks: Parque San Pablo…" → lo de antes del corte.
    const primera = ubic[0].split(/[,(|·:–/]|\s-\s|\.\s/)[0].replace(/[^\p{L}\p{N}' &.]/gu, '').replace(/\.$/, '').trim();
    // Si la línea 📍 solo dice la ciudad o es una dirección, no es un nombre.
    const pn = norm(primera);
    // Un nombre de local no pasa de 5 palabras: si es más largo, es una frase ("Síguenos para no perderte…").
    // Y si empieza en minúscula y tiene espacios, también ("guárdalo bien porque…").
    const esFrase = primera.split(/\s+/).length > 5 || /^\p{Ll}\S*\s/u.test(primera);
    if (primera.length > 2 && !esFrase && !Object.values(CIUDADES).flat().includes(pn) && !ES_DIRECCION.test(norm(ubic[0]))) nombre = sinMayusculas(primera);
  }
  if (!ig_local && mencs.length) {
    ig_local = mencs[0].slice(1);
    if (!nombre) nombre = nombreDeHandle(mencs[0]);
  }

  // Dirección escrita en la línea 📍 (calle + nº o código postal): para OpenStreetMap y para la tarjeta.
  let dir_pie = null;
  for (const l of ubic) {
    const trozos = l.split(/\s[\/|·–-]\s|\.\s(?=\p{Lu})|,\s*/u);
    const i = trozos.findIndex((t) => ES_DIRECCION.test(norm(t.trim())) || /\b\d{5}\b/.test(t));
    if (i >= 0) { dir_pie = trozos.slice(i).join(', ').replace(/[.\s]+$/, '').trim().slice(0, 120); break; }
  }

  let ciudad = detectarCiudad(pieN, ubicN, hashtags);
  const cocina = detectarCocina(pieN + ' ' + hashtags.join(' '));
  // Foodie local que no escribe su ciudad ("FOODVERZO y su propuesta 360…"): se supone la suya,
  // salvo que el pie no hable de ningún sitio o parezca un viaje.
  if (!ciudad && ciudadPorDefecto && (nombre || ig_local || cocina) && !FUERA.test(pieN)) ciudad = ciudadPorDefecto;
  const zona = ciudad ? detectarBarrio(ciudad, `${ubicN}\n${pieN}`) : null;
  const local = detectarLocal(pieN);
  const { precio, precio_aprox } = detectarPrecio(pieN, pie);
  const nivel = detectarNivel(pieN);
  const publi = PUBLI.some((re) => re.test(pieN));

  const tags = [];
  if (publi) tags.push('Publicidad');
  if (/(perro|pet friendly|petfriendly|dog friendly)/.test(pieN)) tags.push('pet-friendly');
  if (/(sin gluten|celiac|gluten free)/.test(pieN)) tags.push('Sin gluten');
  if (/michelin/.test(pieN)) tags.push('Michelin');

  return { nombre, ig_local, ciudad, zona, dir_pie, cocina, local, precio, precio_aprox, nivel, publi, tags };
}

module.exports = { clasificar, menciones, norm, CIUDADES, COCINAS, LOCALES, PERTENECE };
