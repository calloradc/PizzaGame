import { useEffect, useRef, useState } from "react";
import { BuildSheet, GameModal, Icon } from "./components.jsx";
import { prepareRasterImages } from "./game/art.js";
import { createGame } from "./game/engine.js";
import { haptic } from "./game/audio.js";
import { abilities, events, maps } from "./game/config.js";
import { GameScene } from "./GameScene.jsx";
import sprites from "./assets/sprites.svg?raw";

const initialView = {
  money: 340,
  lives: 25,
  wave: 0,
  goal: 18,
  map: 0,
  diff: 0,
  cool: {},
  perks: {},
  towers: [],
  meta: { best: 0 },
  prefs: {},
  speed: 1,
  selection: null,
};

export default function App() {
  const root = useRef(null);
  const game = useRef(null);
  const [view, setView] = useState(initialView);
  const [status, setStatus] = useState("loading");
  const [fullscreen, setFullscreen] = useState(false);
  const [gameMenu, setGameMenu] = useState(false);
  const [usedAbility, setUsedAbility] = useState(null);
  const abilityTimer = useRef(null);
  const actions = useRef(
    new Proxy(
      {},
      {
        get:
          (_, name) =>
          (...args) =>
            game.current?.[name]?.(...args),
      },
    ),
  ).current;

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        await prepareRasterImages();
        if (cancelled) return;
        game.current = createGame({ root: root.current, onChange: setView });
        setStatus("ready");
      } catch (error) {
        console.error("Не удалось загрузить игру", error);
        if (!cancelled) setStatus("error");
      }
    }
    start();
    const updateFullscreen = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => {
      cancelled = true;
      game.current?.destroy();
      game.current = null;
      clearTimeout(abilityTimer.current);
      document.removeEventListener("fullscreenchange", updateFullscreen);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("gamePaused", Boolean(view.modal));
    if (view.modal) setGameMenu(false);
    return () => document.body.classList.remove("gamePaused");
  }, [view.modal]);

  const useAbility = (id) => {
    setUsedAbility(id);
    clearTimeout(abilityTimer.current);
    abilityTimer.current = setTimeout(() => setUsedAbility(null), 400);
    actions.useAbility(id);
  };
  const questText = view.running
    ? view.leaks === view.batchStartLeaks
      ? "Без потерь: сохрани жизни"
      : "Заказ провален: были потери"
    : view.questDone
      ? "Идеальная доставка выполнена"
      : "Заказ: пройди следующую волну без потерь";
  return (
    <div
      ref={root}
      onClickCapture={(event) => {
        if (gameMenu && !event.target.closest(".bottomnav,.menu-trigger"))
          setGameMenu(false);
        const button = event.target.closest("button");
        if (button && !button.disabled) {
          haptic(8);
          if (view.prefs.fx && button.animate)
            button.animate(
              [{ filter: "brightness(1.07)" }, { filter: "brightness(1)" }],
              { duration: 180 },
            );
        }
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: sprites }} />
      <main
        className={`app mobile-game ${view.diff === 0 ? "casual" : ""} ${view.modal ? "modal-active" : ""}`}
      >
        <header className="top">
          <button
            className="logo menu-trigger"
            aria-label="Меню игры"
            aria-expanded={gameMenu}
            onClick={() => setGameMenu(!gameMenu)}
          >
            <Icon id="pizza" />
            <span className="menu-mark" aria-hidden="true">
              ≡
            </span>
          </button>
          <div className="wordmark">
            PIZZA PATROL<small>ВКУСНАЯ ОБОРОНА</small>
          </div>
          <div className="toptools">
            <button
              className="iconbtn"
              aria-label="Пауза"
              onClick={actions.pause}
            >
              <Icon id={view.paused ? "i-play" : "i-pause"} />
            </button>
            <button
              className="iconbtn"
              aria-label="Настройки"
              onClick={() => actions.showModal("settings")}
            >
              <Icon id="i-gear" />
            </button>
          </div>
        </header>
        <div className="stats">
          <div className="stat">
            <Icon id="coin" />
            <div>
              <small>МОНЕТЫ</small>
              <strong id="money">{Math.floor(view.money)}</strong>
            </div>
          </div>
          <div className="stat">
            <Icon id="heart" />
            <div>
              <small>КУХНЯ</small>
              <strong id="lives">{view.lives}</strong>
            </div>
          </div>
          <div className="stat">
            <Icon id="flag" />
            <div>
              <small>ВОЛНА</small>
              <strong id="wave">
                {view.wave}
                <span className="waveMax">
                  {" "}
                  / {view.endless ? "∞" : view.goal}
                </span>
              </strong>
            </div>
          </div>
        </div>
        <div className="levelbar">
          <span>
            {view.running
              ? `НА ПУТИ: ${view.remaining} ВРАГОВ`
              : view.wave
                ? "ПЕРЕДЫШКА · СТРОЙ И УЛУЧШАЙ"
                : "ПОДГОТОВКА"}
          </span>
          <div className="line">
            <i
              style={{
                width: view.running
                  ? `${Math.max(0, ((view.total - view.remaining) / Math.max(1, view.total)) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <button onClick={actions.setSpeed}>×{view.speed}</button>
        </div>
        <GameScene
          blocked={Boolean(view.modal) || view.paused}
          map={view.map}
          diff={view.diff}
        />
        <div className="scene-messages" aria-live="off">
          <div className="maptag">
            {String(view.map + 1).padStart(2, "0")} ·{" "}
            {maps[view.map].name.toUpperCase()}
          </div>
          <div className="eventchip">
            {view.running
              ? events[view.event].name
              : ["Уютно", "Классика", "Остро"][view.diff]}
          </div>
          <div className="chapter">
            {view.wave
              ? `ГЛАВА ${Math.min(4, Math.ceil(view.wave / 6))} · ${["Доставка", "Рынок", "Час пик", "Королевский пир"][Math.min(3, Math.floor((view.wave - 1) / 6))]}`
              : ""}
          </div>
          <div className={`bossbar ${view.boss ? "on" : ""}`}>
            <span>
              КОРОЛЬ КОРКИ{view.boss ? ` · ${Math.ceil(view.boss.hp)} HP` : ""}
            </span>
            <i
              style={{
                width: view.boss
                  ? `${Math.max(0, (view.boss.hp / view.boss.max) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <div className="quest">
            <span>{questText}</span>
            <b>
              {view.running
                ? "+35 монет"
                : view.questDone
                  ? "+35 получено"
                  : "+35"}
            </b>
          </div>
          <div className={`aimhint ${view.aim ? "on" : ""}`}>
            {view.aim === "bomb"
              ? "Выбери место для соус-бомбы · нажми Соус для отмены"
              : "Коснись дороги, чтобы разлить масло"}
          </div>
          <div className={`toast ${view.toast ? "show" : ""}`} role="status">
            {view.toast}
          </div>
          <div className={`banner ${view.banner ? "show" : ""}`}>
            <small>{view.banner?.sub}</small>
            <strong>{view.banner?.title}</strong>
          </div>
          <div
            key={view.damageFlash || 0}
            className={`damageflash ${view.damageFlash ? "on" : ""}`}
          />
          {view.milestone && (
            <div className="milestone">
              {view.milestone.label}
              <small>{view.milestone.sub}</small>
            </div>
          )}
          {!view.towers.length && !view.aim && !view.toast && !view.banner && (
            <div className="screenhint">
              Коснись плюса — поставим башню
              <small>Двигай поле пальцем · масштабируй двумя</small>
            </div>
          )}
        </div>
        <div className="dock">
          <div className="abilities">
            {abilities.map((ability) => {
              const cooldown = view.cool[ability.id] || 0;
              const active =
                view.aim === ability.id ||
                (ability.id === "rally" && view.rally > 0);
              return (
                <button
                  key={ability.id}
                  className={`ability ${active ? "active" : ""} ${usedAbility === ability.id ? "used" : ""}`}
                  aria-label={ability.name}
                  disabled={
                    view.over ||
                    view.paused ||
                    Boolean(view.modal) ||
                    cooldown > 0 ||
                    (ability.id === "repair" &&
                      (view.lives >= view.maxLives || view.money < 80))
                  }
                  onClick={() => useAbility(ability.id)}
                >
                  <Icon id={ability.icon} />
                  <strong>{ability.name}</strong>
                  <small>
                    {cooldown > 0
                      ? `${Math.ceil(cooldown)} с`
                      : ability.id === "repair"
                        ? "80 монет"
                        : view.aim === ability.id
                          ? "На карту"
                          : "Готово"}
                  </small>
                  <i style={{ width: `${(cooldown / ability.cool) * 100}%` }} />
                </button>
              );
            })}
          </div>
          <div className="dockactions">
            <button
              id="buildMode"
              className={view.buildHighlight ? "buildModeOn" : ""}
              onClick={actions.buildMode}
            >
              <Icon id="i-build" />
              Строить
            </button>
            <button id="intelBtn" onClick={() => actions.showModal("intel")}>
              <Icon id="i-intel" />
              Разведка
            </button>
            <button
              className="wavebtn"
              disabled={
                view.over ||
                view.paused ||
                Boolean(view.modal) ||
                (view.running && view.queueLength > 0)
              }
              onClick={actions.startWave}
            >
              <Icon id="i-play" />
              <span>
                {view.running
                  ? view.queueLength
                    ? "Волна идёт"
                    : "Раньше · +22"
                  : `Волна ${view.wave + 1}`}
              </span>
            </button>
          </div>
        </div>
        <nav
          className={`nativefoot bottomnav ${gameMenu ? "open" : ""}`}
          aria-label="Дополнительное меню"
        >
          <span className="srOnly">ЛУЧШИЙ: {view.meta.best}</span>
          <button
            aria-label="Награды"
            onClick={() => actions.showModal("medals")}
          >
            <Icon id="medal" />
            <span>Награды</span>
          </button>
          <button aria-label="Помощь" onClick={() => actions.showModal("help")}>
            <Icon id="i-intel" />
            <span>Помощь</span>
          </button>
          <button
            aria-label="На весь экран"
            onClick={() => {
              setGameMenu(false);
              actions.fullscreen();
            }}
          >
            <Icon id="i-full" />
            <span>{fullscreen ? "Свернуть" : "Экран"}</span>
          </button>
        </nav>
        <BuildSheet view={view} actions={actions} />
      </main>
      <GameModal view={view} actions={actions} />
      {status !== "ready" && (
        <div className="loading">
          <div className="loadPizza">
            {status === "error" ? "Кухня ещё прогревается" : "PIZZA PATROL"}
          </div>
          {status === "loading" ? (
            <>
              <div className="loadbar" />
              <p>Разогреваем печь…</p>
            </>
          ) : (
            <>
              <p>Не удалось загрузить игру.</p>
              <button onClick={() => location.reload()}>
                Попробовать снова
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
