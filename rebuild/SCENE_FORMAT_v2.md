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

## Shared seven-level map scale standard (Rasetsu)

The authoritative preset values are stored in `rebuild/map-scale-presets.js` (global `AAMapScalePresets`). They are available from **Editor → 設定 → 地図の縮尺**. This is an opt-in standard for any scene and does not impose map-specific logic on the renderer.

**Adopted standard canvas (2026-11-23)**: **1000×1000 cells**, each **50 scene-coordinate units**, therefore `coordinateSystem.bounds={minX:0,maxX:50000,minY:0,maxY:50000}`, `grid.spacing=50`. Total grid cells: 1,000,000. The 1000×1000-cell view was tested manually by the user and approved as the reference size. The reusable empty template is `rebuild/examples/fantasy-map-1000-template.scene.json`. Existing other project/real-world/ship maps do not get automatically resized.

**Important separation**: Map cell **count** (1000×1000) and physical **distance per cell** (the seven-tier preset) are independent settings. The `settings.editorGrid` editing/snap grid is also independent of both. Applying a distance preset updates `scene.grid.spacing` and `scene.settings.mapScale`, but never rescales or moves existing shapes. For each new map, choose the actual geographic extent and reconcile the distance scale **before treating positions as measured kilometers**.

| Tier ID | Map hierarchy | Suggested meters per cell (provisional) | Theoretical extent at 1000×1000 cells |
|---|---|---:|---|
| `world` | 世界地図 | 1,000,000m = 1,000km | 1,000,000×1,000,000km |
| `continent` | 大陸地図 | 100,000m = 100km | 100,000×100,000km |
| `nation` | 国家地図 | 20,000m = 20km | 20,000×20,000km |
| `region` | 地方地図 | 2,000m = 2km | 2,000×2,000km |
| `town` | 都市・町 | 50m | 50×50km |
| `district` | 街区・敷地 | 10m | 10×10km |
| `interior` | 建物内部 | 1m | 1×1km |

Example scene properties (optional; not a schema-version change):

```json
"grid": { "visible": false, "spacing": 50 },
"settings": {
  "mapScale": {
    "standardId": "rasetsu-seven-level-v1",
    "tierId": "world",
    "metersPerCell": 1000000,
    "coordinateUnitsPerCell": 50,
    "metersPerCoordinateUnit": 20000
  }
}
```

The physical distance represented by an object is its coordinate-unit span × `metersPerCoordinateUnit`. Objects too small to depict at a given tier should be shown as **symbolic landmarks**, with geometry and buildings stored in separate child maps. Larger sites, cities or building interiors may be split across adjacent maps while keeping the tier's scale consistent.

**Existing Rasetsu map caveat**: `rasetsu-old-world.scene.json` now uses the approved **1000×1000 grid**, by promoting the accepted trial's original 161 shapes with aspect-preserving coordinates. However, its `settings.mapScale` world-tier physical distance is marked **`status:"provisional"`**. At the previously proposed 1,000 km/cell, the theoretical map would be 1,000,000 km wide: **this is not a confirmed world size and should not be treated as a physical measurement**. The world diameter, continent extents, distances between nations, hidden Jendadawn island, U-shaped Kokuten bay, bridge positions and Tokyo Dome-sized Enmaraja island must be reconciled as separate map scales later. `rasetsu-old-world-1000grid-test.scene.json` remains as a benchmark only.

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

The editor creates child objects `objectType:"wall"` (one continuous closed polyline per polygon), and linked `objectType:"door"` with `opening.wallId` and `opening.width` in **scene coordinate units**. `metadata.generatedFromPolygonRoom` identifies generated objects for regeneration without deleting unrelated children. Viewers that support linked openings hide the door span from the wall stroke. A room's own polygon outline stroke is suppressed while generated walls are active so it does not paint across the door.

Vertices are editable independently; **regenerate** after vertex changes to update linked wall and door positions. This is a geometry/editing feature, not a navigability guarantee; pathfinding and wall solid-fill subtraction remain separate work.
