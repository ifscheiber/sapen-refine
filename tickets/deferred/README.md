# Deferred Tickets

This folder holds work that is valid but not currently actionable.

Use `tickets/deferred/` for:

- manual gates that require external evidence, for example real iPad Safari testing against a deployed URL,
- post-trial triage work that requires customer/operator findings,
- backlog items that are intentionally not part of the current implementation sequence.

Do not use this folder for completed work. Completed tickets belong in the dated `done/` folder for the day they were completed.

To reactivate a deferred ticket:

1. Confirm the trigger condition exists, such as deployed URL, device access, real trial findings, or an explicit prioritization decision.
2. Move the ticket into the active dated ticket folder for that day.
3. Update the ticket status and any linked docs/backlog references.
4. Implement and move it to that dated folder's `done/` directory when finished.

Manual-gate tickets must not be marked done without real evidence. Preparation work may be completed separately, but execution gates stay deferred until the required environment and observations exist.

