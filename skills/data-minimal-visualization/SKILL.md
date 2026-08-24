---
name: data-minimal-visualization
description: Use whenever building or editing a chart, graph, plot, or dashboard — rules for keeping visualizations clean, easy to read, and informative. Frank is populating this with his own updated materials over time; treat this as a living style guide, not a finished spec.
---

# Data Minimal Visualization

## Overview

A chart's job is to make a pattern in the data obvious faster than the
underlying table would. Every element that doesn't serve that job — extra
gridlines, redundant labels, decorative color, an axis that isn't the one
you're reading — is friction between the viewer and the point. Default to
removing, not adding.

## Rules

1. **Maximize data-ink ratio.** Every pixel should carry information. Cut
   gridlines, borders, backgrounds, and tick marks that don't help someone
   read a value. If you can delete an element and lose nothing, delete it —
   this is Tufte's data-ink ratio (data-ink ÷ total ink); decoration that
   doesn't encode data is chartjunk, full stop, no matter how "designed" it
   looks. Where you do keep an axis line, trim it to the data's actual
   min/max rather than padding to a round number (a "range-frame") — one
   more thing that's informative instead of decorative.
2. **Pick the chart type the data shape demands**, not the one that looks
   impressive. Trend over time → line. Comparison across categories → bar.
   Part-to-whole → stacked bar or (rarely) pie, only with few slices.
   Distribution → histogram or box plot. Don't reach for 3D, dual-axis, or
   radial charts to make a simple comparison look more sophisticated than it
   is. Never encode a single quantity with area or volume (bubble size,
   3D bar depth) when length or position would do — area is harder to
   compare accurately and it's the classic way a chart quietly lies.
3. **Bars start at zero, always.** Any mark whose *length* is what the eye
   reads as magnitude (bar, column, area) must use a zero baseline —
   cropping it to "zoom in" turns a 10% change into what looks like a 300%
   change. Sanity-check any chart you're unsure about with Tufte's Lie
   Factor: (visual size of the change shown) ÷ (actual size of the change
   in the data). It should be ~1.0; anything past ~1.05 or under ~0.95 means
   the picture is overstating or understating the data. Lines/points that
   aren't encoding magnitude by length (e.g. a line chart tracking
   direction of change) can zoom the y-axis when that's the honest point —
   just label it so the zoom is obvious, not hidden.
4. **One clear takeaway per chart.** If a chart is trying to answer three
   questions at once, it answers none of them well. Split it, or pick the
   one metric that matters most and let the rest live in a tooltip or a
   secondary view.
5. **Label directly, not through a legend when avoidable.** A legend forces
   the eye to travel back and forth between the mark and the key. Labeling
   the line/bar itself (or color-coding with an obvious convention, like red
   for "bad" and blue/green for "good") is faster to read.
6. **Fixed axes when comparing multiple charts side by side.** If the point
   is to compare shape or magnitude across several small charts, they need
   the same scale — auto-scaling per chart defeats the comparison (a small
   wiggle on one chart can look identical in size to a huge swing on
   another purely because the axes differ). This is Tufte's small multiples:
   once someone decodes one panel's design, every other panel is free —
   so when you're tempted to overlay more than ~4-5 series on one chart
   (a "spaghetti graph"), switch to repeating the same small chart per
   category instead of cramming everything into one.
7. **No dual/secondary y-axis.** Two series plotted on two different scales
   in the same chart invites the reader to compare shapes that aren't
   actually comparable, and there's no visual cue telling them not to.
   Either split into two stacked charts sharing an x-axis, or label the data
   points directly instead of adding a second scale.
8. **Respect the physical space the chart will render in.** A chart that's
   comfortable on a 1440px laptop screen is not automatically comfortable at
   390px on a phone — either the chart adapts (bigger touch targets, fewer
   visible labels, scrollable canvas that preserves point density) or you
   accept it needs a minimum width and let it scroll, but never let it
   silently compress into unreadable mush.
9. **Text has to be legible at actual render size**, not just "technically
   present." If axis labels are rotated, overlapping, or below ~11-12px in
   a real browser, they're not labels, they're noise. When there isn't room
   to show every label, thin them out on a uniform stride (not an
   inconsistent auto-collapse) so the remaining ones still read as evenly
   spaced.
10. **Color means something, or it isn't used.** Reserve color for encoding
    a real variable (category, direction, severity). Don't add color for
    visual variety. When color does encode meaning, keep it consistent
    across every chart in the same view (the same metric should always be
    the same color) — this is the Gestalt principle of similarity: same
    color reads as "same series" automatically, so don't fight it by
    reusing a color for something unrelated.
11. **Order data to match how it'll be read.** Time series: pick a
    consistent direction (this app puts most-recent first, left-to-right,
    matching how the surrounding tables already sort) and stay consistent
    across every chart in the same feature. Categorical comparisons: sort by
    value, not alphabetically, unless alphabetical order is itself the point.
12. **Never fabricate visual precision the data doesn't have.** Don't smooth,
    interpolate, or extend a line past the last real data point without
    making that explicit. If a chart mixes real and estimated/synthetic
    data, that's a product decision to make deliberately (and document),
    not a default.

## Before shipping a chart, ask

Does it pass all four: does it have a **story** (a point, not just data),
a **function** (a goal — what should the viewer do or know after looking),
does it show real **information** (not decoration standing in for
substance), and does the **visual form** fit the data shape? A chart
strong on visual form and story but weak on information/function is just
eye candy; strong on information and form but no story/function is
boring; strong on story/function but no real information/form is useless.
The chart that's actually worth shipping is the one at the center of all
four.

## Red flags — stop and reconsider

- A legend is required to read a 2-line chart
- Two charts meant for side-by-side comparison have different y-axis scales
- A bar/column chart with a cropped (non-zero) baseline
- A dual/secondary y-axis on one chart
- More than ~5 overlapping lines on one chart (spaghetti graph — use small
  multiples instead)
- Rotated or tiny axis labels that overlap or clip
- A pie chart with more than ~5 slices, or a 3D chart of any kind
- A single quantity encoded by area or volume instead of length/position
- Gridlines dense enough to compete with the data itself
- A color used purely for decoration, not encoding

## Sources

These rules are synthesized from Edward Tufte's *The Visual Display of
Quantitative Information*, Cole Nussbaumer Knaflic's *Storytelling with
Data*, and David McCandless's *Knowledge is Beautiful*. Full compressed
notes on all three (named terms, worked examples, verbatim rules) are at
`~/Downloads/dataviz/zpending-dataviz-*-SUMMARY.md`.
