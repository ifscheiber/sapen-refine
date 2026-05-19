# Design System

RB-043 establishes a central token layer for colors, typography, radii, surfaces, shell colors, and annotation labels.

Design values should live in `src/design` and be consumed through semantic Tailwind token classes. Active production components should avoid one-off raw hex, RGB, OKLCH, and gray/blue utility palettes unless the value is part of the token layer or canvas rendering constants.
