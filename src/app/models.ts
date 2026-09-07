export interface Category {
  id: string;
  name: string;
  suggestedPct: number;
  perGuest: boolean;
}

export interface Expense {
  id: string;
  categoryId: string;
  supplier: string;
  description?: string;
  estimated: number;
  contracted: number;
  paid: number;
}

export interface WeddingBudget {
  guests: number;
  maxBudget: number;
  categories: Category[];
  expenses: Expense[];
}

export interface CategorySummary extends Category {
  suggested: number;
  perGuestAmount: number;
  estimated: number;
  contracted: number;
  paid: number;
  difference: number;
  progress: number;
}

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'espaco-cerimonia',
    name: 'Espaço/Cerimônia',
    suggestedPct: 15,
    perGuest: false,
  },
  {
    id: 'buffet-comida',
    name: 'Buffet/Comida',
    suggestedPct: 30,
    perGuest: true,
  },
  { id: 'bebidas', name: 'Bebidas', suggestedPct: 8, perGuest: true },
  {
    id: 'decoracao-flores',
    name: 'Decoração/Flores',
    suggestedPct: 10,
    perGuest: false,
  },
  {
    id: 'fotografia-video',
    name: 'Fotografia/Vídeo',
    suggestedPct: 10,
    perGuest: false,
  },
  {
    id: 'musica-dj-banda',
    name: 'Música/DJ/Banda',
    suggestedPct: 6,
    perGuest: false,
  },
  {
    id: 'vestido-traje',
    name: 'Vestido e Traje',
    suggestedPct: 6,
    perGuest: false,
  },
  {
    id: 'convites-papelaria',
    name: 'Convites/Papelaria',
    suggestedPct: 2,
    perGuest: true,
  },
  { id: 'bolo-doces', name: 'Bolo/Doces', suggestedPct: 4, perGuest: true },
  {
    id: 'lembrancinhas',
    name: 'Lembrancinhas',
    suggestedPct: 2,
    perGuest: true,
  },
  {
    id: 'beleza',
    name: 'Beleza (cabelo/maquiagem)',
    suggestedPct: 2,
    perGuest: false,
  },
  { id: 'aliancas', name: 'Alianças', suggestedPct: 3, perGuest: false },
  { id: 'outros', name: 'Outros', suggestedPct: 2, perGuest: false },
];
