export type OrderId = string;

export type Customer = {
  name: string;
};

export type Address = {
  full: string;
};

export type ProductLine = {
  name: string;
};

export type OrderSummary = {
  orderId: OrderId;
  createdAt: string; // ISO
  customer: Customer;
  address: Address;
  products: ProductLine[];

  labelPrintedAt?: string; // ISO
  driverTakenAt?: string; // ISO

  misPichosAssignedAt?: string; // ISO
  petchopAssignedAt?: string; // ISO

  firstAttemptAt?: string; // ISO
  secondAttemptAt?: string; // ISO

  scheduledFor?: string; // ISO (reprogramar)
};

export type Transaction = {
  transactionId: string;
  orderIds: OrderId[];
  createdAt: string; // ISO
};

export type OperationsDataset = {
  now: string; // ISO
  orders: OrderSummary[];
  transactions: Transaction[];
};

