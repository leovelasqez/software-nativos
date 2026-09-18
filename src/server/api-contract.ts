import contract from '../../contracts/foundation-api-v1.json' with { type: 'json' };
import catalogContract from '../../contracts/catalog-inventory-v1.json' with { type: 'json' };
import catalogLifecycleContract from '../../contracts/catalog-lifecycle-v1.json' with { type: 'json' };
import costReconciliationContract from '../../contracts/cost-reconciliation-v1.json' with { type: 'json' };
import posContract from '../../contracts/pos-api-v1.json' with { type: 'json' };
interface OperationContract {
  requestBody?: { content: { 'application/json': { schema: object } } };
  responses: Record<string, { content: { 'application/json': { schema: object } } }>;
  parameters: { name: string; in: string; required: boolean; schema: object }[];
}
const paths = { ...contract.paths, ...catalogContract.paths, ...catalogLifecycleContract.paths, ...costReconciliationContract.paths, ...posContract.paths } as unknown as Record<string, Record<string, OperationContract>>;
function resolveLifecycleReference(value: object): object {
  const ref = (value as { $ref?: string }).$ref;
  if (!ref?.startsWith('#/components/')) return value;
  const [, , section, name] = ref.split('/');
  if (!section || !name) return value;
  return (catalogLifecycleContract.components as Record<string, Record<string, object>>)[section]?.[name] ?? value;
}
export function routeSchema(path: string, method: string) {
  const op = paths[path]?.[method];
  if (!op) throw new Error('route_missing_from_contract');
  function parameters(location: string) {
    const props = op!.parameters.filter(p => p.in === location);
    return { type: 'object', additionalProperties: false,
      properties: Object.fromEntries(props.map(p => [p.name, p.schema])), required: props.filter(p => p.required).map(p => p.name) };
  }
  return { ...(op.requestBody ? { body: resolveLifecycleReference(op.requestBody.content['application/json'].schema) } : {}),
    params: parameters('path'), querystring: parameters('query'),
    response: Object.fromEntries(Object.entries(op.responses).map(([code, value]) => {
      const resolved = resolveLifecycleReference(value) as { content: { 'application/json': { schema: object } } };
      return [code, resolved.content['application/json'].schema];
    })) };
}
