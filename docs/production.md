# Work Trail Production Operations

## Support Procedures

### Company Erasure (Pilot Exit / Customer Data Erasure)

When a customer formally requests complete account and data erasure in writing:
1. Obtain written sign-off from the authorized company representative.
2. Identify the company UUID and exact registered company name.
3. Run the company erasure script with exact name confirmation:
   ```bash
   pnpm --filter @worktrail/api ops:erase-company -- --company <company-id> --confirm "<exact company name>"
   ```
4. Verify that the displayed employee, user, and session counts match the customer.
5. Type `ERASE` when prompted to confirm (or pass `--yes` in non-interactive automated workflows).
6. The procedure:
   - Erases all employee data (sessions, location points, updates, summaries, reports, data exports, consent records).
   - Removes all report and export files from object storage.
   - Deletes all user accounts, invitations, refresh tokens, and password reset tokens.
   - Updates company name to "Deleted company" and sets retention to 30 days.
   - Preserves audit log history and records a final `company.erased` audit entry with counts.
