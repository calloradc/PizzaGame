import { memo, useLayoutEffect, useRef } from "react";
import { Board } from "./components.jsx";
import { createCamera } from "./game/camera.js";
import { mapThemes } from "./game/scenery.js";
import grassUrl from "./assets/grass-tile.webp";

export const GameScene = memo(function GameScene({
  blocked,
  map,
  diff,
  runId,
}) {
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
  }, [map, diff, runId]);
  return (
    <div
      id="mapwrap"
      ref={viewport}
      className={`mapwrap scene-viewport map-theme-${map}`}
      style={{ "--map-ground": mapThemes[map].ground }}
    >
      <div className="camera-world">
        <div
          className="world-ground"
          style={{
            backgroundImage: `url(${grassUrl})`,
            filter: mapThemes[map].filter,
          }}
        />
        <Board />
      </div>
    </div>
  );
});
