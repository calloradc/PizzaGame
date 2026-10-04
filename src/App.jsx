import { useEffect, useRef, useState } from "react";
import {
  BuildSheet,
  GameModal,
  Icon,
  Coins,
  CurrencyText,
  LocaleContext,
  RasterReadyContext,
} from "./components.jsx";
import { prepareRasterImages } from "./game/art.js";
import { createGame } from "./game/engine.js";
import { translate } from "./game/i18n.js";
import { abilities, events, maps } from "./game/config.js";
import { GameScene } from "./GameScene.jsx";
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
  meta: {
    best: 0,
    unlockedTowers: [0, 1],
    unlockedAbilities: ["bomb", "freeze"],
    wallet: 150,
  },
  prefs: { language: "ru" },
  speed: 1,
  selection: null,
};

export default function App() {
  const root = useRef(null),
    game = useRef(null);
  const [view, setView] = useState(initialView),
    [status, setStatus] = useState("loading");
  const [gameMenu, setGameMenu] = useState(false),
    [moreAbilities, setMoreAbilities] = useState(false);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const presses = useRef(new Map()),
    lastActivation = useRef(new WeakMap());
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
  const t = (text, values) => translate(text, view.prefs.language, values);
  useEffect(() => {
    let cancelled = false;
    prepareRasterImages()
      .then(() => {
        if (cancelled) return;
        game.current = createGame({ root: root.current, onChange: setView });
        setStatus("ready");
      })
      .catch((error) => {
        console.error("Не удалось загрузить игру", error);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      game.current?.destroy();
      game.current = null;
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("gamePaused", Boolean(view.modal));
    if (view.modal) {
      setGameMenu(false);
      setMoreAbilities(false);
      setRewardsOpen(false);
    }
    return () => document.body.classList.remove("gamePaused");
  }, [view.modal]);
  const visibleAbilities = moreAbilities
    ? abilities
    : abilities
        .filter((a) => view.meta.unlockedAbilities.includes(a.id))
        .slice(0, 3);
  const abilityButton = (ability) => {
    const cooldown = view.cool[ability.id] || 0;
    const locked = !view.meta.unlockedAbilities.includes(ability.id);
    const active =
      view.aim === ability.id || (ability.id === "rally" && view.rally > 0);
    return (
      <button
        key={ability.id}
        className={`ability ${active ? "active" : ""} ${locked ? "locked" : ""}`}
        aria-label={t(ability.name)}
        title={t(ability.name)}
        disabled={
          !locked &&
          (view.over ||
            view.paused ||
            Boolean(view.modal) ||
            cooldown > 0 ||
            (ability.id === "repair" &&
              (view.lives >= view.maxLives || view.money < 80)))
        }
        onClick={() => {
          if (locked) actions.showModal("shop");
          else actions.useAbility(ability.id);
        }}
      >
        <Icon id={ability.icon} />
        {locked ? (
          <Icon id="lock" className="ability-badge" />
        ) : cooldown > 0 ? (
          <small>{Math.ceil(cooldown)}</small>
        ) : ability.id === "repair" ? (
          <small>
            <Coins amount={80} />
          </small>
        ) : null}
        <i style={{ width: `${(cooldown / ability.cool) * 100}%` }} />
      </button>
    );
  };
  return (
    <LocaleContext.Provider value={view.prefs.language}>
      <RasterReadyContext.Provider value={status === "ready"}>
        <div
          ref={root}
          className="game-root"
          onKeyDownCapture={(e) => {
            if (e.repeat && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          onPointerDownCapture={(e) => {
            if (e.button === 0) {
              if (presses.current.size >= 4) presses.current.clear();
              presses.current.set(e.pointerId, {
                time: performance.now(),
                target: e.target,
                x: e.clientX,
                y: e.clientY,
              });
            }
          }}
          onPointerCancelCapture={(e) => presses.current.delete(e.pointerId)}
          onClickCapture={(e) => {
            const button = e.target.closest("button");
            if (e.button > 0) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            if (button && e.detail > 0) {
              const press =
                presses.current.get(e.nativeEvent.pointerId) ||
                [...presses.current.values()].find(
                  (p) => p.target.closest("button") === button,
                );
              const last = lastActivation.current.get(button) || 0;
              if (
                (press &&
                  (performance.now() - press.time > 600 ||
                    Math.hypot(e.clientX - press.x, e.clientY - press.y) >
                      12)) ||
                performance.now() - last < 260
              ) {
                e.preventDefault();
                e.stopPropagation();
                presses.current.clear();
                return;
              }
              lastActivation.current.set(button, performance.now());
            }
            presses.current.clear();
            if (gameMenu && !e.target.closest(".bottomnav,.menu-trigger"))
              setGameMenu(false);
          }}
        >
          <main
            inert={Boolean(view.modal) || status !== "ready"}
            className={`app mobile-game release-game ${view.diff === 0 ? "casual" : ""} ${view.modal ? "modal-active" : ""} ${view.fromLobby ? "in-lobby" : ""}`}
          >
            <header className="top">
              <button
                className="logo menu-trigger"
                aria-label={t("Меню игры")}
                aria-expanded={gameMenu}
                onClick={() => setGameMenu(!gameMenu)}
              >
                <Icon id="pizza" />
                <span className="menu-mark" aria-hidden="true">
                  ≡
                </span>
              </button>
              <div className="wordmark">
                PIZZA PATROL<small>{t(maps[view.map].name)}</small>
              </div>
              <div className="toptools">
                <button
                  className="iconbtn"
                  aria-label={t("Пауза")}
                  onClick={actions.pause}
                >
                  <Icon id="i-pause" />
                </button>
                <button
                  className="iconbtn"
                  aria-label={t("Настройки")}
                  onClick={() => actions.showModal("settings")}
                >
                  <Icon id="i-gear" />
                </button>
              </div>
            </header>
            <div className="stats">
              <div className="stat">
                <Icon id="coin" />
                <strong id="money">{Math.floor(view.money)}</strong>
              </div>
              <div className="stat">
                <Icon id="heart" />
                <strong id="lives">{view.lives}</strong>
              </div>
              <div className="stat">
                <Icon id="flag" />
                <strong id="wave">
                  {view.wave}
                  <span className="waveMax">
                    {" "}
                    / {view.endless ? "∞" : view.goal}
                  </span>
                </strong>
              </div>
            </div>
            <div className="levelbar">
              <span>
                {view.running
                  ? t("{n} врагов на пути", { n: view.remaining })
                  : t(view.wave ? "Передышка" : "Подготовка")}
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
              <button onClick={actions.setSpeed} aria-label={`×${view.speed}`}>
                ×{view.speed}
              </button>
            </div>
            <GameScene
              blocked={Boolean(view.modal) || view.paused}
              map={view.map}
              diff={view.diff}
              runId={view.runId}
            />
            <div className={`scene-messages ${view.boss ? "has-boss" : ""}`}>
              <div className="maptag">
                {t(maps[view.map].name).toUpperCase()}
              </div>
              {view.running && view.event > 0 && (
                <div className="eventchip">{t(events[view.event].name)}</div>
              )}
              <div
                className={`bossbar ${view.boss ? "on" : ""}`}
                data-boss={view.boss?.type}
                data-casting={view.boss?.casting}
                style={{ "--boss-color": view.boss?.color }}
              >
                <span>{view.boss ? t(view.boss.name) : ""}</span>
                <small>
                  {view.boss?.casting
                    ? t("Готовит атаку…")
                    : t(view.boss?.skill || "")}
                </small>
                <i
                  style={{
                    width: view.boss
                      ? `${Math.max(0, (view.boss.hp / view.boss.max) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
              <div className={`aimhint ${view.aim ? "on" : ""}`}>
                {t(
                  view.aim === "bomb"
                    ? "Выбери место для соус-бомбы"
                    : "Коснись дороги, чтобы разлить масло",
                )}
              </div>
              <div
                className={`toast ${view.toast ? "show" : ""}`}
                role="status"
              >
                <CurrencyText text={view.toast} />
              </div>
              <div className={`banner ${view.banner ? "show" : ""}`}>
                <small>{t(view.banner?.sub || "")}</small>
                <strong>{t(view.banner?.title || "")}</strong>
              </div>
              <div
                key={view.damageFlash || 0}
                className={`damageflash ${view.damageFlash ? "on" : ""}`}
              />
              {view.milestone && (
                <div className="milestone">
                  {t(view.milestone.label)}
                  <small>
                    <CurrencyText text={t(view.milestone.sub)} />
                  </small>
                </div>
              )}
              {!view.towers.length &&
                !view.aim &&
                !view.toast &&
                !view.banner && (
                  <div className="screenhint">
                    {t("Коснись плюса — поставим башню")}
                  </div>
                )}
            </div>
            <div
              className={`dock ${moreAbilities ? "abilities-expanded" : ""}`}
            >
              <div
                className="abilities"
                style={{
                  gridTemplateColumns: `repeat(${moreAbilities ? 4 : visibleAbilities.length + 1},1fr)`,
                }}
              >
                {visibleAbilities.map(abilityButton)}
                <button
                  className="ability more-abilities"
                  aria-label={t("Способности")}
                  aria-expanded={moreAbilities}
                  onClick={() => setMoreAbilities(!moreAbilities)}
                >
                  <span>{moreAbilities ? "×" : "•••"}</span>
                </button>
              </div>
              <div className="dockactions">
                <button
                  id="buildMode"
                  aria-label={t("Строить")}
                  title={t("Строить")}
                  className={view.buildHighlight ? "buildModeOn" : ""}
                  onClick={actions.buildMode}
                >
                  <Icon id="i-build" />
                </button>
                <button
                  id="intelBtn"
                  aria-label={t("Разведка")}
                  title={t("Разведка")}
                  onClick={() => actions.showModal("intel")}
                >
                  <Icon id="i-intel" />
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
                        ? t("Волна")
                        : t("Раньше · +22")
                      : t("Волна {n}", { n: view.wave + 1 })}
                  </span>
                </button>
              </div>
            </div>
            <nav
              className={`nativefoot bottomnav ${gameMenu ? "open" : ""}`}
              aria-label={t("Меню игры")}
            >
              {[
                ["shop", "reward", "Магазин"],
                ["medals", "medal", "Награды"],
                ["help", "i-intel", "Помощь"],
              ].map(([id, icon, label]) => (
                <button
                  key={id}
                  aria-label={t(label)}
                  onClick={() => actions.showModal(id)}
                >
                  <Icon id={icon} />
                  <span>{t(label)}</span>
                </button>
              ))}
              <button
                aria-label={t("На весь экран")}
                onClick={actions.fullscreen}
              >
                <Icon id="i-full" />
                <span>{t("Экран")}</span>
              </button>
              <button
                disabled={view.running || view.adSupplyWave === view.wave}
                onClick={() => actions.watchAd("supply")}
              >
                <Icon id="reward" />
                <span>{t("Поставка +100")}</span>
                <small>{t("Демо-реклама")}</small>
              </button>
              <button onClick={actions.newRun}>
                <Icon id="pizza" />
                <span>{t("Главное меню")}</span>
              </button>
            </nav>
            <div className={`battle-rewards ${rewardsOpen ? "expanded" : ""}`}>
              {rewardsOpen && (
                <div className="battle-reward-options">
                  {[
                    [
                      "supply",
                      "coin",
                      "+100",
                      view.running || view.adSupplyWave === view.wave,
                      "Поставка +100",
                    ],
                    [
                      "repair",
                      "heart",
                      "+5",
                      view.lives >= view.maxLives ||
                        view.adRepairWave === view.wave,
                      "Пополнить жизни",
                    ],
                    [
                      "recharge",
                      "blizzard",
                      "↻",
                      !abilities.some(
                        (a) =>
                          view.meta.unlockedAbilities.includes(a.id) &&
                          view.cool[a.id] > 0,
                      ) || view.adRechargeWave === view.wave,
                      "Перезарядить силы",
                    ],
                  ].map(([kind, icon, label, disabled, title]) => (
                    <button
                      key={kind}
                      disabled={disabled || view.over || view.paused}
                      aria-label={t(title)}
                      onClick={() => actions.watchAd(kind)}
                    >
                      <Icon id={icon} />
                      <b>{label}</b>
                      <span className="ad-play">▶</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                className="gift-trigger"
                aria-label={t("Подарки")}
                aria-expanded={rewardsOpen}
                onClick={() => setRewardsOpen(!rewardsOpen)}
              >
                <Icon id="reward" />
                <span className="ad-play">▶</span>
              </button>
            </div>
            <BuildSheet view={view} actions={actions} />
          </main>
          <GameModal view={view} actions={actions} />
          {status !== "ready" && (
            <div className="loading">
              <Icon id="pizza" className="load-mascot" />
              <div className="loadPizza">PIZZA PATROL</div>
              {status === "loading" ? (
                <>
                  <div className="loadbar" />
                  <p>{t("Разогреваем печь…")}</p>
                </>
              ) : (
                <>
                  <p>{t("Не удалось загрузить игру.")}</p>
                  <button onClick={() => location.reload()}>
                    {t("Попробовать снова")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </RasterReadyContext.Provider>
    </LocaleContext.Provider>
  );
}
