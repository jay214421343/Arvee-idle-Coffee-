# ARVEE Idle release audit — 21 November 2026

Idle continues to use its own native PostgreSQL progress and Discord commands. Browser actions reuse the native action handlers and transaction receipts. Both clients resolve the same Discord identity. Membership and cross-game boosts are validated through ARVEE's authoritative private service; Idle does not own a second purchase or entitlement database.

Prime is now EUR 19.99 for 30 days in ARVEE's authoritative payment configuration. Idle inherits its appropriate benefits automatically. Never hard-code a price or provider key in Idle. Existing memberships and paid/pending checkouts keep their original terms; price-rotation verification belongs to ARVEE RPG's original commerce system.

Current validation: all 196 Idle tests passed with zero skips against a fresh isolated PostgreSQL database; syntax checks and the live doctor passed. The two game stores and production player identities were preserved. Runtime dependency audit reported zero advisories. The browser release and gameplay checks are coordinated in ARVEE's `docs/PRODUCTION-READINESS.md` and `docs/ECOSYSTEM-LIVE-RELEASE.md`.

Real-client Discord OAuth/consent and actual paid provider charges are separate external acceptance steps; synthetic sessions and provider fixtures must not be described as those checks. Deploy only using the established PM2 environment for each bot, retain backups, and keep the coordinated pull requests unmerged pending review.
