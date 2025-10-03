# UI Overview

## Layout

The app uses a two-column layout:

```
┌──────────────────────────────────────────────────────────────┐
│  Blink Desktop                                               │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│   Sidebar    │            Main Content Area                  │
│   (256px)    │                                               │
│              │                                               │
│              │                                               │
│              │                                               │
│              │                                               │
│              │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

## Sidebar (ProjectSidebar.tsx)

```
┌─────────────────────┐
│  Blink Desktop      │  ← Title
├─────────────────────┤
│                     │
│  ┌───────────────┐  │  ← Project Card
│  │ My Agent      │  │
│  │ ~/projects/.. │  │
│  │ ● Running  ▶  │  │  ← Status + Controls
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │  ← Another Project
│  │ Test Agent    │  │
│  │ ~/test/...    │  │
│  │ ○ Stopped  ▶  │  │
│  └───────────────┘  │
│                     │
│         ...         │
│                     │
├─────────────────────┤
│ [+ Add Project]     │  ← Add Button
└─────────────────────┘
```

### Project Card States

**Stopped** (gray dot)
```
┌──────────────────────┐
│ Project Name    [x]  │  ← Delete button
│ /path/to/project     │
│ ○ Stopped        ▶   │  ← Play button
└──────────────────────┘
```

**Running** (green dot)
```
┌──────────────────────┐
│ Project Name    [x]  │
│ /path/to/project     │
│ ● Running        ■   │  ← Stop button
└──────────────────────┘
```

**Starting** (yellow dot)
```
┌──────────────────────┐
│ Project Name    [x]  │
│ /path/to/project     │
│ ● Starting...        │  ← No button
└──────────────────────┘
```

**Error** (red dot)
```
┌──────────────────────┐
│ Project Name    [x]  │
│ /path/to/project     │
│ ● Error          ▶   │  ← Can retry
└──────────────────────┘
```

## Main Content Area

### When No Project Selected

```
┌──────────────────────────────────────────┐
│                                          │
│                                          │
│           No Project Selected            │
│    Add a Blink project to get started    │
│                                          │
│          [+ Add Project]                 │
│                                          │
│                                          │
└──────────────────────────────────────────┘
```

### When Project Not Running

```
┌──────────────────────────────────────────┐
│                                          │
│                                          │
│          Project Not Running             │
│    Start the project to begin chatting   │
│                                          │
│                                          │
│                                          │
└──────────────────────────────────────────┘
```

### Chat Interface (Running Project)

```
┌──────────────────────────────────────────┐
│ My Agent                    Port: 3000   │  ← Header
├──────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────┐     │  ← User message
│  │ Hello, what can you do?        │     │
│  └────────────────────────────────┘     │
│                                          │
│     ┌──────────────────────────────────┐│  ← Assistant message
│     │ I can help you with various      ││
│     │ tasks. I have access to tools    ││
│     │ like getting IP information...   ││
│     └──────────────────────────────────┘│
│                                          │
│  ┌────────────────────────────────┐     │
│  │ Show me my IP                  │     │
│  └────────────────────────────────┘     │
│                                          │
│     ┌──────────────────────────────────┐│
│     │ Your IP is 203.0.113.42         ││
│     │ Location: San Francisco, CA     ││
│     └──────────────────────────────────┘│
│                                          │
├──────────────────────────────────────────┤
│ Type your message...            [Send]   │  ← Input area
└──────────────────────────────────────────┘
```

## Color Scheme (Light Mode)

- **Background**: White (#FFFFFF)
- **Card**: White with subtle border
- **Sidebar Background**: Light gray (#F9FAFB)
- **Primary**: Dark gray/black
- **Accent**: Blue on hover
- **User Messages**: Blue background
- **Assistant Messages**: Light gray background
- **Status Colors**:
  - Green: Running
  - Yellow: Starting
  - Red: Error
  - Gray: Stopped

## Dark Mode (Ready)

The app supports dark mode through Tailwind's dark mode classes:

- **Background**: Dark gray (#09090B)
- **Card**: Darker gray with borders
- **Text**: Light gray/white
- **All status colors adjusted for dark backgrounds**

## Typography

- **Headings**: `text-lg` to `text-2xl`, `font-semibold`
- **Body**: `text-sm` to `text-base`, `font-normal`
- **Labels**: `text-xs`, `text-muted-foreground`
- **Code**: `font-mono`

## Spacing

- **Padding**: Consistent `p-2` to `p-4` throughout
- **Gaps**: `space-y-1` to `space-y-4` for vertical spacing
- **Margins**: Minimal, rely on padding and gaps

## Interactive Elements

### Buttons

**Primary** (Add Project, Send)
```
┌──────────────────┐
│ + Add Project    │  ← Blue background, white text
└──────────────────┘
```

**Ghost** (Project controls)
```
▶  ← Hover shows background
```

**Icon Only**
```
[x]  ← Small, muted, hover shows danger color
```

### Input

```
┌─────────────────────────────────────────┐
│ Type your message...                    │  ← Gray border, focus shows ring
└─────────────────────────────────────────┘
```

## Interactions

### Hover States
- Project cards: Slight background change
- Buttons: Color intensifies
- Icons: Opacity change

### Click Feedback
- Buttons: Scale down slightly
- Cards: No feedback (just selection highlight)

### Loading States
- Buttons: Disabled appearance + opacity
- Messages: Streaming text appears character by character
- Status: "Starting..." shows animated state

## Responsive Behavior

- Sidebar: Fixed 256px width (not responsive)
- Main area: Takes remaining space
- Messages: Max 80% width, responsive to content
- Input: Full width of container

## Accessibility

- All buttons have proper ARIA labels
- Focus states visible with ring
- Keyboard navigation supported
- Screen reader friendly text
- Proper heading hierarchy

## Animations

- **Smooth transitions**: 150-300ms on hover/focus
- **Message appearance**: Fade in + slide up
- **Status changes**: Color transitions
- **Scrolling**: Smooth scroll to bottom

## Icons (Lucide React)

- `FolderPlus`: Add project
- `Play`: Start project
- `Square`: Stop project
- `Trash2`: Delete project
- `Send`: Send message
- Status dots: Unicode characters (●, ○)

## Empty States

1. **No projects**: Shows call-to-action to add first project
2. **Project stopped**: Shows call-to-action to start project
3. **No messages**: Shows hint to start conversation

## Error States

- Alert dialogs for critical errors
- In-place error messages for validation
- Red status dot for failed projects
- Retry available after errors
