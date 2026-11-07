import assert from "node:assert/strict";
import test from "node:test";
import { createPreview, execute } from "./handler.mjs";

const plan = (id, startMs) =>
  JSON.stringify({
    id,
    title: id,
    narration: { text: `Fala ${id}`, startMs, endMs: startMs + 3000 },
  });
const element = {
  type: "rect",
  x: 10,
  y: 10,
  width: 30,
  height: 20,
  fill: "#E9E3D3",
  atMs: 0,
  durationMs: 400,
  enter: "fade",
  motion: "still",
};
const animation = (id) =>
  JSON.stringify({
    version: 1,
    sceneId: id,
    background: "#17202B",
    camera: "push-in",
    elements: [
      element,
      { ...element, type: "text", text: "DADO", x: 20, y: 50 },
    ],
  });
const input = {
  plans: [plan("scene-001", 0), plan("scene-002", 3000)],
  animations: [animation("scene-001"), animation("scene-002")],
  audio: { mimeType: "audio/mpeg", url: "/api/files/narration.mp3" },
};

test("compiles one animated composition per timed plan with narration", async () => {
  const result = await execute({ inputs: input });
  assert.equal(result.status, "success");
  const preview = JSON.parse(result.values.preview);
  assert.equal(preview.scenes.length, 2);
  assert.equal(preview.scenes[1].startMs, 3000);
  assert.equal(preview.scenes[0].elements[1].text, "DADO");
  assert.equal(preview.audioUrl, input.audio.url);
  assert.equal("frameUrl" in preview.scenes[0], false);
});

test("rejects missing, mismatched, or unsafe animations", () => {
  assert.throws(
    () => createPreview({ ...input, animations: [animation("scene-001")] }),
    /correspondente/,
  );
  assert.throws(
    () =>
      createPreview({
        ...input,
        animations: [animation("wrong"), animation("scene-002")],
      }),
    /inválido/,
  );
  assert.throws(
    () =>
      createPreview({
        ...input,
        audio: { mimeType: "audio/mpeg", url: "https://example.com/audio.mp3" },
      }),
    /não está disponível/,
  );
});

test("keeps semantic symbols and atmosphere in preview v2", () => {
  const richAnimation = (id) =>
    JSON.stringify({
      version: 2,
      sceneId: id,
      background: "#17202B",
      backgroundAccent: "#263340",
      texture: "rays",
      camera: "push-in",
      elements: [
        {
          ...element,
          type: "symbol",
          symbol: "shield",
          label: "PROTEÇÃO",
          width: 30,
          height: 35,
        },
        {
          ...element,
          type: "text",
          text: "SEGURANÇA",
          x: 50,
          y: 30,
          fontWeight: 800,
          textAnchor: "middle",
        },
      ],
    });
  const preview = JSON.parse(
    createPreview({
      ...input,
      animations: [richAnimation("scene-001"), richAnimation("scene-002")],
    }),
  );
  assert.equal(preview.version, 2);
  assert.equal(preview.scenes[0].texture, "rays");
  assert.equal(preview.scenes[0].elements[0].symbol, "shield");
});
