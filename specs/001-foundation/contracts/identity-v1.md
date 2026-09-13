# Identidad y permisos v1

REQ-001-01/02/03/04; AC-001-01/02/03 parcial; DEC-001/004.

Esquema normativo: `contracts/identity-v1.schema.json`. Un principal tiene id opaco, tipo human/agent, rol owner/manager/cashier, activo, sucursales explícitas y acciones concedidas. IDs no derivan de documento/celular. El servidor resuelve sesiones opacas revocables y carga estos datos desde almacenamiento confiable. No acepta rol, alcance ni autorización declarados por el cliente. Login, expiración de sesión, hashing de contraseña y rate limiting se detallarán antes del incremento 1.

Acciones v1: data.read, order.write, sale.discount, sale.cancel, sale.charge, shift.open, shift.close, product.create, recipe.create, customer.create, loyalty.enroll, loyalty.redeem, purchase.read, purchase.write, inventory.manage, sale.refund, cost.read, cost.write, loyalty.adjust, settings.manage.

Perfiles iniciales: los tres roles pueden consultar, operar pedidos/caja, descontar/cancelar y crear productos/recetas/clientes e inscribir/canjear online. Encargado añade compras, inventario administrativo y devolución en su alcance. Dueño añade costos, ajuste de puntos y configuración. Concesiones adicionales permiten configurar perfiles; cost.read/cost.write y loyalty.adjust siempre exigen owner. Cada petición comprueba activo, sucursal y acción. Un actor agent no obtiene privilegios por ser agente; usa permisos explícitos y no opera offline en v1 (MCP inicialmente online).

Datos locales de venta: proyecciones explícitas sin costos, precios de compra ni márgenes, incluso en caja usada antes por dueño. Costeo central separado. Compras administrativas solo online, con importes visibles al encargado de su local; no se distribuyen al caché POS. La proyección mínima de producto de este incremento entrega id, name, finalPrice y taxAssignment; taxAssignment null conserva vacío. Es una frontera de confidencialidad, no el contrato completo del catálogo del incremento 2.

Auditoría futura: auditId, operationId, actorId, actorKind, deviceId, branchId, action, occurredAt, receivedAt, reason (nullable), changes (campos permitidos por operación). El adaptador construye actor/equipo/local desde sesión, no desde entrada sin verificar; append-only, mismo commit que mutación. Nunca contraseñas/tokens ni cuerpos completos en logs; no incluir costos en auditoría entregada a cajero. Correcciones por nuevas operaciones relacionadas. Consulta/exportación aplica el mismo alcance y proyección.

Resultado interno de autorización: allowed o denied con reason estable: invalid_context, inactive, branch_denied, permission_denied, online_required, invalid_grant, offline_expired, clock_untrusted. No expone detalles privados de otras sucursales. Contexto y concesión se validan en runtime. Estas funciones no sustituyen autenticación ni middleware HTTP.
