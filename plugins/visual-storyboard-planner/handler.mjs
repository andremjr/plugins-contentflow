import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

const RELATION_TYPES = new Set([
  "direct_literal",
  "figurative",
  "abstract",
  "programmatic",
]);
const ASSET_TYPES = new Set([
  "ai_image",
  "ai_video",
  "stock_footage",
  "avatar",
  "motion_graphic",
  "text",
  "screen_recording",
  "other",
]);
const LAYER_TYPES = new Set([
  "background",
  "media",
  "avatar",
  "text",
  "graphic",
  "overlay",
  "other",
]);
const SKETCH_TYPES = new Set([
  "rect",
  "ellipse",
  "line",
  "polygon",
  "text",
  "symbol",
]);
const SKETCH_TEXTURES = new Set(["none", "grid", "grain", "rays"]);
const SKETCH_SYMBOLS = new Set([
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

const COPY = {
  "pt-BR": {
    invalidInput: "Cada plano de cena precisa ser um objeto JSON válido.",
    invalidScene:
      "O plano da cena não atende ao contrato visual. Revise os campos obrigatórios e os valores permitidos.",
    noOutput: "O runtime não forneceu um diretório de artifacts.",
    cancelled: "A renderização do storyboard foi cancelada.",
    narration: "FALA",
    relation: "RELAÇÃO",
    visual: "DIREÇÃO VISUAL",
    asset: "ASSET",
    layers: "CAMADAS",
    motion: "MOVIMENTO",
    entry: "ENTRADA",
    exit: "SAÍDA",
    moreLayers: "+{count} camadas no plano JSON",
    relationTypes: {
      direct_literal: "direta/literal",
      figurative: "figurativa",
      abstract: "abstrata",
      programmatic: "programática",
    },
    assetTypes: {
      ai_image: "imagem por IA",
      ai_video: "vídeo por IA",
      stock_footage: "stock footage",
      avatar: "avatar",
      motion_graphic: "motion graphic",
      text: "texto",
      screen_recording: "gravação de tela",
      other: "outro",
    },
  },
  en: {
    invalidInput: "Each scene plan must be a valid JSON object.",
    invalidScene:
      "The scene plan does not satisfy the visual contract. Review required fields and allowed values.",
    noOutput: "The runtime did not provide an artifact directory.",
    cancelled: "Storyboard rendering was cancelled.",
    narration: "NARRATION",
    relation: "RELATION",
    visual: "VISUAL DIRECTION",
    asset: "ASSET",
    layers: "LAYERS",
    motion: "MOTION",
    entry: "IN",
    exit: "OUT",
    moreLayers: "+{count} layers in the JSON plan",
    relationTypes: {
      direct_literal: "direct/literal",
      figurative: "figurative",
      abstract: "abstract",
      programmatic: "programmatic",
    },
    assetTypes: {
      ai_image: "AI image",
      ai_video: "AI video",
      stock_footage: "stock footage",
      avatar: "avatar",
      motion_graphic: "motion graphic",
      text: "text",
      screen_recording: "screen recording",
      other: "other",
    },
  },
  es: {
    invalidInput: "Cada plan de escena debe ser un objeto JSON válido.",
    invalidScene:
      "El plan de escena no cumple el contrato visual. Revisa los campos obligatorios y los valores permitidos.",
    noOutput: "El runtime no proporcionó un directorio de artifacts.",
    cancelled: "La renderización del storyboard fue cancelada.",
    narration: "LOCUCIÓN",
    relation: "RELACIÓN",
    visual: "DIRECCIÓN VISUAL",
    asset: "ASSET",
    layers: "CAPAS",
    motion: "MOVIMIENTO",
    entry: "ENTRADA",
    exit: "SALIDA",
    moreLayers: "+{count} capas en el plan JSON",
    relationTypes: {
      direct_literal: "directa/literal",
      figurative: "figurativa",
      abstract: "abstracta",
      programmatic: "programática",
    },
    assetTypes: {
      ai_image: "imagen por IA",
      ai_video: "video por IA",
      stock_footage: "stock footage",
      avatar: "avatar",
      motion_graphic: "motion graphic",
      text: "texto",
      screen_recording: "grabación de pantalla",
      other: "otro",
    },
  },
};

const THEMES = {
  dark: {
    background: "#101114",
    panel: "#181a20",
    frame: "#0b0c0f",
    border: "#343844",
    text: "#f4f4f5",
    muted: "#a1a1aa",
    accent: "#8b5cf6",
    grid: "#262933",
  },
  light: {
    background: "#f4f4f5",
    panel: "#ffffff",
    frame: "#fafafa",
    border: "#d4d4d8",
    text: "#18181b",
    muted: "#52525b",
    accent: "#6d28d9",
    grid: "#e4e4e7",
  },
  blueprint: {
    background: "#071b33",
    panel: "#0b2748",
    frame: "#06172b",
    border: "#4ea5d9",
    text: "#e5f5ff",
    muted: "#9bd3f3",
    accent: "#5eead4",
    grid: "#174c76",
  },
};

const RELATION_COLORS = {
  direct_literal: "#22c55e",
  figurative: "#f59e0b",
  abstract: "#a855f7",
  programmatic: "#06b6d4",
};

const LAYER_COLORS = {
  background: "#64748b",
  media: "#3b82f6",
  avatar: "#ec4899",
  text: "#f59e0b",
  graphic: "#8b5cf6",
  overlay: "#14b8a6",
  other: "#71717a",
};

function localeFor(request) {
  const value = String(request?.context?.locale ?? "pt-BR").toLowerCase();
  if (value.startsWith("en")) return "en";
  if (value.startsWith("es")) return "es";
  return "pt-BR";
}

function message(locale, key, values = {}) {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    COPY[locale]?.[key] ?? COPY["pt-BR"][key] ?? key,
  );
}

function codedError(code, text, retryable = false) {
  const error = new Error(text);
  error.code = code;
  error.retryable = retryable;
  return error;
}

function requireText(value, path, maxLength = 2000) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${path} must be non-empty text`);
  return value.trim().slice(0, maxLength);
}

function optionalText(value, maxLength = 2000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : undefined;
}

function finiteNumber(value, path, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`${path} must be between ${minimum} and ${maximum}`);
  }
  return number;
}

function optionalMilliseconds(value, path) {
  return value === undefined
    ? undefined
    : finiteNumber(value, path, 0, 86_400_000);
}

function normalizeTransition(value, path) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path} must be an object`);
  return {
    type: requireText(value.type, `${path}.type`, 80),
    atMs: optionalMilliseconds(value.atMs, `${path}.atMs`),
    durationMs: optionalMilliseconds(value.durationMs, `${path}.durationMs`),
  };
}

function normalizeLayer(value, index) {
  const path = `layers[${index}]`;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path} must be an object`);
  const type = requireText(value.type, `${path}.type`, 40);
  if (!LAYER_TYPES.has(type)) throw new Error(`${path}.type is unsupported`);
  return {
    id: requireText(value.id, `${path}.id`, 100),
    type,
    label: requireText(value.label, `${path}.label`, 160),
    x: finiteNumber(value.x, `${path}.x`, 0, 100),
    y: finiteNumber(value.y, `${path}.y`, 0, 100),
    width: finiteNumber(value.width, `${path}.width`, 0.1, 100),
    height: finiteNumber(value.height, `${path}.height`, 0.1, 100),
    zIndex: finiteNumber(value.zIndex, `${path}.zIndex`, -100, 100),
    opacity:
      value.opacity === undefined
        ? 1
        : finiteNumber(value.opacity, `${path}.opacity`, 0, 1),
    entry: normalizeTransition(value.entry, `${path}.entry`),
    exit: normalizeTransition(value.exit, `${path}.exit`),
    motion: optionalText(value.motion, 240),
  };
}

function sketchColor(value, path, fallback = "none") {
  if (value === undefined) return fallback;
  if (
    value === "none" ||
    (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value))
  )
    return value;
  throw new Error(`${path} must be a six-digit hex color or none`);
}

function normalizeSketchShape(value, index) {
  const path = `visual.sketch.shapes[${index}]`;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path} must be an object`);
  const type = requireText(value.type, `${path}.type`, 20);
  if (!SKETCH_TYPES.has(type)) throw new Error(`${path}.type is unsupported`);
  const shape = {
    type,
    fill: sketchColor(value.fill, `${path}.fill`),
    stroke: sketchColor(value.stroke, `${path}.stroke`),
    strokeWidth:
      value.strokeWidth === undefined
        ? 1
        : finiteNumber(value.strokeWidth, `${path}.strokeWidth`, 0, 8),
    opacity:
      value.opacity === undefined
        ? 1
        : finiteNumber(value.opacity, `${path}.opacity`, 0, 1),
  };
  const coordinate = (key) =>
    finiteNumber(value[key], `${path}.${key}`, 0, 100);
  if (type === "rect")
    Object.assign(shape, {
      x: coordinate("x"),
      y: coordinate("y"),
      width: coordinate("width"),
      height: coordinate("height"),
      rx: value.rx === undefined ? 0 : coordinate("rx"),
      ry: value.ry === undefined ? 0 : coordinate("ry"),
    });
  if (type === "ellipse")
    Object.assign(shape, {
      cx: coordinate("cx"),
      cy: coordinate("cy"),
      rx: coordinate("rx"),
      ry: coordinate("ry"),
    });
  if (type === "line")
    Object.assign(shape, {
      x1: coordinate("x1"),
      y1: coordinate("y1"),
      x2: coordinate("x2"),
      y2: coordinate("y2"),
    });
  if (type === "polygon") {
    if (
      !Array.isArray(value.points) ||
      value.points.length < 3 ||
      value.points.length > 32
    )
      throw new Error(`${path}.points must contain 3 to 32 points`);
    shape.points = value.points.map((point, pointIndex) => {
      if (!Array.isArray(point) || point.length !== 2)
        throw new Error(
          `${path}.points[${pointIndex}] must be a coordinate pair`,
        );
      return point.map((number, axis) =>
        finiteNumber(number, `${path}.points[${pointIndex}][${axis}]`, 0, 100),
      );
    });
  }
  if (type === "text") {
    Object.assign(shape, {
      x: coordinate("x"),
      y: coordinate("y"),
      text: requireText(value.text, `${path}.text`, 140),
      fontSize:
        value.fontSize === undefined
          ? 6
          : Math.min(
              14,
              Math.max(
                2,
                finiteNumber(
                  value.fontSize,
                  `${path}.fontSize`,
                  Number.MIN_SAFE_INTEGER,
                  Number.MAX_SAFE_INTEGER,
                ),
              ),
            ),
      fontWeight:
        value.fontWeight === undefined
          ? 700
          : finiteNumber(value.fontWeight, `${path}.fontWeight`, 400, 900),
      textAnchor: ["start", "middle", "end"].includes(value.textAnchor)
        ? value.textAnchor
        : "start",
    });
  }
  if (type === "symbol") {
    const symbol = requireText(value.symbol, `${path}.symbol`, 40);
    if (!SKETCH_SYMBOLS.has(symbol))
      throw new Error(`${path}.symbol is unsupported`);
    Object.assign(shape, {
      x: coordinate("x"),
      y: coordinate("y"),
      width: coordinate("width"),
      height: coordinate("height"),
      symbol,
      label: optionalText(value.label, 48),
    });
  }
  return shape;
}

function normalizeSketch(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("visual.sketch must be an object");
  if (
    !Array.isArray(value.shapes) ||
    value.shapes.length < 1 ||
    value.shapes.length > 60
  )
    throw new Error("visual.sketch.shapes must contain 1 to 60 shapes");
  return {
    background: sketchColor(
      value.background,
      "visual.sketch.background",
      "#16202b",
    ),
    backgroundAccent: sketchColor(
      value.backgroundAccent,
      "visual.sketch.backgroundAccent",
      value.background ?? "#16202b",
    ),
    texture: SKETCH_TEXTURES.has(value.texture) ? value.texture : "none",
    shapes: value.shapes.map(normalizeSketchShape),
  };
}

function parseScene(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("scene must be an object");
  const relationType = requireText(
    parsed.relationship?.type,
    "relationship.type",
    40,
  );
  if (!RELATION_TYPES.has(relationType))
    throw new Error("relationship.type is unsupported");
  const assetType = requireText(
    parsed.visual?.assetType,
    "visual.assetType",
    40,
  );
  if (!ASSET_TYPES.has(assetType))
    throw new Error("visual.assetType is unsupported");
  const hasSketch = parsed.visual?.sketch !== undefined;
  const layers =
    hasSketch && (!Array.isArray(parsed.layers) || parsed.layers.length === 0)
      ? [
          {
            id: "composition",
            type: "background",
            label: parsed.title ?? parsed.id,
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            zIndex: 0,
            opacity: 1,
          },
        ]
      : parsed.layers;
  if (!Array.isArray(layers) || layers.length < 1 || layers.length > 24) {
    throw new Error("layers must contain between 1 and 24 items");
  }
  const startMs = optionalMilliseconds(
    parsed.narration?.startMs,
    "narration.startMs",
  );
  const endMs = optionalMilliseconds(
    parsed.narration?.endMs,
    "narration.endMs",
  );
  if (startMs !== undefined && endMs !== undefined && endMs <= startMs) {
    throw new Error("narration.endMs must be greater than narration.startMs");
  }
  const searchTerms = Array.isArray(parsed.visual?.searchTerms)
    ? parsed.visual.searchTerms
        .map((item, index) =>
          requireText(item, `visual.searchTerms[${index}]`, 120),
        )
        .slice(0, 12)
    : [];
  const scene = {
    schemaVersion: "1",
    id: requireText(parsed.id, "id", 100),
    title: optionalText(parsed.title, 160),
    narration: {
      text: requireText(parsed.narration?.text, "narration.text", 4000),
      ...(startMs !== undefined ? { startMs } : {}),
      ...(endMs !== undefined ? { endMs } : {}),
    },
    relationship: {
      type: relationType,
      explanation: optionalText(parsed.relationship?.explanation, 500),
    },
    visual: {
      description: requireText(
        parsed.visual?.description,
        "visual.description",
        1200,
      ),
      assetType,
      prompt: optionalText(parsed.visual?.prompt, 3000),
      searchTerms,
      sketch: normalizeSketch(parsed.visual?.sketch),
    },
    layers: layers
      .map(normalizeLayer)
      .sort((left, right) => left.zIndex - right.zIndex),
  };
  return scene;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value, maxCharacters, maxLines) {
  const words = String(value)
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (words.join(" ").length > lines.join(" ").length && lines.length) {
    lines[lines.length - 1] =
      `${lines[lines.length - 1].replace(/[.…]+$/u, "")}…`;
  }
  return lines.slice(0, maxLines);
}

function textLines(lines, x, y, options = {}) {
  const size = options.size ?? 24;
  const lineHeight = options.lineHeight ?? Math.round(size * 1.35);
  const weight = options.weight ?? 400;
  const fill = options.fill ?? "currentColor";
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="Inter,Segoe UI,Arial,sans-serif">${escapeXml(line)}</text>`,
    )
    .join("");
}

function frameRect(format) {
  const area = { x: 48, y: 132, width: 1020, height: 648 };
  const ratio =
    format === "portrait" ? 9 / 16 : format === "square" ? 1 : 16 / 9;
  let width = area.width;
  let height = width / ratio;
  if (height > area.height) {
    height = area.height;
    width = height * ratio;
  }
  return {
    x: area.x + (area.width - width) / 2,
    y: area.y + (area.height - height) / 2,
    width,
    height,
  };
}

function renderGrid(frame, colors) {
  const lines = [];
  for (let index = 1; index < 3; index += 1) {
    const x = frame.x + (frame.width * index) / 3;
    const y = frame.y + (frame.height * index) / 3;
    lines.push(
      `<line x1="${x}" y1="${frame.y}" x2="${x}" y2="${frame.y + frame.height}"/>`,
    );
    lines.push(
      `<line x1="${frame.x}" y1="${y}" x2="${frame.x + frame.width}" y2="${y}"/>`,
    );
  }
  return `<g stroke="${colors.grid}" stroke-width="2" stroke-dasharray="9 12" opacity="0.75">${lines.join("")}</g>`;
}

function renderLayers(scene, frame, configuration) {
  return scene.layers
    .map((layer, index) => {
      const x = frame.x + (frame.width * layer.x) / 100;
      const y = frame.y + (frame.height * layer.y) / 100;
      const width = (frame.width * layer.width) / 100;
      const height = (frame.height * layer.height) / 100;
      const color = LAYER_COLORS[layer.type] ?? LAYER_COLORS.other;
      const label = `${index + 1}. ${layer.label}`;
      return `<g opacity="${Math.max(0.25, layer.opacity)}">
        <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="3" ${configuration.showLayerGuides ? 'stroke-dasharray="10 7"' : ""}/>
        <rect x="${x + 8}" y="${y + 8}" width="${Math.min(width - 16, Math.max(92, label.length * 9 + 20))}" height="30" rx="8" fill="${color}"/>
        <text x="${x + 18}" y="${y + 29}" fill="#ffffff" font-size="16" font-weight="700" font-family="Inter,Segoe UI,Arial,sans-serif">${escapeXml(label)}</text>
      </g>`;
    })
    .join("");
}

function renderSketch(scene, frame, colors) {
  const sketch = scene.visual.sketch;
  if (!sketch) {
    return `<rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" fill="${colors.frame}"/>${textLines(wrapText(scene.visual.description, 50, 8), frame.x + 58, frame.y + 110, { size: 28, lineHeight: 42, fill: colors.text })}`;
  }
  const renderSymbol = (shape) => {
    const fill = shape.fill === "none" ? "#E9E3D3" : shape.fill;
    const stroke = shape.stroke === "none" ? "#17202B" : shape.stroke;
    const common = `fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
    const line = `fill="none" stroke="${stroke}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
    const icons = {
      person: `<circle cx="50" cy="24" r="14" ${common}/><path d="M25 88c2-30 12-45 25-45s23 15 25 45z" ${common}/><path d="M35 57 15 72M65 57l20 15" ${line}/><circle cx="45" cy="22" r="2.5" fill="${stroke}"/><circle cx="55" cy="22" r="2.5" fill="${stroke}"/><path d="M44 31q6 5 12 0" ${line}/>`,
      building: `<path d="M18 88V18h64v70M10 88h80" ${common}/>${[30, 50, 70].flatMap((x) => [34, 53].map((y) => `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" rx="2" fill="${stroke}"/>`)).join("")}<rect x="43" y="68" width="14" height="20" fill="${stroke}"/>`,
      document: `<path d="M22 8h42l16 16v68H22z" ${common}/><path d="M64 8v18h16M34 43h34M34 56h34M34 69h24" ${line}/>`,
      screen: `<rect x="10" y="13" width="80" height="57" rx="6" ${common}/><path d="M38 88h24M50 70v18M27 54l13-13 10 8 19-21" ${line}/>`,
      phone: `<rect x="27" y="5" width="46" height="90" rx="10" ${common}/><path d="M42 16h16M45 84h10" ${line}/>`,
      wallet: `<rect x="8" y="24" width="84" height="59" rx="10" ${common}/><path d="M13 24 68 9l7 15M63 43h29v24H63a12 12 0 0 1 0-24z" ${line}/><circle cx="72" cy="55" r="3" fill="${stroke}"/>`,
      lock: `<rect x="17" y="42" width="66" height="49" rx="8" ${common}/><path d="M31 42V29a19 19 0 0 1 38 0v13" ${line}/><circle cx="50" cy="63" r="6" fill="${stroke}"/><path d="M50 69v10" ${line}/>`,
      coin: `<circle cx="50" cy="50" r="39" ${common}/><circle cx="50" cy="50" r="29" fill="none" stroke="${stroke}" stroke-width="3"/><path d="M60 34c-5-7-24-6-24 5 0 15 29 5 29 20 0 12-20 13-29 5M50 24v52" ${line}/>`,
      network: `<path d="M22 24 50 47l28-25M22 24l8 54 20-31 28 31V22M30 78h48" ${line}/>${[
        [22, 24],
        [78, 22],
        [50, 47],
        [30, 78],
        [78, 78],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" ${common}/>`)
        .join("")}`,
      chart: `<path d="M14 12v74h76M23 68l17-19 15 9 24-33M68 25h11v11" ${line}/>`,
      map: `<path d="m8 20 27-12 30 12 27-12v72L65 92 35 80 8 92z" ${common}/><path d="M35 8v72M65 20v72" ${line}/><path d="M50 30c-10 0-16 7-16 15 0 12 16 26 16 26s16-14 16-26c0-8-6-15-16-15z" fill="${stroke}"/><circle cx="50" cy="45" r="5" fill="${fill}"/>`,
      folder: `<path d="M7 25h35l9 11h42v50H7z" ${common}/>`,
      warning: `<path d="M50 8 94 88H6z" ${common}/><path d="M50 34v28M50 74v2" ${line}/>`,
      question: `<circle cx="50" cy="50" r="43" ${common}/><path d="M34 36c2-20 34-22 35-1 1 17-19 15-19 29M50 78v1" ${line}/>`,
      shield: `<path d="M50 6c13 10 26 12 37 13v28c0 23-14 38-37 47C27 85 13 70 13 47V19c11-1 24-3 37-13z" ${common}/><path d="m29 50 14 14 28-31" ${line}/>`,
      server: [12, 39, 66]
        .map(
          (y) =>
            `<rect x="10" y="${y}" width="80" height="23" rx="5" ${common}/><circle cx="24" cy="${y + 11.5}" r="3" fill="${stroke}"/><path d="M36 ${y + 11.5}h38" ${line}/>`,
        )
        .join(""),
      arrow: `<path d="M8 50h72M61 27l23 23-23 23" ${line}/>`,
      clock: `<circle cx="50" cy="50" r="42" ${common}/><path d="M50 24v29l19 12" ${line}/>`,
      globe: `<circle cx="50" cy="50" r="42" ${common}/><path d="M8 50h84M50 8c23 22 23 62 0 84M50 8c-23 22-23 62 0 84M15 30h70M15 70h70" ${line}/>`,
      magnifier: `<circle cx="42" cy="42" r="29" ${common}/><path d="m63 63 27 27" ${line}/>`,
    };
    return `<svg x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" overflow="visible"><g filter="url(#symbol-shadow)">${icons[shape.symbol] ?? icons.question}</g>${shape.label ? `<text x="50" y="108" text-anchor="middle" fill="${fill}" stroke="${stroke}" stroke-width="0.6" paint-order="stroke" font-size="9" font-weight="800" font-family="Inter,Segoe UI,Arial,sans-serif">${escapeXml(shape.label)}</text>` : ""}</svg>`;
  };
  const shapes = sketch.shapes
    .map((shape) => {
      const style = `fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" opacity="${shape.opacity}"`;
      if (shape.type === "rect")
        return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.rx}" ry="${shape.ry}" ${style}/>`;
      if (shape.type === "ellipse")
        return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" ${style}/>`;
      if (shape.type === "line")
        return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" ${style}/>`;
      if (shape.type === "polygon")
        return `<polygon points="${shape.points.map((point) => point.join(",")).join(" ")}" ${style}/>`;
      if (shape.type === "text")
        return `<text x="${shape.x}" y="${shape.y}" fill="${shape.fill}" stroke="${shape.stroke === "none" ? "none" : shape.stroke}" stroke-width="${shape.strokeWidth}" paint-order="stroke" font-size="${shape.fontSize}" font-weight="${shape.fontWeight}" text-anchor="${shape.textAnchor}" font-family="Inter,Segoe UI,Arial,sans-serif">${escapeXml(shape.text)}</text>`;
      return renderSymbol(shape);
    })
    .join("");
  const texture =
    sketch.texture === "grid"
      ? `<rect width="100" height="100" fill="url(#sketch-grid)"/>`
      : sketch.texture === "grain"
        ? `<rect width="100" height="100" filter="url(#sketch-grain)" opacity=".6"/>`
        : sketch.texture === "rays"
          ? `<rect width="100" height="100" fill="url(#sketch-rays)"/>`
          : "";
  return `<svg x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="sketch-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${sketch.background}"/><stop offset="1" stop-color="${sketch.backgroundAccent}"/></linearGradient><filter id="symbol-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity=".35"/></filter><filter id="sketch-grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="8"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .11"/></feComponentTransfer></filter><pattern id="sketch-grid" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width=".35"/></pattern><radialGradient id="sketch-rays"><stop stop-color="#ffffff" stop-opacity=".13"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="100" height="100" fill="url(#sketch-bg)"/>${texture}${shapes}</svg>`;
}

function transitionSummary(layer, locale) {
  const parts = [];
  if (layer.entry)
    parts.push(
      `${COPY[locale].entry} ${layer.entry.type}${layer.entry.durationMs !== undefined ? ` ${layer.entry.durationMs}ms` : ""}`,
    );
  if (layer.motion) parts.push(layer.motion);
  if (layer.exit)
    parts.push(
      `${COPY[locale].exit} ${layer.exit.type}${layer.exit.durationMs !== undefined ? ` ${layer.exit.durationMs}ms` : ""}`,
    );
  return parts.join(" · ");
}

function renderStoryboard(scene, configuration, locale) {
  const colors = THEMES[configuration.theme] ?? THEMES.dark;
  const relationColor =
    RELATION_COLORS[scene.relationship.type] ?? colors.accent;
  const frame = frameRect(configuration.frameFormat);
  const maxLayers = Math.max(
    1,
    Math.min(12, Number(configuration.maxVisibleLayers ?? 6)),
  );
  const visibleLayers = scene.layers.slice(0, maxLayers);
  const duration =
    scene.narration.startMs !== undefined && scene.narration.endMs !== undefined
      ? `${(scene.narration.startMs / 1000).toFixed(1)}s → ${(scene.narration.endMs / 1000).toFixed(1)}s`
      : "—";
  const layerLegend = visibleLayers
    .map((layer, index) => {
      const y = 496 + index * 54;
      const motion = configuration.showMotionDetails
        ? transitionSummary(layer, locale)
        : "";
      return `<circle cx="1124" cy="${y - 7}" r="7" fill="${LAYER_COLORS[layer.type] ?? LAYER_COLORS.other}"/>
        ${textLines(wrapText(`${index + 1}. ${layer.label}`, 35, 1), 1142, y, { size: 18, weight: 700, fill: colors.text })}
        ${motion ? textLines(wrapText(motion, 43, 1), 1142, y + 22, { size: 14, fill: colors.muted }) : ""}`;
    })
    .join("");
  const remaining = scene.layers.length - visibleLayers.length;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="${escapeXml(scene.title ?? scene.id)}">
  <rect width="1600" height="900" fill="${colors.background}"/>
  <rect x="28" y="28" width="1544" height="844" rx="28" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
  <rect x="48" y="48" width="10" height="56" rx="5" fill="${relationColor}"/>
  ${textLines([scene.title ?? scene.id], 78, 78, { size: 30, weight: 800, fill: colors.text })}
  ${textLines([`${scene.id}  ·  ${duration}`], 78, 104, { size: 16, fill: colors.muted })}
  <rect x="1120" y="52" width="430" height="40" rx="20" fill="${relationColor}" fill-opacity="0.18" stroke="${relationColor}"/>
  ${textLines([`${COPY[locale].relation}: ${COPY[locale].relationTypes[scene.relationship.type]}`], 1142, 79, { size: 17, weight: 700, fill: relationColor })}
  <rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="18" fill="${colors.frame}" stroke="${colors.border}" stroke-width="3"/>
  ${configuration.showLayerGuides ? renderGrid(frame, colors) : ""}
  <clipPath id="frame-clip"><rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="18"/></clipPath>
  <g clip-path="url(#frame-clip)">${renderSketch(scene, frame, colors)}${scene.visual.sketch ? "" : renderLayers(scene, frame, configuration)}</g>
  <rect x="1096" y="132" width="454" height="648" rx="18" fill="${colors.background}" fill-opacity="0.5" stroke="${colors.border}"/>
  ${textLines([COPY[locale].visual], 1120, 170, { size: 15, weight: 800, fill: colors.accent })}
  ${textLines(wrapText(scene.visual.description, 42, 5), 1120, 202, { size: 18, lineHeight: 25, fill: colors.text })}
  ${textLines([COPY[locale].asset], 1120, 356, { size: 15, weight: 800, fill: colors.accent })}
  ${textLines(wrapText(COPY[locale].assetTypes[scene.visual.assetType], 42, 1), 1120, 388, { size: 20, weight: 700, fill: colors.text })}
  ${scene.relationship.explanation ? textLines(wrapText(scene.relationship.explanation, 44, 3), 1120, 426, { size: 15, lineHeight: 21, fill: colors.muted }) : ""}
  ${textLines([COPY[locale].layers], 1120, 470, { size: 15, weight: 800, fill: colors.accent })}
  ${layerLegend}
  ${remaining > 0 ? textLines([message(locale, "moreLayers", { count: remaining })], 1120, 758, { size: 14, fill: colors.muted }) : ""}
  <rect x="48" y="806" width="1502" height="46" rx="12" fill="${colors.background}" fill-opacity="0.72"/>
  ${textLines([COPY[locale].narration], 68, 836, { size: 14, weight: 800, fill: colors.accent })}
  ${textLines(wrapText(scene.narration.text, 125, 1), 158, 837, { size: 17, fill: colors.text })}
</svg>`;
}

function safeName(value, fallback) {
  const result = String(value ?? fallback)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return result || fallback;
}

function normalizeConfiguration(configuration = {}) {
  return {
    frameFormat: ["landscape", "portrait", "square"].includes(
      configuration.frameFormat,
    )
      ? configuration.frameFormat
      : "landscape",
    theme: ["dark", "light", "blueprint"].includes(configuration.theme)
      ? configuration.theme
      : "dark",
    showLayerGuides: configuration.showLayerGuides !== false,
    showMotionDetails: configuration.showMotionDetails !== false,
    maxVisibleLayers: Math.max(
      1,
      Math.min(12, Number(configuration.maxVisibleLayers ?? 6)),
    ),
  };
}

export async function execute(request, services) {
  const locale = localeFor(request);
  if (request?.invocation?.mode === "cancel" || services?.signal?.aborted) {
    return {
      status: "error",
      code: "CANCELLED",
      message: message(locale, "cancelled"),
      retryable: false,
    };
  }
  if (!services?.getOutputPath)
    throw codedError("INVALID_REQUEST", message(locale, "noOutput"));
  const rawInput = request?.inputs?.scene_plans;
  const rawScenes = Array.isArray(rawInput) ? rawInput : [rawInput];
  if (!rawScenes.length || rawScenes[0] == null) {
    throw codedError("INVALID_INPUT", message(locale, "invalidInput"));
  }
  const configuration = normalizeConfiguration(request.configuration);
  const artifacts = [];
  const values = [];
  const normalizedScenes = [];
  for (const [index, rawScene] of rawScenes.entries()) {
    if (services?.signal?.aborted) {
      return {
        status: "error",
        code: "CANCELLED",
        message: message(locale, "cancelled"),
        retryable: false,
      };
    }
    let scene;
    try {
      scene = parseScene(rawScene);
    } catch (error) {
      throw codedError("INVALID_INPUT", message(locale, "invalidScene"));
    }
    const ordinal = Number(request?.batch?.index ?? index) + 1;
    const svg = renderStoryboard(scene, configuration, locale);
    const bytes = Buffer.from(svg, "utf8");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const id = `storyboard-${hash.slice(0, 20)}`;
    const name = `${String(ordinal).padStart(3, "0")}-${safeName(scene.id, `scene-${ordinal}`)}.svg`;
    await writeFile(services.getOutputPath(name), bytes);
    artifacts.push({
      id,
      name,
      mimeType: "image/svg+xml",
      size: bytes.length,
      source: { kind: "path", path: name },
    });
    values.push({
      id,
      name,
      mimeType: "image/svg+xml",
      size: bytes.length,
      url: `artifact://${id}`,
    });
    normalizedScenes.push(JSON.stringify(scene));
  }
  return {
    status: "success",
    values: {
      storyboard_frames: values,
      normalized_scenes: normalizedScenes,
    },
    artifacts,
    usage: {
      inputCharacters: rawScenes.reduce(
        (total, value) => total + JSON.stringify(value ?? "").length,
        0,
      ),
      outputCharacters: normalizedScenes.reduce(
        (total, value) => total + value.length,
        0,
      ),
    },
  };
}

export const __test = {
  normalizeConfiguration,
  parseScene,
  renderStoryboard,
  safeName,
};
