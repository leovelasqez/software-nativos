import { ArrowDownUp, ArrowRight, ArrowUpRight, Bell, Boxes, Building2, CalendarCheck, CalendarDays, ChartNoAxesCombined, Check, CircleAlert, ClipboardList, CreditCard, FileClock, HeartHandshake, LayoutDashboard, LogOut, Menu, Moon, NotebookText, Package, Plus, ReceiptText, RefreshCw, Search, ShieldCheck, ShoppingBag, Store, Sun, TriangleAlert, Truck, Users, Wallet, X } from 'lucide-react';

const icons = { dashboard: LayoutDashboard, store: Store, boxes: Boxes, branches: Building2, recipes: NotebookText, users: Users, loyalty: HeartHandshake, reports: ChartNoAxesCombined, audit: FileClock, notifications: Bell, backup: ShieldCheck, package: Package, purchases: ShoppingBag, transfers: Truck, counts: ClipboardList, wallet: Wallet, calendar: CalendarDays, month: CalendarCheck, receipt: ReceiptText, payments: CreditCard, movements: ArrowDownUp, next: ArrowRight, link: ArrowUpRight, refresh: RefreshCw, search: Search, plus: Plus, warning: TriangleAlert, error: CircleAlert, check: Check, logout: LogOut, menu: Menu, moon: Moon, sun: Sun, close: X };
export type IconName = keyof typeof icons;
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const Component = icons[name];
  return <Component size={20} strokeWidth={1.65} className={`ui-icon ${className}`} aria-hidden="true" focusable="false" />;
}
