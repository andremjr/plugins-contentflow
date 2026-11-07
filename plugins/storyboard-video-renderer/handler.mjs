import { spawn } from "node:child_process";
import { once } from "node:events";
import { stat } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";

const OUTPUT_NAME = "storyboard-renderizado.mp4";
const ARTIFACT_ID = "storyboard-rendered-video";
const HEX = /^#[0-9a-fA-F]{6}$/;
const ELEMENTS = new Set([
  "rect",
  "ellipse",
  "line",
  "polygon",
  "text",
  "symbol",
]);
const SYMBOLS = new Set([
  "person",
  "building",
  "document",
  "screen",
  "phone",
  "wallet",
  "lock",
  "coin",
  "network",
  "chart",
  "map",
  "folder",
  "warning",
  "question",
  "shield",
  "server",
  "arrow",
  "clock",
  "globe",
  "magnifier",
]);

class PluginFailure extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const smooth = (n) => {
  const v = clamp(n);
  return v * v * (3 - 2 * v);
};

function configuration(raw = {}) {
  const value = {
    width: raw.width ?? 1280,
    height: raw.height ?? 720,
    fps: raw.fps ?? 30,
    encoder: raw.encoder ?? "auto",
    bitrateMbps: raw.bitrateMbps ?? 8,
    burnSubtitles: raw.burnSubtitles ?? false,
  };
  if (
    !Number.isInteger(value.width) ||
    value.width < 320 ||
    value.width > 1920 ||
    !Number.isInteger(value.height) ||
    value.height < 180 ||
    value.height > 1080 ||
    ![24, 30, 60].includes(value.fps) ||
    !["auto", "qsv", "software"].includes(value.encoder) ||
    !Number.isInteger(value.bitrateMbps) ||
    value.bitrateMbps < 2 ||
    value.bitrateMbps > 20 ||
    typeof value.burnSubtitles !== "boolean"
  )
    throw new PluginFailure(
      "INVALID_CONFIGURATION",
      "A configuração de renderização é inválida.",
    );
  return value;
}

function previewManifest(raw) {
  let manifest;
  try {
    manifest = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new PluginFailure(
      "INVALID_INPUT",
      "A prévia animada não contém JSON válido.",
    );
  }
  if (
    ![1, 2].includes(manifest?.version) ||
    !Array.isArray(manifest.scenes) ||
    !manifest.scenes.length ||
    manifest.scenes.length > 1000
  ) {
    throw new PluginFailure(
      "INVALID_INPUT",
      "A prévia animada não atende ao contrato de renderização.",
    );
  }
  let prior = -1;
  for (const scene of manifest.scenes) {
    if (
      !scene ||
      typeof scene.id !== "string" ||
      !Number.isFinite(scene.startMs) ||
      !Number.isFinite(scene.endMs) ||
      scene.startMs < prior ||
      scene.endMs <= scene.startMs ||
      !HEX.test(scene.background) ||
      (scene.backgroundAccent !== undefined &&
        !HEX.test(scene.backgroundAccent)) ||
      !Array.isArray(scene.elements) ||
      scene.elements.length < 2 ||
      scene.elements.length > 32
    )
      throw new PluginFailure(
        "INVALID_INPUT",
        `A cena ${scene?.id ?? "?"} é inválida.`,
      );
    for (const element of scene.elements) {
      if (
        !ELEMENTS.has(element?.type) ||
        !Number.isFinite(element.atMs) ||
        !Number.isFinite(element.durationMs) ||
        (!HEX.test(element.fill ?? "#000000") && element.fill !== "none") ||
        (!HEX.test(element.stroke ?? "#000000") && element.stroke !== "none") ||
        (element.type === "symbol" && !SYMBOLS.has(element.symbol))
      )
        throw new PluginFailure(
          "INVALID_INPUT",
          `Elemento inválido na cena ${scene.id}.`,
        );
    }
    prior = scene.startMs;
  }
  return manifest;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  return ctx;
}

function drawSymbol(ctx, element, width, height) {
  const x = (element.x / 100) * width,
    y = (element.y / 100) * height;
  const w = (element.width / 100) * width,
    h = (element.height / 100) * height;
  const sx = w / 100,
    sy = h / 100;
  const p = (a, b) => [x + a * sx, y + b * sy];
  const fill = element.fill === "none" ? "#E9E3D3" : element.fill;
  const stroke = element.stroke === "none" ? "#17202B" : element.stroke;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(2, element.strokeWidth * Math.min(sx, sy));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const rect = (a, b, c, d, r = 4) => {
    const [px, py] = p(a, b);
    roundRect(ctx, px, py, c * sx, d * sy, r * Math.min(sx, sy)).fill();
    ctx.stroke();
  };
  const circle = (a, b, r) => {
    const [px, py] = p(a, b);
    ctx.beginPath();
    ctx.ellipse(px, py, r * sx, r * sy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  const line = (...pts) => {
    ctx.beginPath();
    pts.forEach(([a, b], i) => {
      const [px, py] = p(a, b);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.stroke();
  };
  switch (element.symbol) {
    case "person":
      circle(50, 24, 14);
      ctx.beginPath();
      {
        const [a, b] = p(25, 88),
          [c, d] = p(50, 43),
          [e, f] = p(75, 88);
        ctx.moveTo(a, b);
        ctx.quadraticCurveTo(c, d, e, f);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      line([35, 57], [15, 72]);
      line([65, 57], [85, 72]);
      break;
    case "building":
      rect(18, 18, 64, 70, 2);
      for (const a of [30, 50, 70])
        for (const b of [34, 53]) rect(a - 5, b - 5, 10, 10, 1);
      rect(43, 68, 14, 20, 0);
      break;
    case "document":
      {
        const [a, b] = p(22, 8);
        ctx.beginPath();
        ctx.moveTo(a, b);
        for (const q of [
          [64, 8],
          [80, 24],
          [80, 92],
          [22, 92],
        ]) {
          const [u, v] = p(...q);
          ctx.lineTo(u, v);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        line([64, 8], [64, 26], [80, 26]);
        line([34, 43], [68, 43]);
        line([34, 56], [68, 56]);
        line([34, 69], [58, 69]);
      }
      break;
    case "screen":
      rect(10, 13, 80, 57, 6);
      line([38, 88], [62, 88]);
      line([50, 70], [50, 88]);
      line([27, 54], [40, 41], [50, 49], [69, 28]);
      break;
    case "phone":
      rect(27, 5, 46, 90, 10);
      line([42, 16], [58, 16]);
      line([45, 84], [55, 84]);
      break;
    case "wallet":
      rect(8, 24, 84, 59, 10);
      rect(63, 43, 29, 24, 7);
      circle(72, 55, 3);
      break;
    case "lock":
      rect(17, 42, 66, 49, 8);
      ctx.beginPath();
      {
        const [a, b] = p(31, 42);
        ctx.moveTo(a, b);
        const [c, d] = p(69, 42);
        ctx.bezierCurveTo(...p(31, 5), ...p(69, 5), c, d);
        ctx.stroke();
      }
      circle(50, 63, 6);
      line([50, 69], [50, 79]);
      break;
    case "coin":
      circle(50, 50, 39);
      circle(50, 50, 29);
      line([50, 24], [50, 76]);
      break;
    case "network":
      line([22, 24], [50, 47], [78, 22]);
      line([22, 24], [30, 78], [50, 47], [78, 78], [78, 22]);
      for (const q of [
        [22, 24],
        [78, 22],
        [50, 47],
        [30, 78],
        [78, 78],
      ])
        circle(...q, 7);
      break;
    case "chart":
      line([14, 12], [14, 86], [90, 86]);
      line([23, 68], [40, 49], [55, 58], [79, 25]);
      line([68, 25], [79, 25], [79, 36]);
      break;
    case "map":
      rect(8, 12, 84, 80, 3);
      line([35, 12], [35, 86]);
      line([65, 18], [65, 92]);
      circle(50, 45, 10);
      break;
    case "folder":
      {
        const [a, b] = p(7, 25);
        ctx.beginPath();
        ctx.moveTo(a, b);
        for (const q of [
          [42, 25],
          [51, 36],
          [93, 36],
          [93, 86],
          [7, 86],
        ]) {
          const [u, v] = p(...q);
          ctx.lineTo(u, v);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    case "warning":
      {
        const [a, b] = p(50, 8);
        ctx.beginPath();
        ctx.moveTo(a, b);
        for (const q of [
          [94, 88],
          [6, 88],
        ]) {
          const [u, v] = p(...q);
          ctx.lineTo(u, v);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        line([50, 34], [50, 62]);
        circle(50, 75, 2);
      }
      break;
    case "question":
      circle(50, 50, 43);
      ctx.font = `bold ${36 * Math.min(sx, sy)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = stroke;
      ctx.fillText("?", ...p(50, 52));
      break;
    case "shield":
      {
        const [a, b] = p(50, 6);
        ctx.beginPath();
        ctx.moveTo(a, b);
        for (const q of [
          [87, 19],
          [87, 47],
          [72, 78],
          [50, 94],
          [28, 78],
          [13, 47],
          [13, 19],
        ]) {
          const [u, v] = p(...q);
          ctx.lineTo(u, v);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        line([29, 50], [43, 64], [71, 33]);
      }
      break;
    case "server":
      for (const b of [12, 39, 66]) {
        rect(10, b, 80, 23, 5);
        circle(24, b + 11.5, 3);
        line([36, b + 11.5], [74, b + 11.5]);
      }
      break;
    case "arrow":
      line([8, 50], [84, 50]);
      line([61, 27], [84, 50], [61, 73]);
      break;
    case "clock":
      circle(50, 50, 42);
      line([50, 24], [50, 53], [69, 65]);
      break;
    case "globe":
      circle(50, 50, 42);
      line([8, 50], [92, 50]);
      line([15, 30], [85, 30]);
      line([15, 70], [85, 70]);
      break;
    case "magnifier":
      circle(42, 42, 29);
      line([63, 63], [90, 90]);
      break;
    default:
      rect(12, 12, 76, 76, 12);
  }
  if (element.label) {
    ctx.font = `800 ${Math.max(10, 9 * Math.min(sx, sy))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    const [tx, ty] = p(50, 102);
    ctx.strokeText(element.label, tx, ty);
    ctx.fillText(element.label, tx, ty);
  }
  ctx.restore();
}

function drawElement(ctx, e, elapsed, progress, width, height) {
  const enter =
    e.durationMs === 0
      ? elapsed >= e.atMs
        ? 1
        : 0
      : smooth((elapsed - e.atMs) / e.durationMs);
  if (enter <= 0) return;
  let dx =
    e.enter === "slide-left"
      ? (1 - enter) * -0.1 * width
      : e.enter === "slide-right"
        ? (1 - enter) * 0.1 * width
        : 0;
  let dy = e.enter === "rise" ? (1 - enter) * 0.08 * height : 0;
  if (e.motion === "drift-left") dx -= progress * 0.03 * width;
  if (e.motion === "drift-right") dx += progress * 0.03 * width;
  if (e.motion === "float")
    dy += Math.sin(progress * Math.PI * 3) * 0.012 * height;
  const scale =
    (e.enter === "scale" ? 0.7 + enter * 0.3 : 1) *
    (e.motion === "pulse" ? 1 + Math.sin(progress * Math.PI * 4) * 0.035 : 1);
  const x = ((e.x ?? 0) / 100) * width,
    y = ((e.y ?? 0) / 100) * height,
    w = ((e.width ?? 0) / 100) * width,
    h = ((e.height ?? 0) / 100) * height;
  ctx.save();
  ctx.globalAlpha = clamp((e.opacity ?? 1) * enter);
  ctx.translate(dx, dy);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.fillStyle = e.fill === "none" ? "transparent" : e.fill;
  ctx.strokeStyle = e.stroke === "none" ? "transparent" : e.stroke;
  ctx.lineWidth = Math.max(0.5, ((e.strokeWidth ?? 1) * width) / 160);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (e.type === "rect") {
    roundRect(
      ctx,
      x,
      y,
      w,
      h,
      Math.min(
        ((e.rx ?? 0) / 100) * width,
        ((e.ry || e.rx || 0) / 100) * height,
      ),
    );
    if (e.fill !== "none") ctx.fill();
    if (e.stroke !== "none") ctx.stroke();
  } else if (e.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(
      ((e.x ?? 0) / 100) * width,
      ((e.y ?? 0) / 100) * height,
      ((e.rx ?? 0) / 100) * width,
      ((e.ry ?? 0) / 100) * height,
      0,
      0,
      Math.PI * 2,
    );
    if (e.fill !== "none") ctx.fill();
    if (e.stroke !== "none") ctx.stroke();
  } else if (e.type === "line") {
    ctx.beginPath();
    ctx.moveTo((e.x1 / 100) * width, (e.y1 / 100) * height);
    ctx.lineTo((e.x2 / 100) * width, (e.y2 / 100) * height);
    ctx.stroke();
  } else if (e.type === "polygon") {
    ctx.beginPath();
    e.points.forEach(([a, b], i) =>
      i
        ? ctx.lineTo((a / 100) * width, (b / 100) * height)
        : ctx.moveTo((a / 100) * width, (b / 100) * height),
    );
    ctx.closePath();
    if (e.fill !== "none") ctx.fill();
    if (e.stroke !== "none") ctx.stroke();
  } else if (e.type === "text") {
    ctx.font = `${e.fontWeight ?? 700} ${Math.max(8, ((e.fontSize ?? 5) / 100) * height)}px Arial`;
    ctx.textAlign = e.textAnchor ?? "left";
    ctx.textBaseline = "alphabetic";
    if (e.stroke !== "none")
      ctx.strokeText(e.text, (e.x / 100) * width, (e.y / 100) * height);
    ctx.fillText(e.text, (e.x / 100) * width, (e.y / 100) * height);
  } else drawSymbol(ctx, e, width, height);
  ctx.restore();
}

export function renderFrame(ctx, manifest, timeSeconds, width, height) {
  const ms = timeSeconds * 1000;
  const scene = manifest.scenes.reduce(
    (last, s) => (s.startMs <= ms ? s : last),
    manifest.scenes[0],
  );
  const elapsed = Math.max(0, ms - scene.startMs);
  const progress = clamp(elapsed / (scene.endMs - scene.startMs));
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, scene.background);
  gradient.addColorStop(1, scene.backgroundAccent ?? scene.background);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  if (scene.texture === "grid") {
    ctx.strokeStyle = "rgba(255,255,255,.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += width / 14) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += height / 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  ctx.save();
  if (scene.camera === "push-in" || scene.camera === "pull-back") {
    const z =
      scene.camera === "push-in" ? 1 + progress * 0.06 : 1.06 - progress * 0.06;
    ctx.translate(width / 2, height / 2);
    ctx.scale(z, z);
    ctx.translate(-width / 2, -height / 2);
  } else if (scene.camera === "pan-left")
    ctx.translate(-progress * 0.03 * width, 0);
  else if (scene.camera === "pan-right")
    ctx.translate((progress * 0.03 - 0.03) * width, 0);
  scene.elements.forEach((e) =>
    drawElement(ctx, e, elapsed, progress, width, height),
  );
  ctx.restore();
}

function run(executable, args, { signal, stdinWriter }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: [stdinWriter ? "pipe" : "ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (c) => {
      if (stderr.length < 200000) stderr += c;
    });
    const abort = () => child.kill("SIGKILL");
    signal?.addEventListener("abort", abort, { once: true });
    child.once("error", reject);
    child.once("close", (code) => {
      signal?.removeEventListener("abort", abort);
      code === 0
        ? resolve(stderr)
        : reject(new Error(stderr.slice(-4000) || `ffmpeg exit ${code}`));
    });
    if (stdinWriter)
      stdinWriter(child.stdin).catch((error) => {
        child.kill("SIGKILL");
        reject(error);
      });
  });
}

async function qsvAvailable(ffmpeg, signal) {
  try {
    await run(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=size=64x64:rate=1",
        "-frames:v",
        "1",
        "-c:v",
        "h264_qsv",
        "-f",
        "null",
        "-",
      ],
      { signal },
    );
    return true;
  } catch {
    return false;
  }
}
function subtitleFilter(file) {
  return `subtitles='${file.replaceAll("\\", "/").replace(":", "\\:").replaceAll("'", "\\'")}'`;
}

export async function execute(request, services) {
  try {
    if (request?.invocation?.mode !== "start")
      throw new PluginFailure(
        "INVALID_INPUT",
        "A renderização aceita somente invocation.mode=start.",
      );
    const config = configuration(request.configuration);
    const manifest = previewManifest(request.inputs?.preview);
    const audio = request.inputs?.audio;
    if (!audio)
      throw new PluginFailure("INVALID_INPUT", "A narração é obrigatória.");
    const audioPath = await services.resolveInputFile(audio);
    const subtitleInput = Array.isArray(request.inputs?.subtitles)
      ? request.inputs.subtitles[0]
      : request.inputs?.subtitles;
    const subtitlePath = subtitleInput
      ? await services.resolveInputFile(subtitleInput)
      : undefined;
    if (config.burnSubtitles && !subtitlePath)
      throw new PluginFailure(
        "INVALID_INPUT",
        "Ative a queima de legendas somente quando um SRT estiver conectado.",
      );
    const ffmpeg = "ffmpeg";
    const encoder =
      config.encoder === "software"
        ? "libx264"
        : config.encoder === "qsv"
          ? "h264_qsv"
          : (await qsvAvailable(ffmpeg, services.signal))
            ? "h264_qsv"
            : "libx264";
    if (
      config.encoder === "qsv" &&
      !(await qsvAvailable(ffmpeg, services.signal))
    )
      throw new PluginFailure(
        "NOT_READY",
        "Intel Quick Sync não está disponível neste computador.",
      );
    const outputPath = services.getOutputPath(OUTPUT_NAME);
    const duration = manifest.scenes.at(-1).endMs / 1000;
    const totalFrames = Math.ceil(duration * config.fps);
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext("2d");
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-video_size",
      `${config.width}x${config.height}`,
      "-framerate",
      String(config.fps),
      "-i",
      "pipe:0",
      "-i",
      audioPath,
    ];
    if (config.burnSubtitles) args.push("-vf", subtitleFilter(subtitlePath));
    args.push(
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      encoder,
      "-b:v",
      `${config.bitrateMbps}M`,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-t",
      duration.toFixed(6),
      "-shortest",
      "-movflags",
      "+faststart",
      outputPath,
    );
    await run(ffmpeg, args, {
      signal: services.signal,
      stdinWriter: async (stdin) => {
        for (let i = 0; i < totalFrames; i++) {
          if (services.signal?.aborted)
            throw new PluginFailure(
              "CANCELLED",
              "A renderização foi cancelada.",
            );
          renderFrame(
            ctx,
            manifest,
            i / config.fps,
            config.width,
            config.height,
          );
          const frame = canvas.data();
          if (!stdin.write(frame)) await once(stdin, "drain");
        }
        stdin.end();
      },
    });
    const info = await stat(outputPath);
    if (info.size < 1)
      throw new PluginFailure(
        "OUTPUT_VALIDATION_FAILED",
        "O vídeo renderizado ficou vazio.",
      );
    const artifact = {
      id: ARTIFACT_ID,
      name: OUTPUT_NAME,
      mimeType: "video/mp4",
      size: info.size,
    };
    return {
      status: "success",
      values: { video: { ...artifact, url: `artifact://${ARTIFACT_ID}` } },
      artifacts: [{ ...artifact, source: { kind: "path", path: OUTPUT_NAME } }],
      logs: [
        `${totalFrames} quadros renderizados com ${encoder} em ${config.width}x${config.height}.`,
      ],
    };
  } catch (error) {
    if (error instanceof PluginFailure)
      return {
        status: "error",
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      };
    return {
      status: "error",
      code: services.signal?.aborted ? "CANCELLED" : "JOB_FAILED",
      message: services.signal?.aborted
        ? "A renderização foi cancelada."
        : "O motor local não conseguiu renderizar o vídeo.",
      retryable: false,
    };
  }
}

export const __test = { configuration, previewManifest };
