import type { Action, Role } from './contracts.ts';
const common: Action[] = ['data.read', 'order.write', 'sale.discount', 'sale.cancel',
  'sale.charge', 'shift.open', 'shift.close', 'product.create', 'recipe.create',
  'customer.create', 'loyalty.enroll', 'loyalty.redeem', 'cash.movement'];
const management: Action[] = ['purchase.read', 'purchase.write', 'inventory.manage', 'sale.refund'];
export function defaultActions(role: Role): Action[] {
  switch (role) {
    case 'cashier': return [...common];
    case 'manager': return [...common, ...management];
    case 'owner': return [...common, ...management, 'cost.read', 'cost.write', 'loyalty.adjust', 'settings.manage'];
    default: return [];
  }
}
