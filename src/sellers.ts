/** REQ-020-01: commercial identity, independent of authentication. */
export interface Seller {
  id: string;
  version: number;
  name: string;
  active: boolean;
  branchIds: string[];
}

export interface ProductCommission { productId: string; version: number; amount: string | null }
export interface CommissionLine {
  lineId: string; productId: string; quantity: string;
  unitAmount: string | null; ruleVersion: number | null; amount: string | null;
}
export interface SellerAttribution {
  sellerId: string; sellerName: string; sellerVersion: number; sellerSnapshotId: string;
  commissionLines: CommissionLine[]; commissionAmount: string | null;
  commissionKnown: string; commissionPending: number;
}
