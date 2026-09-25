import type { Shift } from './pos/store.ts';
import type { SaleV2, RefundV2 } from './orders-domain.ts';
import type { CashMovement } from './pos-domain.ts';

export interface SharedShift {
  shift: Shift;
  sales: SaleV2[];
  refunds: RefundV2[];
  cashMovements: CashMovement[];
  tip: string;
  shipping: string;
}
