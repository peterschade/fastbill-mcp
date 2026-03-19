import { z } from "zod";
import { getClient, cleanData } from "../client.js";
import { formatContacts } from "../formatters.js";
export function registerContactTools(server) {
    server.tool("contact_get", "Get contacts from Fastbill. Returns compact summary by default. Set detailed=true for full raw JSON.", {
        customer_id: z.string().optional().describe("Filter by customer ID"),
        customer_number: z.string().optional().describe("Filter by customer number"),
        contact_id: z.string().optional().describe("Filter by contact ID"),
        term: z.string().optional().describe("Search in ORGANIZATION, FIRST_NAME, LAST_NAME, ADDRESS, ZIPCODE, EMAIL, TAGS"),
        limit: z.number().optional().describe("Max results (default 10, max 100)"),
        offset: z.number().optional().describe("Pagination offset"),
        detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({
            SERVICE: "contact.get",
            FILTER: cleanData({ CUSTOMER_ID: params.customer_id, CUSTOMER_NUMBER: params.customer_number, CONTACT_ID: params.contact_id, TERM: params.term }),
            LIMIT: params.limit ?? 10,
            OFFSET: params.offset,
        });
        const text = params.detailed ? JSON.stringify(result.RESPONSE, null, 2) : formatContacts(result.RESPONSE);
        return { content: [{ type: "text", text }] };
    });
    server.tool("contact_create", "Create a new contact for an existing customer in Fastbill.", {
        customer_id: z.string().describe("Customer ID to link contact to (required)"),
        organization: z.string().optional().describe("Organization name"),
        academic_degree: z.string().optional().describe("Academic degree"),
        position: z.string().optional().describe("Job position"),
        salutation: z.enum(["mr", "mrs", "family", ""]).optional().describe("Salutation"),
        first_name: z.string().optional().describe("First name"),
        last_name: z.string().optional().describe("Last name"),
        address: z.string().optional().describe("Street address"),
        address_2: z.string().optional().describe("Address line 2"),
        zipcode: z.string().optional().describe("Postal code"),
        city: z.string().optional().describe("City"),
        country_code: z.string().optional().describe("Country (ISO 3166 ALPHA-2)"),
        secondary_address: z.string().optional().describe("Secondary/delivery address"),
        phone: z.string().optional().describe("Phone number"),
        phone_2: z.string().optional().describe("Second phone"),
        fax: z.string().optional().describe("Fax"),
        mobile: z.string().optional().describe("Mobile"),
        email: z.string().optional().describe("Email"),
        vat_id: z.string().optional().describe("VAT ID"),
        currency_code: z.string().optional().describe("Currency code"),
        tags: z.string().optional().describe("Tags (comma-separated)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({
            SERVICE: "contact.create",
            DATA: cleanData({
                CUSTOMER_ID: params.customer_id, ORGANIZATION: params.organization, ACADEMIC_DEGREE: params.academic_degree,
                POSITION: params.position, SALUTATION: params.salutation, FIRST_NAME: params.first_name,
                LAST_NAME: params.last_name, ADDRESS: params.address, ADDRESS_2: params.address_2,
                ZIPCODE: params.zipcode, CITY: params.city, COUNTRY_CODE: params.country_code,
                SECONDARY_ADDRESS: params.secondary_address, PHONE: params.phone, PHONE_2: params.phone_2,
                FAX: params.fax, MOBILE: params.mobile, EMAIL: params.email, VAT_ID: params.vat_id,
                CURRENCY_CODE: params.currency_code, TAGS: params.tags,
            }),
        });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("contact_update", "Update an existing contact in Fastbill.", {
        customer_id: z.string().describe("Customer ID (required)"),
        contact_id: z.string().describe("Contact ID to update (required)"),
        organization: z.string().optional().describe("Organization"), academic_degree: z.string().optional().describe("Degree"),
        position: z.string().optional().describe("Position"), salutation: z.enum(["mr", "mrs", "family", ""]).optional().describe("Salutation"),
        first_name: z.string().optional().describe("First name"), last_name: z.string().optional().describe("Last name"),
        address: z.string().optional().describe("Address"), address_2: z.string().optional().describe("Address 2"),
        zipcode: z.string().optional().describe("Zipcode"), city: z.string().optional().describe("City"),
        country_code: z.string().optional().describe("Country"), secondary_address: z.string().optional().describe("Secondary address"),
        phone: z.string().optional().describe("Phone"), phone_2: z.string().optional().describe("Phone 2"),
        fax: z.string().optional().describe("Fax"), mobile: z.string().optional().describe("Mobile"),
        email: z.string().optional().describe("Email"), vat_id: z.string().optional().describe("VAT ID"),
        currency_code: z.string().optional().describe("Currency"), tags: z.string().optional().describe("Tags"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({
            SERVICE: "contact.update",
            DATA: cleanData({
                CUSTOMER_ID: params.customer_id, CONTACT_ID: params.contact_id, ORGANIZATION: params.organization,
                ACADEMIC_DEGREE: params.academic_degree, POSITION: params.position, SALUTATION: params.salutation,
                FIRST_NAME: params.first_name, LAST_NAME: params.last_name, ADDRESS: params.address,
                ADDRESS_2: params.address_2, ZIPCODE: params.zipcode, CITY: params.city,
                COUNTRY_CODE: params.country_code, SECONDARY_ADDRESS: params.secondary_address,
                PHONE: params.phone, PHONE_2: params.phone_2, FAX: params.fax, MOBILE: params.mobile,
                EMAIL: params.email, VAT_ID: params.vat_id, CURRENCY_CODE: params.currency_code, TAGS: params.tags,
            }),
        });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("contact_delete", "Delete a contact from Fastbill.", {
        customer_id: z.string().describe("Customer ID (required)"),
        contact_id: z.string().describe("Contact ID to delete (required)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "contact.delete", DATA: { CUSTOMER_ID: params.customer_id, CONTACT_ID: params.contact_id } });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
}
//# sourceMappingURL=contact.js.map