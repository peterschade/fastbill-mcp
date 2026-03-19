import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, cleanData } from "../client.js";
import { formatCustomers } from "../formatters.js";

export function registerCustomerTools(server: McpServer) {
  server.tool(
    "customer_get",
    "Get customers from Fastbill. Returns compact summary by default (number, name, type, city, email). Set detailed=true for full raw JSON.",
    {
      customer_id: z.string().optional().describe("Filter by customer ID"),
      customer_number: z.string().optional().describe("Filter by customer number"),
      country_code: z.string().optional().describe("Filter by country (ISO 3166 ALPHA-2, e.g. DE, AT, CH)"),
      city: z.string().optional().describe("Filter by city"),
      term: z.string().optional().describe("Search in ORGANIZATION, FIRST_NAME, LAST_NAME, ADDRESS, ZIPCODE, EMAIL, TAGS"),
      limit: z.number().optional().describe("Max results (default 10, max 100)"),
      offset: z.number().optional().describe("Pagination offset"),
      detailed: z.boolean().optional().describe("Return full raw JSON instead of compact summary (default false)"),
    },
    async (params) => {
      const client = getClient();
      const result = await client.request({
        SERVICE: "customer.get",
        FILTER: cleanData({
          CUSTOMER_ID: params.customer_id,
          CUSTOMER_NUMBER: params.customer_number,
          COUNTRY_CODE: params.country_code,
          CITY: params.city,
          TERM: params.term,
        }),
        LIMIT: params.limit ?? 10,
        OFFSET: params.offset,
      });
      const text = params.detailed
        ? JSON.stringify(result.RESPONSE, null, 2)
        : formatCustomers(result.RESPONSE);
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "customer_create",
    "Create a new customer in Fastbill. CUSTOMER_TYPE and LAST_NAME are required. For business customers, ORGANIZATION is also required.",
    {
      customer_type: z.enum(["business", "consumer"]).describe("Customer type: business or consumer"),
      organization: z.string().optional().describe("Company name (required for business customers)"),
      position: z.string().optional().describe("Job position/title"),
      academic_degree: z.string().optional().describe("Academic degree"),
      salutation: z.enum(["mr", "mrs", "family", ""]).optional().describe("Salutation"),
      first_name: z.string().optional().describe("First name (required for consumer customers)"),
      last_name: z.string().describe("Last name (required)"),
      address: z.string().optional().describe("Street address"),
      address_2: z.string().optional().describe("Address line 2"),
      secondary_address: z.string().optional().describe("Delivery/secondary address"),
      zipcode: z.string().optional().describe("Postal code"),
      city: z.string().optional().describe("City"),
      country_code: z.string().optional().describe("Country (ISO 3166 ALPHA-2, e.g. DE)"),
      phone: z.string().optional().describe("Phone number"),
      phone_2: z.string().optional().describe("Second phone number"),
      fax: z.string().optional().describe("Fax number"),
      mobile: z.string().optional().describe("Mobile number"),
      email: z.string().optional().describe("Email address"),
      website: z.string().optional().describe("Website URL"),
      vat_id: z.string().optional().describe("VAT ID (USt-IdNr.)"),
      currency_code: z.string().optional().describe("Currency code (e.g. EUR, USD)"),
      customer_number: z.string().optional().describe("Custom customer number"),
      days_for_payment: z.number().optional().describe("Payment terms in days"),
      payment_type: z.number().optional().describe("Payment type: 1=bank transfer, 2=direct debit, 3=cash, 4=PayPal, 5=prepayment, 6=credit card"),
      bank_name: z.string().optional().describe("Bank name (required if payment_type=2)"),
      bank_account_number: z.string().optional().describe("Bank account number"),
      bank_code: z.string().optional().describe("Bank code (BLZ)"),
      bank_account_owner: z.string().optional().describe("Bank account owner"),
      bank_iban: z.string().optional().describe("IBAN (required if payment_type=2)"),
      bank_bic: z.string().optional().describe("BIC (required if payment_type=2)"),
      bank_account_mandate_reference: z.string().optional().describe("SEPA mandate reference"),
      show_payment_notice: z.number().optional().describe("Show payment notice on invoices (0 or 1)"),
      account_receivable: z.string().optional().describe("Accounts receivable number"),
      buyer_reference: z.string().optional().describe("Buyer reference (Leitweg-ID for XRechnung)"),
      tags: z.string().optional().describe("Tags (comma-separated)"),
    },
    async (params) => {
      const client = getClient();
      const result = await client.request({
        SERVICE: "customer.create",
        DATA: cleanData({
          CUSTOMER_TYPE: params.customer_type, ORGANIZATION: params.organization, POSITION: params.position,
          ACADEMIC_DEGREE: params.academic_degree, SALUTATION: params.salutation, FIRST_NAME: params.first_name,
          LAST_NAME: params.last_name, ADDRESS: params.address, ADDRESS_2: params.address_2,
          SECONDARY_ADDRESS: params.secondary_address, ZIPCODE: params.zipcode, CITY: params.city,
          COUNTRY_CODE: params.country_code, PHONE: params.phone, PHONE_2: params.phone_2, FAX: params.fax,
          MOBILE: params.mobile, EMAIL: params.email, WEBSITE: params.website, VAT_ID: params.vat_id,
          CURRENCY_CODE: params.currency_code, CUSTOMER_NUMBER: params.customer_number,
          DAYS_FOR_PAYMENT: params.days_for_payment, PAYMENT_TYPE: params.payment_type,
          BANK_NAME: params.bank_name, BANK_ACCOUNT_NUMBER: params.bank_account_number,
          BANK_CODE: params.bank_code, BANK_ACCOUNT_OWNER: params.bank_account_owner,
          BANK_IBAN: params.bank_iban, BANK_BIC: params.bank_bic,
          BANK_ACCOUNT_MANDATE_REFERENCE: params.bank_account_mandate_reference,
          SHOW_PAYMENT_NOTICE: params.show_payment_notice, ACCOUNT_RECEIVABLE: params.account_receivable,
          BUYER_REFERENCE: params.buyer_reference, TAGS: params.tags,
        }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    }
  );

  server.tool(
    "customer_update",
    "Update an existing customer in Fastbill. Only provided fields will be updated.",
    {
      customer_id: z.string().describe("Customer ID to update (required)"),
      customer_type: z.enum(["business", "consumer"]).optional().describe("Customer type"),
      organization: z.string().optional().describe("Company name"),
      position: z.string().optional().describe("Job position/title"),
      academic_degree: z.string().optional().describe("Academic degree"),
      salutation: z.enum(["mr", "mrs", "family", ""]).optional().describe("Salutation"),
      first_name: z.string().optional().describe("First name"),
      last_name: z.string().optional().describe("Last name"),
      address: z.string().optional().describe("Street address"),
      address_2: z.string().optional().describe("Address line 2"),
      secondary_address: z.string().optional().describe("Delivery address"),
      zipcode: z.string().optional().describe("Postal code"),
      city: z.string().optional().describe("City"),
      country_code: z.string().optional().describe("Country (ISO 3166 ALPHA-2)"),
      phone: z.string().optional().describe("Phone number"),
      phone_2: z.string().optional().describe("Second phone number"),
      fax: z.string().optional().describe("Fax number"),
      mobile: z.string().optional().describe("Mobile number"),
      email: z.string().optional().describe("Email address"),
      website: z.string().optional().describe("Website URL"),
      vat_id: z.string().optional().describe("VAT ID"),
      currency_code: z.string().optional().describe("Currency code"),
      customer_number: z.string().optional().describe("Customer number"),
      days_for_payment: z.number().optional().describe("Payment terms in days"),
      payment_type: z.number().optional().describe("Payment type: 1=transfer, 2=direct debit, 3=cash, 4=PayPal, 5=prepayment, 6=credit card"),
      bank_name: z.string().optional().describe("Bank name"),
      bank_account_number: z.string().optional().describe("Account number"),
      bank_code: z.string().optional().describe("Bank code"),
      bank_account_owner: z.string().optional().describe("Account owner"),
      bank_iban: z.string().optional().describe("IBAN"),
      bank_bic: z.string().optional().describe("BIC"),
      bank_account_mandate_reference: z.string().optional().describe("SEPA mandate reference"),
      show_payment_notice: z.number().optional().describe("Show payment notice (0/1)"),
      account_receivable: z.string().optional().describe("Accounts receivable number"),
      buyer_reference: z.string().optional().describe("Buyer reference"),
      tags: z.string().optional().describe("Tags (comma-separated)"),
    },
    async (params) => {
      const client = getClient();
      const result = await client.request({
        SERVICE: "customer.update",
        DATA: cleanData({
          CUSTOMER_ID: params.customer_id, CUSTOMER_TYPE: params.customer_type, ORGANIZATION: params.organization,
          POSITION: params.position, ACADEMIC_DEGREE: params.academic_degree, SALUTATION: params.salutation,
          FIRST_NAME: params.first_name, LAST_NAME: params.last_name, ADDRESS: params.address,
          ADDRESS_2: params.address_2, SECONDARY_ADDRESS: params.secondary_address, ZIPCODE: params.zipcode,
          CITY: params.city, COUNTRY_CODE: params.country_code, PHONE: params.phone, PHONE_2: params.phone_2,
          FAX: params.fax, MOBILE: params.mobile, EMAIL: params.email, WEBSITE: params.website,
          VAT_ID: params.vat_id, CURRENCY_CODE: params.currency_code, CUSTOMER_NUMBER: params.customer_number,
          DAYS_FOR_PAYMENT: params.days_for_payment, PAYMENT_TYPE: params.payment_type,
          BANK_NAME: params.bank_name, BANK_ACCOUNT_NUMBER: params.bank_account_number,
          BANK_CODE: params.bank_code, BANK_ACCOUNT_OWNER: params.bank_account_owner,
          BANK_IBAN: params.bank_iban, BANK_BIC: params.bank_bic,
          BANK_ACCOUNT_MANDATE_REFERENCE: params.bank_account_mandate_reference,
          SHOW_PAYMENT_NOTICE: params.show_payment_notice, ACCOUNT_RECEIVABLE: params.account_receivable,
          BUYER_REFERENCE: params.buyer_reference, TAGS: params.tags,
        }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    }
  );

  server.tool("customer_delete", "Delete a customer from Fastbill.", {
    customer_id: z.string().describe("Customer ID to delete (required)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "customer.delete", DATA: { CUSTOMER_ID: params.customer_id } });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });
}
