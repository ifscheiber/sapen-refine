# App Shell

RB-043 target shell concepts:

- authenticated workspace layout,
- primary navigation/sidebar,
- topbar with user/session context,
- consistent page header pattern,
- constrained main content region,
- reusable empty/loading/error states,
- responsive desktop and iPad behavior.

The shell must not own annotation-domain business logic. It should compose children and route context only.
