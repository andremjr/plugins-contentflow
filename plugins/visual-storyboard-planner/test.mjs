import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { __test, execute } from "./handler.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  await readFile(path.join(directory, "contentflow.plugin.json"), "utf8"),
);
const fixture = JSON.parse(
  await readFile(path.join(directory, "fixtures", "execution.json"), "utf8"),
);

test("declares a native image delivery and core-owned item orchestration", () => {
  const capability = manifest.capabilities[0];
  assert.equal(capability.operator, "Código");
  assert.equal(
    capability.outputPorts[0].presentation.renderer,
    "image-gallery",
  );
  assert.deepEqual(capability.outputPorts[0].shape, {
    kind: "content",
    family: "image",
    cardinality: "many",
    representation: "artifact",
    formats: { mimeTypes: ["image/svg+xml"], extensions: [".svg"] },
  });
  assert.deepEqual(capability.execution.itemOrchestration, {
    inputPort: "scene_plans",
    outputPort: "storyboard_frames",
    mode: "sequential",
    strategies: ["per_item"],
    preferredStrategy: "per_item",
    profileParallelism: { supported: false },
  });
  assert.deepEqual(manifest.permissions, ["filesystem:write"]);
  assert.equal(capability.dataPolicy.sendsDataToThirdParties, false);
});

test("normalizes the semantic contract without changing its editorial relation", () => {
  const scene = __test.parseScene(fixture.inputs.scene_plans[0]);
  assert.equal(scene.schemaVersion, "1");
  assert.equal(scene.relationship.type, "figurative");
  assert.equal(scene.visual.assetType, "motion_graphic");
  assert.deepEqual(
    scene.layers.map((layer) => layer.id),
    ["background", "marina", "heart"],
  );
});

test("rejects unsupported relation types", () => {
  const raw = JSON.parse(fixture.inputs.scene_plans[0]);
  raw.relationship.type = "mixed";
  assert.throws(
    () => __test.parseScene(raw),
    /relationship\.type is unsupported/,
  );
});

test("escapes untrusted text in the generated SVG", () => {
  const raw = JSON.parse(fixture.inputs.scene_plans[0]);
  raw.title = "Cena <script>alert(1)</script>";
  const scene = __test.parseScene(raw);
  const svg = __test.renderStoryboard(
    scene,
    __test.normalizeConfiguration({}),
    "pt-BR",
  );
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
});

test("renders a planned visual sketch inside the scene frame", () => {
  const raw = JSON.parse(fixture.inputs.scene_plans[0]);
  raw.visual.sketch = {
    background: "#18283a",
    shapes: [
      { type: "ellipse", cx: 50, cy: 48, rx: 16, ry: 24, fill: "#dc4455" },
      {
        type: "line",
        x1: 50,
        y1: 72,
        x2: 50,
        y2: 92,
        stroke: "#ffffff",
        strokeWidth: 3,
      },
    ],
  };
  delete raw.layers;
  const scene = __test.parseScene(raw);
  const svg = __test.renderStoryboard(
    scene,
    __test.normalizeConfiguration({}),
    "pt-BR",
  );
  assert.match(svg, /<ellipse cx="50" cy="48" rx="16" ry="24"/);
  assert.match(svg, /<svg x="48"/);
  assert.equal(scene.visual.sketch.shapes.length, 2);
  assert.equal(scene.layers[0].id, "composition");
});

test("renders semantic symbols, typography, and scene atmosphere safely", () => {
  const raw = JSON.parse(fixture.inputs.scene_plans[0]);
  raw.visual.sketch = {
    background: "#17202B",
    backgroundAccent: "#263340",
    texture: "grain",
    shapes: [
      {
        type: "symbol",
        symbol: "document",
        label: "EVIDÊNCIA",
        x: 10,
        y: 15,
        width: 28,
        height: 50,
        fill: "#E9E3D3",
        stroke: "#17202B",
      },
      {
        type: "text",
        x: 50,
        y: 22,
        text: "O QUE MUDOU",
        fontSize: 7,
        fontWeight: 800,
        textAnchor: "middle",
        fill: "#E9E3D3",
      },
    ],
  };
  delete raw.layers;
  const scene = __test.parseScene(raw);
  const svg = __test.renderStoryboard(
    scene,
    __test.normalizeConfiguration({}),
    "pt-BR",
  );
  assert.equal(scene.visual.sketch.texture, "grain");
  assert.equal(scene.visual.sketch.shapes[0].symbol, "document");
  assert.match(svg, /O QUE MUDOU/);
  assert.match(svg, /feDropShadow/);
  assert.match(svg, /sketch-grain/);
});

test("clamps oversized generated typography without rejecting the scene", () => {
  const raw = JSON.parse(fixture.inputs.scene_plans[0]);
  raw.visual.sketch = {
    shapes: [
      {
        type: "text",
        x: 50,
        y: 42,
        text: "1º",
        fontSize: 17,
        fill: "#E9E3D3",
      },
    ],
  };
  const scene = __test.parseScene(raw);
  assert.equal(scene.visual.sketch.shapes[0].fontSize, 14);
});

test("rejects unsafe sketch attributes and shows the visual brief when no sketch exists", () => {
  const raw = JSON.parse(fixture.inputs.scene_plans[0]);
  raw.visual.sketch = {
    shapes: [
      {
        type: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fill: "url(javascript:alert(1))",
      },
    ],
  };
  assert.throws(() => __test.parseScene(raw), /hex color or none/);
  delete raw.visual.sketch;
  const svg = __test.renderStoryboard(
    __test.parseScene(raw),
    __test.normalizeConfiguration({}),
    "pt-BR",
  );
  assert.match(svg, /Marina em primeiro plano/);
});

test("localizes relation, asset, and transition labels in rendered planning assets", () => {
  const scene = __test.parseScene(fixture.inputs.scene_plans[0]);
  const configuration = __test.normalizeConfiguration({});
  const pt = __test.renderStoryboard(scene, configuration, "pt-BR");
  const en = __test.renderStoryboard(scene, configuration, "en");
  const es = __test.renderStoryboard(scene, configuration, "es");
  assert.match(pt, /RELAÇÃO: figurativa/);
  assert.match(pt, /ENTRADA fade/);
  assert.match(en, /RELATION: figurative/);
  assert.match(en, /IN fade/);
  assert.match(es, /RELACIÓN: figurativa/);
  assert.match(es, /ENTRADA fade/);
});

test("materializes one SVG artifact and one canonical JSON item", async () => {
  const outputDirectory = await mkdtemp(
    path.join(os.tmpdir(), "contentflow-storyboard-"),
  );
  try {
    const response = await execute(fixture, {
      getOutputPath(name) {
        return path.join(outputDirectory, name);
      },
      signal: new AbortController().signal,
    });
    assert.equal(response.status, "success");
    assert.equal(response.artifacts.length, 1);
    assert.equal(response.artifacts[0].mimeType, "image/svg+xml");
    assert.equal(response.values.storyboard_frames.length, 1);
    assert.equal(response.values.normalized_scenes.length, 1);
    const svg = await readFile(
      path.join(outputDirectory, response.artifacts[0].name),
      "utf8",
    );
    assert.match(svg, /A confiança quebrada/);
    assert.match(svg, /Coração quebrado/);
    const normalized = JSON.parse(response.values.normalized_scenes[0]);
    assert.equal(normalized.id, "scene-001");
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test("localizes all plugin-facing manifest text in English and Spanish", () => {
  const capability = manifest.capabilities[0];
  for (const locale of ["en", "es"]) {
    const localized =
      manifest.localizations[locale].capabilities[capability.id];
    assert.ok(localized.name);
    assert.ok(localized.description);
    for (const port of capability.inputPorts)
      assert.ok(localized.inputPorts[port.key]?.label);
    for (const port of capability.outputPorts)
      assert.ok(localized.outputPorts[port.key]?.label);
    for (const key of Object.keys(capability.blockConfigSchema.properties)) {
      assert.ok(localized.blockConfigSchema.properties[key]?.title);
    }
  }
});
