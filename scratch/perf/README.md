# Gameplay perf harness

Renders real board components through `react-test-renderer` with `react-native`,
`react-native-reanimated` and `@shopify/react-native-skia` stubbed, so board
render cost can be measured without a device.

    npx jest --config scratch/perf/jest.perf.js --runInBand

`board.perf.test.tsx` reports, for Level 100 (28x28, 770 pixels), both the
pre-pass renderer (`BeforeField.tsx`, one `<Pixel>` subtree per cell) and the
current `StaticPixelField`:

  * `mountMs`      — React render phase only, via `React.Profiler`
  * `nativeNodes`  — nodes in the rendered tree (native views before, Skia after)
  * `perClearMs`   — render cost of one pixel clearing

Caveats: desktop V8, not Hermes; the stubs make Skia path ops free; and nothing
here measures the native view diff or shadow-tree layout, which is where the
per-cell renderer cost the most on device. Treat the numbers as a floor on the
improvement, and note that `react-test-renderer`'s own `act()` adds ~2.45 ms per
update, which `React.Profiler` excludes.
