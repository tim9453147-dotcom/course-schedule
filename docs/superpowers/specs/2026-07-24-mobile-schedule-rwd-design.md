# Mobile Schedule RWD Design Specification

## Overview
This document specifies the redesign and optimization of the Mobile Responsive Design (RWD) for the Course Schedule page (`app/pages/index.vue`). The goal is to provide a seamless, comfortable, and intuitive user experience on mobile screens (`< 768px`) while keeping the existing FullCalendar desktop experience unchanged (`>= 768px`).

## User Experience & Interface Design

### 1. Dual View Architecture
- **Desktop (`>= 768px`)**:
  - Unmodified FullCalendar view with full month grid and interaction handlers.
- **Mobile (`< 768px`)**:
  - Compact calendar header & month view with event status dots.
  - Selected date's daily agenda card list (`Daily Agenda`).
  - Mobile bottom drawer (`Bottom Sheet`) for event creation and details instead of desktop popovers.

### 2. Mobile Layout & Components

#### A. Header Controls (`md:hidden`)
- **Classroom Selector**: Compact horizontal scrollable / tab bar for switching classrooms (e.g., 中壢, 桃園). Hidden if only 1 classroom is visible.
- **Header Actions**: Compact top-right "Import" (`匯入`) button and "Add" (`新增`) button, alongside a Floating Action Button (FAB) at the bottom right.
- **Month Navigation**: Compact header with Month Title (e.g., `2026年 7月`) and Prev/Next month navigation buttons, synchronized with swipe gestures.

#### B. Compact Month Grid & Event Indicators
- 7-column calendar grid tailored for mobile screen width.
- Date cells display the numeric day (e.g. `24`) with an active accent highlight for the selected date.
- Underneath date numbers, small colored dots (`Event Badges/Dots`) indicate scheduled courses or activities.
- Color coding matches `KIND_DEFAULT_COLOR` / `colorHex`.

#### C. Selected Day Agenda Card List (`Daily Agenda`)
- Placed directly below the compact calendar grid.
- Shows the formatted title for the selected date (e.g., `7月24日 星期五`).
- Displays a clean list of event cards for that day:
  - **Time Range**: `09:00 - 11:00` or `全天` with a vertical accent bar on the left.
  - **Title & Badges**: Course/Activity title, Classroom/Location badge.
  - **Roles (for courses)**: Host (`主`), Sharer (`分`), Summarizer (`總`), PM (`PM`) tags if present.
  - **Note & Details**: Truncated notes preview.
- **Empty State**: If no events exist for the selected date, display a subtle illustration/icon and "今日無排課行程" text.

#### D. Bottom Sheet / Drawer (`Mobile Modals`)
- On mobile (`< 768px`), detail viewing and quick creation popovers morph into bottom sheets (`UModal` or `UDrawer` slide-up from bottom).
- Eliminates off-screen popover overflow issues and provides easy thumb accessibility.

## Data & State Integration
- **Single Source of Truth**:
  - Reuses the existing `courses`, `events`, `calendarEvents`, and `expandCourse` logic.
  - Selected date state (`selectedDate`) defaults to today (`todayStr()`), updating when any calendar cell is tapped.
- **Permission Handling**:
  - Reuses `canEdit` gating for creation, editing, drag-and-drop, and deletion capabilities.

## Verification & Testing Plan
- Test on desktop (`>= 768px`) to ensure zero regression on full calendar view.
- Test on mobile viewports (`< 768px` / iPhone / Android device sizes):
  - Date tapping updates daily agenda cards instantly.
  - Swipe gestures for switching months work cleanly.
  - Event creation and editing via bottom drawer update both mobile card list and underlying reactive state.
