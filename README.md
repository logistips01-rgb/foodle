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

## Archivos que se tocan a mano

| Archivo | Para qué |
|---|---|
| `foodle/foodies.json` | Lista de foodies: `[{ "usuario": "cocituber", "nota": "…" }]` |
| `foodle/manual.json` | Publicaciones sueltas: `[{ "url": "https://www.instagram.com/p/…/", "creador": "…", "nombre": "…", "ciudad": "Zaragoza" }]` (los campos que pongas mandan sobre las reglas) |
| `foodle/correcciones.json` | Arreglos por publicación (clave = código del enlace): `{ "ABC123": { "nombre": "Casa Pedro", "ciudad": "Zaragoza" }, "XYZ": { "oculta": true }, "QWE": { "visible": true } }` |

Si un fallo de las reglas se repite, se arregla en `foodle/reglas.js` en vez de
llenar las correcciones.

## Claves (nunca en el repo)

- `FB_TOKEN`: token de Facebook de la app (id 3318132571691612) con
  `instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
  `pages_read_engagement` y `business_management`.
- `FB_APP_SECRET`: clave secreta de la app (firma las llamadas).

En GitHub van como **secretos del repositorio** (Settings → Secrets and
variables → Actions) para la tarea diaria. Las consultas se hacen desde la
cuenta profesional @arrocesdebandera (`IG_USER_ID` = 17841437741882903).

## Ejecutar

```bash
node foodle/actualizar.js            # 50 publicaciones por foodie
node foodle/actualizar.js 100        # más publicaciones
node foodle/actualizar.js --sin-osm  # sin OpenStreetMap
python3 -m http.server 8000          # ver la web en http://localhost:8000
```

Node 20+, sin dependencias.
