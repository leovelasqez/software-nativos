# Protocolo de aceptación física — Impresión y cajón

Estado: preparado; no ejecutado. Aplica a AC-011-07 y debe completarse presencialmente antes del lanzamiento. No acreditar compatibilidad por una prueba visual, un modelo de etiqueta o una prueba histórica de Electron.

## Equipos confirmados

| Local | Impresora | Conexión y formato | Uso |
| --- | --- | --- | --- |
| Milán | T80A | USB, 80 mm; etiqueta indica ESC/POS | Comprobantes y comandas |
| Centro | NP / New Print T82E | USB, 80 mm; no asumir ESC/POS | Comprobantes y comandas |

## Preparación por local

1. Registrar Windows, navegador y versión del controlador; confirmar que la impresora correcta aparece disponible en el navegador.
2. Verificar papel de 80 mm, márgenes, escala y nombre de impresora; no habilitar impresión silenciosa ni una impresora predeterminada sin confirmar el equipo físico.
3. Abrir Caja en el mismo perfil y origen que operará el local. Registrar el estado de conexión y la última sincronización antes de cada caso.
4. Usar únicamente datos de ensayo autorizados o una base/perfil de prueba. No repetir cobros reales para diagnosticar impresión.

## Casos de aceptación

| ID | Caso | Resultado esperado | Evidencia mínima |
| --- | --- | --- | --- |
| HW-01 | Comprobante online | La ventana del navegador permite elegir la impresora del local y sale legible en 80 mm | Foto o escaneo, fecha, navegador y nombre de impresora |
| HW-02 | Comanda online | Sale en la misma impresora del local y no descuenta inventario por imprimir | Comanda y registro de pedido antes/después |
| HW-03 | Comprobante offline | La interfaz conserva el comprobante local y la impresión no duplica cobro ni pendiente | Estado de Caja antes/después y comprobante |
| HW-04 | Comanda offline | Se imprime o queda claramente registrada la limitación del navegador; no duplica pedido ni consumo | Estado de pedido y resultado físico |
| HW-05 | Error de impresión | Cancelar/error de diálogo no vuelve a ejecutar venta, consumo, movimiento de Caja ni comanda | Operación única y registro del error |
| HW-06 | Apertura de cajón | El método físico compatible, si existe, abre solo a solicitud explícita y no condiciona el cobro | Método, resultado y modelo de cajón |
| HW-07 | Recuperación tras reinicio | Reiniciar navegador y confirmar que pedido/comprobante/pending de ensayo conservan su identidad | Captura de Caja y comparación de IDs de ensayo |

## Criterio de aprobación

Cada local aprueba únicamente si HW-01 a HW-05 y HW-07 son correctos. HW-06 se registra aparte: su falta no se oculta ni se resuelve repitiendo una venta. Cualquier ajuste de CSS, diálogo de impresión, controlador o configuración debe volver a ejecutar los casos afectados en ambos locales.

## Registro que debe anexarse a la evidencia

Para cada caso: local, equipo, fecha/hora America/Bogota, operador, navegador/versión, controlador, estado online/offline, ID sintético, resultado, captura/foto y anomalía. No guardar datos de clientes, credenciales ni comprobantes comerciales en la evidencia.
