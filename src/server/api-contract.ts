import contract from '../../contracts/foundation-api-v1.json' with { type: 'json' };
interface OperationContract {
  requestBody?: { content: { 'application/json': { schema: object } } };
  responses: Record<string, { content: { 'application/json': { schema: object } } }>;
  parameters: { name: string; in: string; required: boolean; schema: object }[];
}
const paths = contract.paths as unknown as Record<string, Record<string, OperationContract>>;
export function routeSchema(path: string, method: string) {
  const op = paths[path]?.[method];
  if (!op) throw new Error('route_missing_from_contract');
  function parameters(location: string) {
    const props = op!.parameters.filter(p => p.in === location);
    return { type: 'object', additionalProperties: false,
      properties: Object.fromEntries(props.map(p => [p.name, p.schema])), required: props.filter(p => p.required).map(p => p.name) };
  }
  return { ...(op.requestBody ? { body: op.requestBody.content['application/json'].schema } : {}),
    params: parameters('path'), querystring: parameters('query'),
    response: Object.fromEntries(Object.entries(op.responses).map(([code, value]) => [code, value.content['application/json'].schema])) };
}
