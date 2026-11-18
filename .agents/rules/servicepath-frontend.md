---
trigger: model_decision
description: Apply when changing or reviewing frontend UI, UX, styling, layout, or interaction in ServicePath AI.
---

# ServicePath frontend

ServicePath is a B2B service exchange. Design for buyer and provider decisions using the real request, proposal, deal, business, and review data already available in the app.

Use the installed `impeccable` skill for visual critique and design direction. Give each screen a clear task and hierarchy. Use the existing React components, CSS, and API contracts. Prioritize requests, decisions, and evidence over decorative cards, duplicated labels, and badges without workflow meaning.

Use `web-design-guidelines` to review accessibility, responsive behavior, forms, and interaction states. Use Playwright to inspect representative populated, empty, and error states at desktop and mobile widths. Use Chrome DevTools when diagnosing rendering, console, or network issues.

Keep Simulation explicitly read-only and Forecasts explicitly experimental and based on synthetic data. Keep scoring and methodology accessible through disclosure. Use browser-local fixtures or an authorized local test account for checks that would otherwise modify marketplace records.
