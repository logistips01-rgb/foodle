# Foodle · material para la revisión de Meta (App Review)

App: **3318132571691612** · Cuenta desde la que se consulta: **@arrocesdebandera** (IG 17841437741882903)

## Lo que Meta pide en la configuración de la app (Configuración → Básica)

| Campo | Valor |
|---|---|
| URL de la política de privacidad | `https://foodle.es/privacidad.html` (mientras no esté el dominio: `https://logistips01-rgb.github.io/foodle/privacidad.html`) |
| Instrucciones de eliminación de datos | `https://foodle.es/privacidad.html#borrado` |
| Icono de la app (1024×1024) | `img/icono-1024.png` |
| Categoría | Comida y bebida (o «Estilo de vida») |
| Correo de contacto | `hola@foodle.es` (comprobar que existe y se lee) |

Antes de enviar: rellenar el **Responsable** (nombre o razón social, NIF y dirección) en `privacidad.html`,
y tener hecha la **verificación del negocio** en el Business Manager (Meta la exige para el acceso avanzado).

## Permisos y para qué se usa cada uno

Texto para pegar en cada permiso (en inglés también, Meta lo acepta en ambos idiomas):

**instagram_basic**
> Foodle es un buscador de recomendaciones de restaurantes por ciudad. Usamos instagram_basic, junto con
> Business Discovery, para leer las publicaciones públicas (pie, fecha, enlace y número de me gusta y
> comentarios) de una lista cerrada de cuentas profesionales de creadores gastronómicos. Con el pie deducimos
> la ciudad, el restaurante y el tipo de cocina, y mostramos cada publicación con el embed oficial de Instagram
> y un enlace a la original. No descargamos ni volvemos a publicar fotos ni vídeos.

**instagram_manage_insights**
> Business Discovery requiere este permiso. Solo leemos los recuentos públicos de me gusta y comentarios de
> las publicaciones de esas cuentas profesionales, para ordenar las recomendaciones. No leemos estadísticas
> privadas de ninguna cuenta.

**pages_show_list / pages_read_engagement / business_management**
> Necesarios para obtener el token de la Página de Facebook vinculada a nuestra cuenta profesional de
> Instagram (@arrocesdebandera), que es desde la que se hacen las consultas de Business Discovery. Solo
> accedemos a nuestra propia Página.

## Vídeo (screencast) — guion de 1-2 minutos

1. Abrir el Explorador de la API Graph con la app de Foodle y mostrar la consulta
   `17841437741882903?fields=business_discovery.username(comerenzgz){media{caption,permalink,timestamp,like_count}}`
   y su respuesta.
2. Abrir `https://foodle.es`, buscar «arroces» o pulsar el botón Pizza.
3. Enseñar una tarjeta: el embed oficial de Instagram y el enlace «Ver la publicación… en Instagram».
4. Bajar al pie de la web y abrir «Privacidad y borrado de datos».

## A tener en cuenta

- La app funciona hoy en **modo desarrollo** porque solo la usa su administrador. Para abrir la web al público
  con estos datos, Meta pide **acceso avanzado** a los permisos de arriba (revisión + verificación del negocio).
- Si un creador pide salir: añadirlo a `foodle/excluidos.json`. En la siguiente actualización se borra todo lo
  suyo y no se vuelve a leer.
