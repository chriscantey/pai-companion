# Design System

Design preferences for HTML output. Dark theme with vibrant accents.

## Color Palette

### CSS Custom Properties

```css
:root {
    /* Background - dark indigo */
    --bg-primary: #0d1220;
    --bg-secondary: #141c2c;
    --bg-tertiary: #1c2638;

    /* Text - neutral, good contrast */
    --text-primary: #f0f2f5;
    --text-secondary: #c0c8d4;
    --text-muted: #8a919d;

    /* Accent colors */
    --cyan: #12c2e9;        /* Headers, links, info */
    --purple: #c471ed;      /* Quotes, labels, badges */
    --pink: #ff6b9d;        /* List markers, inline code */
    --magenta: #e879f9;     /* Success callouts */
    --blue: #6BB6FF;        /* Highlights */
    --orange: #F39C12;      /* Warnings */
    --teal: #2dd4bf;        /* Positive actions */

    /* Borders */
    --border: rgba(255, 255, 255, 0.08);
}
```

### Quick Reference

| Use | Color | Hex |
|-----|-------|-----|
| Page background | bg-primary | `#0d1220` |
| Cards/sections | bg-secondary | `#141c2c` |
| Hover states | bg-tertiary | `#1c2638` |
| Primary text | text-primary | `#f0f2f5` |
| Secondary text | text-secondary | `#c0c8d4` |
| Muted text | text-muted | `#8a919d` |
| Headers, links | cyan | `#12c2e9` |
| Badges, labels | purple | `#c471ed` |
| Inline code, bullets | pink | `#ff6b9d` |
| Success | magenta | `#e879f9` |
| Highlights | blue | `#6BB6FF` |
| Warnings | orange | `#F39C12` |
| Positive/done | teal | `#2dd4bf` |
| Borders | border | `rgba(255,255,255,0.08)` |

## Typography

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
line-height: 1.7;
```

Include Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

## When to Use

Apply this theme to:
- All HTML in `~/portal/`
- Any web-viewable content

## Component Patterns

### Cards
```css
.card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem;
}
```

### Callouts
```css
.callout {
    background: var(--bg-secondary);
    border-left: 3px solid var(--cyan);
    padding: 1rem;
    border-radius: 0 6px 6px 0;
}
.callout.warning { border-left-color: var(--orange); }
.callout.success { border-left-color: var(--teal); }
```

### Tags/Badges
```css
.tag {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    background: rgba(196, 113, 237, 0.2);
    color: var(--purple);
}
```

## Document Creation Methodology

When creating styled HTML pages:

1. **Self-contained:** All CSS is embedded in the HTML file (no external stylesheets)
2. **Google Fonts:** Always include Inter font via the Google Fonts link
3. **Template structure:**
   - Navigation bar linking back to portal root
   - Header with page title
   - Content sections using the component patterns above
   - Footer
4. **File location:** Write to `~/portal/{tag}/index.html`
5. **Provide URL:** Always give the user the full URL after creating a page
6. **Portal nav:** Every page includes a nav link back to the portal homepage
