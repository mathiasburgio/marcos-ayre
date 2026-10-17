# Arquitectura y convenciones observadas

Este documento describe el código disponible al 4 de octubre de 2026. Sirve como referencia para los próximos cambios. Cuando una práctica aparece solo en un archivo, se indica como observación y no como regla universal.

## Estado del repositorio

Es una aplicación en construcción. `package.json` declara Node.js con CommonJS, Express 5, sesiones, MySQL (`mysql2`) y Socket.IO, además de EJS y otras dependencias. El frontend propio está en `public/resources/`; `public/resources/cdn/` contiene copias de bibliotecas externas. `CAJA FINAL.xlsm` parece ser un archivo de referencia; no hay código que lo consuma en este checkout.

```text
routes/                 rutas HTTP y middleware de acceso
controllers/            lógica de cada ruta (solo usuarios.js está presente)
utils/                  middleware de permisos y límite de peticiones
models/bd.sql           archivo presente, vacío
public/resources/*.js   utilidades propias para el navegador
public/resources/cdn/   bibliotecas de terceros locales
```

No hay `main.js` (aunque figura como `main` en `package.json`), `views/`, `utils/db.js` ni los controladores que importan la mayoría de las rutas. `routes/resumen.js` está vacío. `controllers/usuarios.js` aparece como archivo local sin seguimiento de Git al hacer este relevamiento. Por eso no se puede ejecutar ni confirmar el flujo completo de la aplicación con este checkout. El script `npm test` solo imprime que no hay pruebas configuradas.

## Cómo está organizado el backend

- Cada archivo en `routes/` crea un `express.Router()`, importa un controlador por dominio y exporta el router con `module.exports`.
- Las rutas declaran el control de acceso en línea mediante `permisos({login, admin, esServidor, resp})`. `login` exige `req.session.data`; `admin` exige `req.session.data.esAdmin`; `esServidor` exige `req.session.data.esServidor`. Si una opción se omite o es `false`, no aplica esa restricción. `resp` decide si la denegación HTTP 403 se devuelve como `{error: ...}` o texto. `routes/inicio.js` usa además `rateLimit({windowMs, max})` para la página inicial.
- Las rutas separan páginas HTML (`getHTML`) de operaciones o listados JSON (`listado`, `nuevo`, `modificar`, `eliminar`, etc.). Se usan rutas de acción como `/productos/nuevo` y `/usuarios/eliminar`, generalmente con POST, más que un diseño REST estricto.
- El controlador disponible, `controllers/usuarios.js`, usa funciones nombradas y las exporta en un objeto. Lee `req.body`/`req.params`, consulta la base, devuelve `res.status(...).json(...)` o `sendFile(...)`, y usa `try/catch` con un mensaje de error legible para el usuario. Las consultas SQL mostradas usan parámetros `?`.
- El código mantiene nombres de dominio en español (`usuarios`, `mesas`, `ventas`, `productos`) y mensajes visibles en español. Usa comillas dobles, indentación de cuatro espacios, punto y coma de manera flexible, `const`/`let` y funciones flecha para callbacks. No hay formateador ni linter configurado.

### Interfaces HTTP presentes

| Archivo | Rutas declaradas | Observación |
| --- | --- | --- |
| `routes/index.js` | `/`, `/login`, `/logout` | Inicio público, login y logout; controlador faltante. |
| `routes/usuarios.js` | `/usuarios`, `/usuarios/listado`, acciones de alta, cambio, baja y contraseña | Página y escritura para admin; listado para usuario autenticado. |
| `routes/productos.js` | `/productos`, `/productos/listado`, acciones de alta, cambio y baja | Página y escritura para admin; listado para usuario autenticado. |
| `routes/mesas.js` | `/mesas/listado`, `/mesas/editar`, `/mesas/cobrar` | Autenticación requerida; controlador faltante. |
| `routes/ventas.js` | `/ventas`, `/ventas/concretar`, `/ventas/buscar` | Permisos definidos por ruta; controlador faltante. |
| `routes/evento.js` | `/eventos` y acciones de alta, cambio y cierre | Todas exigen admin; controlador faltante. |
| `routes/resumen.js` | ninguna | Archivo vacío. |

Las rutas son rutas **dentro de cada router**. No está el archivo que los monta, por lo que el prefijo HTTP final todavía no se puede afirmar.

## Patrón general del frontend

El JavaScript propio del navegador usa clases declaradas en scripts clásicos, sin módulos ES ni bundler visible. Las instancias globales esperadas se llaman, entre otras, `modal`, `menu`, `utils` y `numberFormatter`; la aplicación debe cargar las bibliotecas y crear las instancias antes de usar los recursos que dependen de ellas. No hay una vista en este checkout que confirme el orden de carga completo.

Los componentes usan jQuery para seleccionar elementos, enlazar eventos y generar HTML; Bootstrap 4 y AdminLTE aportan modales, popovers, estilos y menús. `Menu.toast` usa SweetAlert2. Otros recursos necesitan ExcelJS, FileSaver, QRCode, JsBarcode o IMask según la función. IMask se usa en `NumberFormatter.js`, pero no aparece en las dependencias ni en `public/resources/cdn/` de este checkout.

Se construyen tablas y formularios con plantillas HTML y atributos propios, especialmente `name`, `crud`, `idd`, `data-tecla`, `hideon` y `showon`. Los eventos se registran al crear el componente o después de regenerar su contenido. Para varias operaciones se usan `Promise` y `async/await` (diálogos, carga de archivos, impresión). La interfaz conserva preferencias en `localStorage` y usa sonidos locales en `public/resources/audios/`.

### `Modal2.js`: interacción y formularios

`Modal` crea un modal Bootstrap en el `body`. Su constructor permite `id`, idioma (`es` por defecto) y animación. `show({title, body, size, buttons, onShow, onShown, onHide, onHidden})` reemplaza el contenido, configura botones y presenta el modal. Los tamaños admitidos incluyen clases Bootstrap (`sm`, `lg`, `xl`) y anchos `70`, `80`, `90` en `vw`. Un botón con `name: "dismiss"` cierra el modal; los botones se describen con `{color, text, name}`.

Operaciones de uso común:

| Método | Resultado observado |
| --- | --- |
| `message(text)` | Muestra aviso y resuelve al cerrarse. |
| `yesno(text, focusOn="yes")` | Resuelve `true`, `false` o `null` si se cierra sin elegir. |
| `prompt({label, value, type, small, ...})` | Resuelve el valor escrito o `null`. |
| `promptSelect({title, ar, textProp, rowTemplate, filter, filterFn, itemsToShow, showIndex})` | Permite filtrar y elegir un ítem; resuelve el ítem o `null`. Con `showIndex` admite teclas 1 a 9. |
| `waiting(text, fn)` / `waiting2(status, text)` | Muestran espera; el segundo superpone un bloqueo sobre el modal. |
| `addPopover({...})` | Mensaje, confirmación o entrada anclada dentro del modal; resuelve con la respuesta. |
| `hide(true)` / `close(true)` | Solicitan el cierre y permiten esperar el evento `hidden.bs.modal`. |

Ejemplo ajustado a la API existente:

```js
const confirmado = await modal.yesno("¿Guardar cambios?");
if (!confirmado) return;

modal.show({
    title: "Editar producto",
    body: htmlFormulario,
    buttons: [
        {color: "secondary", text: "Cancelar", name: "dismiss"},
        {color: "primary", text: "Guardar", name: "guardar"}
    ],
    onShown: () => $("#modal [name='nombre']").focus()
});
$("#modal [name='guardar']").on("click", guardarProducto);
```

Aunque el constructor acepta otro `id`, varios métodos internos consultan directamente `#modal`; usar el identificador por defecto hasta revisar esa limitación. `hide()` sin el primer argumento devuelve una promesa que no se resuelve; si se necesita esperar, pasar `true`. `promptSelect` espera que un `rowTemplate` personalizado incluya el atributo `ind` en el botón elegible. El contenido de `body` se inserta como HTML, así que los datos no confiables deben escaparse antes de interpolarlos.

### `Menu.js`: comportamiento transversal

`Menu` concentra preferencias de interfaz: animaciones, sonido, modo oscuro, mayúsculas en tablas, encabezados (`normal`, `sticky`, `dynamic`), posición del modal y máscara de números. Lee y escribe claves simples en `localStorage`, actualiza clases y botones de AdminLTE/Bootstrap y abre `modalPreferencias()` usando el HTML de `#modalPreferencias`.

También ofrece `setPageName`, `hideCortina`, apertura de barras laterales, `toast({level, title, message, time, sound})`, `playSound`, `teclasRapidas(acciones)`, alerta de vencimiento y `setTheadDynamic()` para tablas insertadas luego de cargar la página. `teclasRapidas` espera acciones `{tecla, label, fn}`, muestra un panel de búsqueda al soltar Control y ejecuta la acción seleccionada; se oculta al abrir un modal. `toast` muestra SweetAlert2 y reproduce un sonido si la preferencia lo permite.

Al implementar una página hay que verificar los elementos que `Menu` espera en el DOM (`#toggle-dark-mode`, `#btn-preferencias`, `#pageName`, `#audioPlayer`, `#cortina`, estructura de AdminLTE, etc.) y disponer de la instancia global `modal` antes de construir `Menu`. Algunas funciones usan globales adicionales como `fechas`, `primordial` y `numberFormatter`; solo llamarlas cuando esos datos estén disponibles.

### Otros recursos propios del frontend

| Archivo | Función y dependencias principales |
| --- | --- |
| `Utils.js` | Conversión y formato de números, texto, URL, validaciones, `FormData`, carga de archivos, portapapeles, QR, código de barras, `debounce`, detección de lector de barras y almacenamiento local por emprendimiento/usuario. Usa jQuery y algunas funciones requieren `primordial`, QRCode, JsBarcode o FileSaver. |
| `NumberFormatter.js` | Máscara opcional para enteros, con punto de miles. Cambia `type="number"` a texto mientras está activa, conserva `mask-original-type`, intercepta `$.valHooks.text`, observa entradas nuevas y expone `getValue`/`setValue`. Requiere IMask. `Menu.setMaskNumbers` la habilita. |
| `SimpleCRUD.js` | Tabla y estado de alta/edición en memoria. Usa `crud="table"`, `crud="fields"`, `crud="btNew"` y `crud="btModify"`; `structure` define columnas. Filtra sobre `list`, muestra lotes de 100 y expone callbacks para selección, limpieza y búsqueda. El guardado real queda a cargo de la página; `getDataToSave()` prepara el objeto y `afterSave()` actualiza la lista local. |
| `DropdownSearcher.js` | Buscador desplegable con filtrado, flechas, Enter, Escape y callback de selección. Recibe elementos jQuery `input`/`button`, `items`, `propId` y `propLabel`; la lista HTML creada tiene cinco opciones visibles. |
| `TableSelector.js` | Selección de filas con flechas y Enter, limitada a las primeras diez filas. Llama al callback con la fila jQuery y un booleano de confirmación. |
| `Imagine.js` | Selector y vista previa de JPG/PNG; redimensiona con `canvas` y devuelve archivo o base64 al callback. Requiere `container` y `callback`. |
| `SuperExcel.js` | Lectura, escritura y exportación de `.xlsx` mediante ExcelJS y FileSaver; usa `modal` para avisar la exportación. |
| `Impresor.js` | Impresión de una plantilla HTML en iframe o mediante `window.electronAPI`; también consulta un servicio POS local en `localhost:9005`. |
| `PrinterJob.js` y `job-printer-front.js` | `PrinterJob.js` define la base `PrinterJob` con líneas, tablas y envío HTTP a `/control/imprimir-ticket`. Se carga antes de `job-printer-front.js`, cuya clase `PrintJob extends PrinterJob` agrega imágenes, corte y la página de prueba. |

## Criterio para cambios futuros

1. Identificar el módulo de negocio y verificar qué ruta, controlador, vista y montaje existen realmente antes de extenderlos.
2. Mantener la separación entre reglas de acceso en rutas, lógica HTTP en controladores y utilidades de interfaz en `public/resources/`.
3. Para pantallas nuevas, revisar primero `Modal`, `Menu`, `Utils`, `NumberFormatter` y los componentes de tabla/selección; integrar sus instancias y dependencias en el orden requerido por la pantalla.
4. Usar el formato y los nombres que ya rodean la modificación. No convertir una página a módulos, framework o estilos nuevos sin que el cambio lo necesite.
5. Comprobar manualmente las rutas y flujos tocados cuando existan los archivos de arranque y vistas; hoy no hay una prueba automatizada funcional.
6. La aplicación se ejecuta exclusivamente en Windows. Resolver Documentos con Electron o con la carpeta especial de Windows cuando se ejecute directamente en Node.

## Desajustes presentes que requieren verificación al tocar esas áreas

Estos son hallazgos del checkout, no convenciones a reproducir:

- Las rutas de `usuarios` no incluyen `:id`, pero `modificar`, `eliminar` y `asignarContrasena` leen `req.params.id`. Hay que definir el contrato HTTP antes de invocarlas.
- `controllers/usuarios.js` trata unas consultas `db.query(...)` como resultado directo y otra con `await ... .result[0]`. Como falta `utils/db.js`, no se puede confirmar el contrato de acceso a datos.
- En `routes/mesas.js`, tanto `/mesas/editar` como `/mesas/cobrar` apuntan a `mesas.nuevo`; revisar esos destinos al modificar esas operaciones.
- `routes/ventas.js` declara `GET /ventas/concretar`; al implementar una operación que cambie datos, confirmar método y contrato.
- `Modal2.js` y algunas otras utilidades insertan contenido con `.html()` o plantillas. Escapar datos externos antes de mostrarlos; no asumir que la interpolación los sanitiza.
- Hay referencias a funciones, plantillas, elementos DOM y globals que no están en este checkout (`IMask`, `fechas`, `primordial`, vistas, controladores, puente Electron). Confirmar su provisión antes de ejecutar esas funciones.

## Implementaciones incorporadas el 14 de octubre de 2026

Esta sección actualiza los desajustes anteriores para los módulos ya implementados:

- `utils/db.js` exporta el esquema SQLite; las consultas se ejecutan mediante `utils/sqlite.js`. `transaction(callback)` ejecuta un callback **sincrónico** con una función de consulta, usando `BEGIN IMMEDIATE`, `COMMIT` y `ROLLBACK`.
- Cada inserción en `bitacora` guarda `eventoId` mediante una subconsulta al evento activo, iniciado y sin finalizar; si no existe, guarda 0. El registro de cierre se inserta antes de desactivar el evento, dentro de la misma transacción, para conservar su asociación. El esquema inicial y la validación de respaldos incluyen `bitacora.eventoId`; no se migran bases anteriores.
- En Preferencias, Instalar impresora solo se habilita con la opción Local. El botón abre un modal con el tutorial de Windows (pasos 0 a 10), Configurar impresora y Test. Configurar ejecuta el endpoint de instalación y, si termina correctamente, usa `new PrintJob().test()` para enviar una página de prueba automáticamente; Test permite repetirla manualmente. `POST /control/imprimir-ticket` exige login para permitir la impresión a los usuarios de ventas, verifica la configuración, el trabajo y el ancho, y envía los datos mediante `utils/job-printer-back.js`. Durante la instalación o la prueba se bloquean ambos botones y el cierre del modal. El trabajo se envía a la térmica configurada en el servidor; no imprime ventas automáticamente.
- `utils/info.js` centraliza configuración, la ruta absoluta de Documentos/ventas-2026, versión, empaquetado, IPv4 y nombre de la PC. La configuración y la ruta se resuelven al acceder a ellas; en Electron, acceder a la configuración después de `app.whenReady()`.
- Express escucha en `0.0.0.0` y el puerto configurado para permitir conexiones IPv4 desde la red. La IP mostrada en Inicio y sus QR prioriza la interfaz de la ruta predeterminada de Windows con menor métrica, evitando seleccionar primero un adaptador virtual sin salida a la red; si no se puede determinar, usa la primera IPv4 externa disponible.
- Al conectar una base sin usuarios, se crea `admin@admin.com` con contraseña inicial `123456789` hasheada con bcrypt. Las conexiones posteriores conservan los usuarios y sus contraseñas.
- Antes de mostrar el login sin sesión y al procesar `POST /inicio/iniciar-sesion`, `controllers/inicio.js` ejecuta `validarLicencia`. En el registro del usuario de Windows que ejecuta el servidor, `HKEY_CURRENT_USER\ventas-2026`, crea los valores REG_SZ `licencia` (UUID) y `creado` (fecha local `YYYYMMDD`) solo si no existen. Los compara con `licencia` y `creado` de `Documentos/ventas-2026/config.json`, leído en cada validación; esos campos se completan manualmente, nunca se copian automáticamente al archivo. `creado` admite la fecha como texto o número en JSON. Si faltan, no coinciden o falla la lectura, responde HTTP 403 con “Licencia no válida”. La comprobación pertenece al servidor, también cuando el acceso viene de otro dispositivo.
- Los eventos nuevos se crean inactivos y un administrador debe activarlos desde la pantalla de Eventos. La activación registra `fechaInicio`; el cierre desactiva el evento y registra `fechaFin`. Solo puede haber un evento iniciado y sin finalizar. Mientras haya un evento activo se deshabilita Agregar evento y el servidor rechaza la creación con HTTP 409, comprobándolo antes del respaldo y dentro de la transacción de alta. Ventas, mesas, stock y movimientos de caja usan el evento activo.
- `controllers/usuarios.js` usa SQLite y hashes bcrypt, valida entradas, omite contraseñas en los listados y recibe `usuarioId` en el cuerpo. La modificación admite una contraseña opcional; se eliminó la ruta separada `asignar-contrasena`. Se creó la vista `pages/usuarios`.
- `controllers/ventas.js` implementa `concretarVenta`, `cobrarMesa` y `crearMesa`, además de búsqueda, listado y edición de mesas y la vista `pages/ventas`. `POST /ventas/concretar` recibe `{productos: [{nombre, precio, costo, cantidad}], efectivo, transferencia, mesaId, cajaNumero}`. `mesaId` identifica la mesa de destino en la petición; no es una columna de `ventas`. Cada producto se identifica por su nombre exacto entre los productos no eliminados; una coincidencia ausente o ambigua rechaza la operación. Los importes, cantidades, subtotales y saldos se validan y guardan como enteros.
- Una venta directa se guarda con su pago en `ventas`. Un pedido para mesa se agrega únicamente al JSON `mesas.productos` y acumula `mesas.total`, sin crear una venta. Cada producto conserva nombre, cantidad, precio, costo y subtotal, y recibe `timestamp` (milisegundos del servidor) y `turno`. Todos los productos del mismo pedido comparten ambos valores; el turno comienza en 1 y aumenta por pedido dentro de cada mesa. Se calcula y guarda en la misma transacción para evitar turnos repetidos ante solicitudes simultáneas. El stock se descuenta al registrar la venta directa o el pedido, incluso si queda negativo.
- En `/ventas`, el botón COBRAR abre un modal con ABONAR y MESAS. ABONAR permite combinar efectivo y transferencia; cada botón Completar coloca el total menos el importe del otro medio. Se avisa si la suma supera el total y solo se habilita Confirmar con importes enteros no negativos cuya suma coincida con el ticket. MESAS permite elegir una mesa y confirmar el pedido independientemente de los importes de ABONAR. Ambos confirman mediante `concretarVenta`, bloqueando envíos simultáneos y conservando el ticket si la operación falla.
- Cada importe del modal COBRAR tiene un botón X para vaciarlo. La mesa se selecciona al pulsar cualquier parte de su fila salvo Editar; ese botón usa `modal.addPopover` para cambiar el nombre. `POST /mesas/editar` admite `{mesaId, nombre}` y conserva en la transacción el número y teléfono actuales cuando se omiten, manteniendo el registro de bitácora existente.
- `POST /mesas/nuevo` recibe `{nombre, numero, telefono?}`; `POST /mesas/editar` añade `mesaId`. `POST /mesas/cobrar` recibe `{mesaId, efectivo, transferencia, cajaNumero}`; la suma debe cubrir exactamente el saldo pendiente. Guarda el pago únicamente en `mesas`, marca `cerrada = 1` y crea otra mesa abierta con el mismo evento y número, nombre predeterminado, teléfono vacío y sin importes ni productos. Ambas escrituras forman una transacción. La mesa cerrada conserva los datos para el resumen y no admite nuevos pedidos, cambios ni otro cobro; no se crean ventas ni se descuenta stock nuevamente.
- El gestor y el selector de mesas muestran únicamente las abiertas, ordenadas por número. `listadoMesas` crea las mesas configuradas que no tengan una fila abierta. El detalle agrupa `mesas.productos` por turno con fecha/hora, sin mostrar el total del pedido junto a la fecha; debajo reutiliza el formulario de cobro de ventas para repartir el saldo entre efectivo y transferencia, con Completar y borrar importe. Al cobrar vuelve al gestor con la mesa limpia disponible. El ticket de venta en preparación se conserva.
- `controllers/control.js` implementa backup, restore, sesión, información, IP, subida y DevTools. Backup, restore y DevTools requieren administrador conectado desde la PC servidor y Electron. Backup abre la carpeta `backups`; restore exige `config.restore === true` y abre un selector. La información de configuración no expone `sessionSecret`.
- Preferencias muestra Instalar impresora junto al selector Local/Servidor para administradores conectados desde la PC servidor. Desde el tutorial, Configurar impresora envía `POST /control/instalar-impresora-termica-directa`, protegido por login, admin y esServidor. El endpoint verifica que Windows tenga una impresora llamada `termica` y ejecuta `setupPrinterAutomationV2(1, nombre)` de `utils/job-printer-back.js`: solicita elevación para compartirla como `Ticketera` y mapea LPT1 en la sesión del usuario. Solo después del éxito guarda `printer.name`, `printer.interface` (`\\.\LPT1`) y `printer.charsPerLine` en `config.json`, conservando las demás opciones y actualizando la configuración en memoria. El módulo usa `utils/info.js`, `node-thermal-printer` y `@vscode/sudo-prompt` 9.3.2, compatible con Node 24; la prueba se envía desde el navegador después de configurar correctamente, sin incorporar impresión automática a ventas.
- `utils/multer-middleware.js` recibe una sola imagen en el campo multipart `file`, valida únicamente que su MIME empiece con `image/`, limita su tamaño a 1 MiB, la guarda en `temp` y la expone como `req.files.file`. `POST /control/subir-archivo` recibe además `carpeta`, mueve el archivo a esa subcarpeta de Documentos/ventas-2026 y devuelve sus datos. `/imagenes` sirve las imágenes a usuarios autenticados. Express excluye multipart del parser raw para dejarlo disponible para Multer.
- `controllers/productos.js` implementa la página, listado, alta, modificación y baja lógica. La pantalla conserva el listado y el panel de datos, con búsqueda y cálculo del precio a partir del costo y el margen. El último evento está en curso cuando tiene `fechaInicio` y no tiene `fechaFin`; mientras tanto se bloquea la edición manual del stock tanto en la pantalla como en el controlador. Las ventas pueden seguir descontando stock y dejarlo negativo.
- Ventas directas y movimientos de caja incrementan `numeroGlobal` desde la clave compartida `numeroGlobal` en `contadores`. Cada tabla mantiene su propio contador `numeroEvento` por evento: `ventas_numeroEvento_{eventoId}` y `movimientosCaja_numeroEvento_{eventoId}`. Los contadores se actualizan en la misma transacción que el registro y comienzan en 1 cuando se usan por primera vez. Ingresos y egresos comparten la secuencia de movimientos de caja. Los movimientos se asocian al último evento iniciado y sin finalizar y el listado filtra por `eventoId` y, opcionalmente, `cajaNumero` (1 a 4; vacío u omitido para todas). El selector de evento muestra nombre y fecha en formato `DD/MM/AAAA`; el selector de caja permite Todas o Caja 1 a 4 y ambos actualizan automáticamente el listado al cambiar.
- Las rutas de inicio, usuarios, productos, eventos, movimientos de caja, control, ventas y mesas pueden cargarse. El límite de peticiones de inicio de sesión también se aplica al POST.
- `npm test` ejecuta pruebas con bases y archivos temporales, incluyendo pruebas HTTP en loopback y simulaciones de diálogos y DevTools de Electron. No usa la base real de Documentos.

## Selección de caja (15 de octubre de 2026)

- Cada inicio de sesión deja `req.session.data.cajaNumero` en cero. El usuario debe elegir una caja del 1 al 4; `POST /control/seleccionar-caja` guarda esa elección en la sesión. La selección se conserva al navegar y se vuelve a pedir al iniciar otra sesión. No se toma automáticamente de `localStorage`.
- Al cargar una página autenticada sin caja, `Menu.hideCortina()` abre un diálogo obligatorio usando `Modal2.js`. El botón superior muestra “Seleccione caja” y parpadea en amarillo hasta guardar la elección.
- `POST /ventas/concretar` y `POST /mesas/cobrar` requieren además `cajaNumero` en el cuerpo, coincidente con la selección de la sesión. Sin una caja válida responden HTTP 400 antes de modificar datos. El frontend también bloquea la confirmación.
- Cada venta guarda `ventas.cajaNumero`; el cobro de una mesa actualiza `mesas.cajaNumero`. El resumen suma ventas directas y mesas, sin duplicar sus productos ni pagos. La cantidad de ventas incluye las ventas directas y un registro por cada turno de pedido de mesa; el contador de Inicio usa el mismo criterio.
- El alta manual de movimientos de caja permite elegir Caja 1 a 4 en el modal, preseleccionando la caja de trabajo. `POST /movimientosCaja/nuevo` exige `cajaNumero`, lo guarda en el movimiento y lo incluye en la bitácora. Esa elección puede ser distinta de la caja de la sesión y no modifica la caja de trabajo. Al guardar se actualiza el listado: se conserva Todas o la caja coincidente; si había otra caja filtrada, se selecciona la del movimiento antes de consultar.
- El resumen de eventos admite `cajaNumero` opcional (1 a 4; vacío u omitido para todas). Filtra las ventas y las mesas por su `cajaNumero`, recalculando productos, cantidades, ganancias e importes. El selector del modal actualiza también los totales de la tabla y no cambia la caja de la sesión.
- Se usa exclusivamente el esquema actual de `utils/db.js`, sin migraciones ni compatibilidad con bases anteriores. Al conectar se crean las tablas, sin insertar contadores. `getContador` devuelve 0 si la clave no existe, sin crearla; `setContador` la guarda al primer cambio. Ventas y movimientos usan `setContador` dentro de sus transacciones, por lo que el primer número global es 1. La restauración exige las tablas y columnas actuales, incluyendo `mesas.productos` y `mesas.cerrada`.

## Respaldos automáticos de eventos

- Antes de crear un evento, después de validar sus datos, se copia toda la base con `db.makeBackup` a `Documentos/respaldos/previo-{nombre_simplificado}-{timestamp}.sqlite`. La creación espera que termine el respaldo.
- La creación, activación y el cierre de eventos no generan movimientos de caja por ventas directas ni mesas, ni incrementan los contadores de movimientos. Las cantidades e importes por medio de pago se consultan en el resumen del evento desde las ventas y las mesas guardadas. Los movimientos de caja existentes se conservan; los nuevos ingresos y egresos se registran desde Movimientos de caja.
- Después de cerrar correctamente un evento se genera `Documentos/respaldos/finalizado-{nombre_simplificado}-{timestamp}.sqlite`, incluyendo el estado final y el registro de cierre en bitácora. Se mantiene el bloqueo de cierre cuando hay mesas pendientes de cobro y el rechazo de un segundo cierre.
- La carpeta se resuelve desde la ubicación real de Documentos de Windows, incluso si está redirigida. El nombre se convierte a minúsculas, se eliminan tildes y símbolos, se convierte ñ en n y se reemplazan espacios por `_`. Si no quedan caracteres se usa `evento`. El timestamp es `Date.now()` en milisegundos.

- En Consumos de mesa, Imprimir aparece junto al saldo pendiente, con estilo warning e icono. Usa PrintJob para enviar fecha de emisión, Resumen de mesa NºX, nombre asociado si existe y cada pedido con fecha/hora e ítems (cantidad, precio y subtotal por producto), sin totales por pedido; termina con el saldo pendiente. La impresión no cobra ni modifica la mesa.
- En Ventas, Buscar ventas abre un modal con las últimas 100 ventas directas del evento activo, de más nueva a más vieja, mostrando fecha, usuarioEmail, caja, monto e Imprimir. Reutiliza `POST /ventas/buscar`. La reimpresión usa los productos y pagos guardados, con REIMPRESION centrado, en negrita y tamaño doble; no registra otra venta ni modifica contadores. `PrinterJob.addLine` admite `grande` y el impresor restablece el tamaño normal después de esa línea.
- Al cobrar una venta de mostrador se imprime automáticamente el ticket usando los productos, pagos, fecha, vendedor y caja de la venta guardada. Los productos del ticket se agrupan por nombre y precio, sumando cantidades y subtotales; la reimpresión de ventas usa el mismo criterio, independientemente del toggle de la pantalla. Un fallo de impresión se avisa como tal y conserva la venta cobrada. Asignar un pedido a mesa o cobrar una mesa no imprime automáticamente.
- `npm run build` genera el instalador NSIS de Windows en `dist/Ventas-{version}-Setup.exe`, con nombre Ventas, identificador `ventas-2026` e icono `public/resources/branding/ventas.ico`. Reutiliza Electron instalado en `node_modules/electron/dist`. Incluye entradas, controladores, rutas, utilidades, recursos públicos y dependencias de producción; excluye la planilla Excel y documentación. `dist` está ignorado por Git. La compilación genera el instalador, sin ejecutarlo ni abrir la aplicación.

## Destino de impresión (16 de octubre de 2026)

- Preferencias de interfaz conserva `printerLocation` (`local`, `servidor`, `ip`, `rawbt` o `ninguna`) y `printerIP` en el `localStorage` de cada dispositivo. Asignar IP muestra un campo IPv4; Probar impresión utiliza el mismo destino que los tickets de ventas y mesas.
- Sin impresora (`ninguna`) omite los trabajos desde `PrinterJob.print()`, sin solicitudes HTTP, IPC ni intents RawBT. La venta se registra normalmente. Las reimpresiones y los resúmenes de mesas no anuncian un envío inexistente. Probar impresión e Instalar impresora se deshabilitan, y `PrintJob.test()` también omite la prueba antes de descargar su imagen.
- `PrinterJob.print()` con Local en Electron usa un puente IPC y la térmica de esa PC. Servidor envía el trabajo al endpoint autenticado `POST /control/imprimir-ticket` del sistema central. Para Local desde un navegador, el servidor identifica la IP del dispositivo por el socket HTTP; Asignar IP usa la IPv4 elegida. Si el destino es otra PC, el servidor reenvía por HTTP al mismo endpoint y puerto de esa instancia, sin cookies, sin redirecciones ni reintentos automáticos. Las solicitudes anteriores sin destino conservan la impresión en el servidor.
- Las PC receptoras deben tener el programa abierto y la térmica configurada mediante Instalar impresora. Un móvil sin receptor debe elegir Servidor o Asignar IP. La instalación en Windows mantiene el recurso Ticketera y LPT1 para su impresión local, pero el envío entre instancias usa HTTP.

## Instancias cliente y servidor

- `config.json` incluye `servidor`: `localhost` o `127.0.0.1` ejecuta el sistema completo; otra IPv4 activa el modo cliente. El valor se valida y se añade como `127.0.0.1` a configuraciones que todavía no lo tengan, conservando las demás opciones. `port` define tanto el puerto local como el del sistema central; todas las PC deben usar el mismo puerto. Los cambios de servidor o puerto requieren reiniciar el programa.
- En modo cliente, Electron carga directamente `http://{servidor}:{port}/`, incluido el login. Las páginas, scripts, imágenes, sesiones y solicitudes de ventas y consultas pertenecen al servidor central. La instancia cliente no carga ni conecta SQLite; si el servidor está desconectado, muestra el error de carga y no inicia una base local.
- Express cliente solo registra `POST /control/imprimir-ticket`, sin sesiones, páginas, archivos estáticos, instalación ni endpoints de consultas. El receptor imprime exclusivamente en su térmica local y acepta trabajos desde la IP central configurada, rechazando otras PC y orígenes de navegador ajenos. El endpoint completo del servidor conserva su permiso de sesión.
- El preload permite obtener el modo, imprimir y configurar la térmica local y abrir enlaces externos mediante IPC. Cada operación verifica la ventana principal y el origen HTTP configurado. Las preferencias de impresión y los botones de contacto usan estas operaciones locales en el cliente, sin abrir otros endpoints HTTP.

## Prioridad de productos

- `productos.prioridad` es un entero del 1 al 10, con valor predeterminado 5 en el esquema actual. Productos permite elegir 1 - Alta, 2, 3, 4, 5 - Media, 6, 7, 8, 9 y 10 - Baja en el alta y la edición. El controlador valida el rango y registra los cambios en bitácora. Omitir prioridad al crear usa 5; omitirla al modificar conserva el valor guardado.
- El listado de Productos conserva el orden alfabético. Ventas filtra los no visibles y ordena los restantes por prioridad ascendente, manteniendo el orden alfabético dentro de cada prioridad. La búsqueda conserva ese orden. La validación de respaldos exige también `productos.prioridad`, conforme al esquema actual sin migraciones.

## RawBT en Android

- RawBT permite imprimir desde un navegador Android usando la impresora Bluetooth que el usuario haya configurado en esa app. `PrinterJob.print()` envía `destino: "rawbt"` al endpoint autenticado de impresión del servidor central. Ese modo valida el trabajo y devuelve ESC/POS en Base64, sin exigir una térmica en el servidor ni escribir el archivo de depuración, abrir una conexión de impresora o ejecutar el trabajo físicamente.
- Se reutiliza el mismo generador de líneas, tablas, imágenes, estilos, saltos y corte de `utils/job-printer-back.js`, con `soloGenerar: true`. El resultado empieza con ESC @ para inicializar la impresora. El navegador construye `intent:base64,{datos}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`, conforme al [conector RawBT de escpos-php](https://github.com/mike42/escpos-php/blob/development/src/Mike42/Escpos/PrintConnectors/RawbtPrintConnector.php).
- Una vez preparado el ticket, el navegador abre directamente el intent mediante `window.location.href`, sin panel, cola ni confirmación adicional del programa. Se usa el mismo envío para ventas, reimpresiones, consumos de mesa y la prueba de impresora. No hay reintentos automáticos. Chrome puede bloquear el lanzamiento si se pierde la interacción del usuario durante la solicitud, según sus [restricciones de intents en Android](https://developer.chrome.com/docs/android/intents); el programa no puede garantizar impresión silenciosa en todos los navegadores. RawBT gestiona la conexión y el estado físico: abrir el intent no confirma que la impresora haya imprimido.
