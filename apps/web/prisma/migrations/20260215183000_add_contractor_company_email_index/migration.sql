-- Improve contractor email lookups scoped by tenant
CREATE INDEX "Contractor_company_id_contact_email_idx"
ON "Contractor"("company_id", "contact_email");
