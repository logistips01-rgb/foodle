# Foodle · pendientes

Actualizado: 30/10/2026.

## Tuyo (antes de pedir la aprobación de Meta y de mover la web)

- [x] **Titular** en `privacidad.html` y `aviso-legal.html`: Manuel Lorente Gálvez, NIF 17747339X, Calle Allué Salvador 22,
      50830 Villanueva de Gállego (Zaragoza) (30/10).
- [x] **Correo de contacto:** foodle@guitle.com (30/10).
- [ ] **Marca (baja prioridad, si Foodle crece):** en la OEPM hay **"STREET FOODLE"** (M3623345, mixta, clases 35 y 43,
      titular Estefanía Alegre Moreno, en vigor, concedida en 2017). Solicitada hacia junio-julio de 2016: venció hacia
      junio-julio de 2026 y está en los 6 meses de gracia. **Volver a mirar en febrero de 2027:** si pone caducada,
      registrar "Foodle" en 35, 43, 42 y 9. Si se quiere registrar ya: clases 42 y 9.
      Ojo: el ".es" no cuenta para distinguir la marca.
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
- [x] Barcelona, Valencia, Bilbao y Sevilla cargadas (30/10).
- [ ] **Criterio (31/10):** primero que haya representación en todas las ciudades, fase a fase; después una pasada
      buscando foodies nuevos para completar las flojas (Sabadell, Terrassa, Lleida, Reus, Pamplona, Logroño…).
- [ ] **Siguiente, por comunidad autónoma:** Cataluña (Girona, Tarragona, Lleida, Sitges, Reus, Sabadell, Terrassa…),
      Comunidad Valenciana (Alicante, Castellón, Elche, Benidorm, Dénia, Gandía…) y País Vasco (Donostia, Vitoria,
      Getxo, Zarautz…).
- [ ] **Después:** Navarra (Pamplona, Tudela…), La Rioja (Logroño, Haro, Calahorra…), Aragón completo (Huesca, Teruel, Jaca, Barbastro, Calatayud…),
      Cantabria (Santander, Laredo, Comillas…), Asturias (Oviedo, Gijón, Avilés, Cangas…) y Galicia (A Coruña, Vigo,
      Santiago, Pontevedra, Lugo, Ourense…).
- [ ] **Luego:** Andalucía (Sevilla ya en curso; Málaga, Granada, Córdoba, Cádiz, Jerez, Marbella, Almería,
      Huelva, Jaén…) y Murcia (Murcia, Cartagena, Lorca…).
- [ ] **Luego:** las Castillas: Castilla y León (Valladolid, Burgos, León, Salamanca, Segovia, Soria, Ávila…) y
      Castilla-La Mancha (Toledo, Cuenca, Albacete, Ciudad Real, Guadalajara…).
- [ ] **Luego:** Extremadura (Badajoz, Cáceres, Mérida, Plasencia…), las islas (Baleares: Palma, Ibiza, Menorca;
      Canarias: Las Palmas, Santa Cruz de Tenerife, Lanzarote, Fuerteventura…) y Ceuta y Melilla.
- [ ] **Famosos y recomendaciones** (más adelante).
- [ ] **Sección de recetas** (decidido el 30/10). Separada de los sitios, con su propio buscador:
      «merluza a la vasca» → las publicaciones de los foodies que la han cocinado (vídeo con la inserción oficial).
      - Categorías: Postres, Arroces y paellas, Asados y carnes, Pescados y mariscos, Guisos y legumbres, Pasta,
        Verduras y ensaladas, Sopas y cremas, Panes y masas; etiquetas Saludable, Sin gluten, Keto, Rápida.
      - Fuentes: las cuentas de recetas (hoy en `excluidos.json`: pasarlas a una lista propia `recetas.json`, hay que
        volver a leerlas), @arrocesdebandera como cuenta propia destacada y marcada así, y las recetas sueltas de los
        foodies de sitios (las que hoy separa la regla `CASA`).
      - Norma de entrada para cocineros: constantes (3 tramos de 30 días) y que publiquen recetas.
      - El texto no se publica: se saca el nombre del plato, la categoría y los ingredientes para buscar; la receta
        se ve en la publicación de Instagram.
      - Añadir el caso de uso a APP_REVIEW.md antes de pedir la revisión de Meta.

## Hecho el 30/10 (revisión legal)

- Los pies ya no se publican: `data/posts.json` sin textos; van cifrados en `data/pies.enc` (`foodle/pies.js`).
- Instagram solo se carga si la persona pulsa «Ver la publicación» (sin cookies de Meta antes); se puede retirar.
- Fuente Inter servida desde foodle.es (sin Google Fonts).
- Página `aviso-legal.html` (LSSI) enlazada desde todas las páginas.
- Fuera las etiquetas de opinión automáticas (Top / Recomendado / Mixto); el orden es por «me gusta».
