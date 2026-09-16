# Plan técnico 001 — Incremento 0

> Contexto histórico de incrementos 0–5. Para cambios nuevos prevalecen DEC-021 y specs/012-unified-web: un sitio único con Caja offline en navegador. Se conservan reglas y contratos comerciales.
El registro del incremento 0 se conserva abajo. El alcance vigente es el incremento 1 descrito al final.

Estado: verificado el alcance delimitado del incremento 0. Autorización: mensaje del usuario del 13-09-2026, «Autorizo iniciar la implementación local del sistema conforme al plan». No incluye producción, contratación ni escrituras en Alegra.

## Incremento seleccionado

Primero pendiente: incremento 0 de la hoja de ruta. Entrega contratos de identidad/permisos y sincronización, políticas ejecutables compartidas y pruebas de dominio/contrato. REQ-001-01/02/03/04 y REQ-007-02/03/04/05. Las pruebas parciales de AC-001-01/02/03 y AC-007-02/03/06 verifican las políticas, no equivalen a API, caché o ventas integradas.

Fuera: usuarios persistidos, login, servidor HTTP/PostgreSQL, UI React, Electron/SQLite, exportaciones y cobros. AC-001-04 se programa para incremento 1. No existen datos ni código previo que migrar; la maqueta externa no se copia como aplicación.

## Diseño

DEC-001: servidor modular único y dominio TypeScript compartido, sin servicios ni colas externas. Se conserva React/TypeScript, Electron/SQLite y Node/PostgreSQL para siguientes incrementos. Este núcleo no abre red ni almacena identidades. Node 24.15.0 instalado ejecuta TypeScript; tsc comprueba tipos por separado.

Autorización por acción explícita, identidad activa y sucursal asignada; denegar por defecto. Dueño también necesita alcance explícito. Los roles son perfiles iniciales; permisos configurables mediante lista concedida sin franquear la restricción de costos. El contexto viene de autenticación confiable, nunca del body enviado por un cliente.

Costos de recetas/promedios/márgenes solo en servidor y sesión online de dueño; nunca caché compartido. Importes de compra en interfaz administrativa online de dueño/encargado autorizado. Datos públicos usan proyección de campos permitidos, no eliminación de una lista de campos secretos. Auditoría definida por contrato; escritura atómica con operaciones se implementará con persistencia.

## Contratos

[Identidad v1](contracts/identity-v1.md), [esquemas](../../contracts/identity-v1.schema.json) y protocolo compartido en [007](../007-offline-sync/contracts/sync-v1.md). JSON Schema 2020-12 cerrado y validación semántica. No hay API HTTP nueva en este incremento; OpenAPI se requiere antes del servidor del incremento 1.

## Migración y recuperación

Sin almacenamiento de negocio en este incremento. Repositorio Git local nuevo, sin remoto, conserva trazabilidad; no reemplaza respaldo. No modificar fuentes Excel/Word/Alegra. El futuro adaptador deberá aplicar contratos a cada lectura/escritura y probar rollback.

## Pruebas y operación

Node test runner: matriz roles/sucursales/acciones online-offline, expiración exacta, reloj atrasado, entrada inválida, proyección sin costos. Ajv valida esquemas. tsc estricto valida código. Datos sintéticos aislados, sin credenciales reales. Evidencia con comandos, resultados y hash Git del código comprobado. No hay cambio visual ni prueba de hardware en este incremento.

## Riesgos abiertos

Autenticación, custodia Windows, revocación real, API y persistencia se implementarán en incrementos 1/3. La política recibe una concesión ya autenticada; por sí sola no autentica usuarios ni protege un equipo comprometido. No hay decisión de negocio bloqueante para incremento 0. Fiscalidad, tasas, recetas, alojamiento e impresión quedan en sus incrementos.

## Incremento 1 — Diseño antes de código

Estado: verificado localmente. Autorización: continuación expresa del usuario. REQ-001-01/02/04/05; AC-001-01/04/05 a 10. Fuera: catálogo/ventas, caché POS, Electron y concesión firmada/DPAPI para usuarios de caja (incremento 3); se conserva contrato 007 como frontera, sin habilitar offline en esta administración web.

### Arquitectura y datos

Fastify/Node TypeScript con PostgreSQL real mediante pg; React/TypeScript/Vite como interfaz compilada servida en el mismo origen. Se reutiliza authorize del incremento 0. Migración SQL versionada: sucursales, bodegas, equipos, usuarios, sesiones y auditoría. Identificadores UUID, timestamps UTC y presentación America/Bogota. Sin precios, recetas ni datos ilustrativos en BD. Solo seed confirmado Milán/Centro, una bodega y caja por local, impresoras T80A/T82E como configuración declarada sin prueba física.

No hay PostgreSQL/Docker instalado. DEC-016: helper embedded-postgres descarga binarios mediante npm y arranca PostgreSQL exclusivamente en loopback, sin servicio Windows ni contratación. Adaptador pg y SQL estándar conservan destino PostgreSQL central. Datos de desarrollo en .local/ ignorado; credencial aleatoria de BD protegida con DPAPI Windows; pruebas en directorio/BD independientes con secretos efímeros. No instalar usuarios del sistema. No borrar datos locales existentes.

### Identidad y seguridad

Bootstrap local mediante formulario inicial, bloqueado transaccionalmente después del primer dueño. El usuario elige nombre/login/contraseña: no usuarios ni credenciales reales inventados. Contraseñas scrypt asíncrono con salt aleatorio, parámetros versionados N=32768/r=8/p=3 y comparación constante. Sesiones opacas de 32 bytes, solo SHA-256 en BD, duración absoluta 12 horas (decisión técnica; distinto de siete días offline). Cookie HttpOnly/SameSite=Strict; Secure requerido cuando se habilite HTTPS. Desarrollo exclusivamente 127.0.0.1. Sin tokens en localStorage. Solo preferencia de tema y selección de sucursal no sensible.

Mutaciones exigen encabezado X-Nativos-Request=1 y Origin coincidente si presente; sin CORS. Verificar Host para evitar DNS rebinding; límites de body/login. Consultas y respuestas con campos permitidos. Servidor resuelve usuario y permisos actuales desde sesión; jamás rol declarado en body de una operación. Administración de identidades/organización/auditoría reservada al dueño con settings.manage en este incremento; demás roles solo consulta de sus sucursales. Concesiones configurables sin elevar costos/ajustes de puntos a no dueños. Control transaccional del último administrador y revocación de sesiones al modificar usuario. Motivo obligatorio en cambios administrativos.

### Contratos

`contracts/foundation-api-v1.json` OpenAPI 3.1 define payloads cerrados, respuestas y errores antes del servidor. `contracts/foundation-v1.md` detalla autenticación, permisos, paginación, auditoría y fallos. 001 identidad base y 007 offline se conservan. Rutas: estado inicial/bootstrap, login/logout/me, usuarios, sucursales/bodegas/equipos y auditoría paginada. No endpoints ficticios de productos/ventas para aparentar AC comercial.

### Transacciones, migración y recuperación

Migraciones con advisory lock y versión/checksum; rechazar alteración de migración aplicada. Mutación y evento auditado en mismo commit; trigger impide cambiar/borrar auditoría. Locks serializan bootstrap y cambios de administradores. Restricción única parcial para caja activa y bodega de venta por local. No borrar usuarios, desactivar con motivo. Pruebas de rollback mediante fallo forzado y cierre/reapertura de conexiones y proceso PostgreSQL; no representan restauración ante pérdida total ni backup productivo.

### UI y verificación

Pantallas funcionales de acceso/configuración inicial, resumen de organización, usuarios/roles, sucursales/bodegas/equipos y auditoría. Menú lateral con módulos pendientes identificados como aún no disponibles. Verde #00bf63, estados vacíos reales, foco visible, tema persistente, diseño móvil. Sin valores de ventas simulados. Formularios accesibles con estados de guardado/error.

Pruebas: unidad existente, integración HTTP contra PostgreSQL real, contrato de solicitudes/respuestas, revocación, alcance, concurrencia, auditoría/rollback y persistencia tras reinicio. E2E navegador de bootstrap/login/alta/edición y temas/teclado/móvil; capturas revisadas con agent-browser. Registrar comandos/resultados/limitaciones. No bloqueante de negocio para este alcance.

Cierre: ver [evidencia](../../docs/evidence/increment-1.md). El helper usa binarios de embedded-postgres con procesos nativos ocultos y cierre explícito de pruebas en Windows; no usa emulación de PostgreSQL.
