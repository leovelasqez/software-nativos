# 001 — Identidad, sucursales, permisos e interfaz

Estado: incrementos 0 y 1 verificados en sus alcances; aceptación comercial transversal y caja offline pendientes. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, secciones 1–3, 10 y 14.

## Alcance

Dueño, encargado y cajero acceden a las sucursales autorizadas con identidad individual. Esta capacidad define permisos, estructura organizativa, auditoría transversal y shell visual; los comportamientos de cada módulo se detallan en sus propias specs.

## Requisitos

- REQ-001-01: gestionar usuarios, roles configurables, sucursales, bodegas y equipo de caja; iniciar con Milán y Centro y una bodega de venta por local.
- REQ-001-02: aplicar la matriz de permisos del plan en servidor, datos locales, interfaz y exportaciones. Costos de recetas, costeo promedio y márgenes solo para el dueño; el encargado puede registrar y consultar importes de compras de su local.
- REQ-001-03: todos los usuarios pueden crear productos/clientes/recetas online y aplicar descuentos/cancelaciones previas al cobro sin aprobación de otro usuario.
- REQ-001-04: conservar auditoría del actor, equipo, local, operación, momento, motivo y cambios relevantes, incluidos agentes.
- REQ-001-05: interfaz en español, COP y America/Bogota, menú lateral, `#00bf63`, claro/oscuro con estado conservado al navegar, teclado y adaptación móvil.

## Fronteras y estados a diseñar

Identidad de usuario y equipo, concesión de permisos, alcance de sucursales, expiración/revocación online y offline. El usuario activo no debe obtener datos de otro rol mediante una llamada manual a la API o exportación del caché.

## Aceptación

- AC-001-01 → REQ-001-01/02. Dado un encargado limitado a Centro, cuando consulta datos de Milán alterando la solicitud, entonces el servidor rechaza el acceso.
- AC-001-02 → REQ-001-02. Dado un cajero, cuando consulta productos o descarga datos permitidos, entonces no recibe campos de costos ni márgenes. Comprobar también datos locales accesibles.
- AC-001-03 → REQ-001-03/04. Dado un cajero online, cuando crea un producto válido o descuenta una línea, entonces la acción se permite y queda asociada a su identidad sin aprobación de encargado.
- AC-001-04 → REQ-001-04/05. Dado un usuario que cambia el tema y navega por teclado entre módulos, entonces conserva el tema, identifica el foco y completa acciones sin contenido recortado.

## Dependencias y pendientes

Contrato offline compartido con 007. DEC-003/004/012 afectan acceso, confidencialidad y operación. Alcances 0/1 definidos en plan.md. API/UI/persistencia de fundamentos verificadas; firma/custodia POS y aceptación comercial permanecen pendientes.

## Alcance entregado — Incremento 0

Ver [plan](plan.md), [tareas](tasks.md) y [evidencia](../../docs/evidence/increment-0.md). Se ejecutaron pruebas de políticas y esquemas; los AC originales que requieren servidor, almacenamiento, UI o reinicios NO están acreditados integralmente. No hay operación comercial real.

## Incremento 1 — Fundamentos autorizados

Autorización vigente: «Ok, continua con incremento 1». Incluye REQ-001-01/02/04/05 en administración online. REQ-001-03 conserva las políticas existentes; sus altas comerciales se implementan con catálogo/clientes/ventas. AC-001-02/03 completos dependen de esos módulos y no se acreditan mediante pantallas vacías.

- AC-001-05 → REQ-001-01/04: dada una base nueva, el primer dueño se registra una sola vez; se conservan Milán/Centro con bodega y caja iniciales. Dos solicitudes simultáneas no crean dos primeros dueños.
- AC-001-06 → REQ-001-01/02: login válido crea sesión revocable; contraseña errónea no identifica si existe el usuario; logout, expiración o desactivación impiden reutilizar sesión. No hay hash ni token en respuestas de usuarios/auditoría.
- AC-001-07 → REQ-001-01/02/04: dueño crea/edita usuario, rol y alcance con motivo; cajero/encargado no administran identidades por defecto. Cambios de permisos revocan sesiones. No desactivar ni quitar privilegios al último administrador activo.
- AC-001-08 → REQ-001-01/04: dueño crea sucursal/bodega/equipo; existe solo una caja activa por local. Cambios y auditoría se guardan juntos o se revierten juntos.
- AC-001-09 → REQ-001-04: reiniciar servidor conserva identidades, organización y auditoría; una segunda migración no duplica datos. Auditoría no permite update/delete desde la aplicación.
- AC-001-10 → REQ-001-02/05: interfaz permite completar creación/edición y navegar en claro/oscuro a escritorio y móvil, con etiquetas, foco visible, mensajes de error y sin desbordamiento horizontal. Los módulos todavía no implementados no simulan operaciones comerciales.

Evidencia del incremento 1: [registro](../../docs/evidence/increment-1.md). AC-001-01/04/05 a 10 cubiertos en alcance online; AC-001-02/03 conservan cobertura parcial del núcleo y esperan módulos comerciales.

## Dirección vigente — sitio web único

La revisión del 15-09-2026 conserva estas reglas y sustituye el cliente de escritorio por módulos del mismo sitio web. Aplicar DEC-021 y [012](../012-unified-web/spec.md). Pruebas históricas de Electron/SQLite no sustituyen aceptación en navegador. Impresión, cajón y recuperación del perfil se verifican antes de operar; no exigir instalador de escritorio.
