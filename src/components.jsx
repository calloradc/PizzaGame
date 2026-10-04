import {
  createContext,
  memo,
  useContext,
  useId,
  useRef,
  useState,
  useEffect,
} from "react";
import { artFor } from "./game/art.js";
import {
  recipes,
  maps,
  species,
  events,
  perks,
  abilities,
  modes,
} from "./game/config.js";
import { towerPrices, abilityPrices, missions } from "./game/progression.js";
import { translate } from "./game/i18n.js";
import boardSvg from "./assets/board.svg?raw";
import { mapThemes, mapScenery } from "./game/scenery.js";

// Only this static SVG subtree is handed to the animation engine.
const boardMarkup = boardSvg;
export const Board = memo(function Board() {
  return (
    <div id="mapMount" dangerouslySetInnerHTML={{ __html: boardMarkup }} />
  );
});

export const RasterReadyContext = createContext(false);
export const Icon = memo(function Icon({ id, className = "" }) {
  // Atlas preparation happens once; refresh even memoized icons when it completes.
  useContext(RasterReadyContext);
  const clip = `sprite-${useId().replace(/:/g, "")}`;
  const art = artFor(id);
  if (!art)
    return (
      <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
        <use href={`#${id}`} />
      </svg>
    );
  const [x, y, width, height] = art.box;
  const scale = Math.min(64 / width, 64 / height);
  if (art.isolated)
    return (
      <svg
        className={`rasterSprite ${className}`}
        viewBox="0 0 64 64"
        aria-hidden="true"
      >
        <image
          href={art.url}
          width="64"
          height="64"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    );
  return (
    <svg
      className={`rasterSprite ${className}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip} clipPathUnits="userSpaceOnUse">
          <rect width="64" height="64" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <image
          href={art.url}
          x={(64 - width * scale) / 2 - x * scale}
          y={(64 - height * scale) / 2 - y * scale}
          width={art.size[0] * scale}
          height={art.size[1] * scale}
        />
      </g>
    </svg>
  );
});

export const LocaleContext = createContext("ru");
export function useT() {
  const language = useContext(LocaleContext);
  return (text, values) => translate(text, language, values);
}
export function Coins({ amount, className = "", kind = "global" }) {
  return (
    <span
      className={`currency currency-${kind} ${className}`}
      data-currency={kind}
    >
      <Icon id={kind === "battle" ? "coin-battle" : "coin-global"} />
      <span>{Math.floor(amount || 0)}</span>
    </span>
  );
}

function useAnimatedView(view, key) {
  const previous = useRef(null);
  const [present, setPresent] = useState(Boolean(view[key]));
  const active = Boolean(view[key]);
  if (active) previous.current = view;
  useEffect(() => {
    if (active) {
      setPresent(true);
      return;
    }
    const timer = setTimeout(() => setPresent(false), 190);
    return () => clearTimeout(timer);
  }, [active]);
  return {
    display: active ? view : present ? previous.current : null,
    closing: !active,
    onExited: () => {
      if (!active) setPresent(false);
    },
  };
}

export function BuildSheet({ view, actions }) {
  const { display, closing, onExited } = useAnimatedView(view, "selection");
  const t = useT();
  return display ? (
    <BuildSheetContent
      view={display}
      actions={actions}
      closing={closing}
      onExited={onExited}
    />
  ) : (
    <section className="sheet" aria-label={t("Меню строительства")} />
  );
}

function BuildSheetContent({ view, actions, closing, onExited }) {
  const t = useT();
  const swipeStart = useRef(null);
  const selection = view.selection;
  if (!selection)
    return <section className="sheet" aria-label={t("Меню строительства")} />;
  const { type, tower, stats, cost, costs, upgradeCost } = selection;
  const recipe = recipes[type];
  const unlocked = view.meta.unlockedTowers.includes(type);
  return (
    <section
      className={`sheet open ${closing ? "closing" : ""}`}
      inert={closing}
      aria-hidden={closing || undefined}
      aria-label={t("Меню строительства")}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onExited();
      }}
      onTouchStart={(e) => {
        swipeStart.current = e.target.closest(".handle,.sheethead")
          ? e.touches[0].clientY
          : null;
      }}
      onTouchEnd={(e) => {
        if (
          swipeStart.current !== null &&
          e.changedTouches[0].clientY - swipeStart.current > 50
        )
          actions.closeSheet();
        swipeStart.current = null;
      }}
    >
      <div className="handle" />
      <div className="sheethead">
        <div>{t(tower ? "Твоя башня" : "Что готовим здесь?")}</div>
        <button
          className="iconbtn"
          aria-label={t("Закрыть")}
          onClick={actions.closeSheet}
        >
          <Icon id="i-close" />
        </button>
      </div>
      {!tower ? (
        <>
          <div className="shop">
            {recipes.map((r, i) => {
              const locked = !view.meta.unlockedTowers.includes(i);
              return (
                <button
                  key={r.id}
                  className={`card ${type === i ? "active" : ""} ${locked ? "locked" : ""}`}
                  aria-label={`${view.prefs.language === "en" ? "Choose" : "Выбрать"} ${t(r.name)}`}
                  onClick={() =>
                    locked ? actions.showModal("shop") : actions.selectRecipe(i)
                  }
                >
                  <Icon id={`t-${r.id}`} />
                  {locked ? (
                    <span className="lock-label">
                      <Icon id="lock" />
                    </span>
                  ) : (
                    <Coins kind="battle" amount={costs[i]} />
                  )}
                </button>
              );
            })}
          </div>
          <div className="recipeInfo">
            <b>{t(recipe.name)}</b> · {t(recipe.desc)}
          </div>
          <div className="recipeDetails">
            <span>
              {Math.round(stats.damage)} {t("урон")}
            </span>
            <span>
              {stats.range} {t("радиус")}
            </span>
            <span>
              {(1 / stats.rate).toFixed(1)} {t("атак/с")}
            </span>
          </div>
          <button
            className="primary"
            disabled={!unlocked || view.money < cost}
            onClick={actions.build}
          >
            <Icon id={`t-${recipe.id}`} />
            {t(view.money < cost ? "Не хватает" : "Поставить ·")}{" "}
            <Coins
              kind="battle"
              amount={view.money < cost ? cost - view.money : cost}
            />
          </button>
        </>
      ) : (
        <>
          <div className="towerhead">
            <Icon id={`t-${recipe.id}`} />
            <div>
              <b>{t(recipe.name)}</b>
              <small>
                {t("Уровень {n} из 5", { n: tower.level })}
                {tower.branch >= 0
                  ? ` · ${t(recipe.branches[tower.branch][0])}`
                  : ""}
              </small>
            </div>
          </div>
          <div className="towerstats">
            {[
              [Math.round(stats.damage), "урон"],
              [(1 / stats.rate).toFixed(1), "атак/с"],
              [stats.range, "радиус"],
              [tower.kills, "побед"],
            ].map(([value, label]) => (
              <div key={label}>
                <b>{value}</b>
                {t(label)}
              </div>
            ))}
          </div>
          {tower.level === 2 && tower.branch < 0 && view.diff !== 0 ? (
            <>
              <div className="recipeInfo">
                {t("На 3 уровне выбери один из двух рецептов:")}
              </div>
              <div className="branches">
                {recipe.branches.map(([name, desc], i) => (
                  <button
                    className="branch"
                    key={name}
                    disabled={view.money < upgradeCost}
                    onClick={() => actions.upgrade(i)}
                  >
                    <b>
                      {t(name)} · <Coins kind="battle" amount={upgradeCost} />
                    </b>
                    <small>{t(desc)}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="recipeInfo">{t(recipe.desc)}</div>
              <button
                className="primary"
                disabled={tower.level >= 5 || view.money < upgradeCost}
                onClick={() => actions.upgrade()}
              >
                <Icon id={tower.level >= 5 ? "star-gold" : "i-upgrade"} />
                {tower.level >= 5 ? (
                  t("Мастер-рецепт: максимум")
                ) : (
                  <>
                    {t("Улучшить до {n} ·", { n: tower.level + 1 })}
                    <Coins kind="battle" amount={upgradeCost} />
                  </>
                )}
              </button>
            </>
          )}
          <div className="actions">
            <button onClick={actions.priority}>
              {t(
                ["Первая", "Сильнейшая", "Ближайшая", "Медики"][tower.priority],
              )}{" "}
              {t("цель")}
            </button>
            <button className="sell" onClick={actions.sell}>
              {t("Продать ·")}{" "}
              <Coins kind="battle" amount={tower.spent * 0.65} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export const MapPreview = memo(function MapPreview({ index, className = "" }) {
  const map = maps[index],
    theme = mapThemes[index];
  const roadPattern = `preview-road-${useId().replace(/:/g, "")}`;
  return (
    <svg
      className={`map-preview ${className}`}
      viewBox="0 0 450 450"
      aria-hidden="true"
      data-map={index}
    >
      <defs>
        <pattern
          id={roadPattern}
          width="96"
          height="96"
          patternUnits="userSpaceOnUse"
        >
          <image href={theme.roadUrl} width="96" height="96" />
        </pattern>
      </defs>
      <rect width="450" height="450" fill={theme.ground} />
      <image
        className="map-preview-ground"
        href={theme.terrainUrl}
        width="450"
        height="450"
        preserveAspectRatio="xMidYMid slice"
      />
      <g transform="translate(15 0)">
        <path
          d={map.path}
          fill="none"
          stroke={theme.edge}
          strokeWidth="38"
          strokeLinecap="round"
        />
        <path
          d={map.path}
          fill="none"
          stroke={`url(#${roadPattern})`}
          strokeWidth="30"
          strokeLinecap="round"
        />
        <path
          d={map.path}
          fill="none"
          stroke="#ffffff"
          strokeOpacity=".14"
          strokeWidth="2"
          strokeDasharray="2 12"
        />
        {mapScenery(index).map((prop, i) => (
          <svg
            key={i}
            x={prop.x - prop.width / 2}
            y={prop.y - prop.height / 2}
            width={prop.width}
            height={prop.height}
            viewBox="0 0 64 64"
          >
            <Icon id={prop.id} />
          </svg>
        ))}
        {map.pads.map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle
              r="18"
              fill={theme.pad}
              stroke={theme.accent}
              strokeWidth="2"
            />
            <path
              d="M-5 0h10m-5-5v10"
              stroke={theme.accent}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        ))}
        <svg x="314" y="329" width="105" height="95" viewBox="0 0 64 64">
          <Icon id="shop" />
        </svg>
        {index === 1 &&
          [
            [80, 35],
            [320, 155],
            [85, 350],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <circle r="21" fill="#ffcf79" opacity=".13" />
              <circle r="9" fill="#ffcf79" opacity=".2" />
              <circle r="3" fill="#ffe8aa" />
            </g>
          ))}
        {index === 2 &&
          [
            [35, 35],
            [300, 390],
            [115, 240],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <ellipse rx="16" ry="9" fill="#ac9948" opacity=".28" />
              <ellipse rx="9" ry="5" fill="#d9c16a" opacity=".6" />
            </g>
          ))}
      </g>
    </svg>
  );
});

export const MapArtwork = memo(function MapArtwork({ index }) {
  return (
    <img
      className="map-artwork"
      src={mapThemes[index].previewUrl}
      alt=""
      aria-hidden="true"
      draggable="false"
      data-map={index}
    />
  );
});

function RewardOffer({ view, actions, compact = false }) {
  const t = useT();
  return (
    <button
      className={`reward-offer ${compact ? "compact" : ""}`}
      disabled={view.shopCooldown > 0}
      aria-label={
        view.shopCooldown > 0
          ? t("Снова через {n} с", { n: view.shopCooldown })
          : t("Забрать")
      }
      title={t("Подарок за просмотр")}
      onClick={() => actions.watchAd("wallet")}
    >
      <Icon id="reward" />
      <Icon id="ad-video" className="ad-play" />
      <Coins amount={80} />
      {view.shopCooldown > 0 && <small>{view.shopCooldown}s</small>}
    </button>
  );
}

function Intro({ view, actions }) {
  const t = useT();
  return (
    <div className="lobby game-lobby">
      <div className="lobby-top">
        <span className="brand">
          <Icon id="pizza" />
          <span>
            PIZZA
            <br />
            <b>PATROL</b>
          </span>
        </span>
        <button
          className="wallet wallet-button"
          aria-label={t("Как заработать валюту")}
          onClick={() => actions.showModal("economy")}
        >
          <Coins amount={view.meta.wallet} />
        </button>
        <button
          className="iconbtn"
          aria-label={t("Настройки")}
          onClick={() => actions.showModal("settings")}
        >
          <Icon id="i-gear" />
        </button>
      </div>
      <div className="lobby-layout">
        <div className="map-stage">
          <div className="map-stage-frame" key={view.chosenMap}>
            <MapArtwork index={view.chosenMap || 0} />
          </div>
          <div className="map-stage-title">
            <button
              className="route-preview-button"
              aria-label={t("Схема карты")}
              title={t("Схема карты")}
              onClick={() => actions.showModal("mapinfo")}
            >
              <Icon id="mode-map" />
            </button>
            <h1>{t(maps[view.chosenMap || 0].name)}</h1>
          </div>
          <span className="map-record" title={t("Рекорд")}>
            <Icon id="medal" />
            {view.meta.best}
          </span>
        </div>
        <div className="run-setup">
          <div className="choices map-choices" aria-label={t("КАРТА")}>
            {maps.map((map, i) => (
              <button
                key={map.name}
                disabled={view.chosenMode === "daily" && i !== view.dailyMap}
                className={`choice ${view.chosenMap === i ? "active" : ""}`}
                onClick={() => actions.chooseMap(i)}
                aria-label={t(map.name)}
                title={t(map.name)}
                aria-pressed={view.chosenMap === i}
              >
                <MapArtwork index={i} />
                <span className="selection-check" aria-hidden="true">
                  <Icon id="confirm" />
                </span>
              </button>
            ))}
          </div>
          <div
            className="choices difficulty-choices"
            aria-label={t("СЛОЖНОСТЬ")}
          >
            {["Уютно", "Классика", "Остро"].map((label, i) => (
              <button
                key={label}
                disabled={view.chosenMode === "daily" && i !== 1}
                className={`choice ${view.chosenDiff === i ? "active" : ""}`}
                onClick={() => actions.chooseDiff(i)}
                aria-pressed={view.chosenDiff === i}
                aria-label={t(label)}
              >
                <span className="difficulty-flames">
                  {Array.from({ length: i + 1 }, (_, j) => (
                    <Icon key={j} id="chili" />
                  ))}
                </span>
                <b>{t(label)}</b>
              </button>
            ))}
          </div>
          <div className="mode-choices" aria-label={t("РЕЖИМ")}>
            {modes.map((m) => (
              <button
                key={m.id}
                className={`mode-choice ${view.chosenMode === m.id ? "active" : ""}`}
                onClick={() => actions.chooseMode(m.id)}
                aria-pressed={view.chosenMode === m.id}
                title={t(m.desc)}
              >
                <Icon id={m.icon} />
                <b>{t(m.name)}</b>
              </button>
            ))}
          </div>
          <button
            className="primary play-cta"
            aria-label={t("Открыть кухню")}
            onClick={actions.newGame}
          >
            <Icon id="i-play" />
            {t("Играть")}
          </button>
          {view.resume && (
            <button className="resume-button" onClick={actions.resumeSave}>
              <Icon id="i-play" />
              {view.resume.finished
                ? t("Результаты забега")
                : t("Продолжить · {map} · {n} волна", {
                    map: t(maps[view.resume.map]?.name || maps[0].name),
                    n: view.resume.wave + 1,
                  })}
            </button>
          )}
          {(view.over || !view.resumeOffered) && (
            <button className="resume-button" onClick={actions.back}>
              {t("Вернуться")}
            </button>
          )}
        </div>
      </div>
      <nav className="lobby-nav">
        {[
          ["shop", "shop-bag", "Магазин"],
          ["medals", "medal", "Задания"],
          ["help", "i-intel", "Помощь"],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            aria-label={t(label)}
            title={t(label)}
            onClick={() => actions.showModal(id)}
          >
            <Icon id={icon} />
          </button>
        ))}
        <RewardOffer view={view} actions={actions} compact />
      </nav>
    </div>
  );
}

function Shop({ view, actions }) {
  const t = useT();
  const [tab, setTab] = useState("tower"),
    [selected, setSelected] = useState(() =>
      Math.max(
        0,
        recipes.findIndex((_, i) => !view.meta.unlockedTowers.includes(i)),
      ),
    );
  const items = tab === "tower" ? recipes : abilities;
  const item = items[selected] || items[0],
    id = tab === "tower" ? selected : item.id;
  const owned = (
    tab === "tower" ? view.meta.unlockedTowers : view.meta.unlockedAbilities
  ).includes(id);
  const descriptions = {
    bomb: "Взрыв соуса по области",
    freeze: "Замедление всех врагов",
    trap: "Яд и замедление на дороге",
    rally: "Скорость атаки +70% на 7 с",
    repair: "Восстановление 5 жизней за 80",
    pulse: "Снимает щиты и оглушает врагов",
    supply: "Добавляет ресурсы во время боя",
  };
  return (
    <>
      <div className="modal-heading">
        <h2>{t("Магазин")}</h2>
        <Coins amount={view.meta.wallet} className="wallet" />
      </div>
      <div className="shop-tabs">
        <button
          className={tab === "tower" ? "active" : ""}
          onClick={() => {
            setTab("tower");
            setSelected(
              Math.max(
                0,
                recipes.findIndex(
                  (_, i) => !view.meta.unlockedTowers.includes(i),
                ),
              ),
            );
          }}
        >
          <Icon id="t-pepper" />
          {t("Башни")} <small>{view.meta.unlockedTowers.length}/10</small>
        </button>
        <button
          className={tab === "ability" ? "active" : ""}
          onClick={() => {
            setTab("ability");
            setSelected(
              Math.max(
                0,
                abilities.findIndex(
                  (a) => !view.meta.unlockedAbilities.includes(a.id),
                ),
              ),
            );
          }}
        >
          <Icon id="pulse" />
          {t("Способности")}{" "}
          <small>{view.meta.unlockedAbilities.length}/7</small>
        </button>
      </div>
      <div className="collection" key={tab}>
        {items.map((r, i) => {
          const itemId = tab === "tower" ? i : r.id;
          const isOwned = (
            tab === "tower"
              ? view.meta.unlockedTowers
              : view.meta.unlockedAbilities
          ).includes(itemId);
          const price = tab === "tower" ? towerPrices[i] : abilityPrices[r.id];
          return (
            <article
              key={r.id}
              className={`collection-card ${isOwned ? "owned" : ""} ${selected === i ? "selected" : ""}`}
              onPointerEnter={() => setSelected(i)}
              onFocus={() => setSelected(i)}
            >
              <button
                className="collection-select"
                aria-label={t(r.name)}
                onClick={() => setSelected(i)}
              >
                <Icon id={tab === "tower" ? `t-${r.id}` : r.icon} />
                {!isOwned && <Icon id="lock" className="collection-lock" />}
              </button>
              <button
                disabled={isOwned || view.meta.wallet < price}
                className={isOwned ? "owned-label" : "buy-button"}
                onClick={() => actions.buy(tab, itemId)}
                aria-label={`${t("Открыть")} ${t(r.name)}`}
              >
                {isOwned ? <Icon id="confirm" /> : <Coins amount={price} />}
              </button>
            </article>
          );
        })}
      </div>
      <div className="collection-detail" aria-live="polite">
        <b>{t(item.name)}</b>
        <span>{t(tab === "tower" ? item.desc : descriptions[item.id])}</span>
      </div>
      <div className="shop-rewards">
        <RewardOffer view={view} actions={actions} />
        <button
          className="reward-offer unlock-offer"
          disabled={owned || view.unlockCooldown > 0}
          onClick={() => actions.watchAd("unlock", { kind: tab, id })}
          aria-label={t("Открыть за просмотр")}
          title={t("Открыть за просмотр")}
        >
          <Icon id={tab === "tower" ? `t-${item.id}` : item.icon} />
          <Icon id="ad-video" className="ad-play" />
          <Icon id="lock" />
          {view.unlockCooldown > 0 && <small>{view.unlockCooldown}s</small>}
        </button>
      </div>
      <button className="secondary" onClick={actions.back}>
        {t("Назад")}
      </button>
    </>
  );
}

function LanguagePicker({ language, actions }) {
  const t = useT(),
    [open, setOpen] = useState(false),
    root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div
      className="setting language-setting"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          root.current.querySelector("#language").focus();
        }
      }}
    >
      <span id="language-label">{t("Язык")}</span>
      <div className="language-picker">
        <button
          id="language"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby="language-label language"
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              requestAnimationFrame(() =>
                root.current.querySelector("[role=option]")?.focus(),
              );
            }
          }}
        >
          <span className="language-code">{language.toUpperCase()}</span>
          {language === "en" ? "English" : "Русский"}
          <span className={`chevron ${open ? "up" : ""}`}>⌄</span>
        </button>
        {open && (
          <div
            className="language-options"
            role="listbox"
            aria-labelledby="language-label"
          >
            {[
              ["ru", "Русский"],
              ["en", "English"],
            ].map(([code, label], i) => (
              <button
                key={code}
                role="option"
                aria-selected={language === code}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    root.current
                      .querySelectorAll("[role=option]")
                      [(i + 1) % 2].focus();
                  }
                }}
                onClick={() => {
                  actions.setPreference("language", code);
                  setOpen(false);
                  root.current.querySelector("#language").focus();
                }}
              >
                <span className="language-code">{code.toUpperCase()}</span>
                {label}
                {language === code && (
                  <Icon id="confirm" className="language-check" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Settings({ view, actions }) {
  const t = useT();
  return (
    <>
      <div className="eyebrow">{t("Настройки")}</div>
      <h2>{t("Комфортная игра")}</h2>
      <LanguagePicker language={view.prefs.language} actions={actions} />
      <div className="setting">
        {t("Звуки кухни")}
        <button
          className={`switch ${view.prefs.sound ? "on" : ""}`}
          role="switch"
          aria-checked={view.prefs.sound}
          aria-label={t("Звуки кухни")}
          onClick={() => actions.togglePreference("sound")}
        />
      </div>
      {[["volume", "Громкость"]].map(([key, label]) => (
        <div className="slider-setting" key={key}>
          <label htmlFor={key}>
            {t(label)}
            <output>{view.prefs[key]}%</output>
          </label>
          <input
            id={key}
            type="range"
            min="0"
            max="100"
            step="5"
            value={view.prefs[key]}
            style={{ "--fill": `${view.prefs[key]}%` }}
            onChange={(e) => actions.setPreference(key, e.target.value)}
          />
        </div>
      ))}
      {[["auto", "Автостарт через 5 с"]].map(([key, label]) => (
        <div className="setting" key={key}>
          {t(label)}
          <button
            className={`switch ${view.prefs[key] ? "on" : ""}`}
            role="switch"
            aria-checked={view.prefs[key]}
            aria-label={t(label)}
            onClick={() => actions.togglePreference(key)}
          />
        </div>
      ))}
      <button className="primary" onClick={actions.back}>
        {t("Готово")}
      </button>
      {!view.resumeOffered && (
        <button className="secondary" onClick={actions.newRun}>
          {t("Выбрать карту и начать заново")}
        </button>
      )}
    </>
  );
}

function Missions({ view, actions }) {
  const t = useT();
  return (
    <>
      <div className="eyebrow">{t("Задания")}</div>
      <h2>{t("Твои достижения")}</h2>
      <Coins amount={view.meta.wallet} className="wallet" />
      <div className="mission-list">
        {missions.map((m) => {
          const value = Math.min(m.target, view.meta[m.key] || 0);
          const claimed = view.meta.claimed.includes(m.id);
          return (
            <article
              className={`mission ${claimed ? "claimed" : ""}`}
              key={m.id}
            >
              <Icon id="medal" />
              <div>
                <b>{t(m.name)}</b>
                <small>{t(m.desc)}</small>
                <div className="mission-progress">
                  <i style={{ width: `${(value / m.target) * 100}%` }} />
                </div>
                <small>
                  {value}/{m.target}
                </small>
              </div>
              <button
                disabled={claimed || value < m.target}
                onClick={() => actions.claimMission(m.id)}
              >
                {t(
                  claimed
                    ? "Получено"
                    : value >= m.target
                      ? "Забрать"
                      : "В процессе",
                )}
                <Coins amount={m.reward} />
              </button>
            </article>
          );
        })}
      </div>
      <button className="primary" onClick={actions.back}>
        {t("Назад")}
      </button>
    </>
  );
}
function Help({ actions }) {
  const t = useT();
  const rules = [
    [
      "i-build",
      "Строй на площадках с плюсом. Покупка рецепта в магазине открывает его навсегда; строительство оплачивается ресурсами забега.",
    ],
    [
      "t-garlic",
      "Сочетай башни: сыр замедляет, чеснок снимает броню, огнемёт наносит больше урона замедленным врагам.",
    ],
    [
      "i-full",
      "Перетаскивай карту, масштабируй щипком или колесом. Короткое нажатие выбирает площадку. Удержание и правая кнопка ничего не строят.",
    ],
    [
      "flag",
      "Каждые 4 волны выбирай бонус, каждые 6 встречай босса. Ранний запуск следующей волны приносит +22.",
    ],
    [
      "ad-video",
      "Реклама пока имитируется. Награда выдаётся только после просмотра; окно можно закрыть без награды.",
    ],
  ];
  return (
    <>
      <div className="eyebrow">PIZZA PATROL</div>
      <h2>{t("Всё просто")}</h2>
      {rules.map(([id, text]) => (
        <div className="rule" key={id}>
          <Icon id={id} />
          <span>{t(text)}</span>
        </div>
      ))}
      <button className="primary" onClick={actions.back}>
        {t("Понятно")}
      </button>
    </>
  );
}

export function GameModal({ view, actions }) {
  const { display, closing, onExited } = useAnimatedView(view, "modal");
  view = display || view;
  const t = useT();
  const modalRef = useRef(null);
  useEffect(() => {
    if (!view.modal) return;
    const previous = document.activeElement;
    const node = modalRef.current;
    node?.focus({ preventScroll: true });
    const handle = (e) => {
      // Let the language picker consume Escape before the dialog itself closes.
      if (
        e.key === "Escape" &&
        node.querySelector('.language-picker [aria-expanded="true"]')
      )
        return;
      if (
        e.key === "Escape" &&
        !["intro", "perks", "finish"].includes(view.modal)
      ) {
        e.preventDefault();
        view.modal === "ad"
          ? actions.cancelAd()
          : view.modal === "pause"
            ? actions.continueGame()
            : actions.back();
      }
      if (e.key !== "Tab") return;
      const targets = [
        ...node.querySelectorAll("button:not(:disabled),select,input,a[href]"),
      ].filter((n) => n.getClientRects().length);
      const first = targets[0],
        last = targets.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === node)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || document.activeElement === node)
      ) {
        e.preventDefault();
        first?.focus();
      }
    };
    node?.addEventListener("keydown", handle);
    return () => {
      node?.removeEventListener("keydown", handle);
      if (previous?.isConnected && !previous.closest("[inert]"))
        previous.focus({ preventScroll: true });
    };
  }, [view.modal, actions]);
  let content;
  switch (view.modal) {
    case "intro":
      content = <Intro view={view} actions={actions} />;
      break;
    case "mapinfo":
      content = (
        <>
          <h2>{t(maps[view.chosenMap || 0].name)}</h2>
          <div className="route-preview">
            <MapPreview index={view.chosenMap || 0} />
          </div>
          <button className="secondary" onClick={actions.back}>
            {t("Назад")}
          </button>
        </>
      );
      break;
    case "economy":
      content = (
        <>
          <h2>{t("Валюта")}</h2>
          <div className="economy-row">
            <Icon id="coin-battle" />
            <div>
              <h3>{t("Жетоны кухни")}</h3>
              <b>
                <Coins kind="battle" amount={view.money} />
              </b>
              <p>{t("Враги, завершённые волны и фермы.")}</p>
              <small>
                {t("Строительство и улучшения. Только текущий забег.")}
              </small>
            </div>
          </div>
          <div className="economy-row">
            <Icon id="coin-global" />
            <div>
              <h3>{t("Золотые монеты")}</h3>
              <b>
                <Coins amount={view.meta.wallet} />
              </b>
              <p>{t("Волны, победы, задания и рекламные подарки.")}</p>
              <small>{t("Открывают башни и силы навсегда.")}</small>
            </div>
          </div>
          <button className="primary" onClick={actions.back}>
            {t("Понятно")}
          </button>
        </>
      );
      break;
    case "shop":
      content = <Shop view={view} actions={actions} />;
      break;
    case "settings":
      content = <Settings view={view} actions={actions} />;
      break;
    case "medals":
      content = <Missions view={view} actions={actions} />;
      break;
    case "help":
      content = <Help actions={actions} />;
      break;
    case "pause":
      content = (
        <>
          <Icon id="pizza" className="hero" />
          <h2>{t("Смена на паузе")}</h2>
          <button className="primary" onClick={actions.continueGame}>
            {t("Продолжить")}
          </button>
          <button className="secondary" onClick={actions.pauseHelp}>
            {t("Посмотреть правила")}
          </button>
          <button className="secondary" onClick={actions.newRun}>
            {t("Главное меню")}
          </button>
        </>
      );
      break;
    case "perks":
      content = (
        <>
          <div className="eyebrow">{t("Секретный рецепт")}</div>
          <h2>{t("Добавим изюминку?")}</h2>
          <div className="perk-grid">
            {view.perkChoices.map((id) => {
              const p = perks.find((p) => p.id === id);
              return (
                <button
                  className="perk"
                  key={id}
                  onClick={() => actions.choosePerk(id)}
                >
                  <Icon id={p.icon} />
                  <div>
                    <b>{t(p.name)}</b>
                    <small>{t(p.desc)}</small>
                  </div>
                  <span>→</span>
                </button>
              );
            })}
          </div>
        </>
      );
      break;
    case "intel":
      content = (
        <>
          <div className="eyebrow">
            {t("РАЗВЕДКА · ВОЛНА {n}", { n: view.intel.wave })}
          </div>
          <h2>{t(events[view.intel.event].name)}</h2>
          <p>{t(events[view.intel.event].desc)}</p>
          {Object.entries(view.intel.counts).map(([type, count]) => (
            <div className="intelrow" key={type}>
              <Icon id={`e-${type}`} />
              <div>
                <b>
                  {t(species[type].name)} × {count}
                </b>
                <small>{t(species[type].desc)}</small>
              </div>
            </div>
          ))}
          <button className="primary" onClick={actions.back}>
            {t("На кухню")}
          </button>
        </>
      );
      break;
    case "finish":
      content = (
        <>
          <Icon id={view.resultWin ? "pizza" : "heart"} className="hero" />
          <div className="eyebrow">
            {t(modes.find((m) => m.id === view.mode)?.name || "Кампания")}
          </div>
          <h2>
            {t(view.resultWin ? "Пиццерия спасена!" : "Попробуем ещё раз?")}
          </h2>
          <div className="result-stats">
            <div>
              <b>{view.wave}</b>
              {t("Волна")}
            </div>
            <div>
              <b>{view.kills}</b>
              {t("Победы")}
            </div>
            <div>
              <Coins amount={view.runWallet} />
              {t("Награда забега")}
            </div>
          </div>
          {!view.doubled && view.runWallet > 0 && (
            <button
              className="reward-button"
              onClick={() => actions.watchAd("double")}
            >
              <Icon id="ad-video" />
              <span>
                {t("Удвоить награду")}
                <small>{t("Демо-реклама")}</small>
              </span>
              <Coins amount={view.runWallet} />
            </button>
          )}
          {!view.resultWin && !view.revived && (
            <>
              <button
                className="reward-button"
                onClick={() => actions.watchAd("revive")}
              >
                <Icon id="ad-video" />
                {t("Вторая попытка")}
                <small>{t("Демо-реклама")}</small>
              </button>
              <p className="subtle-note">
                {t(
                  "Восстановить 8 жизней и переиграть волну. Один раз за забег.",
                )}
              </p>
            </>
          )}
          {view.resultWin && (
            <button className="primary" onClick={actions.endless}>
              {t("Бесконечная доставка")}
            </button>
          )}
          <button
            className={view.resultWin ? "secondary" : "primary"}
            onClick={actions.newRun}
          >
            {t("Новый забег")}
          </button>
        </>
      );
      break;
    case "ad":
      content = (
        <div className="ad-demo">
          <div className="demo-label">{t("Демо-реклама")}</div>
          <Icon id="ad-video" className="ad-gift" />
          <h2>{t("Подарок от кухни")}</h2>
          <div className="ad-reward-preview">
            {view.ad.kind === "unlock" ? (
              <>
                <Icon
                  id={
                    view.ad.item.kind === "tower"
                      ? `t-${recipes[view.ad.item.id].id}`
                      : abilities.find((a) => a.id === view.ad.item.id).icon
                  }
                />
                <Icon id="confirm" />
              </>
            ) : view.ad.kind === "wallet" || view.ad.kind === "supply" ? (
              <>
                +
                <Coins
                  kind={view.ad.kind === "wallet" ? "global" : "battle"}
                  amount={view.ad.kind === "wallet" ? 80 : 100}
                />
              </>
            ) : view.ad.kind === "repair" || view.ad.kind === "revive" ? (
              <>
                <Icon id="heart" />+{view.ad.kind === "repair" ? 5 : 8}
              </>
            ) : view.ad.kind === "double" ? (
              <>
                <Icon id="coin-global" />
                ×2
              </>
            ) : (
              <>
                <Icon id="recharge" />
              </>
            )}
          </div>
          <div className="ad-spot">
            <Icon id="t-pepper" />
            <Icon id="t-chili" />
            <Icon id="t-truffle" />
          </div>
          <div className="ad-countdown" aria-live="polite">
            {view.ad.remaining ? (
              t("{n} с", { n: view.ad.remaining })
            ) : (
              <Icon id="confirm" />
            )}
          </div>
          <div className="ad-progress">
            <i style={{ width: `${((6 - view.ad.remaining) / 6) * 100}%` }} />
          </div>
          <button
            className="primary"
            disabled={view.ad.remaining > 0}
            onClick={actions.collectAd}
          >
            {t("Забрать награду")}
          </button>
          <button className="secondary" onClick={actions.cancelAd}>
            {t("Закрыть без награды")}
          </button>
        </div>
      );
      break;
    default:
      return null;
  }
  return (
    <div
      className={`overlay open release-overlay ${closing ? "closing" : ""} ${view.modal === "intro" ? "lobby-overlay" : ""}`}
      inert={closing}
      aria-hidden={closing || undefined}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onExited();
      }}
    >
      {view.fromLobby && view.modal !== "intro" && (
        <div className="lobby-dialog-backdrop" aria-hidden="true">
          <MapPreview index={view.chosenMap || 0} />
        </div>
      )}
      <div
        key={view.modal}
        ref={modalRef}
        tabIndex={-1}
        className={`modal ${view.modal === "intro" ? "lobby-modal" : ""} ${view.modal === "shop" ? "shop-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("Меню игры")}
      >
        {content}
      </div>
    </div>
  );
}

export function CurrencyText({ text = "", kind = "battle" }) {
  const parts = text.split(/([+]?[0-9]+\s+монет(?:ы|а)?)/gi);
  return (
    <>
      {parts.map((part, i) =>
        /^[+]?[0-9]+\s+монет/i.test(part) ? (
          <span key={i}>
            {part.startsWith("+") ? "+" : ""}
            <Coins kind={kind} amount={parseInt(part)} />
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
