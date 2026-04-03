# Diagram Assets

This folder contains paper-ready SVG and PNG assets generated from the current
SabaiStay implementation.

## Files

- `database-schema.svg`
  Suggested caption: `Physical database schema of SabaiStay showing the main tables, key fields, and foreign-key paths.`
  PNG export: `database-schema.png`
- `erd.svg`
  Suggested caption: `Entity relationship diagram of SabaiStay showing cardinalities among users, listings, bookings, contracts, roommate data, and notifications.`
  PNG export: `erd.png`
- `ui-overview.svg`
  Suggested caption: `UI overview of SabaiStay showing the map-first home page, filtered listing search, listing details, and the role-based dashboard.`
  PNG export: `ui-overview.png`
  Source captures: `ui-captures/board-home.png`, `ui-captures/board-list.png`, `ui-captures/board-listing.png`, `ui-captures/board-dashboard.png`
- `use-case-diagram.svg`
  Suggested caption: `Use case diagram of SabaiStay showing interactions among visitor, student, owner, and administrator roles.`
  PNG export: `use-case-diagram.png`
- `class-diagram.svg`
  Suggested caption: `Simplified UML class diagram of SabaiStay showing users, listings, bookings, contracts, and roommate profiles.`
  PNG export: `class-diagram.png`
- `sequence-booking-workflow.svg`
  Suggested caption: `Sequence diagram of the SabaiStay booking workflow from student request submission to owner-side status updates.`
  PNG export: `sequence-booking-workflow.png`

## Notes

- SVG is the preferred format for the paper because it scales cleanly without
  losing quality.
- PNG exports are included for tools or templates that do not accept SVG.
- `ui-overview` now uses actual route captures from the running app instead of
  hand-drawn placeholder panels.
- The assets are based on the current codebase and `schema.sql`, not only on the
  original concept paper.
- The current PNG exports were rendered at 2x scale for clearer print output.
