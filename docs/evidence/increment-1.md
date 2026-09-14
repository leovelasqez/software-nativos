# Evidencia — Incremento 1: Fundamentos

Fecha de trabajo: 13-09-2026 (America/Bogota). Autorización: «Ok, continua con incremento 1», reiterada con «Continúa con lo que estabas ejecutando». Alcance: fundamentos online de REQ-001-01/02/04/05, con los límites de plan/tasks 001. Estado: verificado localmente; no publicado.

## Resultado concreto

Interfaz React conectada a servidor Fastify y PostgreSQL 18.4 nativo en Windows x64. Primer dueño configurable por el usuario, login/logout, sesiones revocables, usuarios/roles/permisos por sucursal, alta/edición de locales, bodegas y equipos, auditoría persistida y paginada. Milán/T80A y Centro/T82E conservados con una bodega/caja inicial por local. No usuarios reales ni contraseñas predeterminadas.

La maqueta externa se leyó como referencia visual, no se usó como integración. Los archivos Excel/Word y Alegra no se modificaron. Los planes/tasks/criterios y OpenAPI se completaron antes de escribir el servidor. DEC-016 documenta elecciones técnicas y fronteras.

## Verificación reproducible ejecutada

Entorno: Node 24.15.0, npm 12.0.2, PostgreSQL 18.4 nativo (msvc-19.44.35226), Edge instalado para E2E; dependencias exactas en package-lock.json. Arranque de clúster con binarios del paquete, sin servicio Windows. Datos de prueba en clústeres independientes del desarrollo; contraseñas sintéticas aleatorias en memoria.

| Comando | Resultado |
| --- | --- |
| `npm.cmd run typecheck` | TypeScript estricto de servidor, scripts, pruebas e interfaz sin errores |
| `npm.cmd test` | 16 pruebas de dominio/contrato aprobadas, sin omitidas |
| `npm.cmd run test:integration` | 11 subescenarios aprobados en PostgreSQL real; Node contabiliza 12 incluyendo suite padre; 0 fallos |
| `npm.cmd run build` | React/Vite compilados correctamente; no es un despliegue |
| `npm.cmd run test:e2e` | 1 flujo completo aprobado en Edge; configuración, usuarios, organización, auditoría, temas, teclado y acceso restringido |
| Reabrir desarrollo | PostgreSQL y aplicación reiniciados, credencial DPAPI reutilizada; `/api/status` conserva configuración inicial pendiente del dueño |

El último `check` completo pasó. Después se comprobó también el cierre explícito de PostgreSQL E2E en Windows con `typecheck` + `test:e2e`, ambos aprobados. La instalación final de dependencias informó 0 vulnerabilidades conocidas entre 122 paquetes; no equivale a auditoría de seguridad del producto.

## Trazabilidad de pruebas

| Requisito / aceptación | Código / contrato | Evidencia |
| --- | --- | --- |
| REQ-001-01/04; AC-001-05 | app.ts, db.ts, SQL y OpenAPI | Setup concurrente: un 201 y un 409, un único dueño, seeds no duplicados |
| REQ-001-02; AC-001-01 | app.ts/security.ts/authorization.ts | Encargado y cajero de Centro reciben 403 al solicitar Milán; dueño limitado tampoco administra usuarios ajenos |
| REQ-001-01/02; AC-001-06/07 | security.ts, app.ts, Users.tsx | Login genérico, bloqueo persistido, límite por IP, cookie HttpOnly/SameSite, expiración/logout/revocación, permisos exclusivos y último administrador protegido |
| REQ-001-01/04; AC-001-08 | SQL, app.ts, Branches.tsx | Caja activa y bodega predeterminada únicas; referencias cruzadas rechazadas; alta de local y bodega verificadas |
| REQ-001-04; AC-001-09 | db.ts, SQL, app.ts | Fallo inducido en inserción de auditoría revierte sucursal; update/delete/truncate de auditoría rechazados; scope histórico y paginación por cursor |
| REQ-001-01/04; AC-001-09 | Migración y helper PostgreSQL | Migración repetida no duplica, checksum alterado se rechaza; detener/reiniciar procesos conserva usuarios, sesiones, auditoría y bloqueo de login |
| REQ-001-05; AC-001-04/10 | web/, tests/e2e/foundation.spec.ts | Flujo real desde formulario, claro/oscuro persistente al recargar, teclado con foco visible, móvil sin desbordamiento horizontal |
| Contrato de API | contracts/foundation-api-v1.json | Cada respuesta de pruebas de integración validada contra OpenAPI; solicitudes con campos ajenos rechazadas; sin contraseña/hash/token en cuerpos públicos |

Pruebas: [integración](../../tests/integration/foundation.test.ts), [E2E](../../tests/e2e/foundation.spec.ts), [dominio](../../tests/authorization.test.ts). Diseño/tareas: [plan](../../specs/001-foundation/plan.md), [tasks](../../specs/001-foundation/tasks.md), [contrato](../../specs/001-foundation/contracts/foundation-v1.md).

## Revisión visual y accesibilidad

Se inspeccionó además el primer acceso con agent-browser. La base de desarrollo quedó sin cuenta creada, lista para que el usuario elija credenciales. Capturas E2E de una base sintética (no son datos de Nativos):

- [Escritorio claro](increment-1/desktop-light.png) y [oscuro](increment-1/desktop-dark.png), 1440 × 1000 de viewport.
- [Móvil claro](increment-1/mobile-light.png) y [oscuro](increment-1/mobile-dark.png), 390 × 844 de viewport.
- [Formulario móvil y foco](increment-1/mobile-form.png).

Las cinco capturas se revisaron visualmente. Axe no encontró infracciones WCAG 2 A/AA y 2.1 AA en el resumen de las cuatro combinaciones ni en el formulario móvil evaluado. Esto no certifica pantallas o interacciones todavía no implementadas.

La prueba de navegador detectó y permitió corregir dos problemas: el texto de ayuda se incorporaba al nombre accesible de contraseña, y React intentaba enfocar antes de abrir el dialog nativo. Se separó aria-describedby y se establece foco después de showModal. El flujo volvió a pasar. No se ocultaron fallos ni se redujo la prueba a una captura.

## Seguridad y operación local

Servidor vinculado a 127.0.0.1:4310 y BD a 127.0.0.1:54329, sin exposición LAN ni servicios externos. .local/ ignorado y restringido al usuario Windows; credencial local de BD protegida con DPAPI. Contraseñas de usuarios con scrypt, token de sesión solo hasheado en BD, no-store y protección Host/Origin/encabezado de mutación. API de identidad revalida permisos en transacción antes de escribir. No se guardan tokens en localStorage.

La sesión de equipo de administración es un ID emitido por servidor para auditoría, no una autenticación física POS. Auditoría append-only fue probada con el rol local; un administrador del motor podría modificar esquema/triggers, por lo que no se afirma inmutabilidad frente a ese actor. Cuenta de servicio de producción, HTTPS, backup y operación central no se han desplegado.

Se añadieron teardown explícito y validación de ruta para detener exclusivamente clústeres sintéticos en Windows. Los clústeres de prueba de esta ejecución quedaron detenidos; desarrollo continúa disponible. Ninguna prueba borró fuentes de negocio.

## Límites y siguiente incremento

AC-001-02/03 de productos/ventas conservan únicamente la cobertura parcial previa: no existe todavía catálogo comercial, alta de productos/clientes, descuento de pedidos, exportación ni caché POS. No se presentan sus permisos aislados como flujo implementado.

No hay caja Electron/SQLite, concesión offline firmada/custodia POS, sincronización de ventas, cobros, puntos, impresión, migración de Alegra, WhatsApp ni restauración de respaldos. Reiniciar PostgreSQL no demuestra recuperación ante pérdida total del disco. Impuesto opcional sigue vigente; su venta se probará en incremento 3. T80A/T82E registradas, sin validar controladores/cajón.

Siguiente: incremento 2, catálogo/recetas y existencias, completando planes/tareas de 002/003 antes de código. No hay decisión de negocio pendiente que invalide el resultado del incremento 1 ni se requiere renovar la autorización local.

## Identidad de lo comprobado

Base de partida Git: `7e52a77`. [Manifest SHA-256](increment-1/source-sha256.json) identifica código, contratos, configuración y dependencias finales comprobados (normaliza CRLF a LF). El commit de entrega agrega estos archivos y evidencia juntos. No incluye datos locales ni credenciales.
