import {
  CELL_PX,
  MAP_CELL_COUNT,
  MAP_COLS,
  MAP_ROWS,
  type PlayerVision,
} from "@rtsbrowser/shared";

export interface MatchFogHandle {
  update(vision: PlayerVision | undefined): void;
  destroy(): void;
}

/** Low-res fog canvas (one pixel per map cell), scaled to world size. */
export function mountMatchFog(host: HTMLElement): MatchFogHandle {
  const canvas = document.createElement("canvas");
  canvas.className = "match-fog-canvas";
  canvas.width = MAP_COLS;
  canvas.height = MAP_ROWS;
  canvas.style.width = `${MAP_COLS * CELL_PX}px`;
  canvas.style.height = `${MAP_ROWS * CELL_PX}px`;
  host.append(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });
  const image = ctx ? ctx.createImageData(MAP_COLS, MAP_ROWS) : null;

  const update = (vision: PlayerVision | undefined) => {
    if (!ctx || !image || !vision) return;
    const data = image.data;
    for (let i = 0; i < MAP_CELL_COUNT; i++) {
      const explored = vision.explored[i] === 1;
      const visible = vision.visible[i] === 1;
      const o = i * 4;
      if (!explored) {
        data[o] = 4;
        data[o + 1] = 8;
        data[o + 2] = 14;
        data[o + 3] = 235;
      } else if (!visible) {
        data[o] = 12;
        data[o + 1] = 18;
        data[o + 2] = 28;
        data[o + 3] = 165;
      } else {
        data[o + 3] = 0;
      }
    }
    ctx.putImageData(image, 0, 0);
  };

  return {
    update,
    destroy() {
      canvas.remove();
    },
  };
}

export function mountMinimapFog(host: HTMLElement, scaleX: number, scaleY: number): MatchFogHandle {
  const canvas = document.createElement("canvas");
  canvas.className = "minimap-fog-canvas";
  canvas.width = MAP_COLS;
  canvas.height = MAP_ROWS;
  canvas.style.width = `${MAP_COLS * CELL_PX * scaleX}px`;
  canvas.style.height = `${MAP_ROWS * CELL_PX * scaleY}px`;
  host.append(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });
  const image = ctx ? ctx.createImageData(MAP_COLS, MAP_ROWS) : null;

  const update = (vision: PlayerVision | undefined) => {
    if (!ctx || !image || !vision) return;
    const data = image.data;
    for (let i = 0; i < MAP_CELL_COUNT; i++) {
      const explored = vision.explored[i] === 1;
      const visible = vision.visible[i] === 1;
      const o = i * 4;
      if (!explored) {
        data[o] = 4;
        data[o + 1] = 8;
        data[o + 2] = 14;
        data[o + 3] = 240;
      } else if (!visible) {
        data[o] = 10;
        data[o + 1] = 14;
        data[o + 2] = 22;
        data[o + 3] = 200;
      } else {
        data[o + 3] = 0;
      }
    }
    ctx.putImageData(image, 0, 0);
  };

  return {
    update,
    destroy() {
      canvas.remove();
    },
  };
}
