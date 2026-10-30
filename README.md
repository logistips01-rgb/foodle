# 🍽️ Foodle

**Dónde comer según los foodies.** Un buscador por ciudad de las recomendaciones
que los foodies publican en Instagram: "¿dónde como en Zaragoza?" → salen las
publicaciones de los foodies sobre sitios de Zaragoza, insertadas tal cual, y
eliges tú.

Misma forma de trabajar que guitle: web estática, datos en JSON dentro del repo
y una actualización diaria con GitHub Actions. Sin servidor ni base de datos.

> Origen: la primera versión (YouTube + Firestore) nació en la rama `foodle` del
> repo Mootle. Ese historial se conserva aquí; el código de YouTube se retiró al
> pasar a Instagram (está en el historial de git).

---

## Cómo funciona

```
foodle/foodies.json ──► foodle/instagram.js ──► Business Discovery (API oficial de Meta)
foodle/manual.json  ──┐        │  pie, fecha, enlace, likes, comentarios
                      ▼        ▼
                 foodle/actualizar.js
                      │  foodle/reglas.js        ciudad, barrio, restaurante, cocina,
                      │  foodle/correcciones.json precio, nivel, publicidad
                      │  foodle/osm.js           dirección + coordenadas (OpenStreetMap)
                      ▼
   data/posts.json       todo lo leído (acumulado)
   data/foodle.json      lo que sale en la web
   data/pendientes.json  lo que las reglas no han sabido clasificar
                      ▼
   index.html  lee data/foodle.json y muestra cada publicación con el embed
               oficial de Instagram (blockquote + embed.js)
```

## Privacidad y legal (resumen)

- Los **pies no se publican**: `data/posts.json` va sin textos y los pies se guardan cifrados en `data/pies.enc`
  con una clave derivada de `FB_APP_SECRET` (`foodle/pies.js`). Sin la clave se usa la última clasificación guardada.
- **Instagram solo se carga con permiso**: hasta que la persona pulsa «Ver la publicación», la página no conecta con Meta.
- **Sin Google Fonts**: la fuente Inter se sirve desde `fuentes/`.
- **Sin opiniones inventadas**: no se muestran etiquetas tipo «Top» o «Mixto» deducidas por la máquina.
- `privacidad.html` y `aviso-legal.html`; lo pendiente está en `foodle/PENDIENTES.md`.

## Normas

- **Solo la API oficial de Meta.** Nada de scraping de instagram.com ni librerías
  no oficiales.
- **Solo cuentas profesionales** (creador/empresa): es lo que permite Business Discovery.
- **Nunca se descargan ni se resuben vídeos o fotos.** Se muestran con el embed
  oficial; si un foodie desactiva la inserción, queda solo el enlace.
- La API no da la ubicación: la ciudad y el restaurante salen del pie
  (📍, @menciones, #hashtags, barrios).
- Para abrir la web al público, Meta tiene que aprobar la app (App Review).
  Mientras, se pueden añadir publicaciones a mano en `foodle/manual.json`.

## Norma para los foodies

Igual en todas las ciudades: **que sea un foodie que publica de forma constante**.

1. **Cuenta profesional** (si no, la API no la lee).
2. **Constante:** ha publicado en cada uno de los últimos 3 meses (tramos de 30 días).
3. **Foodie:** habla de sitios o de comida (solo deja fuera cuentas que no son de comida).

La ciudad no es requisito: cada publicación se cataloga en la suya. En `foodies.json`, `ciudad` es solo una
pista para los pies que no dicen ninguna. Se comprueba con `node foodle/comprobar.js usuario1 usuario2 …`
(o `--lista` para los que ya están). La actualización diaria avisa (⚠️) de los que dejan de publicar con constancia.

## Archivos que se tocan a mano

| Archivo | Para qué |
|---|---|
| `foodle/foodies.json` | Lista de foodies: `[{ "usuario": "comerenzgz", "ciudad": "Zaragoza", "nota": "…" }]`. `ciudad` solo para los locales: se usa cuando el pie no dice ninguna (y no parece un viaje) |
| `foodle/manual.json` | Publicaciones sueltas: `[{ "url": "https://www.instagram.com/p/…/", "creador": "…", "nombre": "…", "ciudad": "Zaragoza" }]` (los campos que pongas mandan sobre las reglas) |
| `foodle/excluidos.json` | Creadores que han pedido salir: `["usuario"]`. Se borra todo lo suyo de `data/` en la siguiente actualización y no se vuelve a leer |
| `foodle/correcciones.json` | Arreglos por publicación (clave = código del enlace): `{ "ABC123": { "nombre": "Casa Pedro", "ciudad": "Zaragoza" }, "XYZ": { "oculta": true }, "QWE": { "visible": true } }` |

Si un fallo de las reglas se repite, se arregla en `foodle/reglas.js` en vez de
llenar las correcciones.

## Claves (nunca en el repo)

- `FB_TOKEN`: token de Facebook de la app (id 3318132571691612) con
  `instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
  `pages_read_engagement` y `business_management`.
- `FB_APP_SECRET`: clave secreta de la app (firma las llamadas).

**Token sin caducidad.** El token del Explorador dura 1-2 h. `tokenSinCaducidad()`
(foodle/instagram.js) lo cambia por uno largo y de ahí saca el **token de la Página**
de @arrocesdebandera, que no caduca (`expires_at: 0`). Ese es el que va en `FB_TOKEN`.
Ojo: Meta corta el acceso a datos 90 días después de la última vez que el usuario
autorizó la app (`data_access_expires_at`, se ve en el Depurador de tokens). Antes de
esa fecha hay que volver a sacar un token en el Explorador y repetir el cambio.

**Límite de uso.** Business Discovery con 50 publicaciones gasta ~4 % del límite
horario de la app por llamada (cabecera `x-app-usage`, campo `total_time`).
`graph()` frena al 80 % y, si llega al error #4, espera y reintenta, así que con
muchos foodies la tarea diaria tarda más, pero no falla.

**Menciones sin @.** Business Discovery devuelve los pies con las menciones sin
la @ ("Apunta fendo.restaurante , uno de…"). reglas.js las reconoce igualmente.

En GitHub van como **secretos del repositorio** (Settings → Secrets and
variables → Actions) para la tarea diaria. Las consultas se hacen desde la
cuenta profesional @arrocesdebandera (`IG_USER_ID` = 17841437741882903).

## Ejecutar

```bash
node foodle/actualizar.js            # 15 publicaciones por foodie (50 si es nuevo)
node foodle/actualizar.js 100        # más publicaciones
node foodle/actualizar.js --sin-osm  # sin OpenStreetMap
python3 -m http.server 8000          # ver la web en http://localhost:8000
```

Node 20+, sin dependencias.
