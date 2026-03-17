# Design System Specification: Premium India Fintech

## 1. Overview & Creative North Star
**Creative North Star: "The Ethereal Vault"**

This design system rejects the "boxed-in" aesthetic of traditional banking. Instead of rigid grids and heavy borders, we embrace **The Ethereal Vault**—a philosophy where security is conveyed through clarity, and premium status is defined by breathing room. We move away from "standard UI" by utilizing intentional asymmetry, overlapping layers, and a "High-End Editorial" approach to financial data.

The system is designed for the modern Indian landscape: energetic, high-trust, and sophisticated. It breaks the template look by treating every screen as a digital canvas where depth is created through light and glass, not lines.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a deep, authoritative Indigo (`primary`) supported by a spectrum of "Luminous Neutrals."

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts or subtle tonal transitions. 
*   *Example:* A transaction list should sit on `surface-container-low`, while the individual transaction items use `surface-container-lowest` to create separation via contrast, not lines.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-transparent materials.
*   **Base Level:** `surface` (#fbf8ff) - The canvas.
*   **Secondary Level:** `surface-container-low` (#f4f2fc) - Used for grouping content sections.
*   **Elevated Level:** `surface-container-lowest` (#ffffff) - Used for the most interactive elements (cards, inputs) to make them "pop" against the off-white base.

### The Glass & Gradient Rule
To achieve a "Premium India" feel, use **Glassmorphism** for floating elements (Bottom Sheets, Navigation Bars).
*   **Token:** `surface` at 70% opacity + `Backdrop Filter: blur(20px)`.
*   **Signature Gradients:** For primary CTAs, use a linear gradient from `primary` (#061fd0) to `primary-container` (#3142e6) at 135°. This adds a "jewel-like" depth that flat hex codes lack.

---

## 3. Typography: The Editorial Voice
We use **Manrope** for its geometric yet warm characteristics. It bridges the gap between a tech-forward "Neobank" and a high-trust "Legacy Institution."

*   **Display (lg/md/sm):** Used for large currency balances (₹) and hero statements. Use `tight` letter-spacing (-0.02em) to create an authoritative, editorial feel.
*   **Headline & Title:** Use `on-surface` (#1a1b22) with a semi-bold weight. These should feel like newspaper headers—clear and commanding.
*   **Body (lg/md):** Our primary data carrier. Ensure `line-height` is generous (1.5x) to maintain the "clean" aesthetic.
*   **Labels:** Reserved for micro-copy and tags. Use `on-surface-variant` (#454652) to create a clear hierarchy against primary titles.

**The Rupee (₹) Rule:** Always render the Indian Rupee symbol in the same weight as the numerical value, but reduce its font size to 80% of the number to ensure the focus remains on the amount.

---

## 4. Elevation & Depth
Depth in this system is a result of **Tonal Layering**, not structural shadows.

*   **The Layering Principle:** Place `surface-container-lowest` cards on a `surface-container-low` background. The slight shift from #ffffff to #f4f2fc creates a "soft lift" that feels more premium than a drop shadow.
*   **Ambient Shadows:** If an element must "float" (e.g., a FAB or a modal), use a high-dispersion shadow:
    *   *Offset:* 0px 24px | *Blur:* 48px | *Color:* `on-surface` at 6% opacity. This mimics natural light rather than a digital effect.
*   **The Ghost Border:** If accessibility requires a container edge, use `outline-variant` (#c5c5d4) at **15% opacity**. This creates a suggestion of a border without breaking the "No-Line" rule.

---

## 5. Component Logic

### Buttons
*   **Primary:** Indigo gradient (`primary` to `primary-container`), `xl` (3rem) corner radius. Typography: `title-sm` in `on-primary` (#ffffff).
*   **Secondary:** `surface-container-high` background with `on-secondary-container` text. No border.

### Input Fields
*   **Structure:** Avoid boxes. Use a "Plinth" style—a `surface-container-highest` background with a `xl` (3rem) corner radius.
*   **State:** On focus, the background shifts to `surface-container-lowest` with a "Ghost Border" of `primary` at 20%.

### Cards & Lists
*   **Constraint:** Zero dividers. Use spacing (`spacing-4` or `spacing-6`) to separate list items. 
*   **Interaction:** On tap/hover, a card should shift from `surface-container-lowest` to `surface-bright` with an Ambient Shadow.

### Chips (The "Fintech Pill")
*   Use `secondary-container` for the background and `on-secondary-container` for text. Corner radius must always be `full` (9999px) to contrast against the `lg` (2rem) radius of cards.

### Additional Component: The "Wealth Card"
*   A hero component for balances. Uses a deep `primary` background with a subtle, large-scale glassmorphism "flare" (a white circle at 5% opacity, blurred 100px) in the top right corner.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical padding. Give more "headroom" (top padding) to sections than bottom padding to create an editorial flow.
*   **Do** use `primary` sparingly. It is a "signal" color. If everything is blue, nothing is important.
*   **Do** use the `24px+` (lg/xl) corner radius consistently. It makes the UI feel approachable and modern.

### Don’t
*   **Don't** use pure black (#000000). Always use `on-surface` (#1a1b22) for text to maintain the premium, soft-contrast feel.
*   **Don't** use 1px dividers to separate transactions or menu items. Use white space (`spacing-3`) or tonal shifts.
*   **Don't** use standard Material shadows. They are too "heavy" for this system. Always use the Ambient Shadow specification.