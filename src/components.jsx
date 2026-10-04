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
import gardenUrl from "./assets/grass-tile.webp";

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
export function Coins({ amount, className = "" }) {
  return (
    <span className={`currency ${className}`}>
      <Icon id="coin" />
      <span>{Math.floor(amount || 0)}</span>
    </span>
  );
}

export function BuildSheet({ view, actions }) {
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
      className="sheet open"
      aria-label={t("Меню строительства")}
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
                  <strong>{t(r.name)}</strong>
                  {locked ? (
                    <span className="lock-label">
                      <Icon id="lock" />
                      {t("Магазин")}
                    </span>
                  ) : (
                    <Coins amount={costs[i]} />
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
            <Coins amount={view.money < cost ? cost - view.money : cost} />
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
                      {t(name)} · <Coins amount={upgradeCost} />
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
                    <Coins amount={upgradeCost} />
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
              {t("Продать ·")} <Coins amount={tower.spent * 0.65} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Intro({ view, actions }) {
  const t = useT();
  const mode = modes.find((m) => m.id === view.chosenMode) || modes[0];
  return (
    <div className="lobby">
      <div className="lobby-top">
        <span className="brand">
          <Icon id="pizza" />
          PIZZA<span>PATROL</span>
        </span>
        <Coins amount={view.meta.wallet} className="wallet" />
        <button
          className="iconbtn"
          aria-label={t("Настройки")}
          onClick={() => actions.showModal("settings")}
        >
          <Icon id="i-gear" />
        </button>
      </div>
      <div className="lobby-layout">
        <aside className="lobby-hero">
          <div className="hero-orbit">
            <Icon id="pizza" className="hero-mascot" />
            <Icon id="t-garlic" className="hero-tower one" />
            <Icon id="t-chili" className="hero-tower two" />
            <span className="hero-sticker">
              TOWER
              <br />
              DEFENSE
            </span>
          </div>
          <div className="eyebrow">PIZZA PATROL</div>
          <h1>
            {t("Горячая смена.")}
            <br />
            <em>{t("Вкусная оборона.")}</em>
          </h1>
          <p>{t("Собери команду рецептов и защити свою пиццерию.")}</p>
          <div className="hero-record">
            <Icon id="medal" />
            <span>
              {t("Рекорд")} <b>{view.meta.best}</b>
            </span>
            <span>
              10 <small>{t("Башни")}</small>
            </span>
          </div>
        </aside>
        <div className="run-setup">
          <div className="section-title">
            <h2>{t("Новая смена")}</h2>
            <span>01 — 03</span>
          </div>
          <div className="eyebrow">{t("КАРТА")}</div>
          <div className="choices map-choices">
            {maps.map((map, i) => (
              <button
                key={map.name}
                disabled={view.chosenMode === "daily" && i !== view.dailyMap}
                className={`choice ${view.chosenMap === i ? "active" : ""}`}
                onClick={() => actions.chooseMap(i)}
                aria-pressed={view.chosenMap === i}
              >
                <svg
                  className={`mapThumb map-${i}`}
                  viewBox="0 0 450 450"
                  aria-hidden="true"
                >
                  <image
                    href={gardenUrl}
                    width="450"
                    height="450"
                    preserveAspectRatio="xMidYMid slice"
                  />
                  <path d={map.path} transform="translate(15 0)" />
                  {map.pads.slice(0, 7).map(([x, y], j) => (
                    <circle key={j} cx={x + 15} cy={y} r="11" />
                  ))}
                </svg>
                <span className="map-index">0{i + 1}</span>
                <b>{t(map.name)}</b>
                <small>{t(map.note)}</small>
                <span className="selection-check" aria-hidden="true">
                  ✓
                </span>
              </button>
            ))}
          </div>
          <div className="eyebrow">{t("СЛОЖНОСТЬ")}</div>
          <div className="choices difficulty-choices">
            {[
              ["Уютно", "Учимся и отдыхаем", "◉"],
              ["Классика", "Баланс и тактика", "◉◉"],
              ["Остро", "Проверка мастерства", "◉◉◉"],
            ].map(([label, note, dots], i) => (
              <button
                key={label}
                disabled={view.chosenMode === "daily" && i !== 1}
                className={`choice ${view.chosenDiff === i ? "active" : ""}`}
                onClick={() => actions.chooseDiff(i)}
                aria-pressed={view.chosenDiff === i}
              >
                <span className="difficulty-dots">{dots}</span>
                <b>{t(label)}</b>
                <small>{t(note)}</small>
              </button>
            ))}
          </div>
          <div className="eyebrow">{t("РЕЖИМ")}</div>
          <div className="mode-choices">
            {modes.map((m) => (
              <button
                key={m.id}
                className={`mode-choice ${view.chosenMode === m.id ? "active" : ""}`}
                onClick={() => actions.chooseMode(m.id)}
                aria-pressed={view.chosenMode === m.id}
              >
                <Icon id={m.icon} />
                <div>
                  <b>{t(m.name)}</b>
                  <small>{t(m.note)}</small>
                </div>
                <span className="selection-check">✓</span>
              </button>
            ))}
          </div>
          <p className="mode-description">{t(mode.desc)}</p>
          <button
            className="primary play-cta"
            aria-label={t("Открыть кухню")}
            onClick={actions.newGame}
          >
            <Icon id="i-play" />
            {t("Открыть кухню")}
            <span>→</span>
          </button>
          {view.resume && (
            <button className="resume-button" onClick={actions.resumeSave}>
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
          ["shop", "reward", "Магазин"],
          ["medals", "medal", "Задания"],
          ["help", "i-intel", "Помощь"],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            aria-label={t(label)}
            onClick={() => actions.showModal(id)}
          >
            <Icon id={icon} />
            {t(label)}
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </nav>
      <div className="lobby-footer">
        PIZZA PATROL <span>v2.0 · {t("Твоя кухня. Твои правила.")}</span>
      </div>
    </div>
  );
}

function Shop({ view, actions }) {
  const t = useT();
  const [tab, setTab] = useState("tower");
  const items = tab === "tower" ? recipes : abilities;
  return (
    <>
      <div className="modal-heading">
        <div>
          <div className="eyebrow">{t("Коллекция шефа")}</div>
          <h2>{t("Открывай новые тактики")}</h2>
        </div>
        <Coins amount={view.meta.wallet} className="wallet" />
      </div>
      <p>{t("Рецепты остаются с тобой во всех забегах.")}</p>
      <div className="shop-tabs">
        <button
          className={tab === "tower" ? "active" : ""}
          onClick={() => setTab("tower")}
        >
          {t("Башни")} {view.meta.unlockedTowers.length}/10
        </button>
        <button
          className={tab === "ability" ? "active" : ""}
          onClick={() => setTab("ability")}
        >
          {t("Способности")} {view.meta.unlockedAbilities.length}/7
        </button>
      </div>
      <div className="collection">
        {items.map((item, i) => {
          const id = tab === "tower" ? i : item.id;
          const owned = (
            tab === "tower"
              ? view.meta.unlockedTowers
              : view.meta.unlockedAbilities
          ).includes(id);
          const price =
            tab === "tower" ? towerPrices[i] : abilityPrices[item.id];
          const desc =
            tab === "tower"
              ? item.desc
              : {
                  bomb: "Взрыв соуса по области",
                  freeze: "Замедление всех врагов",
                  trap: "Яд и замедление на дороге",
                  rally: "Скорость атаки +70% на 7 с",
                  repair: "Восстановление 5 жизней за 80",
                  pulse: "Снимает щиты и оглушает врагов",
                  supply: "Добавляет ресурсы во время боя",
                }[item.id];
          return (
            <article
              key={item.id}
              className={`collection-card ${owned ? "owned" : ""}`}
            >
              <div className="collection-art">
                <Icon id={tab === "tower" ? `t-${item.id}` : item.icon} />
                {!owned && <Icon id="lock" className="collection-lock" />}
              </div>
              <div className="collection-info">
                <small>{t(tab === "tower" ? item.role : "Способности")}</small>
                <h3>{t(item.name)}</h3>
                <p>{t(desc)}</p>
              </div>
              <button
                disabled={owned || view.meta.wallet < price}
                className={owned ? "owned-label" : "buy-button"}
                onClick={() => actions.buy(tab, id)}
                aria-label={`${t("Открыть")} ${t(item.name)}`}
              >
                {owned ? <>✓ {t("Открыто")}</> : <Coins amount={price} />}
              </button>
            </article>
          );
        })}
      </div>
      <div className="ad-offer">
        <Icon id="reward" />
        <div>
          <b>{t("Подарок за просмотр")}</b>
          <small>{t("Демо-реклама")} · +80</small>
        </div>
        <button
          disabled={view.shopCooldown > 0}
          onClick={() => actions.watchAd("wallet")}
        >
          {view.shopCooldown > 0
            ? t("Снова через {n} с", { n: view.shopCooldown })
            : t("Забрать")}
        </button>
      </div>
      <p className="subtle-note">{t("Получай награды за волны и задания.")}</p>
      <button className="secondary" onClick={actions.back}>
        {t("Назад")}
      </button>
    </>
  );
}

function Settings({ view, actions }) {
  const t = useT();
  return (
    <>
      <div className="eyebrow">{t("Настройки")}</div>
      <h2>{t("Комфортная игра")}</h2>
      <div className="setting language-setting">
        <label htmlFor="language">{t("Язык")}</label>
        <select
          id="language"
          value={view.prefs.language}
          onChange={(e) => actions.setPreference("language", e.target.value)}
        >
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </div>
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
      {[
        ["volume", "Громкость"],
        ["quality", "Качество эффектов"],
      ].map(([key, label]) => (
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
      <p className="subtle-note">
        {t("Автоматически уменьшаем эффекты в больших боях.")}
      </p>
      {[
        ["haptic", "Вибрация"],
        ["auto", "Автостарт через 5 с"],
      ].map(([key, label]) => (
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
      "reward",
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
  const t = useT();
  const modalRef = useRef(null);
  useEffect(() => {
    if (!view.modal) return;
    const previous = document.activeElement;
    const node = modalRef.current;
    node?.focus({ preventScroll: true });
    const handle = (e) => {
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
          <p>{t("Волны, враги, атаки и перезарядка остановлены.")}</p>
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
          <p>
            {t(
              "Выбери один бонус до конца забега. Бонусы одного вида складываются.",
            )}
          </p>
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
              <Icon id="reward" />
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
                <Icon id="reward" />
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
          <Icon id="reward" className="ad-gift" />
          <h2>{t("Подарок от кухни")}</h2>
          <p>
            {t("Это имитация рекламного ролика.")}
            <br />
            {t("Награда будет доступна после завершения таймера.")}
          </p>
          <div className="ad-countdown" aria-live="polite">
            {view.ad.remaining ? t("{n} с", { n: view.ad.remaining }) : "✓"}
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
      className={`overlay open release-overlay ${view.modal === "intro" ? "lobby-overlay" : ""}`}
    >
      <div
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

export function CurrencyText({ text = "" }) {
  const parts = text.split(/([+]?[0-9]+\s+монет(?:ы|а)?)/gi);
  return (
    <>
      {parts.map((part, i) =>
        /^[+]?[0-9]+\s+монет/i.test(part) ? (
          <span key={i}>
            {part.startsWith("+") ? "+" : ""}
            <Coins amount={parseInt(part)} />
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
