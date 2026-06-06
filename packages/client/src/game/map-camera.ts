import { CELL_PX, MAP_COLS, MAP_ROWS } from "@rtsbrowser/shared";

export interface MapCamera {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.75;
export const DEFAULT_ZOOM = 1;

const ARROW_SPEED = 18;
const ZOOM_WHEEL_FACTOR = 1.12;

export function worldSizePx(): { width: number; height: number } {
  return { width: MAP_COLS * CELL_PX, height: MAP_ROWS * CELL_PX };
}

/** Visible world size for the current viewport and zoom level. */
export function visibleWorldSize(viewportW: number, viewportH: number, zoom: number): {
  width: number;
  height: number;
} {
  return { width: viewportW / zoom, height: viewportH / zoom };
}

export function clampCamera(
  cam: MapCamera,
  viewportW: number,
  viewportH: number,
): MapCamera {
  const world = worldSizePx();
  const vis = visibleWorldSize(viewportW, viewportH, cam.zoom);
  const maxX = Math.max(0, world.width - vis.width);
  const maxY = Math.max(0, world.height - vis.height);
  return {
    x: Math.max(0, Math.min(maxX, cam.x)),
    y: Math.max(0, Math.min(maxY, cam.y)),
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom)),
  };
}

export function cameraCenterOnCell(
  gx: number,
  gy: number,
  viewportW: number,
  viewportH: number,
  zoom = DEFAULT_ZOOM,
): MapCamera {
  const px = gx * CELL_PX + CELL_PX;
  const py = gy * CELL_PX + CELL_PX;
  const vis = visibleWorldSize(viewportW, viewportH, zoom);
  return clampCamera(
    { x: px - vis.width / 2, y: py - vis.height / 2, zoom },
    viewportW,
    viewportH,
  );
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: MapCamera,
): { screenX: number; screenY: number } {
  return {
    screenX: (worldX - camera.x) * camera.zoom,
    screenY: (worldY - camera.y) * camera.zoom,
  };
}

const PAN_CLICK_THRESHOLD_PX = 8;

export interface MapCameraController {
  getCamera(): MapCamera;
  setCamera(cam: MapCamera): void;
  focusCell(gx: number, gy: number): void;
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
  hadPanGesture(): boolean;
  clearPanGesture(): void;
  destroy(): void;
}

export function focusCameraWhenReady(
  viewport: HTMLElement,
  controller: MapCameraController,
  gx: number,
  gy: number,
  maxAttempts = 40,
): void {
  const attempt = (n: number) => {
    const rect = viewport.getBoundingClientRect();
    if (rect.width >= 64 && rect.height >= 64) {
      controller.focusCell(gx, gy);
      return;
    }
    if (n < maxAttempts) requestAnimationFrame(() => attempt(n + 1));
  };
  requestAnimationFrame(() => attempt(0));
}

export function attachMapCamera(
  viewport: HTMLElement,
  cameraEl: HTMLElement,
  options: {
    enabled: () => boolean;
    allowDragPan?: () => boolean;
    onCameraChange?: (cam: MapCamera) => void;
    onZoomLabel?: (pct: number) => void;
  },
): MapCameraController {
  let cam: MapCamera = { x: 0, y: 0, zoom: DEFAULT_ZOOM };
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let camStartX = 0;
  let camStartY = 0;
  let panGesture = false;
  const activePointers = new Map<number, { clientX: number; clientY: number }>();
  let pinching = false;
  let pinchStartDistance = 1;
  let pinchStartZoom = DEFAULT_ZOOM;
  let pinchWorldX = 0;
  let pinchWorldY = 0;
  const keys = new Set<string>();

  const apply = () => {
    const { width: vw, height: vh } = viewport.getBoundingClientRect();
    cam = clampCamera(cam, vw, vh);
    cameraEl.style.transform = `translate(${-cam.x}px, ${-cam.y}px) scale(${cam.zoom})`;
    cameraEl.style.transformOrigin = "0 0";
    options.onZoomLabel?.(Math.round(cam.zoom * 100));
    options.onCameraChange?.(cam);
  };

  const setCamera = (next: MapCamera) => {
    cam = { ...next, zoom: next.zoom ?? DEFAULT_ZOOM };
    apply();
  };

  const zoomAroundScreenPoint = (screenX: number, screenY: number, factor: number) => {
    const worldX = cam.x + screenX / cam.zoom;
    const worldY = cam.y + screenY / cam.zoom;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
    cam = {
      x: worldX - screenX / newZoom,
      y: worldY - screenY / newZoom,
      zoom: newZoom,
    };
    apply();
  };

  const applyZoomAroundScreenPoint = (screenX: number, screenY: number, zoom: number) => {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    cam = {
      x: pinchWorldX - screenX / nextZoom,
      y: pinchWorldY - screenY / nextZoom,
      zoom: nextZoom,
    };
    apply();
  };

  const touchPoints = (): Array<{ clientX: number; clientY: number }> =>
    [...activePointers.values()];

  const distance = (
    a: { clientX: number; clientY: number },
    b: { clientX: number; clientY: number },
  ): number => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const startPinch = () => {
    const pts = touchPoints();
    if (pts.length < 2) return;
    const [a, b] = pts;
    const rect = viewport.getBoundingClientRect();
    const screenX = (a.clientX + b.clientX) / 2 - rect.left;
    const screenY = (a.clientY + b.clientY) / 2 - rect.top;
    pinchWorldX = cam.x + screenX / cam.zoom;
    pinchWorldY = cam.y + screenY / cam.zoom;
    pinchStartDistance = Math.max(1, distance(a, b));
    pinchStartZoom = cam.zoom;
    pinching = true;
    dragging = false;
    panGesture = true;
  };

  const onWheel = (e: WheelEvent) => {
    if (!options.enabled()) return;
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? ZOOM_WHEEL_FACTOR : 1 / ZOOM_WHEEL_FACTOR;
    zoomAroundScreenPoint(sx, sy, factor);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      if (!options.enabled()) return;
      activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      viewport.setPointerCapture(e.pointerId);
      if (activePointers.size >= 2) {
        startPinch();
        e.preventDefault();
        return;
      }
    }

    const canPan =
      e.pointerType === "touch"
        ? options.enabled()
        : e.button === 1 || e.button === 2
          ? options.enabled()
          : (options.allowDragPan?.() ?? options.enabled());
    if (!canPan) return;
    if (e.pointerType !== "touch" && e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    const target = e.target as HTMLElement;
    if (target.closest(".map-zoom-controls, .build-btn, .hud-menu-btn, .overlay, .match-demo-bar"))
      return;
    dragging = true;
    panGesture = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    camStartX = cam.x;
    camStartY = cam.y;
    if (e.button === 0 || e.pointerType === "touch") {
      viewport.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" && activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      if (pinching && activePointers.size >= 2) {
        const pts = touchPoints();
        const [a, b] = pts;
        const rect = viewport.getBoundingClientRect();
        const sx = (a.clientX + b.clientX) / 2 - rect.left;
        const sy = (a.clientY + b.clientY) / 2 - rect.top;
        const zoom = pinchStartZoom * (distance(a, b) / pinchStartDistance);
        applyZoomAroundScreenPoint(sx, sy, zoom);
        return;
      }
    }
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.hypot(dx, dy) >= PAN_CLICK_THRESHOLD_PX) panGesture = true;
    cam = {
      x: camStartX - dx / cam.zoom,
      y: camStartY - dy / cam.zoom,
      zoom: cam.zoom,
    };
    apply();
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) pinching = false;
    }
    if (!dragging) return;
    dragging = false;
    try {
      viewport.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    keys.add(e.key);
    if (e.key === "-" || e.key === "_") {
      const rect = viewport.getBoundingClientRect();
      zoomAroundScreenPoint(rect.width / 2, rect.height / 2, 1 / ZOOM_WHEEL_FACTOR);
    }
    if (e.key === "=" || e.key === "+") {
      const rect = viewport.getBoundingClientRect();
      zoomAroundScreenPoint(rect.width / 2, rect.height / 2, ZOOM_WHEEL_FACTOR);
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key);
  };

  const tickMotion = () => {
    if (!options.enabled()) return;
    let dx = 0;
    let dy = 0;

    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) dx -= ARROW_SPEED;
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dx += ARROW_SPEED;
    if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) dy -= ARROW_SPEED;
    if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) dy += ARROW_SPEED;

    if (dx !== 0 || dy !== 0) {
      cam = { x: cam.x + dx / cam.zoom, y: cam.y + dy / cam.zoom, zoom: cam.zoom };
      apply();
    }
  };

  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const motionTimer = window.setInterval(tickMotion, 1000 / 60);

  apply();

  return {
    getCamera: () => cam,
    setCamera,
    focusCell(gx, gy) {
      const { width: vw, height: vh } = viewport.getBoundingClientRect();
      setCamera(cameraCenterOnCell(gx, gy, vw, vh, cam.zoom));
    },
    zoomIn() {
      const rect = viewport.getBoundingClientRect();
      zoomAroundScreenPoint(rect.width / 2, rect.height / 2, ZOOM_WHEEL_FACTOR);
    },
    zoomOut() {
      const rect = viewport.getBoundingClientRect();
      zoomAroundScreenPoint(rect.width / 2, rect.height / 2, 1 / ZOOM_WHEEL_FACTOR);
    },
    resetZoom() {
      const rect = viewport.getBoundingClientRect();
      const worldX = cam.x + rect.width / 2 / cam.zoom;
      const worldY = cam.y + rect.height / 2 / cam.zoom;
      cam = clampCamera(
        { x: worldX - rect.width / 2, y: worldY - rect.height / 2, zoom: DEFAULT_ZOOM },
        rect.width,
        rect.height,
      );
      apply();
    },
    hadPanGesture: () => panGesture,
    clearPanGesture: () => {
      panGesture = false;
    },
    destroy() {
      clearInterval(motionTimer);
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}

/** Map screen scale from a world root element (accounts for camera translate + zoom). */
export function worldScreenScale(worldEl: HTMLElement): { scaleX: number; scaleY: number; rect: DOMRect } {
  const rect = worldEl.getBoundingClientRect();
  const scaleX = rect.width > 0 ? worldEl.offsetWidth / rect.width : 1;
  const scaleY = rect.height > 0 ? worldEl.offsetHeight / rect.height : 1;
  return { scaleX, scaleY, rect };
}

/**
 * Convert client (screen) coords to world pixels.
 * Prefer `worldEl` so pan/zoom from the camera CSS transform stay in sync with hit-testing.
 */
export function clientToWorld(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  camera: MapCamera,
  worldEl?: HTMLElement | null,
): { worldX: number; worldY: number } {
  if (worldEl && worldEl.offsetWidth > 0 && worldEl.offsetHeight > 0) {
    const { scaleX, scaleY, rect } = worldScreenScale(worldEl);
    return {
      worldX: (clientX - rect.left) * scaleX,
      worldY: (clientY - rect.top) * scaleY,
    };
  }
  return {
    worldX: (clientX - viewportRect.left) / camera.zoom + camera.x,
    worldY: (clientY - viewportRect.top) / camera.zoom + camera.y,
  };
}

/** World center → client coordinates (for drag-box selection). */
export function worldToClient(
  worldX: number,
  worldY: number,
  worldEl: HTMLElement,
): { clientX: number; clientY: number } {
  const { scaleX, scaleY, rect } = worldScreenScale(worldEl);
  return {
    clientX: rect.left + worldX / scaleX,
    clientY: rect.top + worldY / scaleY,
  };
}

export function placementCellFromWorld(
  worldX: number,
  worldY: number,
  footprint: { w: number; h: number },
): { gx: number; gy: number } {
  const fw = footprint.w * CELL_PX;
  const fh = footprint.h * CELL_PX;
  return {
    gx: Math.floor((worldX - fw / 2) / CELL_PX),
    gy: Math.floor((worldY - fh / 2) / CELL_PX),
  };
}

export function clientToGrid(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  camera: MapCamera,
): { gx: number; gy: number } {
  const { worldX, worldY } = clientToWorld(clientX, clientY, viewportRect, camera);
  return {
    gx: Math.floor(worldX / CELL_PX),
    gy: Math.floor(worldY / CELL_PX),
  };
}
