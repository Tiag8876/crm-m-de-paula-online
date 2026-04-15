export type ReceivableStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export type ReceivablePaymentMethod =
  | 'pix'
  | 'bank_transfer'
  | 'credit_card'
  | 'boleto'
  | 'cash';

export interface Receivable {
  id: string;
  leadId: string;
  description: string;
  amount: number;
  dueDate: string;
  paidDate?: string | null;
  status: ReceivableStatus;
  paymentMethod?: ReceivablePaymentMethod;
  invoiceNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivablesResponse {
  receivables: Receivable[];
}

export interface ReceivablesSummary {
  totals: {
    pending: number;
    paid: number;
    overdue: number;
  };
  byMonth: Array<{
    month: string;
    pending: number;
    paid: number;
    overdue: number;
  }>;
}
