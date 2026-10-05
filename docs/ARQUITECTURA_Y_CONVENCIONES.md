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
- Las rutas declaran el control de acceso en línea mediante `permisos({login, admin, resp})`. `login` exige `req.session.user`; `admin` exige `req.session.user.isAdmin`; `resp` decide si la denegación HTTP 403 se devuelve como `{error: ...}` o texto. `routes/index.js` usa además `rateLimit({windowMs, max})` para la página inicial.
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
| `NumberFormatter.js` | Máscara opcional en campos numéricos, con punto de miles y coma decimal. Cambia `type="number"` a texto mientras está activa, conserva `mask-original-type`, intercepta `$.valHooks.text`, observa entradas nuevas y expone `getValue`/`setValue`. Requiere IMask y `utils`. `Menu.setMaskNumbers` la habilita. |
| `SimpleCRUD.js` | Tabla y estado de alta/edición en memoria. Usa `crud="table"`, `crud="fields"`, `crud="btNew"` y `crud="btModify"`; `structure` define columnas. Filtra sobre `list`, muestra lotes de 100 y expone callbacks para selección, limpieza y búsqueda. El guardado real queda a cargo de la página; `getDataToSave()` prepara el objeto y `afterSave()` actualiza la lista local. |
| `DropdownSearcher.js` | Buscador desplegable con filtrado, flechas, Enter, Escape y callback de selección. Recibe elementos jQuery `input`/`button`, `items`, `propId` y `propLabel`; la lista HTML creada tiene cinco opciones visibles. |
| `TableSelector.js` | Selección de filas con flechas y Enter, limitada a las primeras diez filas. Llama al callback con la fila jQuery y un booleano de confirmación. |
| `Imagine.js` | Selector y vista previa de JPG/PNG; redimensiona con `canvas` y devuelve archivo o base64 al callback. Requiere `container` y `callback`. |
| `SuperExcel.js` | Lectura, escritura y exportación de `.xlsx` mediante ExcelJS y FileSaver; usa `modal` para avisar la exportación. |
| `Impresor.js` | Impresión de una plantilla HTML en iframe o mediante `window.electronAPI`; también consulta un servicio POS local en `localhost:9005`. |
| `PrinterJob.js` y `job-printer-front.js` | Ambas declaran `class PrintJob` para tickets. La segunda añade imagen y corte, y usa `electronAPI.printJob`; la primera usa `electronAPI.imprimir`. Son variantes incompatibles y no deben cargarse juntas sin decidir cuál corresponde. |

## Criterio para cambios futuros

1. Identificar el módulo de negocio y verificar qué ruta, controlador, vista y montaje existen realmente antes de extenderlos.
2. Mantener la separación entre reglas de acceso en rutas, lógica HTTP en controladores y utilidades de interfaz en `public/resources/`.
3. Para pantallas nuevas, revisar primero `Modal`, `Menu`, `Utils`, `NumberFormatter` y los componentes de tabla/selección; integrar sus instancias y dependencias en el orden requerido por la pantalla.
4. Usar el formato y los nombres que ya rodean la modificación. No convertir una página a módulos, framework o estilos nuevos sin que el cambio lo necesite.
5. Comprobar manualmente las rutas y flujos tocados cuando existan los archivos de arranque y vistas; hoy no hay una prueba automatizada funcional.

## Desajustes presentes que requieren verificación al tocar esas áreas

Estos son hallazgos del checkout, no convenciones a reproducir:

- Las rutas de `usuarios` no incluyen `:id`, pero `modificar`, `eliminar` y `asignarContrasena` leen `req.params.id`. Hay que definir el contrato HTTP antes de invocarlas.
- `controllers/usuarios.js` trata unas consultas `db.query(...)` como resultado directo y otra con `await ... .result[0]`. Como falta `utils/db.js`, no se puede confirmar el contrato de acceso a datos.
- El middleware de permisos usa `req.session.user`, mientras `asignarContrasena` usa `req.session.data.email`. El esquema real de sesión está pendiente de confirmar.
- En `routes/mesas.js`, tanto `/mesas/editar` como `/mesas/cobrar` apuntan a `mesas.nuevo`; en `routes/evento.js`, `/eventos` declara respuesta JSON pero llama a `getHTML`. Revisar si son marcadores provisionales.
- `routes/ventas.js` declara `GET /ventas/concretar`; al implementar una operación que cambie datos, confirmar método y contrato.
- `Modal2.js` y algunas otras utilidades insertan contenido con `.html()` o plantillas. Escapar datos externos antes de mostrarlos; no asumir que la interpolación los sanitiza.
- Hay referencias a funciones, plantillas, elementos DOM y globals que no están en este checkout (`IMask`, `fechas`, `primordial`, vistas, controladores, puente Electron). Confirmar su provisión antes de ejecutar esas funciones.
