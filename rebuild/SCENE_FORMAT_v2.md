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

Each object supports id, name, parentId, level, objectType, geometry, layer, zIndex, visible, selectable, style, label, detail, metadata and visibility.

Geometry types: rect(x,y,width,height), polygon(points), polyline(points), circle(center,radius), ring(center,innerRadius,outerRadius), none.

Style: fill (nullable), stroke (nullable), strokeWidth (pixels), opacity (0..1), dash (array), lineCap and lineJoin.
Label: visible, text, position, fontSize, color, maxWidth, fontWeight, outline, outlineWidth. label.visible=false MUST suppress the name even for large frames.
Visibility: whenParentSelected (boolean), modeGroup and modes (array of allowed mode IDs).
Hierarchy: level=large goes to the big-frame menu. A child object with level=medium and matching parentId goes under that parent. Do not guess parentage from positions.
Painter: higher zIndex draws later. An object's explicit zIndex overrides its named layer zIndex. Grid also obeys the zIndex configured for the grid layer.

## Coordinate examples

A conventional town/map can specify horizontal [1,0], vertical [0,1]. A vertically oriented layout can specify horizontal [0,1], vertical [-1,0]. These projection vectors are DATA and are not fixed to any map class.

## Project files

- rebuild/map-viewer.js : generic scene renderer; no hard-coded project facility names or IDs
- rebuild/header.html : two-row generic root/map navigation and current-map large/medium tree
- rebuild/map-tree.json : root and subordinate maps with scene source paths
- rebuild/scenes/*.scene.json : standalone drawing JSONs
- data/*-layout-draft.json : original preserved source JSONs
- rebuild/examples/sample-town.scene.json : fictional town test scene proving non-ship geometry

## Migration decisions and limitations

The v2 scenes are an independent representation of the approved source layout. Source coordinates were not edited. Existing showLabel=false becomes label.visible=false. Unlike the former implementation, large-area labels are NOT forced visible by a special-case renderer.
Selected known medium-level memberships are expressed by parentId in the scene JSON. Any future hierarchy edits belong in JSON, not in code.
Wall and door objects are not invented for maps without such source objects. Unsupported historical internal mechanics are not automatically reconstructed.
Actual responsive rendering remains subject to real-browser visual QA after structural and syntax validation.
