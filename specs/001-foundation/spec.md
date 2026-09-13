# 001 — Identidad, sucursales, permisos e interfaz

Estado: incremento 0 verificado en dominio/contratos; capacidad completa pendiente. Implementación local: autorizada el 13-09-2026; pendiente según hoja de ruta. Fuente: plan, secciones 1–3, 10 y 14.

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

Contrato offline compartido con 007. DEC-003/004/012 afectan acceso, confidencialidad y operación. Alcance del incremento 0 definido en plan.md. Evidencia parcial disponible; API/UI/persistencia pendientes.

## Alcance entregado — Incremento 0

Ver [plan](plan.md), [tareas](tasks.md) y [evidencia](../../docs/evidence/increment-0.md). Se ejecutaron pruebas de políticas y esquemas; los AC originales que requieren servidor, almacenamiento, UI o reinicios NO están acreditados integralmente. No hay operación comercial real.
