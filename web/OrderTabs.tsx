import { useEffect, useRef } from 'react';
import type { OrderV2 } from '../src/orders-domain.ts';
import { Icon } from './Icon.tsx';
import { orderTabLabel } from './order-navigation.ts';

export function OrderTabs({ orders, selected, numbers, disabled, canCreate, amount, select, create, rename, close }: {
  orders: OrderV2[]; selected: string; numbers: Record<string, number>; disabled: boolean; canCreate: boolean;
  amount: (order: OrderV2) => string; select: (id: string) => void; create: () => void;
  rename: (order: OrderV2) => void; close: (order: OrderV2) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll just this strip, never the catalog or the mobile page.
    const tab = list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.parentElement;
    const strip = list.current;
    if (!tab || !strip) return;
    const reveal = () => {
      const left = tab.offsetLeft;
      if (left < strip.scrollLeft) strip.scrollLeft = left;
      else if (left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth)
        strip.scrollLeft = left + tab.offsetWidth - strip.clientWidth;
    };
    reveal();
    const resize = new ResizeObserver(reveal);
    resize.observe(strip);resize.observe(tab);
    return () => resize.disconnect();
  }, [selected, orders.length]);

  return <div className="pos-order-tabs">
    {/* Own only the tabs: sibling close buttons stay independent accessible controls. */}
    <div role="tablist" aria-label="Ventas abiertas" aria-owns={orders.map(order => `order-tab-${order.id}`).join(' ')}/>
    <div className="pos-order-tab-list" ref={list}>
      {orders.map((order, index) => {
        const label = orderTabLabel(order, numbers[order.id]);
        const active = order.id === selected;
        return <div className={`pos-order-tab ${active ? 'is-active' : ''}`} key={order.id}>
          <button type="button" className="order-tab-label"
            role="tab" id={`order-tab-${order.id}`} data-order-id={order.id}
            aria-selected={active} aria-controls="pos-sale-panel" aria-label={label} tabIndex={active ? 0 : -1}
            title={`${label} · ${order.lines.length} líneas · ${amount(order)}`} aria-disabled={disabled} aria-keyshortcuts="F2 Delete"
            onClick={() => { if (!disabled) select(order.id); }} onKeyDown={event => {
              if (disabled || event.target !== event.currentTarget) return;
              let next: number | undefined;
              if (event.key === 'ArrowRight') next = (index + 1) % orders.length;
              if (event.key === 'ArrowLeft') next = (index + orders.length - 1) % orders.length;
              if (event.key === 'Home') next = 0;
              if (event.key === 'End') next = orders.length - 1;
              if (next !== undefined) {
                event.preventDefault();
                list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
                select(orders[next]!.id);
              }
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(order.id); }
              if (event.key === 'F2') { event.preventDefault(); rename(order); }
              if (event.key === 'Delete') { event.preventDefault(); close(order); }
            }}>
            <Icon name="purchases"/><span>{label}</span>
            {order.lines.length > 0 && <span className="order-tab-count" aria-hidden="true">{order.lines.length}</span>}
          </button>
          <button type="button" className="order-tab-rename" aria-label={`Cambiar nombre de ${label}`} title={`Cambiar nombre de ${label}`}
            disabled={disabled} onClick={event => { event.stopPropagation(); rename(order); }}><Icon name="edit"/></button>
          <button type="button" className="order-tab-close" aria-label={`Cerrar ${label}`} title={`Cerrar ${label}`}
            disabled={disabled} onClick={event => { event.stopPropagation(); close(order); }}><Icon name="close"/></button>
        </div>;
      })}
    </div>
    <button type="button" className="order-tab-add" aria-label="+ Nuevo pedido" title="Nueva venta"
      disabled={disabled || !canCreate} onClick={create}><Icon name="plus"/></button>
  </div>;
}
