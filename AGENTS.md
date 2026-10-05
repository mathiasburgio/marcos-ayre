# Guía para trabajar en este repositorio

Antes de implementar cambios, leer [docs/ARQUITECTURA_Y_CONVENCIONES.md](docs/ARQUITECTURA_Y_CONVENCIONES.md). Ese documento distingue patrones observados de partes aún incompletas.

- Mantener el estilo existente: JavaScript sin TypeScript, CommonJS en Node, clases y scripts globales en el navegador, nombres de dominio y mensajes en español.
- En el frontend, reutilizar `public/resources/Modal2.js` para diálogos y `public/resources/Menu.js` para preferencias, avisos, sonidos y atajos. Revisar también los demás recursos compartidos antes de duplicar funciones.
- Respetar las dependencias de carga y los elementos del DOM que estas clases esperan. Las clases del navegador no usan `import`/`export`.
- Seguir la separación `routes/` → `controllers/` → acceso a datos que muestran los archivos disponibles. Aplicar `permisos(...)` en rutas según acceso y tipo de respuesta.
- No tomar los archivos ausentes ni los desajustes anotados en la documentación como contratos definitivos; comprobarlos al implementar cada función.
- No editar `public/resources/cdn/` para lógica propia: contiene bibliotecas de terceros copiadas al proyecto.
