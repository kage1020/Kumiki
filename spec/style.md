# Style, Layout, and Theme

English · [日本語](./style.ja.md)

## 4.1 Policy

Kumiki **does not let you write CSS directly**. CSS cascade, specificity, and inheritance are the biggest source of hidden dependencies for an AI, and they conflict with Kumiki's "statically trackable side effects" principle.

Instead:

1. Declare **design tokens** in the theme
2. Have **semantic tags** reference those tokens
3. Express **layout via tile primitives** (`row` / `column` / `grid`) props
4. Pass through with `class` / `style` props **only when absolutely necessary**

This covers the visual needs of an ordinary SPA. Complex animations and elaborate decoration are planned as a `motion` layer in v0.2.

---

## 4.2 Design Tokens

Declared in a `theme` definition:

```kumiki
theme DefaultTheme = {
    colors: {
        bg:        "#ffffff",
        fg:        "#1a1a1a",
        muted:     "#666666",
        primary:   "#0070f3",
        success:   "#0a7c2f",
        warning:   "#b07c00",
        danger:    "#c4222a",
        surface:   "#f7f7f7",
        border:    "#e0e0e0"
    },
    spacing: {
        xs: "4px",  sm: "8px",  md: "16px",
        lg: "24px", xl: "40px", xxl: "64px"
    },
    radius: {
        none: "0",   sm: "4px",   md: "8px",
        lg: "16px",  pill: "999px"
    },
    typography: {
        family: "system-ui, sans-serif",
        size: {
            xs: "12px", sm: "14px", md: "16px",
            lg: "20px", xl: "28px", xxl: "40px"
        },
        weight: {
            normal: "400", medium: "500", bold: "700"
        },
        line-height: "1.5"
    },
    shadow: {
        none: "none",
        sm:   "0 1px 2px rgba(0,0,0,0.1)",
        md:   "0 4px 8px rgba(0,0,0,0.1)",
        lg:   "0 8px 24px rgba(0,0,0,0.15)"
    },
    breakpoints: {
        sm: "640px", md: "768px", lg: "1024px", xl: "1280px"
    }
}
```

### 4.2.1 Syntax

```ebnf
theme-def ::= 'theme' identifier '=' '{' theme-section (',' theme-section)* '}'
theme-section ::= identifier ':' '{' theme-entry (',' theme-entry)* '}'
theme-entry ::= identifier ':' (string | '{' theme-entry (',' theme-entry)* '}')
```

`theme` is a single value of type `Theme`. You can define multiple themes to switch between dark/light.

### 4.2.2 Applying It to an app

```kumiki
app TodoApp
    caps   = []
    routes = {"/" -> Home, "/404" -> NotFound}
    init   = []
    theme  = DefaultTheme
```

---

## 4.3 Token References

To reference a token inside a tile prop, use the `@` prefix:

```kumiki
tile Card = box(
              column(
                heading("Title"),
                text("body"))) {
              style: {
                background: @colors.surface,
                padding:    @spacing.md,
                radius:     @radius.md,
                shadow:     @shadow.sm
              }
            }
```

`@colors.surface` is resolved from the theme. It is automatically re-rendered when the theme is switched.

### 4.3.1 Shorthand Properties

Frequently used style props are provided as **common props** and are resolved without writing `@`:

| prop | Type | Example |
|---|---|---|
| `bg` | color token name | `bg: "surface"` → `@colors.surface` |
| `color` | color token name | `color: "muted"` |
| `pad` | spacing token name | `pad: "md"` |
| `pad-x`, `pad-y` | spacing token name | `pad-x: "lg"` |
| `gap` | spacing token name | `gap: "sm"` |
| `radius` | radius token name | `radius: "md"` |
| `shadow` | shadow token name | `shadow: "sm"` |
| `size` | typography.size token name | `size: "lg"` |
| `weight` | typography.weight token name | `weight: "bold"` |

```kumiki
tile Card = box(
              column(
                heading("Title") {size: "lg", weight: "bold"},
                text("body") {color: "muted"})) {
              bg: "surface",
              pad: "md",
              radius: "md",
              shadow: "sm",
              gap: "sm"
            }
```

This dramatically reduces token consumption in the UI an AI writes.

---

## 4.4 Layout

Layout is expressed via **tile structure**, not CSS.

### 4.4.1 row / column

```kumiki
row(A, B, C) {gap: "md", align: "center", justify: "between"}
column(A, B, C) {gap: "sm", align: "stretch"}
```

| prop | Value |
|---|---|
| `gap` | spacing token name |
| `align` | `start` / `center` / `end` / `stretch` / `baseline` |
| `justify` | `start` / `center` / `end` / `between` / `around` / `evenly` |
| `wrap` | `true` / `false` |

### 4.4.2 grid

```kumiki
grid(A, B, C, D) {cols: 2, gap: "md"}
grid(A, B, C) {cols: [1, "auto", 1], gap: "sm"}     ; number or array
```

| prop | Value |
|---|---|
| `cols` | number (equal division) or `List(Text)` (CSS grid-template-columns style) |
| `rows` | same as above |
| `gap` | spacing token name |
| `gap-x`, `gap-y` | individual specification |

### 4.4.3 stack

`stack` is a **vertical stack** — a layout semantically equivalent to `column` (stacking children vertically). Use it when you want the visual nuance of "stacking."

```kumiki
stack(Card1, Card2, Card3) {gap: "md"}
```

> For z-axis stacking (overlays), specify `position` directly as a prop on `box`, or use the `overlay` builtin planned for the future.

### 4.4.4 panel / region / scroll / fieldset

| builtin | Purpose |
|---|---|
| `panel` | A grouping box. Has a visual boundary (border) or heading |
| `region` | A named a11y region. A landmark for screen readers |
| `scroll` | A container with overflow auto. Specify `h` for fixed-height scrolling |
| `fieldset` | A field group within a form. Equivalent to `<fieldset>` |

```kumiki
panel(heading("Settings"), settingsForm) {bg: "surface", pad: "md"}
region(navList) {role: "navigation", aria-label: "Main"}
scroll(longList) {h: 400}
```

### 4.4.5 divider

A horizontal line (`<hr>`). For separators:

```kumiki
column(A, divider(), B)
```

### 4.4.6 box

A general-purpose container. Decorate it with pad/bg/radius/shadow and so on:

```kumiki
box(content) {
    pad: "lg",
    bg: "primary",
    color: "bg",
    radius: "md"
}
```

### 4.4.7 Sizing

| prop | Meaning |
|---|---|
| `w` | width. `"full"` / `"auto"` / `"sm"` / number (px) |
| `h` | height |
| `min-w`, `min-h`, `max-w`, `max-h` | min/max |
| `aspect` | `"1/1"` / `"16/9"`, etc. |

```kumiki
image(src=url) {w: "full", max-w: 600, aspect: "16/9"}
```

---

## 4.5 Responsive

Style props can branch by breakpoint via an object:

```kumiki
column(A, B, C) {
    gap: {base: "sm", md: "md", lg: "lg"},
    pad: {base: "md", lg: "xl"}
}

grid(A, B, C, D) {
    cols: {base: 1, md: 2, lg: 4}
}
```

The keys are `base` plus the keys of theme.breakpoints (`sm`, `md`, `lg`, `xl`).

---

## 4.6 Dark Mode

Define multiple themes and switch a `slot theme-name`:

```kumiki
theme Light = {colors: {bg: "#fff", fg: "#000", ...}, ...}
theme Dark  = {colors: {bg: "#0a0a0a", fg: "#fff", ...}, ...}

slot themeName : Text = "Light"

reducer toggleTheme
    on=ui.click(ThemeBtn)
    do= themeName := if themeName == "Light" then "Dark" else "Light"

app App
    caps   = []
    routes = {"/" -> Home, "/404" -> NotFound}
    init   = []
    theme  = themeName        ; points directly at a slot
```

When you specify a slot as in `theme = themeName`, the theme switches whenever that value changes. The value of `themeName` must be one of the declared theme names (checked by the compiler).

### 4.6.1 Following OS Settings

```kumiki
reducer initTheme
    on=app.start
    do= themeName := if prefers-dark() then "Dark" else "Light"
```

`prefers-dark()` is a built-in helper (it reads `prefers-color-scheme: dark`).

---

## 4.7 State Styles (hover, focus, etc.)

Tile primitives have per-state props:

```kumiki
button(text="Save") {
    bg: "primary",
    color: "bg",
    hover: {bg: "primary-dark"},      ; warns if the token is undefined
    focus: {shadow: "md"},
    disabled: {bg: "muted", color: "border"}
}
```

Supported state keys: `hover` / `focus` / `active` / `disabled` / `selected` / `checked`.

---

## 4.8 Icons

The `icon` element is referenced by name:

```kumiki
icon(name="check") {size: "md", color: "success"}
```

We plan to provide a built-in icon set of around 100 icons in v0.1 (the list comes later). Custom icons are registered by path in `theme.icons`:

```kumiki
theme MyTheme = {
    ...,
    icons: {
        logo: "M3 3h18v18H3z..."     ; SVG path
    }
}
```

---

## 4.9 Animation (limited in v0.1)

In v0.1, only the following:

| prop | Effect |
|---|---|
| `transition: "fade"` | Fade in/out |
| `transition: "slide-up"` | Slide from the bottom |
| `transition: "slide-down"` | Slide from the top |
| `transition-duration: "fast"` / `"normal"` / `"slow"` | Speed |

Applied automatically to tiles whose visibility is toggled with `when`:

```kumiki
when(modalOpen, Modal() {transition: "slide-up", transition-duration: "normal"})
```

Arbitrary CSS transitions / keyframes will be introduced in the v0.2 `motion` layer.

---

## 4.10 Global CSS / Reset

The runtime embeds a minimal reset CSS. Adding to it from the app side is **intentionally impossible**.

Rationale: global CSS becomes an implicit dependency the AI cannot track. All decoration is kept self-contained in tile props.

Exception: meta tags and OG images in `<head>` are declared via `app.meta`:

```kumiki
app TodoApp
    ...
    meta = {
        title: "My Todos",
        description: "Personal todo app",
        og-image: "/og.png",
        favicon: "/favicon.ico"
    }
```

---

## 4.11 Design Decision Record

| Decision | Rationale |
|---|---|
| Don't let users write CSS directly | Cascade and specificity create implicit dependencies the AI cannot track |
| Consolidate design tokens in the theme | Structurally prevents style values from scattering |
| Provide shorthand props (`bg`, `pad`, etc.) | Reduces token consumption |
| Express layout via tile structure | Eliminates the need for the AI to learn layout CSS |
| Ban global CSS | Always ties "where a style came from" to the parent tile |
| Limit animation in v0.1 | Too many choices destabilize the AI's decisions |

---

## 4.12 Next

- Form styling → [Forms](./forms.md)
- Accessibility → [Lifecycle](./lifecycle.md)
