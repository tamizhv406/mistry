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

## Tests

- [tests/test_floor_plan_sketch.ts](../tests/test_floor_plan_sketch.ts): simplification, angle
  snapping, joins, closure, duplicates.
- [tests/test_floor_plan_measure.ts](../tests/test_floor_plan_measure.ts): typed measurements and
  conversion, refusals, exact length with joined walls, T-junctions, dimension layout, zoom
  independence, clear room size, undo and redo, saving and older plans.
- [tests/test_floor_plan_core.ts](../tests/test_floor_plan_core.ts): units, rooms from walls,
  floors, history, import and export.

Touch behaviour (two fingers never draw, tap versus drag, handle targets) is not covered by
`npm test`; it was checked in a phone-sized Chrome through the DevTools protocol.

## Not implemented

- **Multi-select.** The editor holds a single selection. Selecting several items, and moving or
  deleting them together, needs the selection model, drag code and property panels reworked.
- **Rotating a door or window to any angle.** They take the angle of the wall they sit on;
  Rotate turns them a quarter turn and Mirror flips the swing.
- **Sharing.** Export is PNG, JPEG, SVG, DXF, project JSON and print / PDF; there is no share
  link.
- **Clear room size in totals.** The header total, room schedule and estimator still use the
  centre-line area. The clear ("Inside") figure is shown on the plan only.
