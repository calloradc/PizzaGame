import { memo, useLayoutEffect, useRef } from "react";
import { Board } from "./components.jsx";
import { createCamera } from "./game/camera.js";
import grassUrl from "./assets/grass-tile.png";

export const GameScene = memo(function GameScene({ blocked, map, diff }) {
  const viewport = useRef(null);
  const controller = useRef(null);
  useLayoutEffect(() => {
    controller.current = createCamera({ viewport: viewport.current });
    return () => {
      controller.current.destroy();
      controller.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    controller.current?.setEnabled(!blocked);
  }, [blocked]);
  useLayoutEffect(() => {
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
          <pattern
            id="landscapeTiles"
            className="landscape-pattern"
            width="2"
            height="2"
            patternUnits="userSpaceOnUse"
          >
            <image href={grassUrl} width="1" height="1" />
            <image
              href={grassUrl}
              width="1"
              height="1"
              transform="translate(2 0) scale(-1 1)"
            />
            <image
              href={grassUrl}
              width="1"
              height="1"
              transform="translate(0 2) scale(1 -1)"
            />
            <image
              href={grassUrl}
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
    </div>
  );
});
