import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createCanvas } from "@napi-rs/canvas";
import { __test, execute, renderFrame } from "./handler.mjs";

const element = {
  type: "symbol",
  symbol: "document",
  label: "PROVA",
  x: 10,
  y: 15,
  width: 30,
  height: 50,
  rx: 0,
  ry: 0,
  x1: 0,
  y1: 0,
  x2: 0,
  y2: 0,
  fill: "#E9E3D3",
  stroke: "#17202B",
  strokeWidth: 2,
  opacity: 1,
  fontSize: 6,
  atMs: 0,
  durationMs: 200,
  enter: "rise",
  motion: "float",
};
const manifest = {
  version: 2,
  audioUrl: "/api/files/narration.mp3",
  scenes: [
    {
      id: "scene-001",
      title: "Prova",
      startMs: 0,
      endMs: 1000,
      narration: "Uma prova.",
      background: "#17202B",
      backgroundAccent: "#263340",
      texture: "grid",
      camera: "push-in",
      elements: [
        element,
        {
          ...element,
          type: "text",
          text: "EVIDÊNCIA",
          x: 50,
          y: 30,
          symbol: undefined,
        },
      ],
    },
  ],
};

test("validates deterministic rendering configuration", () => {
  assert.deepEqual(__test.configuration({ fps: 24 }).fps, 24);
  assert.throws(() => __test.configuration({ fps: 25 }), /inválida/);
});
test("accepts preview v2 with semantic elements", () => {
  assert.equal(
    __test.previewManifest(JSON.stringify(manifest)).scenes[0].elements[0]
      .symbol,
    "document",
  );
});
test("draws a non-empty deterministic frame", () => {
  const canvas = createCanvas(320, 180);
  const ctx = canvas.getContext("2d");
  renderFrame(ctx, manifest, 0.5, 320, 180);
  const first = Buffer.from(canvas.data());
  renderFrame(ctx, manifest, 0.5, 320, 180);
  assert.equal(first.equals(Buffer.from(canvas.data())), true);
  assert.ok(first.some((byte) => byte !== 0));
});

test(
  "renders a real MP4 with FFmpeg",
  { skip: process.env.FFMPEG_STORYBOARD_E2E !== "1" },
  async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "contentflow-storyboard-render-"),
    );
    try {
      const audioPath = path.join(directory, "narration.wav");
      const generated = spawnSync(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:duration=1",
          audioPath,
        ],
        { windowsHide: true },
      );
      assert.equal(generated.status, 0, generated.stderr?.toString());
      const result = await execute(
        {
          capabilityId: "render-storyboard-video",
          invocation: { mode: "start" },
          configuration: {
            width: 320,
            height: 180,
            fps: 24,
            encoder: "software",
            bitrateMbps: 2,
            burnSubtitles: false,
          },
          inputs: {
            preview: JSON.stringify(manifest),
            audio: { mimeType: "audio/wav", url: "/api/files/narration.wav" },
          },
        },
        {
          signal: new AbortController().signal,
          resolveInputFile: async () => audioPath,
          getOutputPath: (name) => path.join(directory, name),
        },
      );
      assert.equal(result.status, "success", result.message);
      assert.ok(
        (await stat(path.join(directory, result.values.video.name))).size >
          1000,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
