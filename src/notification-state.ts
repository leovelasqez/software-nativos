export const notificationStates = ['pending', 'sending', 'accepted', 'sent', 'delivered', 'read', 'failed_retryable', 'failed_terminal', 'uncertain'] as const;
export type NotificationState = typeof notificationStates[number];
export const notificationLabels: Record<NotificationState, string> = {
  pending: 'Pendiente', sending: 'Enviando', accepted: 'Aceptado por WhatsApp', sent: 'Enviado', delivered: 'Entregado', read: 'Leído',
  failed_retryable: 'Reintento pendiente', failed_terminal: 'Error definitivo', uncertain: 'Entrega incierta',
};
export const isNotificationState = (value: unknown): value is NotificationState => typeof value === 'string' && notificationStates.some(state => state === value);

export type DeliveryEvent =
  | { kind: 'transport'; state: 'accepted' | 'failed_retryable' | 'failed_terminal' | 'uncertain' }
  | { kind: 'webhook'; state: 'sent' | 'delivered' | 'read' | 'failed_terminal' };
const progress: Partial<Record<NotificationState, number>> = { accepted: 1, sent: 2, delivered: 3, read: 4 };

/** Merge evidence for the SAME delivery attempt, not a claim/retry of the queue. */
export function transitionDelivery(current: NotificationState, event: DeliveryEvent): NotificationState {
  if (event.kind === 'transport') {
    // A callback can beat the HTTP response, including a definitive failure.
    return progress[current] || current === 'failed_terminal' ? current : event.state;
  }
  const currentRank = progress[current] ?? 0;
  const incomingRank = progress[event.state] ?? 0;
  if (currentRank >= 3 && incomingRank < currentRank) return current;
  if (incomingRank) return currentRank > incomingRank ? current : event.state;
  return event.state;
}
