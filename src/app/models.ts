export interface Category {
  id: string;
  name: string;
  suggestedPct: number;
  perGuest: boolean;
  responsible?: string;
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
}

export interface ContractMetadata {
  path: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export interface WeddingBudget {
  guests: number;
  maxBudget: number;
  categories: Category[];
  expenses: Expense[];
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
}

export interface BudgetResponse extends WeddingBudget {
  users?: User[];
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

export interface ProfileShare {
  categoryId: string;
  name: string;
  pct: number;
  /** Categoria fora das padrão, reconhecida pelo prefixo do nome. */
  namePrefix?: string;
}

export interface PercentageProfile {
  id: string;
  name: string;
  description: string;
  shares: ProfileShare[];
}

export const slugify = (text: string): string =>
  text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const ASSESSORIA_ID = 'assessoria-cerimonial';

const SHARE_NAMES: Record<string, string> = {
  ...Object.fromEntries(
    DEFAULT_CATEGORIES.map((category) => [category.id, category.name]),
  ),
  [ASSESSORIA_ID]: 'Assessoria/Cerimonial',
};

const createProfile = (
  id: string,
  name: string,
  description: string,
  pcts: Record<string, number>,
): PercentageProfile => ({
  id,
  name,
  description,
  shares: Object.keys(SHARE_NAMES).map((categoryId) => ({
    categoryId,
    name: SHARE_NAMES[categoryId],
    pct: pcts[categoryId] ?? 0,
    ...(categoryId === ASSESSORIA_ID && { namePrefix: 'assessoria' }),
  })),
});

export const PERCENTAGE_PROFILES: PercentageProfile[] = [
  createProfile(
    'padrao',
    'Padrão',
    'Volta aos percentuais originais das categorias cadastradas.',
    Object.fromEntries(
      DEFAULT_CATEGORIES.map((category) => [
        category.id,
        category.suggestedPct,
      ]),
    ),
  ),
  createProfile(
    'agressivo',
    'Perfil agressivo',
    'Concentra o orçamento na festa e na experiência dos convidados.',
    {
      'espaco-cerimonia': 15,
      'buffet-comida': 28,
      bebidas: 12,
      'decoracao-flores': 12,
      'fotografia-video': 10,
      'musica-dj-banda': 10,
      'vestido-traje': 4,
      'convites-papelaria': 1,
      'bolo-doces': 3,
      lembrancinhas: 1,
      beleza: 1,
      aliancas: 2,
      outros: 1,
    },
  ),
  createProfile(
    'basico',
    'Focado no básico',
    'Local, Decoração, Buffet e Assessoria; o restante fica em 0%.',
    {
      'espaco-cerimonia': 30,
      'buffet-comida': 35,
      'decoracao-flores': 20,
      [ASSESSORIA_ID]: 15,
    },
  ),
];
