# Contest administration

Contest administration is backend-only. Set a randomly generated value of at least 32 characters in Railway as `ADMIN_API_TOKEN`. Never put it in Netlify variables, frontend code, URLs, screenshots, or repository files.

Send it only in the `Authorization: Bearer <token>` header to:

- `GET /api/admin/contest/records?filter=verified|unverified|eligible|ineligible|flagged|disqualified&search=<wallet>`
- `GET /api/admin/contest/wallet/:address/history`
- `PATCH /api/admin/contest/wallet/:address/review` with `{ "action": "flag|clear_flag|disqualify|restore", "reason": "required explanation" }`
- `GET /api/admin/contest/export/records`
- `GET /api/admin/contest/export/events`

Review and disqualification changes require a reason and create a separate admin audit event. CSV output quotes special characters and prefixes spreadsheet-formula values. Public APIs never return review notes, raw addresses on leaderboard rows, abuse identifiers, or admin events.

Rotate the admin token immediately if it may have been exposed. Application logs must never print request authorization headers.
