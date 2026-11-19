import { z } from "zod";
import { cleanData } from "../client.js";
export const VAT_CASE_ENUM = z.enum([
    "standard",
    "small_business_regulation",
    "b2c_eu_goods",
    "b2c_noneu_goods",
    "b2b_eu_goods",
    "b2b_eu_services",
    "b2b_noneu_goods",
    "b2b_noneu_services",
]);
/** Line item for invoices, estimates and recurring invoices. */
export const LineItemSchema = z.object({
    article_number: z.string().optional().describe("Article/product number"),
    description: z.string().describe("Item description (required)"),
    quantity: z.number().optional().describe("Quantity (default 1)"),
    unit: z.string().optional().describe("Unit (e.g. Stück, Stunde, Pauschal)"),
    unit_price: z.number().describe("Unit price (required)"),
    vat_percent: z.number().describe("VAT percentage, e.g. 19 (required)"),
    is_gross: z.number().optional().describe("Price is gross (1) or net (0)"),
    discount_percent: z.number().min(0).max(100).optional().describe("Item discount in percent (0-100)"),
    discount_amount: z.number().optional().describe("Item discount as net amount"),
    sort_order: z.number().optional().describe("Sort order of item"),
});
export function mapLineItems(items) {
    return items.map((i) => cleanData({
        ARTICLE_NUMBER: i.article_number,
        DESCRIPTION: i.description,
        QUANTITY: i.quantity,
        UNIT: i.unit,
        UNIT_PRICE: i.unit_price,
        VAT_PERCENT: i.vat_percent,
        IS_GROSS: i.is_gross,
        DISCOUNT_PERCENT: i.discount_percent,
        DISCOUNT_AMOUNT: i.discount_amount,
        SORT_ORDER: i.sort_order,
    }));
}
/** Document-level discount fields (invoice, estimate, recurring). */
export const documentDiscountParams = {
    discount_percent: z.number().min(0).max(100).optional().describe("Document discount in percent (0-100)"),
    discount_amount: z.number().optional().describe("Document discount as amount (always net)"),
};
export const SUBTYPE_ENUM = z.enum(["standard", "progress_invoice", "final_invoice"]);
/** DELETE_EXISTING_ITEMS=1 without new items would wipe all positions. */
export function assertItemsWhenReplacing(deleteExisting, items) {
    if (deleteExisting === 1 && (!items || items.length === 0)) {
        throw new Error("delete_existing_items=1 requires at least one new item, otherwise all positions would be deleted.");
    }
}
export const WEBHOOK_EVENTS = [
    "customer.created", "customer.updated", "customer.deleted",
    "invoice.created", "invoice.completed", "invoice.canceled",
    "estimate.created", "estimate.updated",
    "contact.created", "contact.updated", "contact.deleted",
    "cancellation.created", "cancellation.canceled",
];
//# sourceMappingURL=shared.js.map