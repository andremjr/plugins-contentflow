const hex = /^#[0-9a-fA-F]{6}$/;
const shapes = new Set([
  "rect",
  "ellipse",
  "line",
  "polygon",
  "text",
  "symbol",
]);
const textures = new Set(["none", "grid", "grain", "rays"]);
const symbols = new Set([
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
const motions = ["drift-left", "drift-right", "float", "pulse", "still"];

function invalid(message) {
  const error = new Error(message);
  error.code = "INVALID_INPUT";
  return error;
}
function number(value, fallback = 0) {
  return Number.isFinite(value)
    ? Math.max(-100, Math.min(200, value))
    : fallback;
}
function color(value, fallback) {
  return value === "none" || hex.test(value ?? "") ? value : fallback;
}

export function compose(raw) {
  let plan;
  try {
    plan = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw invalid("O plano da cena não é JSON válido.");
  }
  const sketch = plan?.visual?.sketch;
  const duration = plan?.narration?.endMs - plan?.narration?.startMs;
  if (
    !plan?.id ||
    !hex.test(sketch?.background ?? "") ||
    !Array.isArray(sketch.shapes) ||
    sketch.shapes.length < 1 ||
    sketch.shapes.length > 60 ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    throw invalid("O plano não contém desenho e tempos válidos para animação.");
  }
  const relation = plan.relationship?.type;
  const camera =
    relation === "figurative"
      ? "pull-back"
      : relation === "abstract"
        ? "pan-left"
        : relation === "programmatic"
          ? "pan-right"
          : "push-in";
  const elements = sketch.shapes.slice(0, 32).flatMap((shape, index) => {
    if (!shapes.has(shape.type)) return [];
    const entrance =
      shape.type === "line"
        ? "draw"
        : relation === "programmatic"
          ? "slide-right"
          : relation === "abstract"
            ? "scale"
            : index % 3 === 0
              ? "rise"
              : "fade";
    const atMs = Math.min(
      Math.max(0, duration - 120),
      Math.round(index * Math.min(190, duration / (sketch.shapes.length + 2))),
    );
    const motion =
      shape.type === "line"
        ? "still"
        : motions[(index + plan.id.length) % motions.length];
    return [
      {
        type: shape.type,
        x: number(shape.x),
        y: number(shape.y),
        width: number(shape.width),
        height: number(shape.height),
        rx: number(shape.rx),
        ry: number(shape.ry),
        x1: number(shape.x1),
        y1: number(shape.y1),
        x2: number(shape.x2),
        y2: number(shape.y2),
        ...(shape.type === "polygon" ? { points: shape.points } : {}),
        ...(shape.type === "text"
          ? {
              text: String(shape.text ?? "").slice(0, 140),
              fontWeight: number(shape.fontWeight, 700),
              textAnchor: ["start", "middle", "end"].includes(shape.textAnchor)
                ? shape.textAnchor
                : "start",
            }
          : {}),
        ...(shape.type === "symbol" && symbols.has(shape.symbol)
          ? {
              symbol: shape.symbol,
              label:
                typeof shape.label === "string"
                  ? shape.label.slice(0, 48)
                  : undefined,
            }
          : {}),
        fill: color(shape.fill, "none"),
        stroke: color(shape.stroke, "none"),
        strokeWidth: number(shape.strokeWidth, 1),
        opacity: Number.isFinite(shape.opacity)
          ? Math.max(0, Math.min(1, shape.opacity))
          : 1,
        fontSize: number(shape.fontSize, 5),
        atMs,
        durationMs: Math.min(420, duration - atMs),
        enter: entrance,
        motion,
      },
    ];
  });
  if (elements.length < 2)
    throw invalid("O plano precisa de pelo menos duas camadas visuais.");
  return JSON.stringify({
    version: 2,
    sceneId: plan.id,
    background: sketch.background,
    backgroundAccent: hex.test(sketch.backgroundAccent ?? "")
      ? sketch.backgroundAccent
      : sketch.background,
    texture: textures.has(sketch.texture) ? sketch.texture : "none",
    camera,
    elements,
  });
}

export async function execute(request, services) {
  if (request?.invocation?.mode === "cancel" || services?.signal?.aborted)
    return {
      status: "error",
      code: "CANCELLED",
      message: "Composição cancelada.",
      retryable: false,
    };
  const supplied = request?.inputs?.plans;
  const plans = Array.isArray(supplied)
    ? supplied
    : supplied == null
      ? []
      : [supplied];
  if (!plans.length) throw invalid("Nenhum plano de cena foi fornecido.");
  return { status: "success", values: { animations: plans.map(compose) } };
}
