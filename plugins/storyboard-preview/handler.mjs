const fileUrl = /^\/api\/files\/[a-zA-Z0-9._-]+$/;
const colors = /^#[0-9a-fA-F]{6}$/;
const primitiveTypes = new Set([
  "rect",
  "ellipse",
  "line",
  "polygon",
  "text",
  "symbol",
]);
const entranceTypes = new Set([
  "fade",
  "rise",
  "slide-left",
  "slide-right",
  "scale",
  "draw",
]);
const motionTypes = new Set([
  "still",
  "drift-left",
  "drift-right",
  "float",
  "pulse",
  "rotate",
]);
const cameraTypes = new Set([
  "static",
  "push-in",
  "pull-back",
  "pan-left",
  "pan-right",
]);
const textureTypes = new Set(["none", "grid", "grain", "rays"]);
const symbolTypes = new Set([
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
    json: (n) => `Composição da cena ${n} não é JSON válido.`,
    element: (e, s) =>
      `Elemento ${e} da cena ${s} fora do contrato de animação.`,
    count: "Cada plano precisa de uma composição animada correspondente.",
    audio: "A narração MP3 não está disponível para a prévia.",
    scene: (n) => `Plano ou composição da cena ${n} inválido.`,
    cancelled: "Prévia cancelada.",
  },
  en: {
    json: (n) => `Scene ${n} composition is not valid JSON.`,
    element: (e, s) =>
      `Element ${e} in scene ${s} does not match the animation contract.`,
    count: "Each plan needs a matching animated composition.",
    audio: "The MP3 narration is unavailable for preview.",
    scene: (n) => `Scene ${n} plan or composition is invalid.`,
    cancelled: "Preview cancelled.",
  },
  es: {
    json: (n) => `La composición de la escena ${n} no es JSON válido.`,
    element: (e, s) =>
      `El elemento ${e} de la escena ${s} no cumple el contrato de animación.`,
    count: "Cada plan necesita una composición animada correspondiente.",
    audio: "La narración MP3 no está disponible para la vista previa.",
    scene: (n) => `El plan o la composición de la escena ${n} no es válido.`,
    cancelled: "Vista previa cancelada.",
  },
};
function copy(locale) {
  return COPY[locale] ?? COPY["pt-BR"];
}

function invalid(message) {
  const error = new Error(message);
  error.code = "INVALID_INPUT";
  return error;
}

function parse(value, index, locale) {
  try {
    if (typeof value !== "string") return value;
    const clean = value
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    return JSON.parse(clean);
  } catch {
    throw invalid(copy(locale).json(index + 1));
  }
}

function coordinate(value) {
  return Number.isFinite(value) && value >= -100 && value <= 200;
}
function color(value) {
  return value === "none" || colors.test(value);
}

function validateElement(item, index, sceneIndex, sceneDuration, locale) {
  if (
    !item ||
    !primitiveTypes.has(item.type) ||
    !color(item.fill ?? "none") ||
    !color(item.stroke ?? "none") ||
    !coordinate(item.x ?? 0) ||
    !coordinate(item.y ?? 0) ||
    !coordinate(item.width ?? 0) ||
    !coordinate(item.height ?? 0) ||
    !coordinate(item.rx ?? 0) ||
    !coordinate(item.ry ?? 0) ||
    !coordinate(item.x1 ?? 0) ||
    !coordinate(item.y1 ?? 0) ||
    !coordinate(item.x2 ?? 0) ||
    !coordinate(item.y2 ?? 0) ||
    !Number.isFinite(item.atMs) ||
    item.atMs < 0 ||
    item.atMs > sceneDuration ||
    !Number.isFinite(item.durationMs) ||
    item.durationMs < 0 ||
    item.durationMs > sceneDuration ||
    !entranceTypes.has(item.enter) ||
    !motionTypes.has(item.motion) ||
    (item.type === "text" &&
      (typeof item.text !== "string" || item.text.length > 140)) ||
    (item.type === "symbol" &&
      (!symbolTypes.has(item.symbol) ||
        (item.label !== undefined &&
          (typeof item.label !== "string" || item.label.length > 48)))) ||
    (item.type === "polygon" &&
      (!Array.isArray(item.points) ||
        item.points.length < 3 ||
        item.points.length > 20 ||
        item.points.some(
          (point) =>
            !Array.isArray(point) ||
            point.length !== 2 ||
            !coordinate(point[0]) ||
            !coordinate(point[1]),
        )))
  ) {
    throw invalid(copy(locale).element(index + 1, sceneIndex + 1));
  }
  return {
    type: item.type,
    x: item.x ?? 0,
    y: item.y ?? 0,
    width: item.width ?? 0,
    height: item.height ?? 0,
    rx: item.rx ?? 0,
    ry: item.ry ?? 0,
    x1: item.x1 ?? 0,
    y1: item.y1 ?? 0,
    x2: item.x2 ?? 0,
    y2: item.y2 ?? 0,
    points: item.type === "polygon" ? item.points : undefined,
    text: item.type === "text" ? item.text : undefined,
    symbol: item.type === "symbol" ? item.symbol : undefined,
    label: item.type === "symbol" ? item.label : undefined,
    fontWeight:
      item.type === "text" && Number.isFinite(item.fontWeight)
        ? Math.max(400, Math.min(900, item.fontWeight))
        : undefined,
    textAnchor:
      item.type === "text" &&
      ["start", "middle", "end"].includes(item.textAnchor)
        ? item.textAnchor
        : undefined,
    fill: item.fill ?? "none",
    stroke: item.stroke ?? "none",
    strokeWidth: Number.isFinite(item.strokeWidth)
      ? Math.max(0, Math.min(8, item.strokeWidth))
      : 1,
    opacity: Number.isFinite(item.opacity)
      ? Math.max(0, Math.min(1, item.opacity))
      : 1,
    fontSize: Number.isFinite(item.fontSize)
      ? Math.max(2, Math.min(12, item.fontSize))
      : 5,
    atMs: item.atMs,
    durationMs: item.durationMs,
    enter: item.enter,
    motion: item.motion,
  };
}

export function createPreview(inputs, locale = "pt-BR") {
  const plans = inputs?.plans;
  const animations = inputs?.animations;
  const audio = inputs?.audio;
  if (
    !Array.isArray(plans) ||
    !Array.isArray(animations) ||
    !plans.length ||
    plans.length !== animations.length ||
    plans.length > 1000
  ) {
    throw invalid(copy(locale).count);
  }
  if (!audio || audio.mimeType !== "audio/mpeg" || !fileUrl.test(audio.url)) {
    throw invalid(copy(locale).audio);
  }
  let lastStart = -1;
  const scenes = plans.map((raw, index) => {
    const plan = parse(raw, index, locale);
    const animation = parse(animations[index], index, locale);
    const startMs = plan?.narration?.startMs;
    const endMs = plan?.narration?.endMs;
    if (
      !plan ||
      typeof plan.id !== "string" ||
      !plan.id ||
      typeof plan.title !== "string" ||
      typeof plan.narration?.text !== "string" ||
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      startMs < lastStart ||
      endMs <= startMs ||
      ![1, 2].includes(animation?.version) ||
      animation.sceneId !== plan.id ||
      !colors.test(animation.background) ||
      (animation.backgroundAccent !== undefined &&
        !colors.test(animation.backgroundAccent)) ||
      (animation.texture !== undefined &&
        !textureTypes.has(animation.texture)) ||
      !cameraTypes.has(animation.camera) ||
      !Array.isArray(animation.elements) ||
      animation.elements.length < 2 ||
      animation.elements.length > 32
    ) {
      throw invalid(copy(locale).scene(index + 1));
    }
    lastStart = startMs;
    const duration = endMs - startMs;
    return {
      id: plan.id,
      title: plan.title,
      startMs,
      endMs,
      narration: plan.narration.text,
      background: animation.background,
      backgroundAccent: animation.backgroundAccent ?? animation.background,
      texture: animation.texture ?? "none",
      camera: animation.camera,
      elements: animation.elements.map((item, elementIndex) =>
        validateElement(item, elementIndex, index, duration, locale),
      ),
    };
  });
  return JSON.stringify({ version: 2, audioUrl: audio.url, scenes });
}

export async function execute(request, services) {
  const locale = request?.context?.locale ?? "pt-BR";
  if (request?.invocation?.mode === "cancel" || services?.signal?.aborted) {
    return {
      status: "error",
      code: "CANCELLED",
      message: copy(locale).cancelled,
      retryable: false,
    };
  }
  return {
    status: "success",
    values: { preview: createPreview(request.inputs, locale) },
  };
}
