/** Roles map to the five legacy portals plus platform administration. */
export type UserRole = 'admin' | 'ops' | 'counselor' | 'partner' | 'candidate';

export type Gender = 'M' | 'F' | 'O';

export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'expired' | 'locked';

export type ModuleKind = 'aptitude' | 'interest' | 'personality' | 'demographic';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export type PaymentGateway = 'ccavenue' | 'razorpay';

/** D-27: behaviour of the server-authoritative test timer across candidate disconnects. */
export type TimerDisconnectPolicy = 'keep-running' | 'pause';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
