'use strict';

/**
 * Foodle — clasificador por reglas (sin API de IA).
 *
 * Lee el pie de una publicación de Instagram y saca:
 *   - restaurante → línea "📍 …" o primera @mención que no sea el propio foodie
 *   - ciudad      → diccionario de ciudades (más peso si va en #hashtag o en la línea 📍)
 *   - zona        → barrios de las ciudades que los tienen (Zaragoza, Madrid, Barcelona, Valencia, Bilbao, Sevilla…)
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
  // Áreas metropolitanas de Barcelona, Bilbao y Sevilla (ver PERTENECE).
  "L'Hospitalet": ['hospitalet', "l'hospitalet", 'hospitalet de llobregat'],
  Badalona: ['badalona'],
  'Sant Cugat': ['sant cugat'],
  Getxo: ['getxo', 'algorta', 'neguri'],
  Barakaldo: ['barakaldo', 'baracaldo'],
  'Dos Hermanas': ['dos hermanas'],
  'Mairena del Aljarafe': ['mairena del aljarafe'],
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
Object.assign(PERTENECE,
  { "L'Hospitalet": 'Barcelona', Badalona: 'Barcelona', 'Sant Cugat': 'Barcelona' },
  { Getxo: 'Bilbao', Barakaldo: 'Bilbao' },
  { 'Dos Hermanas': 'Sevilla', 'Mairena del Aljarafe': 'Sevilla' });

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
  Barcelona: {
    'Gràcia': ['gracia', 'vila de gracia'],
    'Eixample': ['eixample', "l'eixample", 'ensanche', 'passeig de gracia', 'rambla de catalunya', 'enric granados'],
    'El Born': ['el born', 'born'],
    'Gòtic': ['barri gotic', 'barrio gotico', 'gotic', 'gotico'],
    'El Raval': ['raval', 'el raval'],
    'Barceloneta': ['barceloneta'],
    'Poble-sec': ['poble sec', 'poble-sec', 'poblesec', 'blai'],
    'Sant Antoni': ['sant antoni'],
    'Poblenou': ['poblenou', 'poble nou'],
    'Sants': ['sants'],
    'Les Corts': ['les corts'],
    'Sarrià - Sant Gervasi': ['sarria', 'sant gervasi'],
    'Sagrada Família': ['sagrada familia'],
    'Horta - Guinardó': ['horta', 'guinardo'],
  },
  Valencia: {
    'Ruzafa': ['ruzafa', 'russafa'],
    'El Carmen': ['barrio del carmen', 'el carmen', 'el carme'],
    'Ciutat Vella': ['ciutat vella', 'mercado central', 'plaza de la virgen', 'lonja'],
    'Cabanyal - Malvarrosa': ['cabanyal', 'el cabanyal', 'malvarrosa', 'patacona'],
    'Benimaclet': ['benimaclet'],
    'Ensanche': ['ensanche', 'eixample', 'pla del remei', 'colon'],
    'Campanar': ['campanar'],
    'Patraix': ['patraix'],
    'Benimámet / Burjassot': ['benimamet', 'burjassot'],
    'El Saler / Albufera': ['el saler', 'albufera', 'el palmar'],
  },
  Bilbao: {
    'Casco Viejo': ['casco viejo', 'zazpi kaleak', 'siete calles', 'plaza nueva', 'plaza berria'],
    'Bilbao La Vieja': ['bilbao la vieja', 'san francisco'],
    'Indautxu': ['indautxu', 'indautxo'],
    'Abando': ['abando', 'gran via de bilbao', 'ledesma'],
    'Deusto': ['deusto'],
    'Santutxu': ['santutxu'],
    'Ribera': ['mercado de la ribera', 'la ribera'],
  },
  Sevilla: {
    'Triana': ['triana', 'calle betis', 'betis'],
    'Alameda': ['alameda de hercules', 'alameda'],
    'Santa Cruz': ['barrio de santa cruz', 'santa cruz'],
    'Arenal': ['el arenal', 'arenal'],
    'Alfalfa': ['alfalfa'],
    'Feria / Macarena': ['calle feria', 'macarena', 'feria'],
    'Nervión': ['nervion'],
    'Los Remedios': ['los remedios'],
    'San Bernardo': ['san bernardo'],
    'Centro': ['plaza nueva de sevilla', 'calle sierpes', 'sierpes', 'tetuan'],
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
// Comida hecha en casa (recetas, la comida de la abuela…): no es un sitio al que ir, no sale en la web.
// Solo cuenta si el pie no tiene línea 📍: un restaurante puede presumir de "la receta de la abuela".
const CASA = [
  /\bingredientes\s*(:|\(\s*(\d|para)|\n|para\b)/,
  /\b\d+\s?(g|gr|grs|ml|kg)\s+de\s/,
  /\bprecalienta/,
  /\bhorno a \d{3}/,
  /\b(te dejo|aqui (te dejo|tienes)|guarda(te)?|apunta(te)?) (esta|la|mi) receta/,
  /\breceta (facil|facilisima|sencilla|casera|rapida|saludable)/,
  /\b(cocinando|comiendo|cocinamos|comemos|cocina) con (mi|la) (abuela|yaya|iaia|amama|madre|mama)\b/,
  /\b(hech[oa]s?|cocinad[oa]s?|preparad[oa]s?) en casa\b/,
  /\bhoy cocino\b/,
  /\ben mi cocina\b/,
];
// …salvo que hable de un sitio: "fuimos a…", "el restaurante…", un evento de hamburguesas.
const EN_UN_SITIO = /\b(restaurantes?|local|bar|taberna|cafeteria|hamburgueseria|fuimos|visitamos|hemos ido|nos pasamos|thechampions\w*|sorteo|reserva|encargo|lavapies|carrer|calle)\b/;

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
  // lacuchararestaurante → Lacuchara (el sufijo también va pegado a veces).
  s = s.replace(/(?<=^[a-z]{4,})(restaurante|restaurant|madrid|zaragoza|zgz)$/i, '').trim();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "CANÍBAL ROYAL" → "Caníbal Royal" (los pies en mayúsculas se leen mal en la web). */
function sinMayusculas(s) {
  if (s !== s.toUpperCase() || !/\p{Lu}{3}/u.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a, c) => a + c.toUpperCase());
}

// La línea 📍 muchas veces es solo la dirección: entonces no es el nombre del local.
const ES_DIRECCION = /^(c\/|c\.|calle|cl\.|avda|av\.|avenida|pl\.|plaza|plza|paseo|p\.?º|pº|camino|ctra|carretera|trav|tr\.|ronda|andador|glorieta|cc |centro comercial|poligono|parque|pza|carrer|placa|passeig|avinguda|rua|rúa|kalea|carr\b|carr\.|pasadizo|pasaje|cuesta|costanilla|callejon|bulevar|urbanizacion|via )/;

/** Línea(s) de ubicación: "📍 Casa Pedro, Calle X, Zaragoza". */
// Un nombre propio lleva en mayúscula todas sus palabras salvo los enlaces ("Taberna de la Tienta");
// "Entre sus best seller encontramos" o "Antes éramos 11 en casa" son frases, no nombres.
const ENLACES = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', '&', 'en', 'by', 'da', 'do', 'di', 'le', 'a']);
function esNombrePropio(t) {
  return String(t).split(/\s+/).filter(Boolean).every((w) => ENLACES.has(w.toLowerCase()) || /^[\p{Lu}\d]/u.test(w));
}

// Palabras que a veces salen como "nombre" y no lo son.
const NO_NOMBRE = new Set(['donde', 'aqui', 'hoy', 'este', 'esta', 'nuevo', 'nueva', 'el sitio', 'sitio', 'restaurante',
  'bar', 'ubicacion', 'direccion', 'precio', 'menu', 'carta', 'reserva', 'horario', 'publi', 'publicidad',
  'comida', 'cena', 'comer', 'almuerzo', 'desayuno', 'merienda', 'vermut', 'planazo', 'ruta', 'guia',
  'probamos', 'probe', 'pruebo', 'probando', 'fuimos', 'estuvimos', 'descubrimos', 'nuevo sitio', 'sitiazo', 'brutal', 'top',
  ...Object.keys(COCINAS).map(norm)]);

/** Cuando no hay 📍 con nombre: otras formas habituales de decir el sitio. */
function nombreSinUbicacion(pie) {
  const lineas = String(pie || '').split(/\n/).map((l) => l.trim()).filter(Boolean);
  const limpio = (t) => t.replace(/[^\p{L}\p{N}' &.-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const pareceNombre = (t) => t && t.length >= 3 && t.length <= 40 && t.split(' ').length <= 5 && /^\p{Lu}/u.test(t)
    && !NO_NOMBRE.has(norm(t)) && esNombrePropio(t);
  // 1. "Churrería San Ginés 📍 Pasadizo de San Ginés, 5": lo de antes del 📍 en la misma línea.
  for (const l of lineas) {
    const i = l.indexOf('📍');
    if (i > 0) { const t = limpio(l.slice(0, i)); if (pareceNombre(t)) return sinMayusculas(t); }
  }
  // 2. "🍽️ Colósimo" / "🍴 Casa Pepe": línea propia con el emoji de restaurante.
  for (const l of lineas) {
    const m = l.match(/^(?:🍽️?|🍴)\s*(.+)$/u);
    if (m) {
      const t = limpio(m[1]);
      if (/^[a-z0-9][a-z0-9._]{3,29}$/.test(t)) return nombreDeHandle(t);
      if (pareceNombre(t)) return sinMayusculas(t);
    }
  }
  // 3. Entre comillas: el mejor torrezno de Madrid “Taberna La Tienta”.
  const q = String(pie).match(/[“"«]([^”"»\n]{3,40})[”"»]/);
  if (q && pareceNombre(limpio(q[1]))) return sinMayusculas(limpio(q[1]));
  // 4. La cuenta del local sola en una línea ("lacuchararestaurante") o en una lista ("1: barpadraocops …").
  for (const l of lineas) {
    const m = l.replace(/^[^\p{L}\p{N}]+/u, '').match(/^(?:\d+\s*[:.)-]\s*)?([a-z0-9][a-z0-9._]{3,29})(?:\s|$)/);
    if (m && (m[0].trim() === l.replace(/^[^\p{L}\p{N}]+/u, '').trim() || /^\d/.test(l.replace(/^[^\p{L}\p{N}]+/u, ''))) && !NO_HANDLE.has(m[1])) return nombreDeHandle(m[1]);
  }
  // 5. Primera línea "🌯 Kevabrö": emoji y un nombre corto (1-3 palabras), nada más.
  const p = lineas[0] && lineas[0].match(/^\p{Extended_Pictographic}[\uFE0F\s]*([\p{L}\p{N}' &.-]{3,30})$/u);
  if (p) { const t = limpio(p[1]); if (pareceNombre(t) && t.split(' ').length <= 3 && t !== t.toUpperCase()) return t; }
  return null;
}

function lineasUbicacion(pie) {
  return String(pie || '')
    .split(/\n/)
    .filter((l) => /📍|ubicacion:|direccion:|donde:/i.test(norm(l)) || l.includes('📍'))
    // "📍 Dónde: Calle X" → "Calle X" (se quitan todas las etiquetas seguidas, no solo la primera).
    .map((l) => l.replace(/^.*?(?:📍|ubicaci[oó]n:|direcci[oó]n:|d[oó]nde:)(?:\s*(?:📍|ubicaci[oó]n:|direcci[oó]n:|d[oó]nde:|[:\-–]))*\s*/i, '').trim())
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
    // Y si acaba en número de portal ("José Hierro 17B"), es una dirección sin "Calle" delante.
    const esFrase = primera.split(/\s+/).length > 5 || /^\p{Ll}\S*\s/u.test(primera) || /\s\d{1,4}[a-zA-Z]?$/.test(primera);
    if (primera.length > 2 && !esFrase && !Object.values(CIUDADES).flat().includes(pn) && !ES_DIRECCION.test(norm(ubic[0]))) nombre = sinMayusculas(primera);
  }
  if (!nombre) nombre = nombreSinUbicacion(pie);
  if (!ig_local && mencs.length) {
    ig_local = mencs[0].slice(1);
    if (!nombre) nombre = nombreDeHandle(mencs[0]);
  }
  // Nunca un nombre que es una palabra suelta de relleno, una cocina o una ciudad.
  if (nombre && (NO_NOMBRE.has(norm(nombre)) || /^\d/.test(nombre))) nombre = null;

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
  const enLocal = ig_local && new RegExp(`\\b(en|por|a|al|de) @?${ig_local.replace(/[.]/g, '\\.')}`).test(pieN);
  const casa = !ubic.length && !enLocal && CASA.some((re) => re.test(pieN)) && !EN_UN_SITIO.test(pieN);

  const tags = [];
  if (publi) tags.push('Publicidad');
  if (/(perro|pet friendly|petfriendly|dog friendly)/.test(pieN)) tags.push('pet-friendly');
  if (/(sin gluten|celiac|gluten free)/.test(pieN)) tags.push('Sin gluten');
  if (/michelin/.test(pieN)) tags.push('Michelin');

  return { nombre, ig_local, ciudad, zona, dir_pie, cocina, local, precio, precio_aprox, nivel, publi, casa, tags };
}

module.exports = { clasificar, menciones, norm, CIUDADES, COCINAS, LOCALES, PERTENECE };
