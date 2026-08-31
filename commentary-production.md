# Commentary production

The production runner creates the approved four-line Arabic commentary in resumable chunks of at most four verses.

## Safety checks

- Uses exact verse text from `bible.json`.
- Grounds each chunk in normalized public-domain commentary records.
- Requires academic, theological, deep, and applied lines.
- Rejects missing source locators, invalid lengths, and repeated eight-word phrases.
- Writes progress after every approved chunk and skips approved verses when resumed.
- Stops without approval on authentication, quota, validation, or retry failure.

## Commands

Plan two chunks without AI credits:

```powershell
node run-approved-commentary-orchestrator.js --dry-run --max-chunks 2
```

Run or resume production:

```powershell
node run-commentary-production-continuously.js
```

The continuous supervisor restarts the resumable orchestrator after transient CLI, quota, authentication, or malformed-response stops. Set `COMMENTARY_RETRY_SECONDS` to change its 60-second retry delay.

Test orchestration with the mock CLI:

```powershell
node test-commentary-orchestrator.js
```