'use strict';

/**
 * Foodle — platos: de cada publicación de cocina saca el nombre del plato, la categoría, los ingredientes y
 * unas etiquetas (Saludable, Sin gluten, Keto, Rápida), para el buscador de foodle.es/recetas/.
 *
 * El texto del foodie NO se publica: el nombre del plato se compone con el vocabulario de este archivo
 * («Arroz de torreznos y huevo», «Merluza a la vasca»), nunca copiando frases del pie. La receta completa se ve
 * en la publicación de Instagram (inserción oficial).
 */

const { norm } = require('./reglas');

const CATEGORIAS = [
  'Postres', 'Arroces y paellas', 'Asados y carnes', 'Pescados y mariscos', 'Guisos y legumbres',
  'Pasta', 'Verduras y ensaladas', 'Sopas y cremas', 'Panes y masas',
];
const ETIQUETAS = ['Saludable', 'Sin gluten', 'Keto', 'Rápida'];

// Platos con nombre propio: [cómo se escribe, categoría, variantes (normalizadas, sin tildes)].
const PLATOS = [
  ['Merluza a la vasca', 'Pescados y mariscos', ['merluza a la vasca']],
  ['Merluza en salsa verde', 'Pescados y mariscos', ['merluza en salsa verde']],
  ['Bacalao al pil pil', 'Pescados y mariscos', ['bacalao al pil ?pil']],
  ['Bacalao a la vizcaína', 'Pescados y mariscos', ['bacalao a la vizcaina']],
  ['Bacalao con tomate', 'Pescados y mariscos', ['bacalao con tomate']],
  ['Pulpo a la gallega', 'Pescados y mariscos', ['pulpo a la gallega', 'pulpo a feira']],
  ['Gambas al ajillo', 'Pescados y mariscos', ['gambas al ajillo']],
  ['Mejillones a la marinera', 'Pescados y mariscos', ['mejillones a la marinera']],
  ['Calamares a la romana', 'Pescados y mariscos', ['calamares a la romana']],
  ['Chipirones en su tinta', 'Pescados y mariscos', ['chipirones en su tinta', 'calamares en su tinta']],
  ['Marmitako', 'Pescados y mariscos', ['marmitako']],
  ['Ceviche', 'Pescados y mariscos', ['ceviche']],
  ['Lubina a la sal', 'Pescados y mariscos', ['lubina a la sal', 'dorada a la sal']],
  ['Paella valenciana', 'Arroces y paellas', ['paella valenciana', 'paellita valenciana']],
  ['Paella de marisco', 'Arroces y paellas', ['paella de marisco']],
  ['Paella mixta', 'Arroces y paellas', ['paella mixta']],
  ['Arroz a banda', 'Arroces y paellas', ['arroz a banda']],
  ['Arroz negro', 'Arroces y paellas', ['arroz negro']],
  ['Arroz al horno', 'Arroces y paellas', ['arroz al horno']],
  ['Arroz del senyoret', 'Arroces y paellas', ['arroz del senyoret', 'arroz del senorito']],
  ['Arroz con bogavante', 'Arroces y paellas', ['arroz con bogavante', 'arroz de bogavante']],
  ['Fideuá', 'Arroces y paellas', ['fideua']],
  ['Risotto', 'Arroces y paellas', ['risotto']],
  ['Arroz con leche', 'Postres', ['arroz con leche']],
  ['Tortilla de patatas', 'Verduras y ensaladas', ['tortilla de patatas?', 'tortilla espanola']],
  ['Patatas bravas', 'Verduras y ensaladas', ['patatas bravas']],
  ['Huevos rotos', 'Verduras y ensaladas', ['huevos rotos']],
  ['Ensaladilla rusa', 'Verduras y ensaladas', ['ensaladilla( rusa)?']],
  ['Pisto', 'Verduras y ensaladas', ['pisto']],
  ['Escalivada', 'Verduras y ensaladas', ['escalivada']],
  ['Hummus', 'Verduras y ensaladas', ['hummus']],
  ['Guacamole', 'Verduras y ensaladas', ['guacamole']],
  ['Migas', 'Guisos y legumbres', ['migas (de pastor|extremenas|manchegas)']],
  ['Cocido madrileño', 'Guisos y legumbres', ['cocido madrileno']],
  ['Cocido', 'Guisos y legumbres', ['cocido']],
  ['Fabada', 'Guisos y legumbres', ['fabada']],
  ['Lentejas', 'Guisos y legumbres', ['lentejas']],
  ['Garbanzos', 'Guisos y legumbres', ['garbanzos']],
  ['Alubias', 'Guisos y legumbres', ['alubias', 'judias pintas', 'pochas']],
  ['Potaje', 'Guisos y legumbres', ['potaje']],
  ['Rancho', 'Guisos y legumbres', ['rancho']],
  ['Callos', 'Guisos y legumbres', ['callos']],
  ['Porrusalda', 'Guisos y legumbres', ['porrusalda']],
  ['Rabo de toro', 'Guisos y legumbres', ['rabo de toro']],
  ['Carrilleras', 'Guisos y legumbres', ['carrilleras?']],
  ['Albóndigas', 'Asados y carnes', ['albondigas']],
  ['Pollo al ajillo', 'Asados y carnes', ['pollo al ajillo']],
  ['Pollo asado', 'Asados y carnes', ['pollo asado']],
  ['Pollo al curry', 'Asados y carnes', ['pollo al curry']],
  ['Cordero asado', 'Asados y carnes', ['cordero asado', 'ternasco asado']],
  ['Cochinillo', 'Asados y carnes', ['cochinillo']],
  ['Costillas', 'Asados y carnes', ['costillas']],
  ['Carne mechada', 'Asados y carnes', ['carne mechada']],
  ['Hamburguesas', 'Asados y carnes', ['hamburguesas?']],
  ['Croquetas', 'Asados y carnes', ['croquetas']],
  ['Cachopo', 'Asados y carnes', ['cachopo']],
  ['Lasaña', 'Pasta', ['lasana']],
  ['Canelones', 'Pasta', ['canelones']],
  ['Espaguetis a la carbonara', 'Pasta', ['carbonara']],
  ['Macarrones', 'Pasta', ['macarrones']],
  ['Espaguetis', 'Pasta', ['espaguetis', 'spaghetti']],
  ['Ñoquis', 'Pasta', ['noquis', 'gnocchi']],
  ['Pasta', 'Pasta', ['pasta']],
  ['Gazpacho', 'Sopas y cremas', ['gazpacho']],
  ['Salmorejo', 'Sopas y cremas', ['salmorejo']],
  ['Ajoblanco', 'Sopas y cremas', ['ajoblanco']],
  ['Sopa de ajo', 'Sopas y cremas', ['sopa de ajo', 'sopa castellana']],
  ['Sopa de cebolla', 'Sopas y cremas', ['sopa de cebolla']],
  ['Caldo', 'Sopas y cremas', ['caldo']],
  ['Tarta de queso', 'Postres', ['tarta de queso', 'cheesecake']],
  ['Tiramisú', 'Postres', ['tiramisu']],
  ['Torrijas', 'Postres', ['torrijas']],
  ['Flan', 'Postres', ['flan']],
  ['Natillas', 'Postres', ['natillas']],
  ['Brownie', 'Postres', ['brownies?']],
  ['Cinnamon rolls', 'Postres', ['cinnamon rolls?', 'rollos de canela']],
  ['Bizcocho', 'Postres', ['bizcocho']],
  ['Galletas', 'Postres', ['galletas', 'cookies']],
  ['Dorayakis', 'Postres', ['dorayakis?']],
  ['Buñuelos', 'Postres', ['bunuelos']],
  ['Fisuelos', 'Postres', ['fisuelos']],
  ['Tartaletas', 'Postres', ['tartaletas?']],
  ['Palmeritas', 'Postres', ['palmeritas?', 'palmeras de hojaldre']],
  ['Mousse', 'Postres', ['mousse']],
  ['Helado', 'Postres', ['helado']],
  ['Crepes', 'Postres', ['crepes?', 'tortitas', 'pancakes']],
  ['Empanada', 'Panes y masas', ['empanada']],
  ['Empanadillas', 'Panes y masas', ['empanadillas']],
  ['Pizza', 'Panes y masas', ['pizzas?']],
  ['Focaccia', 'Panes y masas', ['focaccia']],
  ['Pan de molde', 'Panes y masas', ['pan de molde']],
  ['Pan casero', 'Panes y masas', ['pan casero', 'pan de masa madre', 'masa madre']],
  ['Brioche', 'Panes y masas', ['brioche']],
  ['Coca', 'Panes y masas', ['coca de (recapte|llardons|sant joan)']],
  ['Hojaldre', 'Panes y masas', ['hojaldre']],
  ['Tacos', 'Asados y carnes', ['tacos']],
];

// Platos que se completan con «de / con + ingrediente»: «Arroz de torreznos», «Crema de calabaza».
const BASES = [
  ['Arroz', 'Arroces y paellas', 'arroz(?: meloso| caldoso| seco| express)?'],
  ['Paella', 'Arroces y paellas', 'paella'],
  ['Risotto', 'Arroces y paellas', 'risotto'],
  ['Fideuá', 'Arroces y paellas', 'fideua'],
  ['Crema', 'Sopas y cremas', 'crema'],
  ['Sopa', 'Sopas y cremas', 'sopa'],
  ['Caldo', 'Sopas y cremas', 'caldo'],
  ['Puré', 'Sopas y cremas', 'pure'],
  ['Tarta', 'Postres', 'tarta'],
  ['Bizcocho', 'Postres', 'bizcocho'],
  ['Galletas', 'Postres', 'galletas'],
  ['Mousse', 'Postres', 'mousse'],
  ['Ensalada', 'Verduras y ensaladas', 'ensalada'],
  ['Crema', 'Sopas y cremas', 'vichyssoise'],
  ['Tortilla', 'Verduras y ensaladas', 'tortilla'],
  ['Revuelto', 'Verduras y ensaladas', 'revuelto'],
  ['Gratinado', 'Verduras y ensaladas', 'gratinado'],
  ['Croquetas', 'Asados y carnes', 'croquetas'],
  ['Hamburguesas', 'Asados y carnes', 'hamburguesas?'],
  ['Albóndigas', 'Asados y carnes', 'albondigas'],
  ['Guiso', 'Guisos y legumbres', 'guiso|guisado'],
  ['Estofado', 'Guisos y legumbres', 'estofado'],
  ['Potaje', 'Guisos y legumbres', 'potaje'],
  ['Lentejas', 'Guisos y legumbres', 'lentejas'],
  ['Garbanzos', 'Guisos y legumbres', 'garbanzos'],
  ['Alubias', 'Guisos y legumbres', 'alubias'],
  ['Pasta', 'Pasta', 'pasta'],
  ['Espaguetis', 'Pasta', 'espaguetis|spaghetti'],
  ['Macarrones', 'Pasta', 'macarrones'],
  ['Lasaña', 'Pasta', 'lasana'],
  ['Fideos', 'Pasta', 'fideos'],
  ['Pizza', 'Panes y masas', 'pizzas?'],
  ['Empanada', 'Panes y masas', 'empanada'],
  ['Pan', 'Panes y masas', 'pan'],
  ['Pastel', 'Panes y masas', 'pastel'],
  ['Quiche', 'Panes y masas', 'quiche'],
  ['Tacos', 'Asados y carnes', 'tacos'],
  ['Patatas', 'Verduras y ensaladas', 'patatas'],
  ['Hojaldre', 'Panes y masas', 'hojaldre'],
  ['Pollo', 'Asados y carnes', 'pollo'],
];

// Ingredientes: [cómo se escribe, categoría que sugiere (o null), variantes].
const INGREDIENTES = [
  ['merluza', 'Pescados y mariscos', ['merluza']], ['bacalao', 'Pescados y mariscos', ['bacalao']],
  ['salmón', 'Pescados y mariscos', ['salmon']], ['atún', 'Pescados y mariscos', ['atun', 'bonito']],
  ['lubina', 'Pescados y mariscos', ['lubina']],
  ['rape', 'Pescados y mariscos', ['rape']], ['sardinas', 'Pescados y mariscos', ['sardinas']],
  ['boquerones', 'Pescados y mariscos', ['boquerones']], ['gambas', 'Pescados y mariscos', ['gambas', 'gamba roja', 'carabineros']],
  ['langostinos', 'Pescados y mariscos', ['langostinos']], ['bogavante', 'Pescados y mariscos', ['bogavante']],
  ['pulpo', 'Pescados y mariscos', ['pulpo']], ['calamar', 'Pescados y mariscos', ['calamar(es)?', 'chipirones', 'sepia']],
  ['mejillones', 'Pescados y mariscos', ['mejillones']], ['almejas', 'Pescados y mariscos', ['almejas', 'berberechos']],
  ['marisco', 'Pescados y mariscos', ['marisco']], ['cigalas', 'Pescados y mariscos', ['cigalas']],
  ['pollo', 'Asados y carnes', ['pollo', 'alitas', 'contramuslos', 'pechuga']], ['pavo', 'Asados y carnes', ['pavo']],
  ['ternera', 'Asados y carnes', ['ternera', 'chuleton', 'entrecot', 'solomillo de ternera']],
  ['cerdo', 'Asados y carnes', ['cerdo', 'lomo', 'solomillo', 'secreto iberico', 'presa iberica', 'pluma iberica']],
  ['cordero', 'Asados y carnes', ['cordero', 'ternasco', 'ternasquito']], ['conejo', 'Asados y carnes', ['conejo']],
  ['pato', 'Asados y carnes', ['pato', 'magret']], ['faisán', 'Asados y carnes', ['faisan', 'perdiz', 'codorniz']],
  ['costillas', 'Asados y carnes', ['costillas']], ['carrilleras', 'Asados y carnes', ['carrilleras?']],
  ['torreznos', 'Asados y carnes', ['torreznos']], ['panceta', 'Asados y carnes', ['panceta', 'pancetta']],
  ['bacon', 'Asados y carnes', ['bacon', 'beicon']], ['chorizo', 'Asados y carnes', ['chorizo']],
  ['morcilla', 'Asados y carnes', ['morcilla']], ['jamón', 'Asados y carnes', ['jamon']],
  ['carne picada', 'Asados y carnes', ['carne picada']], ['foie', 'Asados y carnes', ['foie']],
  ['arroz', 'Arroces y paellas', ['arroz']],
  ['patatas', 'Verduras y ensaladas', ['patatas?']], ['boniato', 'Verduras y ensaladas', ['boniato']],
  ['calabaza', 'Verduras y ensaladas', ['calabaza']], ['calabacín', 'Verduras y ensaladas', ['calabacin']],
  ['berenjena', 'Verduras y ensaladas', ['berenjenas?']], ['alcachofas', 'Verduras y ensaladas', ['alcachofas?']],
  ['brócoli', 'Verduras y ensaladas', ['brocoli']], ['coliflor', 'Verduras y ensaladas', ['coliflor']],
  ['espinacas', 'Verduras y ensaladas', ['espinacas']], ['champiñones', 'Verduras y ensaladas', ['champinones', 'setas', 'boletus', 'niscalos']],
  ['pimientos', 'Verduras y ensaladas', ['pimientos?( de padron)?']], ['tomate', null, ['tomates?']],
  ['cebolla', null, ['cebolla']], ['puerro', 'Verduras y ensaladas', ['puerros?']], ['ajo', null, ['ajos?']],
  ['zanahoria', 'Verduras y ensaladas', ['zanahorias?']], ['aguacate', 'Verduras y ensaladas', ['aguacate']],
  ['espárragos', 'Verduras y ensaladas', ['esparragos']], ['judías verdes', 'Verduras y ensaladas', ['judias verdes']],
  ['guisantes', 'Verduras y ensaladas', ['guisantes']], ['castañas', null, ['castanas']],
  ['lentejas', 'Guisos y legumbres', ['lentejas']], ['garbanzos', 'Guisos y legumbres', ['garbanzos']],
  ['alubias', 'Guisos y legumbres', ['alubias', 'judias blancas', 'fabes']], ['quinoa', null, ['quinoa']],
  ['huevo', null, ['huevos?']], ['queso', null, ['queso', 'brie', 'provolone', 'mozzarella', 'parmesano', 'burrata']],
  ['nata', null, ['nata']], ['leche', null, ['leche']], ['yogur', null, ['yogur']],
  ['chocolate', 'Postres', ['chocolate', 'cacao']], ['manzana', 'Postres', ['manzanas?']],
  ['plátano', 'Postres', ['platanos?']], ['fresas', 'Postres', ['fresas']], ['limón', null, ['limon']],
  ['naranja', null, ['naranja']], ['piña', null, ['pina']], ['uva', null, ['uvas?']],
  ['canela', 'Postres', ['canela']], ['miel', null, ['miel']], ['almendra', null, ['almendras?']],
  ['nueces', null, ['nueces']], ['avena', null, ['avena']], ['harina', 'Panes y masas', ['harina']],
  ['masa madre', 'Panes y masas', ['masa madre']], ['hojaldre', 'Panes y masas', ['hojaldre']],
  ['masa filo', 'Panes y masas', ['masa filo']], ['tofu', null, ['tofu']], ['curry', null, ['curry']],
];

// Formas de cocinar que van detrás de un ingrediente: «Pollo al ajillo», «Bacalao a la vizcaína».
const ESTILOS = [
  ['a la vasca', 'a la vasca'], ['en salsa verde', 'en salsa verde'], ['al pil pil', 'al pil ?pil'],
  ['a la vizcaína', 'a la vizcaina'], ['a la gallega', 'a la gallega'], ['al ajillo', 'al ajillo'],
  ['a la plancha', 'a la plancha'], ['al horno', 'al horno'], ['a la cerveza', 'a la cerveza'],
  ['en salsa', 'en salsa'], ['al curry', 'al curry'], ['a la romana', 'a la romana'], ['en tempura', 'en tempura'],
  ['en freidora de aire', 'en (la )?freidora de aire|en (la )?air ?fryer'], ['asado', 'asad[oa]s?'],
  ['guisado', 'guisad[oa]s?'], ['rebozado', 'rebozad[oa]s?'], ['relleno', 'rellen[oa]s?'],
  ['gratinado', 'gratinad[oa]s?'], ['estofado', 'estofad[oa]s?'], ['en escabeche', 'en escabeche'],
  ['a la brasa', 'a la brasa'], ['confitado', 'confitad[oa]s?'],
];

const reB = (s) => new RegExp(`\\b(?:${s})\\b`);
const PLATOS_RE = PLATOS.map(([nombre, cat, vs]) => ({ nombre, cat, re: reB(vs.join('|')) }));
const ING_RE = INGREDIENTES.map(([nombre, cat, vs]) => ({ nombre, cat, re: reB(vs.join('|')), src: vs.join('|') }));
const ESTILO_SRC = ESTILOS.map(([, s]) => s).join('|');
const ING_SRC = ING_RE.map((i) => i.src).join('|');

// Palabras que delatan que la publicación habla de un sitio (no es una receta).
const SITIO = /(📍|\b(restaurante|fuimos a|hemos ido|visitamos|reserva|carta del|menu degustacion|chiringuito)\b)/i;
// Señales de receta en el pie (además del nombre del plato).
const RECETA = [
  /\bingredientes\b/, /\breceta\b/, /\b\d+\s?(g|gr|grs|gramos|ml|kg)\b/, /\bprecalienta/, /\bhorno a \d{3}/,
  /\b(paso a paso|elaboracion|preparacion)\b/, /\b(hech[oa]s?|cocinad[oa]s?) en casa\b/, /\bhoy (cocino|hacemos|os traigo)\b/,
  /\bfreidora de aire\b/, /\bthermomix\b/, /\b(cocemos|sofreimos|anadimos|horneamos|mezclamos|batimos|salteamos)\b/,
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ingDe = (txt) => ING_RE.find((i) => i.re.test(txt));

/** Título de la publicación: la primera línea con letras, sin hashtags ni menciones. */
function titulo(pie) {
  for (const l of String(pie || '').split('\n')) {
    const t = norm(l).replace(/[#@][\w.áéíóúñ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (/[a-z]{3}/.test(t)) return t;
  }
  return '';
}

/**
 * Compone el nombre del plato a partir del vocabulario (nunca copia el pie).
 * enPie: se busca en todo el pie (no en el título); entonces solo valen los nombres de varias palabras,
 * para no confundir «arroz cocido» con un cocido.
 */
function plato(txt, enPie = false) {
  // 1. Base + «de / con» + ingredientes: «Arroz de torreznos, pimientos y huevo». Gana la que sale antes.
  let mejor = null;
  for (const [nombre, cat, base] of BASES) {
    const m = new RegExp(`\\b(?:${base})\\b(?:\\s+\\w+)?\\s+(de|con|del)\\s+([^.!?¿¡\\n]{3,80})`).exec(txt);
    if (!m || (mejor && mejor.i <= m.index)) continue;
    const ings = [];
    for (const trozo of m[2].split(/,|\by\b|\bcon\b|\be\b/).slice(0, 4)) {
      const i = ingDe(trozo);
      if (!i || ings.includes(i.nombre) || i.nombre === norm(nombre)) continue;
      if (i.nombre === 'arroz' && cat === 'Arroces y paellas') continue;
      ings.push(i.nombre);
    }
    if (ings.length) {
      const lista = ings.length > 1 ? `${ings.slice(0, -1).join(', ')} y ${ings[ings.length - 1]}` : ings[0];
      mejor = { i: m.index, plato: `${nombre} ${m[1] === 'con' ? 'con' : 'de'} ${lista}`, cat };
    }
  }
  if (mejor) return { plato: mejor.plato, cat: mejor.cat };
  // 2. Platos con nombre propio: «Merluza a la vasca», «Fabada».
  const p = PLATOS_RE.find((x) => (!enPie || x.nombre.includes(' ')) && x.re.test(txt));
  if (p) return { plato: p.nombre, cat: p.cat };
  // 3. Ingrediente + forma de cocinarlo: «Pollo al ajillo», «Castañas en freidora de aire».
  const m = txt.match(new RegExp(`\\b(${ING_SRC})\\s+(${ESTILO_SRC})\\b`));
  if (m) {
    const i = ingDe(m[1]);
    const e = ESTILOS.find(([, s]) => reB(s).test(m[2]));
    if (i && e) return { plato: cap(`${i.nombre} ${e[0]}`), cat: i.cat };
  }
  if (enPie) return null;
  // 4. La base sola: «Risotto», «Tarta».
  for (const [nombre, cat, base] of BASES) if (reB(base).test(txt)) return { plato: nombre, cat };
  return null;
}

/**
 * Clasifica una publicación como receta. Devuelve null si no lo parece.
 * opciones.cocinero: la cuenta es de recetas (basta con que se reconozca el plato y no hable de un sitio).
 */
function clasificarReceta(pie, { cocinero = false } = {}) {
  const pieN = norm(pie);
  if (!pieN.trim()) return null;
  const tit = titulo(pie);
  const señales = RECETA.filter((re) => re.test(pieN)).length;
  if (SITIO.test(pie) && señales < 2) return null;
  const p = plato(tit) || (señales ? plato(pieN.slice(0, 600), true) : null);
  if (!p && !señales) return null;
  if (!cocinero && señales === 0) return null;

  const ingredientes = [];
  for (const i of ING_RE) if (i.re.test(pieN) && ingredientes.length < 12) ingredientes.push(i.nombre);
  // Categoría: la del plato; si no, la que más sugieren los ingredientes del título y del pie.
  let categoria = p ? p.cat : null;
  if (!categoria) {
    const votos = {};
    for (const i of ING_RE) if (i.cat && i.re.test(tit)) votos[i.cat] = (votos[i.cat] || 0) + 3;
    for (const i of ING_RE) if (i.cat && i.re.test(pieN)) votos[i.cat] = (votos[i.cat] || 0) + 1;
    categoria = Object.entries(votos).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }
  if (!p && !categoria) return null;
    // Sin plato reconocido: «Receta con…» el ingrediente del título que encaja con la categoría.
  const principal = ING_RE.find((i) => i.re.test(tit) && i.cat === categoria) || ING_RE.find((i) => i.re.test(tit))
    || ING_RE.find((i) => i.re.test(pieN) && i.cat === categoria);
  const nombre = p ? p.plato : (principal ? `Receta con ${principal.nombre}` : null);
  if (!nombre) return null;

  const etiquetas = [];
  if (/\b(saludable|sana|sano|healthy|fit|light|ligera|ligero)\b/.test(pieN)) etiquetas.push('Saludable');
  if (/\b(sin gluten|gluten free|celiac\w*)\b/.test(pieN)) etiquetas.push('Sin gluten');
  if (/\b(keto|low ?carb|cetogenic\w*)\b/.test(pieN)) etiquetas.push('Keto');
  if (/\b(rapid[oa]|express|en (5|10|15|20) minutos|en un momento)\b/.test(pieN)) etiquetas.push('Rápida');
  return { plato: nombre, categoria, ingredientes, etiquetas };
}

module.exports = { clasificarReceta, CATEGORIAS, ETIQUETAS };
