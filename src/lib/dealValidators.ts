import { z } from 'zod';

const DealStatusEnum = z.enum(['exploring', 'active', 'ready_to_claim', 'claimed', 'closed']);

export const ChecklistItemSchema = z.object({
  id: z.string().optional(),
  action_text: z.string().min(1, 'Action text is required'),
  deadline: z.preprocess((val) => (val === '' ? null : val), z.string().nullable().optional()),
  is_done: z.boolean().default(false),
});

export const BaseDealSchema = z.object({
  id: z.string().optional(),
  company: z.string().min(1, 'Company is required'),
  status: DealStatusEnum.default('exploring'),
  open_date: z.preprocess((val) => (val === '' ? null : val), z.string().nullable().optional()),
  note: z.string().nullable().optional(),
  currency: z.string().default('USD'),
  bonus_amount: z.coerce.number().default(0),
  checklist_items: z.array(ChecklistItemSchema).optional(),
});

export const CreditCardSpecificsSchema = z.object({
  card_name: z.string().min(1, 'Card name is required'),
  target_spend: z.coerce.number().default(0),
  spend_progress: z.coerce.number().default(0),
  action_date: z.preprocess((val) => (val === '' ? null : val), z.string().nullable().optional()),
});

export const CreditCardDealSchema = BaseDealSchema.extend({
  type: z.literal('credit_card'),
  type_specific_data: CreditCardSpecificsSchema,
});

export const BankAccountSpecificsSchema = z.object({
  action_date: z.preprocess((val) => (val === '' ? null : val), z.string().nullable().optional()),
});

export const BankAccountDealSchema = BaseDealSchema.extend({
  type: z.literal('bank_account'),
  type_specific_data: BankAccountSpecificsSchema,
});

export const BrokerageSpecificsSchema = z.object({
  fund_committed: z.coerce.number().default(0),
  action_date: z.preprocess((val) => (val === '' ? null : val), z.string().nullable().optional()),
});

export const BrokerageDealSchema = BaseDealSchema.extend({
  type: z.literal('brokerage_account'),
  type_specific_data: BrokerageSpecificsSchema,
});

export const OtherDealSchema = BaseDealSchema.extend({
  type: z.literal('other'),
  type_specific_data: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const DealSchema = z.discriminatedUnion('type', [
  CreditCardDealSchema,
  BankAccountDealSchema,
  BrokerageDealSchema,
  OtherDealSchema,
]);

export type Deal = z.infer<typeof DealSchema>;
export type DealStatus = z.infer<typeof DealStatusEnum>;
export type CreditCardDeal = z.infer<typeof CreditCardDealSchema>;
export type BankAccountDeal = z.infer<typeof BankAccountDealSchema>;
export type BrokerageDeal = z.infer<typeof BrokerageDealSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export interface DealRow {
  id: string;
  user_id: string;
  company: string;
  type: 'credit_card' | 'bank_account' | 'brokerage_account' | 'other';
  status: DealStatus;
  open_date: string | null;
  note: string | null;
  currency: string;
  bonus_amount: number;
  type_specific_data?: {
    card_name?: string;
    target_spend?: number;
    spend_progress?: number;
    action_date?: string | null;
    fund_committed?: number;
    [key: string]: unknown;
  } | null;
  created_at?: string;
  updated_at?: string;
  deal_checklist_items?: ChecklistItem[];
}
