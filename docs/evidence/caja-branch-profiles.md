# Evidencia — 015 Perfiles de Caja por sucursal y comprobante térmico

Fecha: 18-09-2026. Entorno: piloto local `http://127.0.0.1:4410`, base aislada `.local/pilot`.

## Resultado local

- La Caja mostró el selector de sucursal y conmutó entre los perfiles de Centro y Milán después de sincronizar, sin mostrar el error de autorización de Administración.
- Se comprobó que los snapshots de Caja usan `centro-venta` para Centro y `milan-venta` para Milán; los consumos de venta se registran contra la bodega indicada por su snapshot.
- Un traslado entre las bodegas de venta se presentó como `Centro · Bodega de venta → Milán · Bodega de venta`, tanto en la lista como en la recepción. La revisión no registró una recepción ni modificó existencias.
- El comprobante interno incorporó un botón de impresión y una superficie blanco/negro. El CSS de impresión limita el contenido al comprobante y define papel de 80 mm; no se accionó una impresora física durante esta revisión.

## Verificación ejecutada

```text
npm run typecheck
npm run build
```

Ambos comandos finalizaron correctamente el 18-09-2026. La revisión funcional se realizó en Caja local; no se almacenan aquí clientes, identificadores de comprobantes, contraseñas ni datos financieros.

## Límites

Esto no acredita papel, márgenes reales, escala del controlador, impresión offline, comandas ni cajón. Deben ejecutarse los casos HW-01 a HW-05 y HW-07 de `docs/operations/hardware-acceptance.md` en T80A/Milán y T82E/Centro antes de habilitar ventas reales.
