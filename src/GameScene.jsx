import { memo, useEffect, useRef, useState } from "react";
import { Board } from "./components.jsx";
import { createCamera, MIN_ZOOM, MAX_ZOOM } from "./game/camera.js";
import landscapeUrl from "./assets/garden-expanded.png";

export const GameScene = memo(function GameScene({ blocked, map, diff }) {
  const viewport = useRef(null);
  const controller = useRef(null);
  const [camera, setCamera] = useState({ zoom: 1 });
  useEffect(() => {
    controller.current = createCamera({
      viewport: viewport.current,
      onChange: setCamera,
    });
    return () => {
      controller.current.destroy();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    controller.current?.setEnabled(!blocked);
  }, [blocked]);
  useEffect(() => {
    controller.current?.reset();
  }, [map, diff]);
  return (
    <div
      id="mapwrap"
      ref={viewport}
      className={`mapwrap scene-viewport ${map === 1 ? "night" : ""}`}
    >
      <svg className="world-backdrop" aria-hidden="true">
        <defs>
          {/* Adjacent copies share the same edge pixels, including at minimum zoom. */}
          <pattern
            id="landscapeTiles"
            className="landscape-pattern"
            width="2"
            height="2"
            patternUnits="userSpaceOnUse"
          >
            <image href={landscapeUrl} width="1" height="1" />
            <image
              href={landscapeUrl}
              width="1"
              height="1"
              transform="translate(2 0) scale(-1 1)"
            />
            <image
              href={landscapeUrl}
              width="1"
              height="1"
              transform="translate(0 2) scale(1 -1)"
            />
            <image
              href={landscapeUrl}
              width="1"
              height="1"
              transform="translate(2 2) scale(-1 -1)"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#landscapeTiles)" />
      </svg>
      <div className="camera-world">
        <Board />
      </div>
      <div className="camera-controls" role="group" aria-label="Масштаб поля">
        <button
          aria-label="Увеличить поле"
          disabled={blocked || camera.zoom >= MAX_ZOOM}
          onClick={() => controller.current.zoomIn()}
        >
          +
        </button>
        <span className="zoom-readout" aria-live="off">
          {Math.round(camera.zoom * 100)}%
        </span>
        <button
          aria-label="Уменьшить поле"
          disabled={blocked || camera.zoom <= MIN_ZOOM}
          onClick={() => controller.current.zoomOut()}
        >
          −
        </button>
        <button
          aria-label="Вернуть поле в центр"
          disabled={blocked}
          onClick={() => controller.current.reset()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 2v5m0 10v5M2 12h5m10 0h5" />
          </svg>
        </button>
      </div>
    </div>
  );
});
