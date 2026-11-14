# Generic Map Scene JSON v2

## Design contract

This is a generic map drawing app for worlds, towns, buildings, ships and other maps. No place-specific, structure-specific, facility-ID or setting-ID logic belongs in the renderer.

- Map content (geometry, style, hierarchy, labels, display conditions and painter order) is declared in JSON.
- A boundary is a visual shape, NOT automatically a wall. Walls and routes are independent JSON objects.
- The renderer reads styles and names exactly as provided. Missing optional style fields use universal defaults only.
- The scene is read-only in the current implementation. Editing, collision and pathfinding remain separate future features.
- Zoom never silently switches hierarchy.

## Core schema

| Field | Purpose |
|---|---|
| schemaVersion: 2 | Required version |
| id, name | Scene identity and display name |
| coordinateSystem | horizontal and vertical projection vectors; world bounds; background |
| grid | visible, spacing, stroke, strokeWidth |
| layers | Optional named layers and default zIndex values |
| settings | labelDefaults, selectionZoom, visibilityGroups |
| objects | Array of drawable and selectable objects |

Each object supports id, name, parentId, numeric displayLevel, objectType, geometry, layer, zIndex, visible, selectable, style, label, detail, metadata and visibility.

**Current schema:** `displayLevel` is a positive integer (1, 2, 3, ...). All five existing scenes are migrated. Legacy string `level` is no longer written to these scenes, although older imported data remains readable. Hierarchy follows `parentId` recursively. `objectType` identifies semantics; display levels are not physical floors. Overlap handling is separate.

Geometry types: rect(x,y,width,height), polygon(points), polyline(points), circle(center,radius), ring(center,innerRadius,outerRadius), none.

Style: fill (nullable), stroke (nullable), strokeWidth (pixels), opacity (0..1), dash (array), lineCap and lineJoin.
Label: visible, text, position, fontSize, color, maxWidth, fontWeight, outline, outlineWidth. label.visible=false MUST suppress the name even for large frames.
Visibility: whenParentSelected (boolean), modeGroup and modes (array of allowed mode IDs).
Hierarchy: `parentId` controls nesting in the menu, independent of `objectType`. Do not guess parentage from positions.
Painter: higher zIndex draws later. An object's explicit zIndex overrides its named layer zIndex. Grid also obeys the zIndex configured for the grid layer.

## Coordinate examples

A conventional town/map can specify horizontal [1,0], vertical [0,1]. A vertically oriented layout can specify horizontal [0,1], vertical [-1,0]. These projection vectors are DATA and are not fixed to any map class.

## Project files

- rebuild/map-viewer.js : generic scene renderer; no hard-coded project facility names or IDs
- rebuild/header.html : root map selector, left-side view tabs and recursive hierarchy tree
- rebuild/map-tree.json : root and subordinate maps with scene source paths
- rebuild/scenes/*.scene.json : standalone drawing JSONs
- data/*-layout-draft.json : original preserved source JSONs
- rebuild/examples/sample-town.scene.json : fictional town test scene proving non-ship geometry

## Migration decisions and limitations

The v2 scenes are an independent representation of the approved source layout. Source coordinates were not edited. Existing showLabel=false becomes label.visible=false. Unlike the former implementation, large-area labels are NOT forced visible by a special-case renderer.
Selected known memberships are expressed by parentId in the scene JSON. Any future hierarchy edits belong in JSON, not in code.
Wall and door objects are not invented for maps without such source objects. Unsupported historical internal mechanics are not automatically reconstructed.
Actual responsive rendering remains subject to real-browser visual QA after structural and syntax validation.


## Editing UI

The same scene JSON is now editable in `rebuild/editor.html` using `rebuild/map-editor.js`.

- Shapes (geometry.type) and semantic role (objectType) are **independent**. A line is not automatically a road or a wall; the user chooses its role and layer.
- Users may add, duplicate, delete, drag and edit any object. Labels, color, opacity, parentId, level, layer and zIndex are separately configurable.
- The full object JSON can be edited directly for properties not exposed by individual form fields.
- Undo/Redo covers form changes and completed object drags. Selecting objects does not alter the scene.
- The editor imports and downloads JSON. GitHub Pages does not allow committing files directly. Downloaded JSON must be added to the corresponding scene path separately.
- The previous site-specific editor and overview remain under `legacy/` as historical references; primary entrypoints redirect to the generic pages.

## JSON-driven visibility groups

The renderer builds display-mode buttons from `settings.visibilityGroups`, not from hard-coded road names:

```json
{
  "visibilityGroups": {
    "routes": {
      "label": "経路",
      "default": "main",
      "options": [
        {"id": "main", "label": "主要のみ"},
        {"id": "all", "label": "全案を表示"},
        {"id": "off", "label": "非表示"}
      ]
    }
  }
}
```

A drawable object joins a group with `visibility: {"modeGroup":"routes","modes":["main","all"]}`. Other arbitrary group keys work identically.

## JSON-driven legend

```json
{
  "legendGroups": [
    {
      "title": "地区",
      "filter": {"displayLevels": [1]},
      "swatch": "box"
    },
    {
      "title": "壁",
      "filter": {"objectTypes": ["wall"], "visibleOnly": true},
      "swatch": "line"
    }
  ]
}
```

Optional `uniqueBy` and `displayField` are dotted paths into an object's fields, e.g. `metadata.roadType`. The renderer does not decide that specific object types must appear in the legend.

## Validations

```sh
node rebuild/tests/validate-scenes.js
node rebuild/tests/editor-smoke.js
```

The first test checks schema consistency and unchanged legacy coordinates. The second exercises editing and undo/redo using a fictional town instead of site-specific fixtures.



## Optional polygon room editor objects

The generic editor supports **one polygon room area** (`objectType:"region"` or other selected polygon) and auto-generated perimeter wall objects. Each polygon side is indexed `0..n-1`, including last→first, while the UI displays `1..n`.

Example of the room's saved metadata:

```json
{
  "polygonRoom": {
    "wallThicknessCm": 25,
    "doors": [{"edgeIndex": 1, "widthM": 3, "position": 0.5, "type": "sliding"}]
  }
}
```

The editor creates child objects `objectType:"wall"` (one per edge), and linked `objectType:"door"` with `opening.wallId` and `opening.width` in **scene coordinate units**. `metadata.generatedFromPolygonRoom` identifies generated objects for regeneration without deleting unrelated children. Viewers that support linked openings hide the door span from the wall stroke. A room's own polygon outline stroke is suppressed while generated walls are active so it does not paint across the door.

Vertices are editable independently; **regenerate** after vertex changes to update linked wall and door positions. This is a geometry/editing feature, not a navigability guarantee; pathfinding and wall solid-fill subtraction remain separate work.
