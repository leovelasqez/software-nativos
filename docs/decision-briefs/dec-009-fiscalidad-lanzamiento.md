# DEC-009 — Decisión requerida: emisión fiscal al reemplazar Alegra

Estado: propuesta operativa; no constituye asesoría fiscal, no identifica obligaciones legales y no autoriza emitir documentos, contratar proveedor ni publicar el sitio. Afecta REQ-011-05, AC-011-05 y el corte conjunto de Milán/Centro.

## Hechos ya establecidos

- La aplicación local emite comprobantes internos; estos no se presentan como documentos fiscales.
- Los impuestos de producto pueden permanecer sin asignar. Un campo vacío no equivale a tasa 0 % ni a exención.
- Nativos quiere reemplazar Alegra, pero la fiscalidad aplicable, tasas concretas, numeración, proveedor y procedimiento de contingencia no están definidos.

## Resoluciones que debe entregar el contador u operación autorizada

1. Qué documentos fiscales debe emitir cada local, en qué casos y desde qué fecha de corte.
2. Tasas, tratamientos y campos obligatorios por producto/documento; cómo tratar productos cuyo impuesto sigue sin asignar.
3. Responsable, proveedor o mecanismo autorizado de emisión, numeración, credenciales y ambiente de prueba.
4. Regla de contingencia si el emisor fiscal no está disponible y procedimiento de conciliación posterior.
5. Retención, acceso y reconciliación entre comprobante interno, documento fiscal y medio de pago.

## Alternativas a evaluar por la operación

### A. Integrar un proveedor fiscal autorizado

La aplicación conserva la venta/comprobante interno y solicita el documento fiscal al proveedor después de validar el cobro. Requiere contrato, credenciales fuera del repositorio, prueba en entorno autorizado, gestión de respuestas inciertas y conciliación.

### B. Emitir mediante una plataforma autorizada separada durante el piloto

Caja registra la operación interna y un responsable emite el documento fiscal en la plataforma aprobada. Reduce el cambio técnico inicial, pero agrega un paso manual y exige una conciliación diaria que detecte omisiones o duplicados.

### C. Mantener temporalmente la emisión fiscal en el sistema anterior

Solo es admisible si la operación y el contador autorizan explícitamente un período de transición, con corte, responsables y conciliación. No equivale al reemplazo final de Alegra y no puede asumirse sin autorización.

## Criterios de aceptación tras la decisión

1. La regla fiscal, tasas, documentos, proveedor/mecanismo y contingencia están aprobados por el responsable competente.
2. El flujo elegido asocia de forma trazable venta, comprobante interno y documento fiscal sin repetir un cobro ante un fallo de red o impresión.
3. Credenciales y datos fiscales sensibles no aparecen en repositorio, auditoría, exportaciones, respaldo ni caché de Caja.
4. Una prueba autorizada por cada local registra emisión, rechazo y recuperación/conciliación de respuesta incierta.
5. El corte conjunto se bloquea si la configuración fiscal obligatoria no está aprobada o validada.

## Preguntas para resolver

- ¿Qué documento debe emitir Nativos para cada operación y qué responsable lo confirma?
- ¿Qué tasas y tratamientos corresponden a cada producto activo?
- ¿Qué proveedor/mecanismo, ambiente de prueba y responsable de credenciales se usarán?
- ¿Qué plazo y responsable resuelven una emisión incierta o caída del proveedor?
- ¿Se aprueba un piloto transitorio? Si sí, ¿cuál es su fecha de fin y cómo se concilia?
