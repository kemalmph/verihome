# VeriHome Design System

Extracted from Stitch project `10150202233806739775` (9 screens).

---

## Color Tokens

### Brand Colors (Core)
| Token | Hex | Usage |
|---|---|---|
| `primary-green` | `#1A7A5E` | Primary container, CTAs, accents |
| `dark-navy` | `#0D2137` | Footer, sidebar, hero dark sections |
| `light-green-bg` | `#E8F5F0` | Badges, tag backgrounds, hover fills |
| `text-primary` | `#333333` | Body text (mapped to `on-surface`) |
| `text-muted` | `#888888` | Secondary text, labels |
| `border-color` | `#CCCCCC` | Card borders, dividers |

### Material Design Color System (from Stitch)
| Token | Hex | Description |
|---|---|---|
| `primary` | `#006048` | Deep green (text/icon use) |
| `primary-container` | `#1A7A5E` | Primary button backgrounds |
| `on-primary` | `#FFFFFF` | Text on primary containers |
| `primary-fixed` | `#9CF4D1` | Subtle green tint |
| `primary-fixed-dim` | `#80D7B6` | Dimmed primary fixed |
| `secondary` | `#4D6079` | Secondary text, nav links |
| `secondary-container` | `#CEE1FF` | Light blue container |
| `on-secondary` | `#FFFFFF` | Text on secondary |
| `surface` | `#FBF9F8` | Page background |
| `surface-container-lowest` | `#FFFFFF` | Card background (white) |
| `surface-container-low` | `#F6F3F2` | Subtle card bg |
| `surface-container` | `#F0EDED` | Input/field background |
| `surface-container-high` | `#EAE8E7` | Higher elevation surface |
| `surface-container-highest` | `#E4E2E1` | Highest elevation surface |
| `surface-dim` | `#DCD9D9` | Dimmed surface |
| `on-surface` | `#1B1C1C` | Primary text on light backgrounds |
| `on-surface-variant` | `#3E4944` | Secondary text, icons |
| `outline` | `#6E7A74` | Borders, dividers |
| `outline-variant` | `#BEC9C2` | Subtle borders |
| `inverse-surface` | `#303030` | Dark surfaces |
| `inverse-on-surface` | `#F3F0F0` | Text on dark surfaces |
| `on-secondary-fixed` | `#081C32` | Dark navy text |
| `error` | `#BA1A1A` | Error states |
| `error-container` | `#FFDAD6` | Error backgrounds |

### Semantic Mappings
- **Page background**: `#FBF9F8` (surface)
- **Card background**: `#FFFFFF` (surface-container-lowest)
- **Brand green**: `#1A7A5E` (primary-container)
- **Dark text**: `#1B1C1C` (on-surface)
- **Muted text**: `#3E4944` (on-surface-variant)
- **Sidebar/Footer bg**: `#0D2137` (dark navy custom)
- **Badge green bg**: `#E8F5F0` (light-green-bg)
- **Badge green text**: `#1A7A5E` (primary-container)

---

## Typography Scale

**Font Family**: Public Sans (Google Fonts)  
Weights used: 300, 400, 500, 600, 700, 800

| Token | Size | Line Height | Weight | Letter Spacing | Usage |
|---|---|---|---|---|---|
| `h1` | 40px | 1.2 | 700 | -0.02em | Hero headings (desktop) |
| `h1-mobile` | 32px | 1.2 | 700 | — | Hero headings (mobile) |
| `h2` | 32px | 1.3 | 700 | — | Section headings |
| `h2-mobile` | 24px | 1.3 | 700 | — | Section headings (mobile) |
| `h3` | 24px | 1.4 | 600 | — | Card titles, sidebar brand |
| `h4` | 20px | 1.4 | 600 | — | Card subtitles, price |
| `body-lg` | 18px | 1.6 | 400 | — | Hero subtext, important body |
| `body-md` | 16px | 1.6 | 400 | — | Standard body text |
| `label-md` | 14px | 1.0 | 500 | — | Buttons, nav links, badges |
| `small` | 12px | 1.4 | 400 | — | Captions, timestamps, meta |

---

## Spacing Scale

| Token | Value | Description |
|---|---|---|
| `xs` | 4px | Micro gaps |
| `base` | 8px | Base unit |
| `sm` | 12px | Small gaps |
| `md` | 24px | Section padding, card padding |
| `gutter` | 24px | Grid gutter |
| `lg` | 48px | Large section spacing |
| `xl` | 80px | Extra large section spacing |
| `margin-mobile` | 16px | Page margin (mobile) |
| `margin-desktop` | 64px | Page margin (desktop) |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `DEFAULT` | 4px (`0.25rem`) | Inputs, small elements |
| `lg` | 8–12px | Cards, buttons |
| `xl` | 12–16px | Featured cards, sections |
| `full` | 9999px | Pills, avatars, badges |

---

## Shadow Styles

```css
/* Surface 1 — standard card */
box-shadow: 0px 4px 12px rgba(13, 33, 55, 0.05);

/* Surface 1 Hover — elevated card */
box-shadow: 0px 8px 20px rgba(13, 33, 55, 0.08);

/* Card border hover */
border-color: rgba(26, 122, 94, 0.3);
```

---

## Component Patterns

### Navbar
- Height: 80px (h-20), sticky, z-50
- Background: `surface` (#FBF9F8), border-bottom `outline-variant`
- Logo: `h3` weight bold, `primary` color
- Nav links: `body-md` / `label-md`, `on-surface-variant`, hover `primary`
- Active nav link: `primary` color + border-bottom-2 `primary`
- CTA button: `bg-primary-container text-on-primary` rounded-lg
- Language toggle: `EN | ID` pill, `surface-container-low` bg

### Listing Card
- White background, `1px solid #CCCCCC`, `border-radius: 12px`
- Image: 16:9 aspect ratio, hover scale-110 with transition-500
- Verified badge: `bg-[#E8F5F0] text-[#1A7A5E]` rounded-full, top-left
- RLA Score: `bg-[#E8F5F0] text-[#1A7A5E]` badge, top-right or inline
- Price: `text-[#1A7A5E] font-h3 font-bold`
- Title: `text-[#0D2137] font-h4`
- Location: `on-surface-variant` + location_on icon
- Amenity row: icons + small text, border-y `outline-variant`
- CTA: full-width outline button `border-[#1A7A5E] text-[#1A7A5E]`, hover fill green
- Hover: card lifts with `shadow: 0px 8px 20px rgba(13,33,55,0.08)`, border-color `rgba(26,122,94,0.3)`

### RLA Score Component
- Container: `surface-container-low` bg, `outline-variant` border, `rounded-xl`
- Score badge: white bg, `primary` star icon, `h3` text
- Progress bars: `surface-container-highest` track, `primary` fill, `h-2 rounded-full`
- Categories: Building Condition, Natural Lighting, Bathroom, Ventilation
- Tag pills: `secondary-container` / `primary-fixed` backgrounds

### Dashboard Sidebar
- Width: 288px (w-72)
- Background: `#0D2137` (dark navy)
- Logo: `primary-fixed` color (`#9CF4D1`)
- Active item: `primary-fixed-dim` text + `bg-white/5`
- Inactive items: `white/70`, hover `white + bg-white/5`
- User card: `bg-white/5 border-white/10`
- Active badge: `bg-green-custom (#1A7A5E)` text white

### Consultation Package Cards
- Basic: standard border `outline-variant`
- Premium: `border-2 border-primary-container`, `scale-105` on desktop
- "Most Popular" chip: `bg-primary-container text-on-primary`, top-right corner
- Check icons: filled, `primary` color

### Payment Cards
- Border: `1px solid #CCCCCC`
- Selected: `border-color: #1A7A5E`, `bg-[#E8F5F0]`
- Hover: `border-color: rgba(26,122,94,0.3)`, box-shadow lift

### Footer
- Background: `#0D2137` (on-background / dark navy)
- Text: `surface-variant` (muted white/gray)
- Logo: `primary-fixed` (#9CF4D1 mint green)
- Link hover: `primary-fixed`
- Simple footer variant: `secondary` (#4D6079) background

### Buttons
| Variant | Style |
|---|---|
| Primary filled | `bg-primary text-on-primary` or `bg-primary-container text-on-primary` |
| Outline | `border-2 border-primary text-primary`, hover fill |
| Ghost | `text-primary`, hover `bg-surface-container` |
| Destructive | `bg-error text-on-error` |

### Verified/Curated Badge
```
bg: #E8F5F0
text: #1A7A5E
icon: verified (filled)
border-radius: full (pill)
font: label-md, semi-bold
```

### Trust & VeriHome Guarantee block
- Dark navy bg `#0D2137`
- Icon: `verified_user`, `primary-fixed` color
- Text: white, small, opacity 90

---

## Layout

- Max content width: `1280px` (max-w-[1280px]) or `1400px` for dashboard
- Grid: 12-column, `24px` gutter
- Desktop breakpoint: `md:` (768px), `lg:` (1024px)
- Mobile padding: 16px sides
- Desktop padding: 64px sides
