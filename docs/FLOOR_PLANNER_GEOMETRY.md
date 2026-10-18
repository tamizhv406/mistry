# Floor Planner: geometry, measurements and sketching

How the Floor Planner stores a drawing, what its measurements mean, and how a freehand
stroke becomes walls. Written for whoever works on the planner next.

A plan drawn here is a conceptual layout for planning and discussion. It is not a certified
structural or architectural drawing. Structural design, and compliance with building rules and
approvals, must be checked by a qualified engineer or architect. Both sentences are shown in
the editor (Drawing tips, Plan overview) and on the printed / PDF export; the PNG and JSON
exports carry the first one (`PLAN_DISCLAIMER`, `PLAN_REVIEW_NOTE` in
[planDocument.ts](../src/domain/planDocument.ts)).

## Coordinate system and scale

| | |
|---|---|
| Origin | Top-left corner of the plot |
| Axes | `x` to the right, `y` downward (screen convention) |
| Stored unit | The plan's **base unit**: feet for `feet` and `inches` plans, metres for `meters` and `centimeters` plans |
| Scale on screen | 20 px per plan unit at 100% zoom (`PX_PER_UNIT`), times the zoom |
| View | `zoom`, `panX`, `panY` are view state only. They are never written into geometry |

- A wall is its **centre-line**: `x1, y1, x2, y2` plus `thickness`, all in the base unit.
- `inches` and `centimeters` only change how a length is shown and what a plain typed number
  means. Their coordinates are still feet and metres.
- Screen and plan positions are converted in one place, `planToScreen` / `screenToPlan` in
  [planMeasure.ts](../src/domain/planMeasure.ts). A finger-sized tolerance in pixels is turned
  into plan units with `pixelsToPlan(pixels, zoom)`, so snapping feels the same at any zoom
  while the stored result does not depend on zoom.

## Units and conversion

- 1 ft = 0.3048 m exactly, 1 ft = 12 in (`METERS_PER_FOOT` in
  [planGeometry.ts](../src/domain/planGeometry.ts)).
- A typed length is read by `parseLengthInput`. It accepts `12' 6"`, `12'-6"`, `12ft 6in`,
  `12 6`, `12-6`, `6"`, `150in`, `12.5`, `3.5m`, `350cm`, `3500mm` and inch fractions such as
  `6 1/2"`. A plain number is in the plan's own display unit. Feet typed into a metre plan (and
  the reverse) are converted.
- Refused, with a message and no change to the plan: empty text, text that is not a length,
  zero, negative values, anything non-finite, a wall shorter than 3 in / 5 cm or longer than
  1000 ft / 300 m, and a thickness outside 2 in to 3 ft / 50 mm to 900 mm.
- **Rounding is display only.** Geometry is stored at full precision. `formatDimension` rounds
  for labels (feet to the nearest quarter inch, metres to the centimetre). A typed `12' 7 1/4"`
  is stored as 12.604166… ft and shown as `12'-7¼"`.
- The only clean-up applied to stored numbers is removing floating-point fuzz at 1e-9 of a unit
  when a sketch or a rotation creates a coordinate. Room outlines derived from walls are
  rounded to 0.0001 of a unit; they are recomputed from the walls and never feed back into them.

## What each measurement means

| Shown as | Meaning | Source |
|---|---|---|
| Red dimension line outside a wall | Wall length, joint to joint along the centre-line | `wallLengthOf` |
| Thickness | Across the wall. It never changes a wall's length | `wall.thickness` |
| Green "Inside …" in a room | Clear size between the inner wall faces: the centre-line outline moved in by half the thickness of the wall on each side | `roomInterior` |
| Room area on the plan, in the room schedule and in totals | Area of the centre-line outline (a little larger than the clear area) | `roomArea` |

Dimension lines are drawn from the wall's real end points on every render, so they follow a
drag as it happens. `outsideNormal` picks the side away from the room the wall encloses, and
`layoutDimension` places the extension lines, arrowheads and label. Measurement text is a fixed
size on screen; the *Measurement text size* setting scales the text and nothing else.

## Editing that keeps the plan connected

- **Dragging a corner handle** (`moveJoint`): every wall end at that corner moves together. The
  corner snaps to another corner or a wall crossing within reach, otherwise to the grid, and
  follows the Snap setting.
- **Dragging a wall** (`translateWall`): walls joined to its ends stretch to follow.
- **Typing a length** (`resizeWall`): the chosen end stays put and the other end moves along
  the wall's own line. A wall that turns off at the moving end is carried whole, so a
  rectangular room stays rectangular; a wall that continues in the same line gives up or gains
  the length.
- **T-junctions** (`reattachTees`): a wall end resting on the side of another wall follows that
  wall through all three edits.
- After any wall change `normaliseFloor` re-derives rooms and keeps doors and windows on their
  wall. `prepareForWallEdit` runs first: a room from an older plan that already fills the space
  its walls enclose is tied to those walls, so it follows the edit.
- A new wall is never laid on top of an existing one (`trimNewWall`, `subtractCoveredSpans`):
  only the part that is new is added and an exact repeat is refused.

## Freehand sketching

`interpretStroke` in [planSketch.ts](../src/domain/planSketch.ts) turns one stroke into walls:

1. Wobble is removed (Ramer-Douglas-Peucker); hooks at the ends and small jogs are dropped.
2. Each straight run is pulled to an allowed angle when it is close to one. Angles and
   tolerances are options: by default 0° and 90° within 20°, 45° and 135° within 12°.
3. A line is fitted to each run and corners are the crossings of neighbouring lines, so a
   hand-drawn box gets true right angles.
4. Stroke ends join a corner, wall crossing or wall within the endpoint tolerance. A stroke
   that ends near its start is closed.
5. Parts lying on existing walls are cut away.

Nothing is added to the plan by that function. Its result reports each correction and
`maxShift`, the furthest the stroke was moved. The editor shows the result live while the
finger moves, then:

- commits it as **one undo step** and shows what was done with an Undo button, when every
  correction is within the snap reach; or
- shows it dashed with **Use / Leave open / Redraw**, when a correction is larger (a gap wider
  than the snap reach was closed, or the stroke was moved further than the review limit).

## Wall segments: erase part of a wall, split a wall

Implemented in [planEdit.ts](../src/domain/planEdit.ts). Every function there returns a whole,
consistent floor (rooms re-derived, doors and windows kept on their wall) or a refusal with a
reason, and never changes its input. The editor applies the result as one undo step and shows
what it did with an Undo button.

- **Junctions** (`wallJunctions`): the points along a wall where another wall ends on it
  (T-junction) or crosses it. Points within the join tolerance of the wall's own ends are
  corners, not junctions. They divide the wall into **segments** (`wallSegmentAt`).
- **Eraser** (`eraseWallSegment`): a tap on a wall erases only the segment under the finger,
  between the two nearest junctions. The rest of the wall keeps its exact coordinates, and the
  walls it meets are not touched. A wall nothing meets is erased whole. Doors and windows on the
  erased part go with it (the result says so); the others stay exactly where they were and are
  moved onto the remaining piece they stand on (`rehost`). Before this, the eraser only split
  the wall in two, erased nothing, and let doors on the far half be clamped onto the near half.
- **Split** (`splitWall`): cuts a wall into two walls at the point nearest the tap (on the grid
  when Snap is on; exactly on a junction when the tap is within the join tolerance of one). Both
  parts keep thickness, type and height. Refused near either end and through a door or window.
  `splitWallAtJunctions` cuts at every junction at once.
- The selected wall shows the segment "Erase part" would remove (blue band) and a dashed cut
  mark where Split will cut.
- Eraser and Split act on a tap only. A pinch or a pan that starts on a wall never erases or
  cuts it: in those tools elements do not take the press, the canvas hit-tests the tap with a
  finger-sized reach in screen pixels.

## Measurement check (small differences that should match)

`findAlignmentIssues` reports measurements a few millimetres apart (0.5 mm to 100 mm by
default) that are probably meant to be the same:

- **out of line:** the two ends of one near-horizontal or near-vertical wall are at different
  distances from the same reference line, e.g. 150 mm at one end and 140 mm at the other;
- **step:** two walls that continue each other end to end sit on lines a few mm apart.

Both measurements are taken from a real line (the top or left edge of the plot) and are the
drawing's own numbers. A difference larger than 100 mm is taken to be intended; diagonal walls
are never reported. Nothing is changed by finding issues: the editor shows a small "≠ 10 mm"
badge on the plan and the **Measurement check** sheet lists both measurements and the
difference. The user picks the measurement that is right (`applyAlignmentFix`); the other end,
or the other wall, is moved to it with `moveJoint`, so joined walls follow, and a jog that ends
up with no length is removed. "Keep as drawn" hides the item for the session.

## Rooms changed through their walls

- `resizeRoom` sets a room's width (left to right) and/or length (top to bottom), centre line to
  centre line like its area. A room made by walls changes by moving the walls of one side (right
  and bottom by default, or the side chosen); rooms next to the moved wall grow or shrink with
  it and every changed room is listed. Refused, with the reason, when a wall on that side runs on
  past the room (it would reshape other rooms), when it would close up another room, and for
  sizes that are not numbers, are below 3 ft / 0.9 m or above 200 ft / 60 m. A hand-placed room
  simply gets the new size. Before this, the size boxes changed a wall-made room's record only;
  its walls redrew it at the old size, so the change never showed.
- `deleteRoom` removes a wall-made room with the wall parts only it uses; walls shared with
  another room stay. A room whose walls are all shared is refused (deleting it would open the
  rooms around it).
- `addRoom` draws a walled room with a door: in a corner of a chosen room (two new inside walls)
  or against the outside of the drawing where it fits on the plot.
- `syncRoomsWithWalls` (planGeometry.ts): a room whose space was erased can no longer take over
  the space of the room next door. Rooms whose centre is still inside a space claim it first;
  only rooms left over fall back to the nearest free space.

## Measurement labels

A wall's length label can be dragged out from the wall or along it to a clearer spot. Where it
is drawn is saved on the wall (`dimensionOffset`, `dimensionShift`, plan units) and never
changes the wall or its length. A tap on a label still opens the exact-length box. The text size
is the *Measurement text size* setting. While a wall is drawn, a dashed guide dimension line
shows its length, and the live label adds the other units (a feet plan shows metres and
millimetres, a metre plan millimetres and feet-inches) and what the end snapped to.

## Building Mistry AI on the device

[planCommands.ts](../src/services/planCommands.ts) reads requests such as "Fix my plan", "Make
this bedroom 10 feet wide", "Add a bathroom in bedroom 1" and "Rename this room to Pooja" and
turns them into a **proposal**: the complete next floor plus a list of what changes, built from
the functions above. The AI sheet draws it dashed over the plan; nothing changes until Apply.
A proposal that removes anything asks a second time. After Apply the editor checks that the
drawing really changed before saying "Done", and Undo restores it. A request for a whole new
layout goes to the `floor-plan-ai` server function when it is configured, otherwise to the
built-in layout rules; the sheet says which.

## Tests

- [tests/test_plan_editing.ts](../tests/test_plan_editing.ts): junctions and segments, erasing
  one segment, splitting, the 150 mm / 140 mm measurement check and its fix, room resize through
  walls, deleting and adding rooms, undo, saving and reopening.
- [tests/test_plan_commands.ts](../tests/test_plan_commands.ts): reading sizes from requests,
  room choice, proposals that change the real walls, "Fix my plan", bad and missing input.
- [tests/test_floor_plan_sketch.ts](../tests/test_floor_plan_sketch.ts): simplification, angle
  snapping, joins, closure, duplicates.
- [tests/test_floor_plan_measure.ts](../tests/test_floor_plan_measure.ts): typed measurements and
  conversion, refusals, exact length with joined walls, T-junctions, dimension layout, zoom
  independence, clear room size, undo and redo, saving and older plans.
- [tests/test_floor_plan_core.ts](../tests/test_floor_plan_core.ts): units, rooms from walls,
  floors, history, import and export.

Touch behaviour (two fingers never draw, tap versus drag, handle targets, segment erase, split,
the measurement check, label dragging, the AI sheet) is not covered by `npm test`; it was
checked in a 390 × 844 touch-emulated Chrome through the DevTools protocol, not on a real phone.

## Not implemented

- **Multi-select.** The editor holds a single selection. Selecting several items, and moving or
  deleting them together, needs the selection model, drag code and property panels reworked.
- **Non-rectangular room sizes.** Width and length can be typed for rectangular rooms only;
  L-shaped and other rooms are resized by moving their walls or corners.
- **Rotating a door or window to any angle.** They take the angle of the wall they sit on;
  Rotate turns them a quarter turn and Mirror flips the swing.
- **Sharing.** Export is PNG, JPEG, SVG, DXF, project JSON and print / PDF; there is no share
  link.
- **Clear room size in totals.** The header total, room schedule and estimator still use the
  centre-line area. The clear ("Inside") figure is shown on the plan only.
