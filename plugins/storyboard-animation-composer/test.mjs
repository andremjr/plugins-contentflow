import assert from "node:assert/strict";
import test from "node:test";
import { compose, execute } from "./handler.mjs";

const plan = (id, relation) =>
  JSON.stringify({
    id,
    title: "Uma questão de confiança",
    relationship: { type: relation },
    narration: {
      text: "O episódio revelou outra questão.",
      startMs: 1000,
      endMs: 5000,
    },
    visual: {
      sketch: {
        background: "#17202B",
        shapes: [
          {
            type: "rect",
            x: 10,
            y: 20,
            width: 45,
            height: 50,
            fill: "#E9E3D3",
          },
          {
            type: "line",
            x1: 50,
            y1: 25,
            x2: 80,
            y2: 65,
            stroke: "#C44B4B",
            strokeWidth: 2,
          },
        ],
      },
    },
  });

test("one planned scene becomes visual layers with timed movement and no planning card", async () => {
  const result = await execute({
    inputs: { plans: [plan("scene-001", "figurative")] },
  });
  assert.equal(result.status, "success");
  const animation = JSON.parse(result.values.animations[0]);
  assert.equal(animation.sceneId, "scene-001");
  assert.equal(animation.camera, "pull-back");
  assert.equal(animation.elements[1].enter, "draw");
  assert.equal(animation.elements.length, 2);
  assert.equal(
    animation.elements.some(
      (element) => element.text === "Uma questão de confiança",
    ),
    false,
  );
  assert.equal("frameUrl" in animation, false);
});

test("different relationships produce different camera and entrance plans", () => {
  const direct = JSON.parse(compose(plan("scene-001", "direct_literal")));
  const abstract = JSON.parse(compose(plan("scene-002", "abstract")));
  assert.notEqual(direct.camera, abstract.camera);
  assert.notEqual(direct.elements[0].enter, abstract.elements[0].enter);
});

test("preserves semantic symbols, typography, and atmosphere in animation v2", () => {
  const rich = JSON.parse(plan("scene-003", "programmatic"));
  rich.visual.sketch = {
    background: "#17202B",
    backgroundAccent: "#263340",
    texture: "grid",
    shapes: [
      {
        type: "symbol",
        symbol: "network",
        label: "REDE",
        x: 8,
        y: 18,
        width: 40,
        height: 55,
        fill: "#E9E3D3",
        stroke: "#17202B",
      },
      {
        type: "text",
        x: 54,
        y: 28,
        text: "RASTRO",
        fontSize: 8,
        fontWeight: 800,
        textAnchor: "start",
        fill: "#C44B4B",
      },
    ],
  };
  const animation = JSON.parse(compose(JSON.stringify(rich)));
  assert.equal(animation.version, 2);
  assert.equal(animation.texture, "grid");
  assert.equal(animation.elements[0].symbol, "network");
  assert.equal(animation.elements[1].text, "RASTRO");
});
