import { memo, useId, useRef } from "react";
import { artFor } from "./game/art.js";
import { recipes, maps, species, events, perks } from "./game/config.js";
import boardSvg from "./assets/board.svg?raw";
import gardenUrl from "./assets/garden.png";

// Only this static SVG subtree is handed to the animation engine.
const boardMarkup = boardSvg.replace("./assets/garden.png", gardenUrl);
export const Board = memo(function Board() {
  return (
    <div id="mapMount" dangerouslySetInnerHTML={{ __html: boardMarkup }} />
  );
});

export function Icon({ id, className = "" }) {
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
}

export function BuildSheet({ view, actions }) {
  const swipeStart = useRef(null);
  const selection = view.selection;
  const onTouchStart = (event) => {
    swipeStart.current = event.target.closest(".handle,.sheethead")
      ? event.touches[0].clientY
      : null;
  };
  const onTouchEnd = (event) => {
    if (
      swipeStart.current !== null &&
      event.changedTouches[0].clientY - swipeStart.current > 50
    )
      actions.closeSheet();
    swipeStart.current = null;
  };
  if (!selection)
    return <section className="sheet" aria-label="Меню строительства" />;
  const { type, tower, stats, cost, costs, upgradeCost } = selection;
  const recipe = recipes[type];
  return (
    <section
      className="sheet open"
      aria-label="Меню строительства"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="handle" />
      <div>
        <div className="sheethead">
          <div>
            {tower ? "Твоя башня" : "Что готовим здесь?"}
            <small>
              {tower
                ? "Сделай башню ещё вкуснее"
                : "Выбери башню для этой площадки"}
            </small>
          </div>
          <button
            className="iconbtn"
            onClick={actions.closeSheet}
            aria-label="Закрыть"
          >
            <Icon id="i-close" />
          </button>
        </div>
        {!tower ? (
          <>
            <div className="shop">
              {recipes.map((recipe, index) => (
                <button
                  key={recipe.id}
                  className={`card ${type === index ? "active" : ""}`}
                  onClick={() => actions.selectRecipe(index)}
                  aria-label={`Выбрать ${recipe.name}`}
                >
                  <Icon id={`t-${recipe.id}`} />
                  <strong>{recipe.name}</strong>
                  <span>{costs[index]} монет</span>
                </button>
              ))}
            </div>
            <div className="recipeInfo">
              <b>{recipe.name}</b> · {recipe.desc}
            </div>
            <div className="recipeDetails advancedAction">
              <span>Урон {Math.round(stats.damage)}</span>
              <span>Радиус {stats.range}</span>
              <span>{(1 / stats.rate).toFixed(1)} атак/с</span>
            </div>
            <button
              className="primary"
              disabled={view.money < cost}
              onClick={actions.build}
            >
              <Icon id={`t-${recipe.id}`} />
              <span>
                {view.money < cost
                  ? `Нужно ещё ${cost - view.money} монет`
                  : `Поставить · ${cost} монет`}
              </span>
            </button>
          </>
        ) : (
          <>
            <div className="towerhead">
              <Icon id={`t-${recipe.id}`} />
              <div>
                <b>{recipe.name}</b>
                <small>
                  Уровень {tower.level} из 5
                  {tower.branch >= 0
                    ? ` · ${recipe.branches[tower.branch][0]}`
                    : ""}
                </small>
              </div>
            </div>
            <div className="towerstats advancedAction">
              <div>
                <b>{Math.round(stats.damage)}</b>урон
              </div>
              <div>
                <b>{(1 / stats.rate).toFixed(1)}</b>атак/с
              </div>
              <div>
                <b>{stats.range}</b>радиус
              </div>
              <div>
                <b>{tower.kills}</b>побед
              </div>
            </div>
            {tower.level === 2 && tower.branch < 0 && view.diff !== 0 ? (
              <>
                <div className="recipeInfo">
                  На 3 уровне выбери один из двух рецептов:
                </div>
                <div className="branches">
                  {recipe.branches.map(([name, description], index) => (
                    <button
                      className="branch"
                      key={name}
                      disabled={view.money < upgradeCost}
                      onClick={() => actions.upgrade(index)}
                    >
                      <b>
                        {name} · {upgradeCost}
                      </b>
                      <small>{description}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="recipeInfo">{recipe.desc}</div>
                <button
                  className="primary"
                  disabled={tower.level >= 5 || view.money < upgradeCost}
                  onClick={() => actions.upgrade()}
                >
                  {tower.level >= 5
                    ? "Мастер-рецепт: максимум"
                    : `Улучшить до ${tower.level + 1} · ${upgradeCost}`}
                </button>
              </>
            )}
            <div className="actions">
              <button className="advancedAction" onClick={actions.priority}>
                {
                  ["Первая", "Сильнейшая", "Ближайшая", "Медики"][
                    tower.priority
                  ]
                }{" "}
                цель
              </button>
              <button className="sell" onClick={actions.sell}>
                Продать · {Math.floor(tower.spent * 0.65)}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Intro({ view, actions }) {
  return (
    <>
      <Icon id="pizza" className="hero" />
      <div className="eyebrow">PIZZA PATROL · НОВАЯ СМЕНА</div>
      <h2>Готовим и играем!</h2>
      <p>
        Нажми на площадку, выбери вкусную башню и защищай пиццерию. Начни с
        уютного режима — он про удовольствие, а не спешку.
      </p>
      <div className="eyebrow">КАРТА</div>
      <div className="choices">
        {maps.map((map, index) => (
          <button
            key={map.name}
            className={`choice ${view.chosenMap === index ? "active" : ""}`}
            onClick={() => actions.chooseMap(index)}
          >
            <svg className="mapThumb" viewBox="0 0 450 450" aria-hidden="true">
              <image
                href={gardenUrl}
                width="450"
                height="450"
                preserveAspectRatio="xMidYMid slice"
              />
              <path d={map.path} transform="translate(15 0)" />
            </svg>
            {map.name}
            <small>{map.note}</small>
          </button>
        ))}
      </div>
      <div className="eyebrow">НАСТРОЕНИЕ</div>
      <div className="choices">
        {[
          ["Уютно", "18 спокойных волн"],
          ["Классика", "Больше тактики"],
          ["Остро", "Для опытных"],
        ].map(([label, description], index) => (
          <button
            key={label}
            className={`choice ${view.chosenDiff === index ? "active" : ""}`}
            onClick={() => actions.chooseDiff(index)}
          >
            {label}
            <small>{description}</small>
          </button>
        ))}
      </div>
      <button className="primary" onClick={actions.newGame}>
        Открыть кухню
      </button>
      {view.resume && (
        <button className="secondary" onClick={actions.resumeSave}>
          Продолжить · {maps[view.resume.map]?.name || "Площадь"} ·{" "}
          {view.resume.wave + 1} волна
        </button>
      )}
      {view.over || !view.resumeOffered ? (
        <button className="secondary" onClick={actions.back}>
          Вернуться
        </button>
      ) : null}
    </>
  );
}

function Help({ actions }) {
  const rules = [
    [
      "i-full",
      "Поле можно двигать одним пальцем и приближать двумя. Кнопка прицела возвращает всю карту в центр. Управление всегда остаётся поверх карты.",
    ],
    [
      "i-build",
      "Разные башни: коснись плюса на карте, выбери одну из 7 карточек, нажми «Поставить». Выбор сам по себе не тратит монеты.",
    ],
    [
      "t-pepper",
      "Нажми построенную башню. В уютном режиме достаточно нажимать «Улучшить». В других режимах на 3 уровне можно выбрать специализацию. Максимум — 5 уровней.",
    ],
    [
      "t-basil",
      "Базилик усиливает соседей. Ферма приносит доход. Сыр + печь — комбинация против толпы, сода + снайпер — против брони.",
    ],
    [
      "bomb",
      "Соус и масло требуют касания карты. Лёд, чили и ремонт срабатывают сразу. Масло ставится только на дорогу.",
    ],
    [
      "flag",
      "Каждые 4 волны — выбор бонуса. Каждые 6 — босс. Уютный забег длится 18 волн, остальные — 24. Отправь волну раньше за +22 монеты, пока старые враги ещё идут.",
    ],
  ];
  return (
    <>
      <div className="eyebrow">НА ПЛИТЕ ВСЁ ПОД КОНТРОЛЕМ</div>
      <h2>Всё просто</h2>
      {rules.map(([id, text]) => (
        <div className="rule" key={id}>
          <Icon id={id} />
          <span>{text}</span>
        </div>
      ))}
      <p>
        Прогресс сохраняется перед каждой волной. Меню и окна приостанавливают
        бой; строительство через нижнюю панель происходит в реальном времени.
      </p>
      <button className="primary" onClick={actions.back}>
        Понятно
      </button>
    </>
  );
}

export function GameModal({ view, actions }) {
  let content;
  switch (view.modal) {
    case "intro":
      content = <Intro view={view} actions={actions} />;
      break;
    case "help":
      content = <Help actions={actions} />;
      break;
    case "settings":
      content = (
        <>
          <div className="eyebrow">НАСТРОЙКИ КУХНИ</div>
          <h2>По твоему вкусу</h2>
          {[
            ["sound", "Звуки кухни"],
            ["fx", "Частицы и плавная походка"],
            ["haptic", "Вибрация"],
            ["auto", "Автостарт через 5 с"],
          ].map(([key, label]) => (
            <div className="setting" key={key}>
              {label}
              <button
                className={`switch ${view.prefs[key] ? "on" : ""}`}
                role="switch"
                aria-checked={view.prefs[key]}
                aria-label={label}
                onClick={() => actions.togglePreference(key)}
              />
            </div>
          ))}
          <p>
            Двигай поле одним пальцем, меняй масштаб щипком или кнопками + и −.
            Панели закрываются крестиком или свайпом вниз за верхний край. На
            телефоне можно включить полный экран.
          </p>
          <button className="primary" onClick={actions.back}>
            Готово
          </button>
          <button className="secondary" onClick={actions.newRun}>
            Выбрать карту и начать заново
          </button>
        </>
      );
      break;
    case "pause":
      content = (
        <>
          <div className="eyebrow">ВРЕМЯ НА ПЕРЕКУС</div>
          <h2>Смена на паузе</h2>
          <p>Волны, враги, атаки и перезарядка остановлены.</p>
          <button className="primary" onClick={actions.continueGame}>
            Продолжить
          </button>
          <button className="secondary" onClick={actions.pauseHelp}>
            Посмотреть правила
          </button>
        </>
      );
      break;
    case "perks":
      content = (
        <>
          <div className="eyebrow">НОВЫЙ СЕКРЕТНЫЙ РЕЦЕПТ</div>
          <h2>Добавим изюминку?</h2>
          <p>
            Выбери один бонус до конца забега. Бонусы одного вида складываются.
          </p>
          {view.perkChoices.map((id) => {
            const perk = perks.find((perk) => perk.id === id);
            return (
              <button
                className="perk"
                key={id}
                onClick={() => actions.choosePerk(id)}
              >
                <Icon id={perk.icon} />
                <div>
                  <b>{perk.name}</b>
                  <small>{perk.desc}</small>
                </div>
              </button>
            );
          })}
        </>
      );
      break;
    case "intel":
      content = (
        <>
          <div className="eyebrow">РАЗВЕДКА · ВОЛНА {view.intel.wave}</div>
          <h2>{events[view.intel.event].name}</h2>
          <p>
            {events[view.intel.event].desc}{" "}
            {view.intel.wave % 6 === 0
              ? "Король корки вызывает подкрепления — приготовь снайперов и контроль."
              : ""}
          </p>
          {Object.entries(view.intel.counts).map(([type, count]) => (
            <div className="intelrow" key={type}>
              <Icon id={`e-${type}`} />
              <div>
                <b>
                  {species[type].name} × {count}
                </b>
                <small>{species[type].desc}</small>
              </div>
            </div>
          ))}
          <div className="chipline">
            {Object.entries(view.perks).map(([id, count]) => (
              <span className="tag" key={id}>
                {perks.find((perk) => perk.id === id)?.name} ×{count}
              </span>
            ))}
          </div>
          <button className="primary" onClick={actions.back}>
            На кухню
          </button>
        </>
      );
      break;
    case "medals":
      content = (
        <>
          <div className="eyebrow">КНИГА ШЕФА</div>
          <h2>Вкусные награды</h2>
          {[
            ["Первая смена", "Построить 10 башен", view.meta.built >= 10],
            [
              "Секретный рецепт",
              "Выбрать 5 специализаций",
              view.meta.specs >= 5,
            ],
            ["Мастер кухни", "Победить 500 врагов", view.meta.kills >= 500],
            ["Корочка без короны", "Победить 3 боссов", view.meta.boss >= 3],
            ["Легенда кухни", "Пройти любой забег", view.meta.wins > 0],
          ].map(([name, description, earned]) => (
            <div className={`medal ${earned ? "earned" : ""}`} key={name}>
              <Icon id="medal" />
              <div>
                <b>{name}</b>
                <small>
                  {description}
                  {earned ? " · получено" : ""}
                </small>
              </div>
            </div>
          ))}
          <p>Рекорд и награды сохраняются между забегами.</p>
          <button className="primary" onClick={actions.back}>
            Назад
          </button>
        </>
      );
      break;
    case "finish":
      content = (
        <>
          <Icon id={view.resultWin ? "pizza" : "heart"} className="hero" />
          <div className="eyebrow">
            {view.resultWin
              ? `${view.goal} ДОСТАВОК ПОЗАДИ`
              : "КУХНЯ НЕ ВЫДЕРЖАЛА"}
          </div>
          <h2>{view.resultWin ? "Пиццерия спасена!" : "Попробуем ещё раз?"}</h2>
          <p>
            {view.resultWin
              ? "Все главы пройдены. В бесконечном режиме здоровье растёт ещё быстрее."
              : `Волна ${view.wave}, ${view.kills} побед. Против брони ставь соду и базилик, замедляй толпы сыром, а медиков выбирай отдельным приоритетом.`}
          </p>
          <div className="chipline">
            <span className="tag">{maps[view.map].name}</span>
            <span className="tag">
              {["Уютно", "Классика", "Остро"][view.diff]}
            </span>
            <span className="tag">{view.kills} побед</span>
          </div>
          {view.resultWin && (
            <button className="primary" onClick={actions.endless}>
              Бесконечная доставка
            </button>
          )}
          <button
            className={view.resultWin ? "secondary" : "primary"}
            onClick={actions.newRun}
          >
            Новый забег
          </button>
        </>
      );
      break;
    default:
      return null;
  }
  return (
    <div className="overlay open">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Меню игры"
      >
        {content}
      </div>
    </div>
  );
}
