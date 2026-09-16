export type BaseUnit = 'g' | 'ml' | 'unit';
export interface Item { id: string; name: string; reference: string; kind: 'raw' | 'consumable' | 'finished'; baseUnit: BaseUnit }
export interface Product { id: string; type: 'finished' | 'prepared'; name: string; reference: string; category: string; unit: 'unit'; presentation: string; price: string; tax: { label: string; rate: string; exempt: boolean } | null; description: string; version: number; activeRecipeVersion: number | null; sellable: boolean }
export interface Conversion { factor: string; source: string }
export interface RecipeLine { id: string; itemId: string; quantity: string | null; unit: string; conversion: Conversion | null; kind: 'ingredient' | 'packaging'; baseQuantity?: string | null }
export interface RecipeOption { id: string; name: string; kind: 'addition' | 'substitution'; replacesLineId: string | null; price: string | null; line: RecipeLine }
export interface Recipe { id: string; productId: string; version: number; name: string; instructions: string; state: 'draft' | 'active'; lines: RecipeLine[]; options: RecipeOption[] }
const SCALE = 1_000_000n;
export class CatalogError extends Error {}
export function decimal(value: string): bigint {
  if (!/^(0|[1-9][0-9]{0,23})(\.[0-9]{1,6})?$/.test(value)) throw new CatalogError('Número decimal inválido.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * SCALE + BigInt(fraction.padEnd(6, '0'));
}
export function formatted(value: bigint): string {
  if (value < 0n) return `-${formatted(-value)}`;
  const fraction = (value % SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  return `${value / SCALE}${fraction ? '.' + fraction : ''}`;
}
export function multiply(a: string, b: string): string {
  const n = decimal(a) * decimal(b);
  if (n % SCALE) throw new CatalogError('La conversión requiere más de seis decimales. Revisa la cantidad.');
  const result = formatted(n / SCALE);
  if (result.split('.')[0]!.length > 24) throw new CatalogError('Cantidad fuera del rango permitido.');
  return result;
}
export function toBase(quantity: string, unit: string, baseUnit: BaseUnit, conversion: Conversion | null): string {
  const known = unit === baseUnit ? '1' : unit === 'kg' && baseUnit === 'g' || unit === 'l' && baseUnit === 'ml' ? '1000' : null;
  if (known && conversion && decimal(conversion.factor) !== decimal(known)) throw new CatalogError('El factor contradice la conversión de unidad base.');
  const factor = known ?? conversion?.factor;
  if (!factor || decimal(factor) <= 0n || (!known && (conversion?.source.trim().length ?? 0) < 2)) throw new CatalogError('Falta una conversión documentada a la unidad base.');
  return multiply(quantity, factor);
}
export function freezeRecipe(input: Recipe, items: Map<string, Item>): Recipe {
  const active = input.state === 'active';
  const ids = new Set<string>();
  function line(value: RecipeLine, label: string): RecipeLine {
    const item = items.get(value.itemId);
    if (!item || item.kind === 'finished') throw new CatalogError(`${label}: selecciona una materia prima o consumible.`);
    let baseQuantity: string | null = null;
    try {
      if (value.quantity === null || decimal(value.quantity) <= 0n) throw new CatalogError('Falta una cantidad mayor que cero.');
      baseQuantity = toBase(value.quantity, value.unit, item.baseUnit, value.conversion);
    } catch (e) { if (active) throw new CatalogError(`${label}: ${(e as Error).message}`); }
    return { ...value, baseQuantity };
  }
  if (active && !input.lines.some(l => l.kind === 'ingredient')) throw new CatalogError('Agrega al menos un ingrediente antes de activar.');
  const lines = input.lines.map((v, i) => {
    if (ids.has(v.id)) throw new CatalogError('Identificadores de líneas duplicados.'); ids.add(v.id);
    return line(v, `Línea ${i + 1}`);
  });
  const optionIds = new Set<string>();
  const options = input.options.map((o, i) => {
    if (optionIds.has(o.id)) throw new CatalogError('Opciones duplicadas.'); optionIds.add(o.id);
    if (o.kind === 'substitution' ? !ids.has(o.replacesLineId ?? '') : o.replacesLineId !== null) throw new CatalogError(`Opción ${i + 1}: línea reemplazada inválida.`);
    if (active && o.price === null) throw new CatalogError(`Opción ${i + 1}: falta el precio adicional (puede ser cero).`);
    return { ...o, line: line(o.line, `Opción ${i + 1}`) };
  });
  return { ...input, lines, options };
}
export function consumption(recipe: Recipe, optionIds: string[] = []) {
  if (recipe.state !== 'active') throw new CatalogError('La receta no está activa.');
  if (new Set(optionIds).size !== optionIds.length) throw new CatalogError('Selección de opciones duplicada.');
  const lines = new Map(recipe.lines.map(l => [l.id, l])); const replaced = new Set<string>(); let extraPrice = 0n;
  const additions: RecipeLine[] = [];
  for (const id of optionIds) {
    const option = recipe.options.find(o => o.id === id);
    if (!option || option.price === null) throw new CatalogError('Opción inválida.');
    if (option.kind === 'substitution') {
      if (!option.replacesLineId || replaced.has(option.replacesLineId)) throw new CatalogError('Solo una sustitución por línea.');
      replaced.add(option.replacesLineId); lines.delete(option.replacesLineId);
    }
    additions.push(option.line); extraPrice += decimal(option.price);
  }
  const quantities = new Map<string, bigint>();
  for (const l of [...lines.values(), ...additions]) {
    if (!l.baseQuantity) throw new CatalogError('Receta sin consumo validado.');
    quantities.set(l.itemId, (quantities.get(l.itemId) ?? 0n) + decimal(l.baseQuantity));
  }
  return { items: [...quantities].map(([itemId, quantity]) => ({ itemId, quantity: formatted(quantity) })), extraPrice: formatted(extraPrice) };
}
export function recipeCost(recipe: Recipe, costs: Map<string, string | null>): string | null {
  let cost = 0n;
  for (const l of consumption(recipe).items) {
    const unitCost = costs.get(l.itemId); if (unitCost === null || unitCost === undefined) return null;
    cost += decimal(multiply(l.quantity, unitCost));
  }
  return formatted(cost);
}
