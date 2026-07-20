DROP INDEX "rebase_quotes_fingerprint_unique";--> statement-breakpoint
CREATE INDEX "rebase_quotes_fingerprint_idx" ON "rebase_quotes" USING btree ("quote_fingerprint");