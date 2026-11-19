import { z } from "zod";
export declare const VAT_CASE_ENUM: z.ZodEnum<["standard", "small_business_regulation", "b2c_eu_goods", "b2c_noneu_goods", "b2b_eu_goods", "b2b_eu_services", "b2b_noneu_goods", "b2b_noneu_services"]>;
/** Line item for invoices, estimates and recurring invoices. */
export declare const LineItemSchema: z.ZodObject<{
    article_number: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    quantity: z.ZodOptional<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
    unit_price: z.ZodNumber;
    vat_percent: z.ZodNumber;
    is_gross: z.ZodOptional<z.ZodNumber>;
    discount_percent: z.ZodOptional<z.ZodNumber>;
    discount_amount: z.ZodOptional<z.ZodNumber>;
    sort_order: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    description: string;
    unit_price: number;
    vat_percent: number;
    article_number?: string | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    is_gross?: number | undefined;
    discount_percent?: number | undefined;
    discount_amount?: number | undefined;
    sort_order?: number | undefined;
}, {
    description: string;
    unit_price: number;
    vat_percent: number;
    article_number?: string | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    is_gross?: number | undefined;
    discount_percent?: number | undefined;
    discount_amount?: number | undefined;
    sort_order?: number | undefined;
}>;
export type LineItem = z.infer<typeof LineItemSchema>;
export declare function mapLineItems(items: LineItem[]): Record<string, unknown>[];
/** Document-level discount fields (invoice, estimate, recurring). */
export declare const documentDiscountParams: {
    discount_percent: z.ZodOptional<z.ZodNumber>;
    discount_amount: z.ZodOptional<z.ZodNumber>;
};
export declare const SUBTYPE_ENUM: z.ZodEnum<["standard", "progress_invoice", "final_invoice"]>;
/** DELETE_EXISTING_ITEMS=1 without new items would wipe all positions. */
export declare function assertItemsWhenReplacing(deleteExisting: number | undefined, items: LineItem[] | undefined): void;
export declare const WEBHOOK_EVENTS: readonly ["customer.created", "customer.updated", "customer.deleted", "invoice.created", "invoice.completed", "invoice.canceled", "estimate.created", "estimate.updated", "contact.created", "contact.updated", "contact.deleted", "cancellation.created", "cancellation.canceled"];
//# sourceMappingURL=shared.d.ts.map