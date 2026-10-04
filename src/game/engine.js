import { placeArt } from "./art.js";
import {
  recipes,
  maps,
  species,
  events,
  perks,
  abilities,
  planWave,
  bossForWave,
} from "./config.js";
import { distanceSquared, selectTarget } from "./targeting.js";
import { createEffects } from "./effects.js";
import { sound, haptic, configureAudio } from "./audio.js";
// React owns the interface. This instance owns only the animated SVG scene.
export function createGame({ root, onChange }) {
  const $ = (id) => root.querySelector(`#${id}`),
    NS = "http://www.w3.org/2000/svg";
  let disposed = false,
    frame = null,
    modalKind = null,
    resumeOffered = true,
    resultWin = false,
    toastText = "",
    banner = null,
    milestone = null;
  let last = performance.now(),
    statsCache = new WeakMap();
  const isBoss = (enemy) => Boolean(species[enemy.type].boss);
  const invalidateStats = () => {
    statsCache = new WeakMap();
  };
  function writeAttr(node, name, value) {
    const cache =
      node._gameAttributes || (node._gameAttributes = Object.create(null));
    if (cache[name] === value) return;
    cache[name] = value;
    node.setAttribute(name, value);
  }
  const timers = new Set();
  function later(fn, ms) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!disposed) fn();
    }, ms);
    timers.add(timer);
    return timer;
  }
  const listen = (node, event, fn, options) => {
    node.addEventListener(event, fn, options);
    return () => node.removeEventListener(event, fn, options);
  };
  const cleanups = [];
  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }
  let prefs = { sound: false, fx: true, haptic: false, auto: false },
    meta = { best: 0, kills: 0, built: 0, boss: 0, wins: 0, specs: 0 },
    checkpoint = null;
  try {
    prefs = {
      ...prefs,
      ...JSON.parse(localStorage.getItem("pizzaPrefs") || "{}"),
    };
    meta = {
      ...meta,
      ...JSON.parse(localStorage.getItem("pizzaMeta") || "{}"),
    };
    let c = JSON.parse(localStorage.getItem("pizzaSaveV2") || "null");
    if (c?.v === 2) checkpoint = c;
  } catch (e) {}
  let S,
    locations = [],
    route = [],
    roadLength = 0,
    selected = -1,
    pick = 0,
    sheetKind = "",
    aim = "",
    buildHighlight = false,
    paused = false,
    modalOpen = false,
    speed = 1,
    toastTimer,
    bannerTimer,
    uiClock = 0,
    chosenMap = 0,
    chosenDiff = 0;
  function goal() {
    return S.diff === 0 ? 18 : 24;
  }
  function fresh(map = chosenMap, diff = chosenDiff) {
    return {
      v: 2,
      map,
      diff,
      money: diff === 0 ? 340 : diff === 1 ? 275 : 235,
      lives: diff === 0 ? 25 : 20,
      maxLives: diff === 0 ? 25 : 20,
      wave: 0,
      kills: 0,
      leaks: 0,
      towers: [],
      enemies: [],
      shots: [],
      fx: [],
      texts: [],
      traps: [],
      queue: [],
      running: false,
      spawn: 0,
      total: 0,
      spawned: 0,
      over: false,
      endless: false,
      event: 0,
      perks: {},
      nextPerk: 4,
      perkChoices: [],
      cool: { bomb: 0, freeze: 0, trap: 0, rally: 0, repair: 0 },
      rally: 0,
      batchStartLives: 20,
      batchStartLeaks: 0,
      rewardWaves: [],
      autoTimer: 0,
      questDone: false,
    };
  }
  S = fresh();
  configureAudio(prefs);
  const { effect, burst, ring, puddle, lightning, float } = createEffects({
    getState: () => S,
    prefs,
    $,
    el,
  });
  function fitBoard() {
    // Keep a square world at every viewport size and zoom. Never stretch the original art.
    $("map").setAttribute("viewBox", "0 0 450 450");
    $("world").setAttribute("transform", "translate(15 0)");
  }
  function setupMap() {
    fitBoard();
    let m = maps[S.map];
    locations = m.pads;
    $("road").setAttribute("d", m.path);
    $("roadEdge").setAttribute("d", m.path);
    roadLength = $("road").getTotalLength();
    route = [];
    for (let d = 0; d < roadLength + 2; d += 2) {
      let p = $("road").getPointAtLength(Math.min(d, roadLength));
      route.push([p.x, p.y]);
    }
    $("terrain").setAttribute("fill", ["#b8d693", "#99bda0", "#d0db9a"][S.map]);
    drawDecor();
    drawScene();
    $("pads").innerHTML = "";
    locations.forEach(([x, y], i) => {
      let g = el(
        "g",
        {
          class: "pad",
          "data-pad": i,
          role: "button",
          tabindex: 0,
          "aria-label": "Площадка " + (i + 1),
        },
        $("pads"),
      );
      g.setAttribute("transform", `translate(${x} ${y})`);
      el(
        "ellipse",
        { cx: 0, cy: 5, rx: 20, ry: 12, fill: "#557947", opacity: ".22" },
        g,
      );
      el(
        "circle",
        {
          class: "pad-base",
          cx: 0,
          cy: 0,
          r: 18,
          fill: "#e6efb7",
          stroke: "#80a45a",
          "stroke-width": 2,
        },
        g,
      );
      el(
        "circle",
        {
          class: "build-ring",
          cx: 0,
          cy: 0,
          r: 20,
          fill: "none",
          stroke: "#fff8ce",
          "stroke-width": 2.5,
          "stroke-dasharray": "5 4",
          "stroke-linecap": "round",
        },
        g,
      );
      el(
        "path",
        {
          d: "M-5 0h10m-5-5v10",
          stroke: "#729654",
          "stroke-width": 3,
          "stroke-linecap": "round",
        },
        g,
      );
      el(
        "circle",
        { class: "pad-hit", cx: 0, cy: 0, r: 28, fill: "transparent" },
        g,
      );
      g.onclick = (e) => {
        e.stopPropagation();
        padClick(i);
      };
      g.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          padClick(i);
        }
      };
    });
  }

  function drawDecor() {
    const group = $("mapDecor");
    group.replaceChildren();
    group.setAttribute("pointer-events", "none");
    const choices = [
      "d-daisy",
      "d-pink",
      "d-pot",
      "d-hedge",
      "d-tree",
      "d-bench",
      "d-rocks",
      "d-fence",
      "d-mushrooms",
    ];
    const objects = [];
    for (let row = -2; row <= 7; row++) {
      for (let col = -2; col <= 6; col++) {
        const seed = Math.abs((col + 7) * 31 + (row + 8) * 47 + S.map * 23);
        if (seed % 5 === 0) continue;
        const x = col * 90 + 30 + (seed % 19) - 9;
        const y = row * 78 + 26 + ((seed * 3) % 17) - 8;
        const id = choices[seed % choices.length];
        const width =
          id === "d-tree" ? 64 : id === "d-hedge" ? 58 : 38 + (seed % 10);
        const height = id === "d-tree" ? 78 : width;
        const clearance = Math.max(width, height) / 2;
        if (
          route.some(
            (p) => distanceSquared(p[0], p[1], x, y) < (clearance + 22) ** 2,
          )
        )
          continue;
        if (
          locations.some(
            (p) => distanceSquared(p[0], p[1], x, y) < (clearance + 24) ** 2,
          )
        )
          continue;
        if (distanceSquared(x, y, 365, 375) < 75 ** 2) continue;
        objects.push({ id, x, y, width, height });
      }
    }
    objects.sort((a, b) => a.y - b.y);
    for (const prop of objects) {
      const node = placeArt(
        el,
        prop.id,
        {
          x: prop.x - prop.width / 2,
          y: prop.y - prop.height / 2,
          width: prop.width,
          height: prop.height,
          class: "scenery-prop",
        },
        group,
      );
      node.dataset.x = prop.x;
      node.dataset.y = prop.y;
    }
  }
  function drawScene() {
    $("boardProps").replaceChildren();
  }
  function construction(x, y, color) {
    ring(x, y, 29, color);
    if (!prefs.fx) return;
    for (let i = 0; i < 6; i++) {
      let a = i * 1.05,
        n = el(
          "path",
          { d: "M-2 0h4M0-2v4", stroke: color, "stroke-width": 1.7 },
          $("constructionFx"),
        );
      effect(n, 0.45, (f, p) =>
        n.setAttribute(
          "transform",
          `translate(${x + Math.cos(a) * (20 + p * 16)} ${y + Math.sin(a) * (20 + p * 16)}) scale(${1 - p})`,
        ),
      );
    }
  }
  function littleCast(id, x, y) {
    if (!prefs.fx) return;
    let n = el("g", {}, $("effects"));
    placeArt(el, id, { x: -15, y: 0, width: 30, height: 30 }, n);
    effect(n, 0.4, (f, p) => {
      n.setAttribute(
        "transform",
        `translate(${x} ${y - 65 + (1 - Math.pow(1 - p, 3)) * 48})`,
      );
      n.setAttribute("opacity", Math.min(1, (1 - p) * 3));
    });
  }
  function celebrate(label, sub) {
    if (!prefs.fx) return;
    const message = { label, sub };
    milestone = message;
    renderUI();
    later(() => {
      if (milestone === message) milestone = null;
      renderUI();
    }, 2200);
    for (let i = 0; i < 25; i++)
      burst(
        80 + i * 11,
        55 + (i % 4) * 10,
        ["#e86b47", "#ffdb73", "#60b7a5"][i % 3],
        1,
      );
  }
  function point(d) {
    let q = Math.max(0, Math.min(route.length - 1, d / 2)),
      i = Math.floor(q),
      p = q - i,
      a = route[i],
      b = route[Math.min(i + 1, route.length - 1)];
    return { x: a[0] + (b[0] - a[0]) * p, y: a[1] + (b[1] - a[1]) * p };
  }
  function towerAt(i) {
    return S.towers.find((t) => t.pad === i);
  }
  function discount() {
    return (
      1 -
      Math.min(
        0.24,
        S.towers.filter((t) => t.type === 6 && t.branch === 1).length * 0.12,
      )
    );
  }
  function cost(type) {
    return Math.round(recipes[type].cost * discount());
  }
  function upgradeCost(t) {
    return Math.round(
      recipes[t.type].cost *
        (0.72 + t.level * 0.28) *
        Math.pow(1.18, t.level - 1) *
        discount(),
    );
  }
  function stats(t) {
    if (statsCache.has(t)) return statsCache.get(t);
    let r = recipes[t.type],
      mult = 1 + (t.level - 1) * 0.42,
      damage = r.damage * mult * (1 + (S.perks.damage || 0) * 0.12),
      rate =
        r.rate / (1 + (t.level - 1) * 0.09) / (1 + (S.perks.speed || 0) * 0.1),
      range = (r.range + (t.level - 1) * 5) * (1 + (S.perks.range || 0) * 0.1);
    if (t.type !== 5 && S.event === 4) range *= 0.88;
    if (t.branch >= 0) {
      if (t.type === 0) {
        if (t.branch === 0) {
          rate /= 1.45;
          damage *= 0.85;
        } else damage *= 1.35;
      }
      if (t.type === 1 && t.branch === 1) range += 20;
      if (t.type === 3 && t.branch === 1) {
        damage *= 1.7;
        rate *= 1.2;
      }
      if (t.type === 4 && t.branch === 1) damage *= 1.35;
    }
    let aura = 0;
    for (let b of S.towers)
      if (
        b !== t &&
        b.type === 2 &&
        Math.hypot(
          locations[b.pad][0] - locations[t.pad][0],
          locations[b.pad][1] - locations[t.pad][1],
        ) < (b.branch === 1 ? 95 : 70)
      )
        aura = Math.max(aura, b.branch === 1 ? 0.25 : 0.1);
    rate /= 1 + aura;
    if (S.rally > 0) rate /= 1.7;
    const result = { damage, rate, range: Math.round(range), r };
    statsCache.set(t, result);
    return result;
  }
  function padClick(i) {
    if (S.over || modalOpen || paused) return;
    if (aim) {
      castAt(...locations[i]);
      return;
    }
    selected = i;
    buildHighlight = false;
    let t = towerAt(i);
    if (t) {
      pick = t.type;
      sheetKind = "tower";
    } else sheetKind = "build";
    renderSelection();
    haptic(10);
  }
  function build() {
    if (
      sheetKind !== "build" ||
      selected < 0 ||
      towerAt(selected) ||
      modalOpen ||
      paused ||
      S.over
    )
      return;
    let price = cost(pick);
    if (S.money < price) {
      toast("Нужно ещё " + (price - S.money) + " монет");
      return;
    }
    let pad = selected;
    S.money -= price;
    let t = {
      pad,
      type: pick,
      level: 1,
      branch: -1,
      cd: 0.1,
      kills: 0,
      spent: price,
      priority: pick === 5 ? 1 : 0,
      stun: 0,
    };
    S.towers.push(t);
    invalidateStats();
    meta.built++;
    drawTower(t);
    t.birth = 0.36;
    t.node.classList.add("building");
    construction(...locations[pad], recipes[pick].color);
    burst(...locations[pad], recipes[pick].color, 12);
    sound(650, 0.07);
    closeSheet();
    saveMeta();
    save();
    renderUI();
    toast(recipes[pick].name + " построена");
  }
  function drawTower(t) {
    let [x, y] = locations[t.pad],
      g = el(
        "g",
        {
          class: "tower",
          "data-tower": t.pad,
          transform: `translate(${x - 28} ${y - 36})`,
          role: "button",
          tabindex: 0,
          "aria-label": recipes[t.type].name,
        },
        $("towers"),
      );
    t.birth = 0;
    t.motion = el("g", {}, g);
    t.art = placeArt(
      el,
      "t-" + recipes[t.type].id,
      { x: 0, y: 0, width: 56, height: 56, class: "art raster-art" },
      t.motion,
    );
    const start = 28 - ((t.level - 1) * 9) / 2 - 5.5;
    for (let i = 0; i < t.level; i++)
      placeArt(
        el,
        "star-gold",
        {
          x: start + i * 9,
          y: 49,
          width: 11,
          height: 11,
          class: "tower-star",
          "pointer-events": "none",
        },
        g,
      );
    if (t.branch >= 0)
      placeArt(
        el,
        t.branch === 1 ? "star-blue" : "star-gold",
        { x: 44, y: -3, width: 15, height: 15, "pointer-events": "none" },
        g,
      );
    el("rect", { x: -3, y: -6, width: 62, height: 68, fill: "transparent" }, g);
    t.node = g;
    g.onclick = (e) => {
      e.stopPropagation();
      padClick(t.pad);
    };
    g.onkeydown = (e) => {
      if (e.key === "Enter") padClick(t.pad);
    };
  }
  function upgrade(branch) {
    let t = towerAt(selected);
    if (!t || t.level >= 5 || S.over || paused || modalOpen) return;
    if (t.level === 2 && t.branch < 0 && branch === undefined && S.diff !== 0) {
      toast("Выбери специализацию ниже");
      return;
    }
    let price = upgradeCost(t);
    if (S.money < price) {
      toast("Нужно ещё " + (price - S.money) + " монет");
      return;
    }
    S.money -= price;
    t.spent += price;
    t.level++;
    invalidateStats();
    if (t.level === 3) {
      t.branch = branch ?? [0, 0, 1, 0, 0, 0, 0][t.type];
      meta.specs++;
    }
    t.node.remove();
    drawTower(t);
    t.birth = 0.24;
    t.node.classList.add("levelup");
    construction(...locations[t.pad], "#ffdd7d");
    burst(...locations[t.pad], "#ffdc80", 15);
    float(
      locations[t.pad][0],
      locations[t.pad][1] - 25,
      "УРОВЕНЬ " + t.level,
      "#ba792e",
    );
    sound(900, 0.08);
    renderSelection();
    saveMeta();
    save();
    renderUI();
  }
  function sell() {
    let t = towerAt(selected);
    if (!t || S.over || modalOpen || paused) return;
    S.money += Math.floor(t.spent * 0.65);
    burst(...locations[t.pad], "#e9cb87", 12);
    ring(...locations[t.pad], 26, "#ffd66f");
    t.node.remove();
    S.towers = S.towers.filter((a) => a !== t);
    invalidateStats();
    closeSheet();
    save();
    renderUI();
    toast("Возвращено " + Math.floor(t.spent * 0.65) + " монет");
  }
  function closeSheet() {
    selected = -1;
    sheetKind = "";
    $("range").setAttribute("r", 0);
    renderPadStates();
    renderUI();
  }
  function renderPadStates() {
    root.querySelectorAll(".pad").forEach((n, i) => {
      n.style.opacity = towerAt(i) ? 0 : 1;
      n.classList.toggle("selected", i === selected);
      n.classList.toggle("highlight", buildHighlight && !towerAt(i));
    });
    root
      .querySelectorAll(".tower")
      .forEach((n) =>
        n.classList.toggle("selected", +n.dataset.tower === selected),
      );
  }
  function renderSelection() {
    renderPadStates();
    if (selected < 0) {
      closeSheet();
      return;
    }
    const [x, y] = locations[selected],
      t = towerAt(selected),
      st = stats(t || { type: pick, level: 1, branch: -1, pad: selected });
    $("range").setAttribute("cx", x);
    $("range").setAttribute("cy", y);
    $("range").setAttribute("r", st.range);
    renderUI();
  }
  function eventFor(w) {
    return S.diff === 0
      ? 0
      : w < 3 || w % 6 === 0
        ? 0
        : 1 + ((w + S.map * 2) % 4);
  }
  function plan(w) {
    return planWave(w, S.diff);
  }
  function startWave(early = false) {
    if (S.over || paused || modalOpen || S.perkChoices.length) return;
    if (S.running && (!early || S.queue.length)) return;
    if (!S.towers.length) {
      buildHighlight = true;
      renderPadStates();
      toast("Нажми на плюс, выбери рецепт и построй башню");
      return;
    }
    if (!S.running) {
      S.total = 0;
      S.spawned = 0;
      S.batchStartLives = S.lives;
      S.batchStartLeaks = S.leaks;
      S.questDone = false;
    }
    S.wave++;
    S.event = eventFor(S.wave);
    invalidateStats();
    S.rewardWaves.push(S.wave);
    let queue = plan(S.wave);
    S.queue.push(...queue);
    S.total += queue.length;
    S.running = true;
    S.spawn = 0.4;
    S.autoTimer = 0;
    if (early) {
      S.money += 22;
      toast("Ранняя доставка: +22 монеты. Враги ещё на пути!");
    }
    closeSheet();
    setAim("");
    saveBeforeWave();
    showBanner(
      "ВОЛНА " + S.wave,
      S.wave % 6 === 0
        ? species[bossForWave(S.wave)].name.toUpperCase() + " ИДЁТ НА КУХНЮ"
        : events[S.event].name.toUpperCase(),
    );
    sound(370, 0.1);
    sound(620, 0.15, 0.12);
    renderUI();
  }
  function spawnEnemy(type, wave = S.wave, d = 0, child = false, options = {}) {
    let v = species[type],
      diff = [0.92, 1.12, 1.5][S.diff],
      scale =
        Math.pow(S.diff === 0 ? 1.115 : 1.125, Math.max(0, wave - 1)) *
        diff *
        (wave > 24 ? 1 + (wave - 24) * 0.1 : 1),
      hp = v.hp * scale * (options.elite ? 1.4 : 1),
      p = point(d),
      e = {
        type,
        wave,
        hp,
        max: hp,
        speed: v.speed * (1 + wave * 0.015),
        reward: Math.round(v.reward * (options.elite ? 1.35 : 1)),
        life: S.diff === 0 && v.boss ? 4 : v.life,
        armor: Math.min(
          0.72,
          v.armor + (S.event === 3 ? 0.15 : 0) + (options.elite ? 0.08 : 0),
        ),
        d,
        x: p.x,
        y: p.y,
        age: Math.random() * 0.5,
        slow: 0,
        slowPower: 0.6,
        stun: 0,
        poison: 0,
        dot: 0,
        burn: 0,
        source: null,
        shield: type === "shield" || type === "general" ? hp * 0.45 : 0,
        maxShield: type === "shield" || type === "general" ? hp * 0.45 : 0,
        summon: 5.5,
        casting: 0,
        haste: 0,
        birth: options.from ? 0.48 : 0.22,
        from: options.from || null,
        elite: Boolean(options.elite),
        healClock: 0,
        flash: 0,
        dead: false,
      };
    let g = el(
        "g",
        {
          class: `enemy ${v.boss ? "boss-enemy" : ""} ${options.from ? "summoned" : ""}`,
          "data-species": type,
          "data-elite": e.elite,
          transform: `translate(${e.x} ${e.y})`,
        },
        $("enemies"),
      ),
      sz = v.boss ? 66 : type === "crumb" ? 24 : 39;
    e.node = g;
    e.size = sz;
    el(
      "ellipse",
      {
        cx: 0,
        cy: sz / 2 - 2,
        rx: sz * 0.36,
        ry: 3,
        fill: "#57492d",
        opacity: ".18",
      },
      g,
    );
    e.art = el("g", { class: "enemy-art" }, g);
    placeArt(
      el,
      "e-" + type,
      { x: -sz / 2, y: -sz / 2, width: sz, height: sz, class: "raster-art" },
      e.art,
    );
    el(
      "rect",
      {
        x: -17,
        y: -sz / 2 - 7,
        width: 34,
        height: 4,
        rx: 2,
        fill: "#71573c",
        opacity: ".6",
      },
      g,
    );
    e.bar = el(
      "rect",
      {
        x: -17,
        y: -sz / 2 - 7,
        width: 34,
        height: 4,
        rx: 2,
        fill: v.boss ? v.color : "#eafaac",
      },
      g,
    );
    if (e.shield)
      e.shieldbar = el(
        "rect",
        { x: -17, y: -sz / 2 - 11, width: 34, height: 2, fill: "#b2f1ee" },
        g,
      );
    if (type === "healer")
      e.aura = el(
        "circle",
        {
          r: 20,
          fill: "none",
          stroke: "#d4efb3",
          "stroke-width": 1,
          opacity: ".6",
        },
        g,
      );
    S.enemies.push(e);
    if (child) S.total++;
    else S.spawned++;
    return e;
  }
  function splitDough(enemy) {
    for (const side of [-1, 1]) {
      spawnEnemy(
        "crumb",
        enemy.wave,
        Math.max(0, enemy.d - (side < 0 ? 8 : 26)),
        true,
        { from: { x: enemy.x + side * 10, y: enemy.y - 6 } },
      );
      if (!prefs.fx) continue;
      const shard = el("g", { class: "dough-half" }, $("effects"));
      const half = el(
        "svg",
        {
          x: side < 0 ? -enemy.size / 2 : 0,
          y: -enemy.size / 2,
          width: enemy.size / 2,
          height: enemy.size,
          overflow: "hidden",
        },
        shard,
      );
      placeArt(
        el,
        "e-dough",
        {
          x: side < 0 ? 0 : -enemy.size / 2,
          y: 0,
          width: enemy.size,
          height: enemy.size,
        },
        half,
      );
      effect(
        shard,
        0.42,
        (_, p) => {
          shard.setAttribute(
            "transform",
            `translate(${enemy.x + side * p * 17} ${enemy.y - Math.sin(p * Math.PI) * 14}) rotate(${side * p * 22})`,
          );
          shard.setAttribute("opacity", 1 - p);
        },
        "split",
      );
    }
  }
  function giveShield(enemy, amount) {
    enemy.maxShield = Math.max(enemy.maxShield, amount);
    enemy.shield = Math.min(enemy.maxShield, enemy.shield + amount);
    if (!enemy.shieldbar)
      enemy.shieldbar = el(
        "rect",
        {
          x: -17,
          y: -enemy.size / 2 - 11,
          width: 34,
          height: 2,
          fill: "#b2f1ee",
        },
        enemy.node,
      );
    writeAttr(
      enemy.shieldbar,
      "width",
      ((34 * enemy.shield) / enemy.maxShield).toFixed(1),
    );
  }
  function bossSkill(enemy) {
    const descriptor = species[enemy.type];
    enemy.skillCount = (enemy.skillCount || 0) + 1;
    enemy.node.dataset.skillCount = enemy.skillCount;
    ring(enemy.x, enemy.y, 70, descriptor.color);
    if (enemy.type === "boss") {
      const types =
        enemy.wave >= 12 ? ["shield", "olive", "tomato"] : ["tomato", "olive"];
      for (let i = 0; i < types.length; i++) {
        if (S.enemies.length >= 120) break;
        const portalX = enemy.x + (i - 0.5) * 24;
        ring(portalX, enemy.y + 10, 17, "#ffe4a2");
        spawnEnemy(
          types[i],
          enemy.wave,
          Math.max(0, enemy.d - 28 - i * 20),
          true,
          { from: { x: portalX, y: enemy.y - 4 } },
        );
      }
    } else if (enemy.type === "moldboss") {
      enemy.hp = Math.min(enemy.max, enemy.hp + enemy.max * 0.04);
      for (const ally of S.enemies) {
        if (
          ally.dead ||
          ally === enemy ||
          distanceSquared(ally.x, ally.y, enemy.x, enemy.y) > 105 ** 2
        )
          continue;
        giveShield(ally, ally.max * 0.22);
        if (prefs.fx) {
          const spore = el("g", {}, $("effects"));
          placeArt(
            el,
            "a-heal",
            { x: -6, y: -6, width: 12, height: 12 },
            spore,
          );
          effect(spore, 0.45, (_, p) =>
            spore.setAttribute(
              "transform",
              `translate(${enemy.x + (ally.x - enemy.x) * p} ${enemy.y + (ally.y - enemy.y) * p - Math.sin(p * Math.PI) * 12})`,
            ),
          );
        }
      }
    } else if (enemy.type === "chiliboss") {
      for (const tower of enemy.targets || []) {
        if (!S.towers.includes(tower)) continue;
        tower.stun = Math.max(tower.stun || 0, S.diff === 0 ? 1.25 : 1.8);
        littleCast("a-oven", ...locations[tower.pad]);
        ring(...locations[tower.pad], 24, "#ffac52");
      }
    } else {
      giveShield(enemy, enemy.max * 0.2);
      for (const ally of S.enemies) {
        if (
          !ally.dead &&
          distanceSquared(ally.x, ally.y, enemy.x, enemy.y) < 130 ** 2
        ) {
          ally.haste = 4;
          if (prefs.fx) ring(ally.x, ally.y, 17, "#71d1ed");
        }
      }
    }
  }
  function updateBoss(enemy, dt) {
    if (
      !enemy.enraged &&
      enemy.hp < enemy.max * 0.5 &&
      ["chiliboss", "general"].includes(enemy.type)
    ) {
      enemy.enraged = true;
      enemy.speed *= 1.22;
      float(enemy.x, enemy.y - 42, "ВТОРАЯ ФАЗА!", species[enemy.type].color);
      ring(enemy.x, enemy.y, 65, species[enemy.type].color);
    }
    if (enemy.casting > 0) {
      enemy.casting -= dt;
      if (enemy.casting <= 0) {
        enemy.node.dataset.casting = "false";
        bossSkill(enemy);
      }
      return;
    }
    enemy.summon -= dt;
    if (enemy.summon > 0) return;
    enemy.summon = enemy.type === "chiliboss" ? 9 : 7;
    enemy.casting = 0.85;
    enemy.node.dataset.casting = "true";
    ring(enemy.x, enemy.y, 35, species[enemy.type].color);
    if (enemy.type === "chiliboss") {
      enemy.targets = S.towers
        .filter(
          (t) =>
            distanceSquared(...locations[t.pad], enemy.x, enemy.y) < 140 ** 2,
        )
        .sort(
          (a, b) =>
            distanceSquared(...locations[a.pad], enemy.x, enemy.y) -
            distanceSquared(...locations[b.pad], enemy.x, enemy.y),
        )
        .slice(0, 2);
      for (const tower of enemy.targets) {
        const [x, y] = locations[tower.pad];
        const warning = el(
          "circle",
          {
            cx: x,
            cy: y,
            r: 24,
            fill: "#ff6b30",
            "fill-opacity": 0.2,
            stroke: "#ffe183",
            "stroke-width": 2,
          },
          $("effects"),
        );
        effect(
          warning,
          0.85,
          (_, p) =>
            warning.setAttribute(
              "opacity",
              0.45 + Math.sin(p * Math.PI * 5) * 0.35,
            ),
          "warning",
        );
      }
    }
  }
  function damage(e, amount, source, pierce = false, flash = true) {
    if (e.dead) return;
    let a = amount * (pierce ? 1 : 1 - e.armor);
    if (e.shield > 0) {
      let shieldMult = source?.type === 4 ? 2 : 1,
        spent = Math.min(e.shield, a * shieldMult);
      e.shield -= spent;
      a -= spent / shieldMult;
      e.shieldbar?.setAttribute("width", (34 * e.shield) / e.maxShield);
    }
    e.hp -= a;
    if (flash && a > 0) e.flash = 0.075;
    writeAttr(e.bar, "width", Math.max(0, (34 * e.hp) / e.max).toFixed(1));
    if (e.hp > 0) return;
    e.dead = true;
    let reward = Math.round(e.reward * (1 + (S.perks.income || 0) * 0.15));
    S.money += reward;
    S.kills++;
    meta.kills++;
    if (source) source.kills++;
    if (isBoss(e)) {
      meta.boss++;
      celebrate(
        species[e.type].name + " повержен!",
        "Босс повержен · +" + reward + " монет",
      );
      float(e.x, e.y - 25, "БОСС ПОВЕРЖЕН!", "#c45130");
      sound(1000, 0.18);
      haptic([30, 40, 30]);
    } else if (S.kills % 5 === 0) float(e.x, e.y - 17, "+" + reward, "#98702b");
    burst(e.x, e.y, recipes[source?.type ?? 0].color, isBoss(e) ? 16 : 5);
    if (e.type === "dough") {
      splitDough(e);
    }
    if (e.type === "pepper") {
      ring(e.x, e.y, 65, "#eb7144");
      for (let t of S.towers)
        if (
          Math.hypot(locations[t.pad][0] - e.x, locations[t.pad][1] - e.y) < 65
        ) {
          if ((t.stunShield || 0) <= 0) {
            t.stun = S.diff === 0 ? 0.8 : 1.5;
            t.stunShield = 5;
          }
        }
    }
    if (prefs.fx && S.kills % 3 === 0) {
      let c = el("g", {}, $("effects"));
      placeArt(el, "coin", { x: -6, y: -6, width: 12, height: 12 }, c);
      let x = e.x,
        y = e.y;
      effect(c, 0.7, (f, p) => {
        c.setAttribute(
          "transform",
          `translate(${x + (110 - x) * p} ${y - (y + 20) * p * p})`,
        );
        c.setAttribute("opacity", 1 - p);
      });
    }
    if (prefs.fx && e.type !== "dough") {
      let ghost = el(
        "g",
        { transform: `translate(${e.x} ${e.y})` },
        $("effects"),
      );
      placeArt(
        el,
        "e-" + e.type,
        {
          x: -e.size / 2,
          y: -e.size / 2,
          width: e.size,
          height: e.size,
          class: "raster-art",
        },
        ghost,
      );
      effect(ghost, 0.48, (f, p) => {
        let ease = 1 - Math.pow(1 - p, 3),
          side = e.face || 1;
        ghost.setAttribute(
          "transform",
          `translate(${e.x + side * ease * 8} ${e.y + ease * 5}) rotate(${side * ease * 85} 0 ${e.size * 0.34}) scale(${side} 1)`,
        );
        ghost.setAttribute("opacity", Math.min(1, (1 - p) * 2.5));
      });
    }
    e.node.remove();
  }
  function hit(e, t) {
    let st = stats(t),
      d = st.damage,
      type = t.type;
    if (e.dead) return;
    if (Math.random() < 0.04 + (S.perks.crit || 0) * 0.12) {
      d *= 2;
      float(e.x, e.y - 18, "КРИТ!", "#d46235");
    }
    if (type === 5 && t.branch === 0 && isBoss(e)) d *= 2;
    damage(
      e,
      d,
      t,
      type === 4 ||
        (type === 0 && t.branch === 1) ||
        (type === 5 && t.branch === 0),
    );
    if (type === 1) {
      for (let a of S.enemies) {
        if (a.dead || Math.hypot(a.x - e.x, a.y - e.y) > 34) continue;
        a.slow = Math.max(a.slow, 2.2);
        a.slowPower = t.branch === 1 ? 0.4 : 0.6;
        if (a !== e) damage(a, d * 0.45, t);
      }
      ring(e.x, e.y, 32, "#ffe080");
      if (t.branch === 0) puddle(e.x, e.y, 4);
    }
    if (type === 2) {
      e.poison = 3.5;
      e.dot =
        (8 + t.level * 2.2) *
        (t.branch === 0 ? 1.8 : 1) *
        (1 + (S.perks.damage || 0) * 0.12);
      e.source = t;
    }
    if (type === 3) {
      let radius = 36 + (t.level - 1) * 3 + (t.branch === 0 ? 20 : 0);
      for (let a of S.enemies) {
        if (a.dead || Math.hypot(a.x - e.x, a.y - e.y) > radius) continue;
        if (a !== e) damage(a, d * 0.8, t);
        a.burn = 2.5;
        a.burnDot = (9 + t.level * 2) * (t.branch === 0 ? 1.7 : 1);
        a.source = t;
      }
      ring(e.x, e.y, radius, "#ffac4e");
      burst(e.x, e.y, "#ffe086", 7);
    }
    if (type === 4) {
      let list = S.enemies
          .filter(
            (a) => !a.dead && a !== e && Math.hypot(a.x - e.x, a.y - e.y) < 78,
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - e.x, a.y - e.y) -
              Math.hypot(b.x - e.x, b.y - e.y),
          )
          .slice(0, t.branch === 0 ? 5 : 2),
        prev = e;
      if (t.branch === 1) e.stun = Math.max(e.stun, 0.4);
      for (let a of list) {
        lightning(prev.x, prev.y, a.x, a.y);
        damage(a, d * 0.7, t, true);
        if (t.branch === 1) a.stun = Math.max(a.stun, 0.4);
        prev = a;
      }
    }
    if (type === 5) {
      lightning(
        locations[t.pad][0],
        locations[t.pad][1] - 15,
        e.x,
        e.y,
        "#ffd994",
      );
      if (t.branch === 1) {
        let list = S.enemies
          .filter((a) => a !== e && !a.dead && Math.abs(a.d - e.d) < 65)
          .slice(0, 3);
        for (let a of list) {
          damage(a, d * 0.65, t, true);
          lightning(e.x, e.y, a.x, a.y, "#ffe6b2");
        }
      }
    }
  }
  function fire(t, target) {
    let [x, y] = locations[t.pad],
      st = stats(t);
    t.cd = st.rate;
    t.flash = 0.1;
    t.recoil = 0.22;
    if (Math.abs(target.x - x) > 4) t.face = target.x < x ? -1 : 1;
    t.node.dataset.facing = t.face || 1;
    let n = el("g", {}, $("shots"));
    let size = t.type === 3 ? 17 : t.type === 5 ? 11 : 13;
    el(
      "path",
      {
        d: "M-12 0h9",
        stroke: st.r.color,
        "stroke-width": 2,
        opacity: 0.4,
        class: "projectiletrail",
      },
      n,
    );
    placeArt(
      el,
      "a-" + st.r.id,
      { x: -size / 2, y: -size / 2, width: size, height: size },
      n,
    );
    S.shots.push({ x, y: y - 10, target, t, node: n });
    if (t.type === 2 && t.branch === 0) {
      let e = S.enemies.find(
        (a) =>
          !a.dead && a !== target && Math.hypot(a.x - x, a.y - y) < st.range,
      );
      if (e) {
        let n2 = el("g", {}, $("shots"));
        placeArt(el, "a-basil", { x: -6, y: -6, width: 12, height: 12 }, n2);
        S.shots.push({ x, y: y - 10, target: e, t, node: n2 });
      }
    }
    if (t.type === 5) sound(190, 0.045);
    else if (Math.random() < 0.25)
      sound(t.type === 3 ? 140 : 580 - t.type * 65, 0.025);
  }
  function setAim(value) {
    aim = value;
    closeSheet();
    renderUI();
  }
  function castAt(x, y) {
    if (!aim || paused || modalOpen || S.over) return;
    if (aim === "bomb") {
      littleCast("bomb", x, y);
      S.cool.bomb = 32;
      for (let e of S.enemies)
        if (Math.hypot(e.x - x, e.y - y) < 73)
          damage(e, (105 + S.wave * 15) * (isBoss(e) ? 0.75 : 1), null, true);
      ring(x, y, 73, "#ed8243");
      burst(x, y, "#ffc562", 28);
      float(x, y - 10, "СОУС-БУМ", "#c5512f");
      haptic(25);
      sound(80, 0.18);
    }
    if (aim === "trap") {
      let nearest = Infinity;
      for (let p of route)
        nearest = Math.min(nearest, Math.hypot(p[0] - x, p[1] - y));
      if (nearest > 25) {
        toast("Масло нужно разлить на дороге");
        return;
      }
      littleCast("trap", x, y);
      S.cool.trap = 24;
      let n = el(
        "ellipse",
        {
          cx: x,
          cy: y,
          rx: 30,
          ry: 17,
          fill: "#9b783d",
          opacity: 0.6,
          stroke: "#ebc85a",
          "stroke-width": 2,
        },
        $("effects"),
      );
      S.traps.push({ x, y, time: 18, node: n });
      toast("Масло: яд и замедление на 18 секунд");
    }
    setAim("");
    renderUI();
  }
  function useAbility(id) {
    if (
      !abilities.some((a) => a.id === id) ||
      S.cool[id] > 0 ||
      paused ||
      modalOpen ||
      S.over
    )
      return;
    if (!S.running && id !== "repair") {
      toast("Способности пригодятся во время волны");
      return;
    }
    if (id === "bomb" || id === "trap") {
      setAim(aim === id ? "" : id);
      return;
    }
    if (id === "freeze") {
      let mist = el(
        "rect",
        { x: 0, y: 0, width: 420, height: 450, fill: "#d5fffc", opacity: 0.22 },
        $("effects"),
      );
      effect(mist, 0.7, (f, p) => mist.setAttribute("opacity", 0.22 * (1 - p)));
      for (let e of S.enemies) {
        e.slow = Math.max(e.slow, isBoss(e) ? 3 : 6);
        e.slowPower = 0.35;
        ring(e.x, e.y, 24, "#b1eeeb");
      }
      S.cool.freeze = 38;
      toast("Ледяная сода: 6 секунд замедления");
      sound(1000, 0.12);
    }
    if (id === "rally") {
      S.rally = 7;
      invalidateStats();
      S.cool.rally = 48;
      for (let t of S.towers) ring(...locations[t.pad], 23, "#ec894d");
      toast("Острая смена: скорость атаки +70% на 7 с");
      sound(700, 0.1);
    }
    if (id === "repair") {
      if (S.money < 80) {
        toast("Ремонт стоит 80 монет");
        return;
      }
      if (S.lives === S.maxLives) {
        toast("Кухня полностью цела");
        return;
      }
      burst(367, 382, "#f29a71", 16);
      float(365, 350, "+5 ЖИЗНЕЙ", "#d65b49");
      S.money -= 80;
      S.lives = Math.min(S.maxLives, S.lives + 5);
      S.cool.repair = 55;
      toast("Кухня восстановлена: +5 жизней");
      sound(750, 0.12);
      save();
    }
    renderUI();
  }
  cleanups.push(
    listen($("map"), "click", (e) => {
      if (aim) {
        let p = $("map").createSVGPoint();
        p.x = e.clientX;
        p.y = e.clientY;
        let q = p.matrixTransform($("world").getScreenCTM().inverse());
        castAt(q.x, q.y);
      } else if (!e.target.closest(".tower,.pad")) closeSheet();
    }),
  );
  function tick(dt) {
    if (paused || modalOpen || S.over) return;
    dt *= speed;
    for (let k in S.cool)
      S.cool[k] = Math.max(
        0,
        S.cool[k] - dt * (1 + (S.perks.cool || 0) * 0.15),
      );
    const rallyBefore = S.rally;
    S.rally = Math.max(0, S.rally - dt);
    if (rallyBefore > 0 && S.rally === 0) invalidateStats();
    if (S.running) {
      S.spawn -= dt;
      if (S.spawn <= 0 && S.queue.length) {
        let q = S.queue.shift();
        spawnEnemy(q.type, q.wave, 0, false, { elite: q.elite });
        S.spawn =
          Math.max(0.24, 0.82 - S.wave * 0.018) * (S.event === 1 ? 0.68 : 1);
      }
    }
    let liveSnapshot = [...S.enemies];
    for (let a of liveSnapshot) a.healed = 0;
    for (let e of liveSnapshot) {
      if (e.dead) continue;
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.haste = Math.max(0, e.haste - dt);
      e.birth = Math.max(0, e.birth - dt);
      if (e.poison > 0) {
        e.poison -= dt;
        damage(e, e.dot * dt, e.source, true, false);
      }
      if (e.burn > 0) {
        e.burn -= dt;
        damage(e, (e.burnDot || 14) * dt, e.source, true, false);
      }
      if (e.dead) continue;
      if (S.event === 2) e.hp = Math.min(e.max, e.hp + e.max * 0.015 * dt);
      if (e.type === "healer") {
        e.healClock -= dt;
        for (let a of liveSnapshot)
          if (
            !a.dead &&
            a !== e &&
            distanceSquared(a.x, a.y, e.x, e.y) < 3600
          ) {
            let heal = Math.min(
              a.max * 0.027 * dt,
              Math.max(0, a.max * 0.05 * dt - a.healed),
            );
            a.hp = Math.min(a.max, a.hp + heal);
            a.healed += heal;
          }
        if (e.healClock <= 0) {
          e.healClock = 1.6;
          ring(e.x, e.y, 60, "#87c47c");
        }
      }
      if (isBoss(e)) updateBoss(e, dt);
      let slowFactor =
          e.slow > 0
            ? isBoss(e)
              ? Math.max(0.75, e.slowPower)
              : e.slowPower
            : 1,
        move =
          e.stun > 0 || e.casting > 0
            ? 0
            : e.speed *
              dt *
              slowFactor *
              (S.event === 1 ? 1.12 : 1) *
              (e.haste > 0 ? 1.3 : 1) *
              (e.type === "olive" && e.age % 4 < 0.7
                ? S.diff === 0
                  ? 1.3
                  : 1.55
                : 1);
      e.d += move;
      let p = point(e.d),
        face = p.x < e.x - 0.02 ? -1 : p.x > e.x + 0.02 ? 1 : e.face || 1;
      e.face = face;
      e.x = p.x;
      e.y = p.y;
      const birth = e.birth / (e.from ? 0.48 : 0.22);
      const offsetX = e.from ? (e.from.x - e.x) * birth : 0;
      const offsetY = e.from
        ? (e.from.y - e.y) * birth - Math.sin(birth * Math.PI) * 13
        : 0;
      e.node.setAttribute(
        "transform",
        `translate(${(e.x + offsetX).toFixed(2)} ${(e.y + offsetY).toFixed(2)})`,
      );
      let bob = prefs.fx && move > 0 ? Math.sin(e.d * 0.22) * 1.15 : 0;
      let rock = prefs.fx && move > 0 ? Math.sin(e.d * 0.22) * 4.5 : 0;
      const pulse =
        e.casting > 0 && prefs.fx
          ? Math.sin((e.casting / 0.85) * Math.PI) * 0.14
          : 0;
      const appearance = prefs.fx ? 1 - birth * 0.45 : 1;
      writeAttr(
        e.art,
        "transform",
        `translate(0 ${bob.toFixed(2)}) rotate(${rock.toFixed(2)}) scale(${(face * appearance * (1 + pulse)).toFixed(3)} ${(appearance * (1 - pulse * 0.7)).toFixed(3)})`,
      );
      const filter =
        e.flash > 0
          ? "url(#enemyHit)"
          : e.slow > 0
            ? "drop-shadow(0 0 2px #83dfe2)"
            : e.poison > 0
              ? "drop-shadow(0 0 2px #66a865)"
              : e.elite
                ? "drop-shadow(0 0 2px #fbd774)"
                : "";
      if (e.lastFilter !== filter) {
        e.art.style.filter = filter;
        e.lastFilter = filter;
      }
      writeAttr(e.node, "data-poisoned", e.poison > 0 ? "true" : "false");
      writeAttr(e.bar, "width", Math.max(0, (34 * e.hp) / e.max).toFixed(1));
      if (prefs.fx && (e.poison > 0 || e.burn > 0)) {
        e.statusFx = (e.statusFx || 0) - dt;
        if (e.statusFx <= 0) {
          e.statusFx = 0.6;
          burst(e.x, e.y - 10, e.poison > 0 ? "#b4ed6d" : "#ffad4d", 2);
        }
      }
      if (e.d >= roadLength - 9) {
        S.lives = Math.max(0, S.lives - e.life);
        S.leaks += e.life;
        e.dead = true;
        e.node.remove();
        ring(365, 391, 35, "#e98350");
        damageFlash++;
        renderUI();
        haptic(40);
        sound(100, 0.15);
        if (S.lives <= 0) {
          finish(false);
          return;
        }
      }
    }
    S.enemies = S.enemies.filter((e) => !e.dead);
    for (let t of S.towers) {
      t.cd -= dt;
      t.stun = Math.max(0, (t.stun || 0) - dt);
      writeAttr(t.node, "data-stunned", t.stun > 0 ? "true" : "false");
      t.stunShield = Math.max(0, (t.stunShield || 0) - dt);
      t.flash = Math.max(0, (t.flash || 0) - dt);
      t.recoil = Math.max(0, (t.recoil || 0) - dt);
      t.birth = Math.max(0, (t.birth || 0) - dt);
      let bounce = prefs.fx ? Math.sin(((t.recoil || 0) / 0.22) * Math.PI) : 0,
        entrance = prefs.fx ? 1 - (t.birth / 0.36) * 0.65 : 1;
      writeAttr(
        t.motion,
        "transform",
        `translate(28 56) scale(${((t.face || 1) * entrance * (1 + bounce * 0.13)).toFixed(3)} ${(entrance * (1 - bounce * 0.11)).toFixed(3)}) translate(-28 -56)`,
      );
      writeAttr(t.motion, "opacity", Math.min(1, entrance * 2));
      const filter =
        (selected === t.pad ? "url(#towerOutline) " : "") +
        (t.stun > 0
          ? "grayscale(.8)"
          : t.flash > 0
            ? "brightness(1.4)"
            : S.rally > 0
              ? "drop-shadow(0 0 3px #ee8742)"
              : "");
      if (t.lastFilter !== filter) {
        t.art.style.filter = filter;
        t.lastFilter = filter;
      }
      if (t.stun > 0 || t.cd > 0) continue;
      const [x, y] = locations[t.pad];
      const target = selectTarget(S.enemies, x, y, stats(t).range, t.priority);
      if (target) fire(t, target);
    }
    for (let s of S.shots) {
      if (s.target.dead) {
        s.node.remove();
        s.dead = true;
        continue;
      }
      let dx = s.target.x - s.x,
        dy = s.target.y - s.y,
        d = Math.hypot(dx, dy),
        v = (s.t.type === 5 ? 650 : 280) * dt;
      if (d <= v + 4) {
        hit(s.target, s.t);
        s.node.remove();
        s.dead = true;
      } else {
        s.x += (dx / d) * v;
        s.y += (dy / d) * v;
        s.node.setAttribute(
          "transform",
          `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI})`,
        );
      }
    }
    S.shots = S.shots.filter((s) => !s.dead);
    S.enemies = S.enemies.filter((e) => !e.dead);
    for (let f of S.fx) {
      f.time -= dt;
      f.update(f, 1 - Math.max(0, f.time) / f.max);
      if (f.time <= 0) f.node.remove();
    }
    S.fx = S.fx.filter((f) => f.time > 0);
    for (let f of S.texts) {
      f.time -= dt;
      f.node.setAttribute("y", f.y + (1 - f.time / f.max) * -25);
      f.node.setAttribute("opacity", Math.min(1, f.time * 2));
      if (f.time <= 0) f.node.remove();
    }
    S.texts = S.texts.filter((f) => f.time > 0);
    for (let tr of S.traps) {
      tr.time -= dt;
      tr.node.setAttribute("opacity", Math.min(0.6, tr.time / 5));
      for (let e of S.enemies)
        if (Math.hypot(e.x - tr.x, e.y - tr.y) < 31) {
          e.slow = Math.max(e.slow, 0.3);
          e.slowPower = 0.45;
          damage(e, (12 + S.wave * 1.5) * dt, null, true, false);
        }
      if (tr.time <= 0) tr.node.remove();
    }
    S.traps = S.traps.filter((t) => t.time > 0);
    if (S.running && !S.enemies.some((e) => !e.dead) && !S.queue.length)
      completeWave();
    if (!S.running && prefs.auto && S.autoTimer > 0 && !S.perkChoices.length) {
      S.autoTimer -= dt;
      if (S.autoTimer <= 0) startWave();
    }
    uiClock += dt;
    if (uiClock > 0.25) {
      uiClock = 0;
      renderUI();
    }
  }
  function completeWave() {
    S.running = false;
    setAim("");
    let reward = 0;
    for (let w of S.rewardWaves) {
      reward += 23 + w * 2;
      for (let t of S.towers)
        if (t.type === 6)
          reward += Math.round(
            (15 + t.level * 6) * (t.branch === 0 ? 1.65 : 1),
          );
    }
    if (S.leaks === S.batchStartLeaks) {
      reward += 35;
      S.questDone = true;
    }
    S.money += reward;
    S.rewardWaves = [];
    if (S.diff === 0) S.lives = Math.min(S.maxLives, S.lives + 2);
    meta.best = Math.max(meta.best, S.wave);
    saveMeta();
    S.autoTimer = 5;
    toast("Вкусно сыграно! +" + reward);
    closeSheet();
    if (S.wave >= goal() && !S.endless) {
      finish(true);
      return;
    }
    if (S.wave >= S.nextPerk) {
      S.nextPerk += 4;
      rollPerks();
    }
    save();
    renderUI();
  }
  function rollPerks() {
    let shuffled = [...perks].sort(() => Math.random() - 0.5);
    S.perkChoices = shuffled.slice(0, 3).map((p) => p.id);
    showPerks();
  }
  function showPerks() {
    openModal("perks");
  }
  function choosePerk(id) {
    invalidateStats();
    if (!S.perkChoices.includes(id)) return;
    if (id === "cash") S.money += 140;
    else if (id === "health") {
      S.maxLives += 4;
      S.lives = Math.min(S.maxLives, S.lives + 6);
    } else S.perks[id] = (S.perks[id] || 0) + 1;
    S.perkChoices = [];
    closeModal();
    save();
    celebrate("Новый рецепт!", perks.find((p) => p.id === id).name);
    toast("Рецепт добавлен: " + perks.find((p) => p.id === id).name);
    renderUI();
  }
  let damageFlash = 0;
  function renderUI() {
    if (disposed) return;
    wake();
    const t = towerAt(selected),
      st =
        selected >= 0
          ? stats(t || { type: pick, level: 1, branch: -1, pad: selected })
          : null;
    const boss = S.enemies.find((e) => !e.dead && isBoss(e));
    onChange({
      ...snapshot(),
      running: S.running,
      over: S.over,
      event: S.event,
      total: S.total,
      remaining: S.queue.length + S.enemies.filter((e) => !e.dead).length,
      queueLength: S.queue.length,
      goal: goal(),
      questDone: S.questDone,
      batchStartLeaks: S.batchStartLeaks,
      rally: S.rally,
      meta: { ...meta },
      prefs: { ...prefs },
      cool: { ...S.cool },
      perks: { ...S.perks },
      paused,
      speed,
      aim,
      buildHighlight,
      toast: toastText,
      banner,
      milestone,
      damageFlash,
      modal: modalKind,
      chosenMap,
      chosenDiff,
      resultWin,
      resumeOffered,
      resume: resumeOffered ? checkpoint : null,
      selection:
        selected < 0
          ? null
          : {
              pad: selected,
              pick,
              type: t ? t.type : pick,
              tower: t
                ? {
                    level: t.level,
                    branch: t.branch,
                    kills: t.kills,
                    spent: t.spent,
                    priority: t.priority,
                  }
                : null,
              stats: st,
              cost: cost(pick),
              costs: recipes.map((_, i) => cost(i)),
              upgradeCost: t ? upgradeCost(t) : 0,
            },
      boss: boss
        ? {
            hp: boss.hp,
            max: boss.max,
            type: boss.type,
            name: species[boss.type].name,
            color: species[boss.type].color,
            skill: species[boss.type].skill,
            casting: boss.casting > 0,
          }
        : null,
      intel:
        modalKind === "intel"
          ? {
              wave: S.running ? S.wave : S.wave + 1,
              event: eventFor(S.running ? S.wave : S.wave + 1),
              counts: plan(S.running ? S.wave : S.wave + 1).reduce(
                (counts, e) => {
                  counts[e.type] = (counts[e.type] || 0) + 1;
                  return counts;
                },
                {},
              ),
            }
          : null,
    });
  }
  function toast(text) {
    toastText = text;
    clearTimeout(toastTimer);
    toastTimer = later(() => {
      toastText = "";
      renderUI();
    }, 2400);
    renderUI();
  }
  function showBanner(title, sub) {
    banner = { title, sub };
    clearTimeout(bannerTimer);
    bannerTimer = later(() => {
      banner = null;
      renderUI();
    }, 1800);
    renderUI();
  }
  function saveMeta() {
    try {
      localStorage.setItem("pizzaMeta", JSON.stringify(meta));
      localStorage.setItem("pizzaPrefs", JSON.stringify(prefs));
    } catch (e) {}
  }
  function snapshot() {
    return {
      v: 2,
      map: S.map,
      diff: S.diff,
      money: S.money,
      lives: S.lives,
      maxLives: S.maxLives,
      wave: S.wave,
      kills: S.kills,
      leaks: S.leaks,
      endless: S.endless,
      perks: S.perks,
      nextPerk: S.nextPerk,
      perkChoices: S.perkChoices,
      cool: S.cool,
      towers: S.towers.map(
        ({ pad, type, level, branch, kills, spent, priority }) => ({
          pad,
          type,
          level,
          branch,
          kills,
          spent,
          priority,
        }),
      ),
    };
  }
  function writeSave(c) {
    checkpoint = JSON.parse(JSON.stringify(c));
    try {
      localStorage.setItem("pizzaSaveV2", JSON.stringify(checkpoint));
    } catch (e) {}
  }
  function save() {
    if (!S.running && !S.over) writeSave(snapshot());
  }
  function saveBeforeWave() {
    if (S.rewardWaves.length === 1) {
      let c = snapshot();
      c.wave = S.wave - 1;
      writeSave(c);
    }
  }
  function clearSave() {
    checkpoint = null;
    try {
      localStorage.removeItem("pizzaSaveV2");
    } catch (e) {}
  }
  function openModal(kind) {
    modalOpen = true;
    modalKind = kind;
    closeSheet();
    renderUI();
  }
  function closeModal() {
    modalOpen = false;
    modalKind = null;
    renderUI();
  }
  function reset(map = chosenMap, diff = chosenDiff) {
    clearSave();
    S = fresh(map, diff);
    invalidateStats();
    for (const id of [
      "towers",
      "enemies",
      "shots",
      "effects",
      "texts",
      "constructionFx",
    ])
      $(id).replaceChildren();
    selected = -1;
    sheetKind = "";
    pick = 0;
    aim = "";
    paused = false;
    speed = 1;
    buildHighlight = true;
    $("range").setAttribute("r", 0);
    setupMap();
    renderPadStates();
    closeModal();
    save();
    renderUI();
    toast("Выбери площадку и поставь первую башню");
  }
  function resumeSave() {
    const c = checkpoint;
    if (!c) return;
    reset(c.map, c.diff);
    for (const k of [
      "money",
      "lives",
      "maxLives",
      "wave",
      "kills",
      "leaks",
      "endless",
      "perks",
      "nextPerk",
      "perkChoices",
      "cool",
    ])
      if (c[k] !== undefined) S[k] = c[k];
    S.towers = c.towers.map((t) => ({ ...t, cd: 0, stun: 0 }));
    invalidateStats();
    S.endless = S.endless || S.wave >= goal();
    for (const t of S.towers) drawTower(t);
    buildHighlight = false;
    renderPadStates();
    save();
    renderUI();
    if (S.perkChoices.length) showPerks();
    else toast("Продолжаем с волны " + (S.wave + 1));
  }
  function finish(win) {
    S.running = false;
    S.over = true;
    setAim("");
    meta.best = Math.max(meta.best, win ? S.wave : Math.max(0, S.wave - 1));
    if (win) meta.wins++;
    saveMeta();
    if (!win) clearSave();
    resultWin = win;
    openModal("finish");
  }
  function intro(first = true) {
    chosenMap = 0;
    chosenDiff = 0;
    resumeOffered = first;
    openModal("intro");
  }
  function pause() {
    if (S.over || modalOpen) return;
    paused = true;
    openModal("pause");
  }
  async function fullscreen() {
    try {
      if (
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      )
        await document.documentElement.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
      else toast("В меню браузера выбери «На главный экран»");
    } catch {
      toast("Полный экран недоступен в этом браузере");
    }
  }
  cleanups.push(
    listen(document, "visibilitychange", () => {
      if (document.hidden) {
        save();
        saveMeta();
        if (S.running && !modalOpen && !paused) pause();
      }
    }),
  );
  cleanups.push(
    listen(window, "pagehide", () => {
      save();
      saveMeta();
    }),
  );
  cleanups.push(listen(window, "resize", fitBoard));
  const observer =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(fitBoard) : null;
  observer?.observe($("mapMount"));
  placeArt(
    el,
    "shop",
    { x: 314, y: 329, width: 105, height: 95 },
    $("pizzeria"),
  );
  setupMap();
  intro();
  function hasWork() {
    return (
      !disposed &&
      !paused &&
      !modalOpen &&
      !S.over &&
      (S.running ||
        S.fx.length ||
        S.texts.length ||
        S.traps.length ||
        S.shots.length ||
        S.rally > 0 ||
        Object.values(S.cool).some((value) => value > 0) ||
        (prefs.auto && S.autoTimer > 0) ||
        S.towers.some(
          (t) => t.birth > 0 || t.recoil > 0 || t.stun > 0 || t.flash > 0,
        ))
    );
  }
  function wake() {
    if (frame === null && hasWork()) {
      last = performance.now();
      frame = requestAnimationFrame(loop);
    }
  }
  function loop(now) {
    if (disposed) return;
    frame = null;
    const dt = Math.min(0.045, (now - last) / 1000);
    last = now;
    tick(dt);
    if (frame === null && hasWork()) frame = requestAnimationFrame(loop);
    else if (frame === null && !paused && !modalOpen && !S.over) renderUI();
  }
  wake();
  return {
    startWave: () => startWave(S.running),
    build,
    upgrade,
    sell,
    closeSheet,
    useAbility,
    selectRecipe(type) {
      if (!recipes[type] || sheetKind !== "build") return;
      pick = type;
      renderSelection();
      sound(500 + pick * 80, 0.04);
    },
    priority() {
      const t = towerAt(selected);
      if (t) {
        t.priority = (t.priority + 1) % 4;
        renderSelection();
        save();
      }
    },
    buildMode() {
      if (modalOpen || S.over || paused) return;
      setAim("");
      buildHighlight = !buildHighlight;
      renderPadStates();
      toast("Нажми на свободную площадку и выбери башню");
    },
    setSpeed() {
      speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
      renderUI();
    },
    showModal(kind) {
      if (["intel", "help", "settings", "medals"].includes(kind))
        openModal(kind);
    },
    chooseMap(map) {
      if (maps[map]) {
        chosenMap = map;
        renderUI();
      }
    },
    chooseDiff(diff) {
      if ([0, 1, 2].includes(diff)) {
        chosenDiff = diff;
        renderUI();
      }
    },
    newGame: () => reset(),
    resumeSave,
    newRun: () => intro(false),
    back() {
      if (S.over) openModal("finish");
      else closeModal();
    },
    continueGame() {
      paused = false;
      closeModal();
    },
    pauseHelp() {
      paused = false;
      openModal("help");
    },
    endless() {
      S.over = false;
      S.endless = true;
      S.autoTimer = 5;
      closeModal();
      save();
    },
    togglePreference(key) {
      if (!Object.hasOwn(prefs, key)) return;
      prefs[key] = !prefs[key];
      saveMeta();
      if (key === "sound") sound(650, 0.1);
      if (key === "auto" && prefs.auto && !S.running) S.autoTimer = 5;
      renderUI();
    },
    choosePerk,
    pause,
    fullscreen,
    destroy() {
      if (disposed) return;
      save();
      saveMeta();
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      for (const cleanup of cleanups) cleanup();
      for (const timer of timers) clearTimeout(timer);
      for (const id of [
        "towers",
        "enemies",
        "shots",
        "effects",
        "texts",
        "constructionFx",
        "pizzeria",
        "pads",
      ])
        $(id).replaceChildren();
    },
  };
}
