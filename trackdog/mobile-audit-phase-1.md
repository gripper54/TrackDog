# Trackdog Mobile Audit - Phase 1

Date: 2026-04-30
Scope: Current iPhone usability audit before any mobile-first redesign work.

## Summary

Trackdog is partially responsive, but it is not yet truly workable as an iPhone field app. The current CSS collapses some grids to one column, which helps, but the information density, oversized hero area, crowded tab system, dense entry rows, and large desktop-first reporting tools will still make field use frustrating.

Main conclusion: the app needs a mobile-first shell and mobile task prioritization, not just smaller breakpoints.

## Severity Levels

- Critical: blocks practical phone use
- High: painful or slow on phone
- Medium: usable but clumsy
- Low: polish / efficiency issue

## Findings by area

### 1) Global shell and top-of-screen structure

#### 1.1 Hero area is too tall for iPhone
- Severity: High
- Current behavior:
  - Large hero section
  - Large logo block
  - Large stat card
  - Significant copy before real work begins
- Mobile impact:
  - Pushes actual controls far below the fold
  - Feels like a landing page instead of a field tool
- Recommendation:
  - Compress hero heavily on mobile
  - Reduce copy to one short line
  - Collapse status and totals into a compact top strip

#### 1.2 Tabs are overloaded for phone
- Severity: Critical
- Current behavior:
  - 7 tab buttons in a wrapping tab bar
- Mobile impact:
  - Wraps into multiple rows
  - Hard to scan and tap quickly
  - Important actions get buried
- Recommendation:
  - Replace with dedicated mobile navigation in later phase
  - Prioritize 4 to 5 primary destinations max

#### 1.3 Overall app starts with too much visual ceremony
- Severity: Medium
- Mobile impact:
  - Slower path to adding a field entry
- Recommendation:
  - Mobile should open as a work tool first, brand second

## 2) Quick Add screen

### 2.1 Quick Add contains too many stacked tools at once
- Severity: Critical
- Current behavior:
  - Plain-language parser
  - Single mass entry tool
  - Mixed importer
  - Full manual form
  - All inside one long vertical page
- Mobile impact:
  - Huge scroll depth
  - Hard to find primary action quickly
  - High cognitive load in the field
- Recommendation:
  - Phone Quick Add should focus on manual entry first
  - Secondary tools should move into collapsible sections or separate mobile destinations

### 2.2 Primary entry form is not optimized for one-hand mobile use
- Severity: High
- Current behavior:
  - Full desktop-style form exposed at once
- Mobile impact:
  - Too many visible inputs
  - Tedious on phone keyboard
- Recommendation:
  - Reduce default visible fields
  - Promote only date, worker, hours, WO, description, save
  - Hide advanced fields behind expanders later

### 2.3 Multiple action rows create tap clutter
- Severity: High
- Current behavior:
  - Parse buttons, preview buttons, save buttons, clear buttons across multiple modules
- Mobile impact:
  - Button crowding
  - Hard to know which action belongs to which block at a glance
- Recommendation:
  - Convert to clearer card sections with one dominant action per area

### 2.4 No sticky save affordance for field use
- Severity: High
- Mobile impact:
  - User may fill form and then need to scroll to submit
- Recommendation:
  - Add sticky bottom action bar in later implementation phases

## 3) Dashboard

### 3.1 Dashboard content is dense but survivable
- Severity: Medium
- Current behavior:
  - Totals, highlights, recent entries, work order summaries
- Mobile impact:
  - Acceptable if cards stack cleanly, but still not ideal as a phone home screen
- Recommendation:
  - For mobile, show shorter summary cards and recent entries only

### 3.2 Entry toplines are too dense for narrow widths
- Severity: High
- Current behavior:
  - Multiple inline spans in one row for date, worker, customer, hours, revenue
- Mobile impact:
  - Likely wraps awkwardly
  - Hard to scan quickly
- Recommendation:
  - Convert to stacked mobile card metadata

## 4) Reports screen

### 4.1 Reports are strongly desktop-first
- Severity: High
- Current behavior:
  - Filter row
  - Many report action buttons
  - Invoice header
  - Meta form
  - Detailed entry list
- Mobile impact:
  - Too much horizontal and vertical density
  - Large control clusters
  - Likely frustrating for phone use
- Recommendation:
  - Keep as simplified review mode on mobile
  - Full report authoring can stay desktop-biased

### 4.2 Report action cluster is too large for touch flow
- Severity: High
- Mobile impact:
  - Too many equal-priority buttons
- Recommendation:
  - Reduce visible actions on mobile and move extras behind a More actions pattern

## 5) Calendar

### 5.1 Month grid is not well-suited to iPhone
- Severity: High
- Current behavior:
  - Many small day cards in a full month grid
- Mobile impact:
  - Tiny targets
  - Poor readability
  - Heavy scrolling
- Recommendation:
  - Replace with agenda/list mode on mobile, or a simplified week-first presentation

## 6) Work Orders

### 6.1 Work order cards are usable but text-heavy
- Severity: Medium
- Current behavior:
  - Group cards with inline stats and long job descriptions
- Mobile impact:
  - Readable but visually dense
- Recommendation:
  - Convert to shorter stacked cards on phone

## 7) Billing Queue

### 7.1 Queue rows are dense and low-priority for phone
- Severity: Medium
- Mobile impact:
  - Too much metadata inline
  - Not a field-first mobile priority
- Recommendation:
  - Mobile should simplify or deprioritize this view

## 8) Records

### 8.1 Records panel has long operational text and secondary actions
- Severity: Medium
- Mobile impact:
  - Okay but not efficient
- Recommendation:
  - Convert to cleaner status cards and vertical action buttons

## 9) Import tools on phone

### 9.1 Mixed importer is functional but still too heavy for casual mobile use
- Severity: High
- Current behavior:
  - Large textarea
  - warnings list
  - preview list
- Mobile impact:
  - Can work in a pinch, but it is not lightweight
- Recommendation:
  - Keep available, but not as the main phone path
  - Make it a dedicated mobile import screen later

## 10) Interaction and touch concerns

### 10.1 Too many equal-weight controls on many screens
- Severity: High
- Mobile impact:
  - Hard to see primary next step
- Recommendation:
  - Stronger primary/secondary hierarchy on mobile

### 10.2 Some metadata blocks are too verbose for field use
- Severity: Medium
- Mobile impact:
  - More reading than doing
- Recommendation:
  - Compress explanatory copy on phone

## Prioritized issue list

### Must fix early
1. Replace multi-row tab bar for mobile
2. Shrink/compress hero area on mobile
3. Redesign Quick Add into a real phone-first flow
4. Reduce dense inline entry rows into stacked cards
5. Simplify or replace month calendar grid on phone

### Should fix soon after
6. Simplify report actions on mobile
7. Move import tools into clearer mobile sections
8. Add sticky action areas for save/primary tasks

### Later polish
9. Cleaner safe-area spacing
10. Better mobile-specific status/toast behavior
11. More progressive disclosure of advanced fields

## Recommended Phase 2 scope

Phase 2 should define the iPhone information architecture before styling changes:
- choose the 4 to 5 primary mobile destinations
- define mobile home/default screen
- define what Quick Add shows by default
- decide which views stay desktop-first but mobile-accessible
- decide which screens become simplified mobile-only presentations

## Recommended Phase 3 first implementation target

After Phase 2, build in this order:
1. mobile navigation shell
2. compact mobile header
3. phone-first Quick Add
4. mobile entry cards

## Testing approach for each future phase

For every phase after implementation:
- test at iPhone width first
- test add entry flow start to finish
- test edit entry flow
- test tab/nav switching
- test no horizontal scroll
- test thumb reach for primary actions
- test form submission with keyboard open
