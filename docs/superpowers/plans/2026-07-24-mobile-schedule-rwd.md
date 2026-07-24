# Mobile Schedule RWD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a mobile-optimized responsive design (RWD) for the course schedule page (`app/pages/index.vue`), featuring a compact calendar grid with event dots and a daily agenda card list for `< 768px` viewports, while preserving desktop FullCalendar view for `>= 768px`.

**Architecture:** Create a `MobileScheduleView.vue` component that handles mobile header controls, compact 7-column month grid with event dots, selected date management, daily agenda card list, and FAB button. Integrate it into `app/pages/index.vue` with `md:hidden` / `hidden md:block` responsive toggles. Upgrade quick detail and creation modals on mobile to bottom slide-up sheets.

**Tech Stack:** Nuxt 3, Vue 3, Nuxt UI / Tailwind CSS, Lucide icons.

## Global Constraints

- Preserve all existing desktop FullCalendar behavior and functionality (`>= 768px`).
- Shared single source of truth for course/event data (`courses`, `events`, `calendarEvents`).
- Full support for permissions (`canEdit`), classroom tab switching, and event clicks.

---

### Task 1: Create Mobile Schedule Component (`MobileScheduleView.vue`)

**Files:**
- Create: `app/components/MobileScheduleView.vue`

**Interfaces:**
- Props:
  - `events`: `Array<{ title: string, start: string, end?: string, allDay: boolean, color: string, extendedProps: { source: string, refId: number, occDate?: string } }>`
  - `classrooms`: `string[]`
  - `currentClassroom`: `string`
  - `canEdit`: `boolean`
  - `tabItems`: `Array<{ label: string, value: string }>`
- Emits:
  - `update:currentClassroom`: `(val: string) => void`
  - `select-event`: `(event: any, anchorElement?: HTMLElement) => void`
  - `create-event`: `(dateStr: string) => void`
  - `open-import`: `() => void`

- [x] **Step 1: Create `MobileScheduleView.vue` with template and script**
- [x] **Step 2: Commit `MobileScheduleView.vue`**

---

### Task 2: Integrate `MobileScheduleView` into `app/pages/index.vue`

**Files:**
- Modify: `app/pages/index.vue`

**Interfaces:**
- Consumes: `MobileScheduleView.vue`
- RWD Toggles: `md:hidden` for mobile view, `hidden md:block` for desktop FullCalendar view.

- [x] **Step 1: Add MobileScheduleView to index.vue template**
- [x] **Step 2: Commit updates to `app/pages/index.vue`**

---

### Task 3: Verification & Polish

**Files:**
- Check: `app/pages/index.vue`
- Check: `app/components/MobileScheduleView.vue`

- [x] **Step 1: Test Nuxt build**
- [x] **Step 2: Verify git status and commit final polish**
