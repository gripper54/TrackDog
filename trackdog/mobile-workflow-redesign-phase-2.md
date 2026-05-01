# Trackdog Mobile Workflow Redesign

Date: 2026-04-30
Purpose: Redesign Trackdog around real iPhone field use before implementing mobile UI changes.

## Core mobile goal

On phone, Trackdog should feel like a field logging tool, not a desktop admin app squeezed onto a smaller screen.

The mobile experience should optimize for:
- fast entry in the field
- quick review of today’s work
- easy lookup by work order
- low-friction correction/editing
- optional batch import when needed

It should not optimize first for:
- heavy report authoring
- dense billing review
- full desktop-style monthly administration

## Mobile user mindset

Typical iPhone usage is likely one of these:
1. I just finished work, log it fast
2. I need to check what was logged today
3. I need to find a work order quickly
4. I need to fix or add one entry while walking or standing
5. I occasionally need to paste/import a batch

This means the phone app should be built around speed, clarity, and thumb-friendly actions.

## Mobile workflow principles

### 1. Add first
The most important action on mobile is creating an entry quickly.

### 2. Review second
The user should be able to instantly see today’s and recent entries.

### 3. Search third
Work-order lookup should be direct and always close at hand.

### 4. Import as a dedicated tool
Mass entry and mixed-line import should exist, but should not compete with the main quick-add flow.

### 5. Reports stay simplified
Reports, records, billing, and archive views should be reduced on phone and treated as secondary/admin surfaces.

## Proposed mobile information architecture

### Primary mobile destinations
Use 5 bottom-nav destinations max.

1. **Add**
2. **Entries**
3. **Work Orders**
4. **Import**
5. **More**

This is the cleanest balance between field actions and admin access.

## Screen-by-screen redesign

---

## 1. Add screen (default mobile home)

### Goal
Log one new entry as fast as possible.

### What should appear immediately
- date
- worker
- hours
- work order
- short description
- save button

### What should be hidden by default
- rate
- amount
- customer if defaulted
- property
- summary/notes
- service presets unless helpful in a compact strip

### Layout behavior
- one-column form
- large touch targets
- large numeric inputs
- sticky bottom save bar
- optional “More details” expander

### Optional secondary tools on Add screen
- plain-language parse input in a collapsed card
- recent work-order suggestions
- quick hour chips like 1, 2, 4, 6, 8

### Success state
After save:
- clear confirmation
- option to add another similar entry
- option to view today’s entries

### Why this matters
This becomes the field-first action hub.

---

## 2. Entries screen

### Goal
See and edit recent work without digging.

### Default view
- Today first
- Then recent entries
- Optional segment switch: Today / This Week / This Month

### Card structure
Each card should show:
- date
- worker
- hours
- work order
- short description

Expandable details:
- summary
- rate/amount
- customer/property
- edit/delete actions

### Mobile behavior
- stacked cards, no dense inline rows
- swipe is optional later, not required first
- filters should be compact and collapsible

### Why this matters
This becomes the “check what I already logged” screen.

---

## 3. Work Orders screen

### Goal
Quickly find and review work grouped by WO.

### Default behavior
- search bar at top
- recent/active work orders first
- simplified cards with:
  - WO number
  - hours total
  - entries count
  - short latest description

### Actions
- tap to open work-order detail view
- from detail view, see related entries
- add new entry prefilled with that WO

### Why this matters
Work orders are one of the most common mental anchors in the field.

---

## 4. Import screen

### Goal
Keep batch workflows available without cluttering the Add screen.

### Sections
- plain-language parser
- single mass split tool
- mixed-line importer

### Mobile behavior
- each tool in its own accordion/card
- one active tool expanded at a time
- preview cards shown underneath
- validation warnings displayed clearly

### Why this matters
Import is useful, but it should not overwhelm the main entry flow.

---

## 5. More screen

### Goal
Hold lower-frequency admin tools.

### Put here
- Reports
- Calendar
- Billing Queue
- Records
- Dashboard/admin summaries

### Mobile behavior
- list of admin destinations
- simplified versions on phone where possible
- desktop remains better for deep report/billing work

### Why this matters
Prevents rare tasks from crowding core field workflows.

---

## Mobile header redesign

### Current problem
The current hero/header acts like a desktop marketing panel.

### New mobile header
Use a compact top area with:
- app title: Trackdog
- small month summary or today summary
- status line if needed

Possible compact example:
- Trackdog
- Apr total: 128.5 hrs
- White Oaks / Prime Properties

This should take very little vertical space.

## Navigation redesign

### Current problem
7 wrapped tabs are not workable on iPhone.

### New mobile nav
Bottom nav with:
- Add
- Entries
- Work Orders
- Import
- More

### Behavior
- sticky to bottom
- safe-area aware
- labels always visible
- active state clear

## Recommended mobile defaults

### On app open
Open to **Add**

### After save
Stay on Add, but offer:
- Add another
- View today’s entries

### If editing existing item
Open full edit sheet/card, not hidden inline clutter

## Desktop vs mobile responsibility split

### Mobile-first core
- Add
- Entries
- Work Orders
- Import

### Desktop-first but still accessible on mobile
- Reports
- Billing Queue
- Records
- Full calendar/admin screens

This split is healthy and realistic.

## Implementation priorities after workflow approval

### Build order
1. Mobile shell and bottom nav
2. Compact mobile header
3. New Add screen structure
4. New Entries screen structure
5. New Work Orders screen structure
6. Import screen cleanup
7. More screen / admin routing

## Phase-by-phase testing plan

### After mobile shell
- no nav wrapping
- no horizontal scroll
- bottom nav reachable and stable

### After Add screen
- can create entry quickly on iPhone width
- sticky save works with keyboard open
- no unnecessary scroll to submit

### After Entries screen
- recent entries easy to scan
- edit flow works without layout break

### After Work Orders
- WO search is fast
- WO detail flow feels natural

### After Import
- paste box usable on phone
- warnings and preview readable

## Final recommendation

Do not try to make every desktop screen equally powerful on iPhone.

Instead:
- make the field workflow excellent
- make admin workflows available but secondary
- design the mobile app around speed, not completeness

That is the best path to making Trackdog genuinely workable on phone.