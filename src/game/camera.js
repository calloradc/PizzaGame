// The camera transforms the scene; gameplay remains in its original SVG coordinates.
export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 3;
const TILE_BOARDS = 2; // The generated extension places the original garden in its central half.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createCamera({ viewport, onChange }) {
  const landscape = viewport.querySelector(".landscape-pattern");
  let width = 0,
    height = 0,
    size = 0;
  let camera = { x: 0, y: 0, zoom: 1 };
  let enabled = true,
    gesture = null,
    moved = false,
    suppressClick = false;
  let frame = 0,
    disposed = false;
  const pointers = new Map();
  const cleanups = [];
  const listen = (node, type, handler, options) => {
    node.addEventListener(type, handler, options);
    cleanups.push(() => node.removeEventListener(type, handler, options));
  };
  const local = (event) => {
    const rect = viewport.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function bounded(next) {
    const zoom = clamp(next.zoom, MIN_ZOOM, MAX_ZOOM);
    const side = size * zoom;
    const limitX = Math.max(0, (side - width) / 2) + side * 0.25;
    const limitY = Math.max(0, (side - height) / 2) + side * 0.25;
    return {
      zoom,
      x: clamp(next.x, -limitX, limitX),
      y: clamp(next.y, -limitY, limitY),
    };
  }
  function render() {
    frame = 0;
    if (disposed) return;
    const tile = size * camera.zoom * TILE_BOARDS;
    const style = viewport.style;
    style.setProperty("--board-size", `${size}px`);
    style.setProperty("--camera-x", `${camera.x}px`);
    style.setProperty("--camera-y", `${camera.y}px`);
    style.setProperty("--camera-zoom", camera.zoom);
    landscape?.setAttribute(
      "patternTransform",
      `translate(${width / 2 + camera.x - tile / 2} ${height / 2 + camera.y - tile / 2}) scale(${tile})`,
    );
    viewport.dataset.zoom = camera.zoom.toFixed(4);
    onChange?.({ ...camera });
  }
  function update(next) {
    camera = bounded(next);
    if (!frame) frame = requestAnimationFrame(render);
  }
  function rebase() {
    const points = [...pointers.values()];
    if (points.length >= 2) {
      gesture = {
        type: "pinch",
        camera: { ...camera },
        center: midpoint(...points),
        distance: Math.max(1, distance(...points)),
      };
      moved = suppressClick = true;
    } else if (points.length === 1) {
      gesture = { type: "pan", camera: { ...camera }, start: points[0] };
    } else gesture = null;
  }
  function pointerDown(event) {
    if (!enabled || event.button !== 0 || event.target.closest("button"))
      return;
    if (!pointers.size) moved = suppressClick = false;
    pointers.set(event.pointerId, local(event));
    rebase();
  }
  function pointerMove(event) {
    if (!pointers.has(event.pointerId) || !gesture || !enabled) return;
    pointers.set(event.pointerId, local(event));
    const points = [...pointers.values()];
    if (gesture.type === "pinch" && points.length >= 2) {
      const center = midpoint(...points);
      const zoom = clamp(
        (gesture.camera.zoom * distance(...points)) / gesture.distance,
        MIN_ZOOM,
        MAX_ZOOM,
      );
      const ratio = zoom / gesture.camera.zoom;
      update({
        zoom,
        x:
          center.x -
          width / 2 -
          (gesture.center.x - width / 2 - gesture.camera.x) * ratio,
        y:
          center.y -
          height / 2 -
          (gesture.center.y - height / 2 - gesture.camera.y) * ratio,
      });
    } else {
      const dx = points[0].x - gesture.start.x,
        dy = points[0].y - gesture.start.y;
      if (!moved && Math.hypot(dx, dy) < 7) return;
      moved = suppressClick = true;
      update({ ...camera, x: gesture.camera.x + dx, y: gesture.camera.y + dy });
    }
    viewport.classList.add("dragging");
  }
  function pointerUp(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    rebase();
    if (!pointers.size) viewport.classList.remove("dragging");
  }
  function zoomAt(zoom, point = { x: width / 2, y: height / 2 }) {
    const nextZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM),
      ratio = nextZoom / camera.zoom;
    update({
      zoom: nextZoom,
      x: point.x - width / 2 - (point.x - width / 2 - camera.x) * ratio,
      y: point.y - height / 2 - (point.y - height / 2 - camera.y) * ratio,
    });
  }
  function reset() {
    pointers.clear();
    gesture = null;
    viewport.classList.remove("dragging");
    update({ x: width > height ? -size * 0.22 : 0, y: 0, zoom: 1 });
  }
  function resize() {
    const rect = viewport.getBoundingClientRect();
    const previousSize = size;
    width = rect.width;
    height = rect.height;
    if (!width || !height) return;
    size = Math.min(width, height) * 0.96;
    if (!previousSize) reset();
    else {
      const ratio = size / previousSize;
      update({ ...camera, x: camera.x * ratio, y: camera.y * ratio });
      rebase();
    }
  }
  listen(viewport, "pointerdown", pointerDown);
  listen(window, "pointermove", pointerMove, { passive: false });
  listen(window, "pointerup", pointerUp);
  listen(window, "pointercancel", pointerUp);
  listen(
    viewport,
    "click",
    (event) => {
      if (event.target.closest("button")) return;
      // A native click after a drag/pinch must never select a pad or cast an ability.
      // Keyboard activation has detail=0 and remains available to SVG buttons.
      if (suppressClick && event.detail !== 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  listen(
    viewport,
    "wheel",
    (event) => {
      if (!enabled || event.target.closest("button")) return;
      event.preventDefault();
      zoomAt(
        camera.zoom * Math.exp(-clamp(event.deltaY, -100, 100) * 0.0025),
        local(event),
      );
    },
    { passive: false },
  );
  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  resize();
  return {
    reset,
    zoomIn: () => enabled && zoomAt(camera.zoom * 1.25),
    zoomOut: () => enabled && zoomAt(camera.zoom / 1.25),
    setEnabled(value) {
      enabled = value;
      if (!value) {
        pointers.clear();
        gesture = null;
        viewport.classList.remove("dragging");
      }
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      pointers.clear();
    },
  };
}
