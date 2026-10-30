# Foodle · pendientes

Actualizado: 30/10/2026.

## Tuyo (antes de pedir la aprobación de Meta y de mover la web)

- [ ] **Datos del titular** (nombre o razón social, NIF y dirección) en `privacidad.html` y `aviso-legal.html`.
      Están como `[NOMBRE O RAZÓN SOCIAL] · [NIF] · [DIRECCIÓN]`. Pásamelos y los pongo.
- [ ] **Correo `hola@foodle.es`** que funcione (vale un reenvío a tu correo actual: redirección de DonDominio o ImprovMX).
- [ ] **Marca "Foodle"**: buscar en OEPM (consultas2.oepm.es/LocalizadorWeb) y TMview (tmdn.org/tmview) marcas en vigor
      en clases 43, 9 y 42. Hay varias empresas "Foodle" en el mundo (una app de pedidos que opera en España). Si está libre,
      plantearse registrarla.
- [ ] **Verificación del negocio** en el Business Manager de Meta y envío de la revisión (App Review) con `APP_REVIEW.md`.
- [ ] **Revisión por un abogado** antes del lanzamiento público (privacidad, aviso legal, uso de contenido de Instagram).
- [ ] **Historial de git con los pies antiguos**: hasta el 30/10 `data/posts.json` llevaba los textos completos. Ya no se
      publican en foodle.es, pero siguen en el historial del repositorio (público).
      **Decidido:** cuando empiece a haber tráfico, pasar a GitHub Pro y poner los repos en privado (Pages sigue
      funcionando con Pro). Antes de hacerlo, comprobar que foodle.es sigue viéndose tras el cambio.

## Mío / ideas

- [ ] Comprobar la **primera tarea diaria automática** (04:41 UTC): que termina con 64 foodies, token "PAGE · nunca",
      sin cortes por el límite de Meta.
- [ ] Unas **700 fichas sin nombre** del sitio (salen con el tipo de comida). Corregir a mano las importantes en
      `foodle/correcciones.json`.
- [ ] **Más foodies de Alcobendas / zona norte** (pedir nombres a la familia).
- [ ] **En curso:** Barcelona, Valencia, Bilbao y Sevilla (candidatos comprobados con la norma, barrios ya puestos).
- [ ] **Siguiente, por comunidad autónoma:** Cataluña (Girona, Tarragona, Lleida, Sitges, Reus, Sabadell, Terrassa…),
      Comunidad Valenciana (Alicante, Castellón, Elche, Benidorm, Dénia, Gandía…) y País Vasco (Donostia, Vitoria,
      Getxo, Zarautz…).
- [ ] **Después:** Navarra (Pamplona, Tudela…), Aragón completo (Huesca, Teruel, Jaca, Barbastro, Calatayud…),
      Cantabria (Santander, Laredo, Comillas…), Asturias (Oviedo, Gijón, Avilés, Cangas…) y Galicia (A Coruña, Vigo,
      Santiago, Pontevedra, Lugo, Ourense…).
- [ ] **Luego:** Andalucía (Sevilla ya en curso; Málaga, Granada, Córdoba, Cádiz, Jerez, Marbella, Almería,
      Huelva, Jaén…).
- [ ] **Famosos y recomendaciones** (más adelante).

## Hecho el 30/10 (revisión legal)

- Los pies ya no se publican: `data/posts.json` sin textos; van cifrados en `data/pies.enc` (`foodle/pies.js`).
- Instagram solo se carga si la persona pulsa «Ver la publicación» (sin cookies de Meta antes); se puede retirar.
- Fuente Inter servida desde foodle.es (sin Google Fonts).
- Página `aviso-legal.html` (LSSI) enlazada desde todas las páginas.
- Fuera las etiquetas de opinión automáticas (Top / Recomendado / Mixto); el orden es por «me gusta».
