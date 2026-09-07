export interface Category {
  id: string;
  name: string;
  suggestedPct: number;
  perGuest: boolean;
}

export interface ContractMetadata {
  path: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  supplier: string;
  description?: string;
  estimated: number;
  contracted: number;
  paid: number;
  contract?: ContractMetadata;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WeddingBudget {
  guests: number;
  maxBudget: number;
  categories: Category[];
  expenses: Expense[];
}
