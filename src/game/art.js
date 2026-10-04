// Raster sprite frames: original generated PNGs are preserved unchanged.
// Bounds keep each subject isolated even when an atlas has unequal cells.
const towerFrames = {
  pepper: [157, 13, 284, 325],
  cheese: [620, 44, 280, 278],
  basil: [1075, 16, 344, 321],
  oven: [137, 354, 331, 322],
  soda: [613, 338, 346, 327],
  sniper: [1078, 362, 342, 308],
  farm: [116, 687, 363, 306],
  pizza: [609, 679, 289, 330],
  shop: [1037, 678, 424, 329],
};
const enemyFrames = {
  tomato: [65, 48, 355, 367],
  olive: [482, 56, 290, 365],
  mush: [824, 53, 401, 362],
  healer: [47, 414, 415, 402],
  pepper: [456, 417, 330, 376],
  dough: [846, 493, 373, 320],
  shield: [39, 844, 380, 379],
  boss: [414, 791, 522, 424],
  crumb: [957, 956, 282, 262],
};
const iconNames = [
  "coin",
  "heart",
  "flag",
  "bomb",
  "freeze",
  "trap",
  "rally",
  "repair",
  "i-build",
  "i-intel",
  "i-gear",
  "i-pause",
  "i-play",
  "i-close",
  "i-full",
  "medal",
];
const iconBounds = [
  [63, 68, 286, 294],
  [372, 98, 592, 279],
  [686, 66, 911, 295],
  [988, 45, 1196, 300],
  [48, 353, 306, 602],
  [400, 364, 599, 595],
  [681, 362, 905, 594],
  [980, 386, 1209, 584],
  [57, 659, 295, 892],
  [373, 660, 604, 903],
  [671, 664, 902, 895],
  [1009, 674, 1188, 917],
  [96, 966, 279, 1173],
  [378, 969, 580, 1165],
  [683, 953, 904, 1166],
  [984, 940, 1205, 1191],
];
const ammoNames = [
  "pepper",
  "cheese",
  "basil",
  "oven",
  "soda",
  "sniper",
  "farm",
  "heal",
  "star",
];
const ammoBounds = [
  [125, 141, 349, 357],
  [526, 154, 730, 345],
  [930, 127, 1127, 363],
  [124, 522, 352, 748],
  [524, 528, 733, 739],
  [912, 523, 1146, 738],
  [158, 921, 319, 1117],
  [515, 931, 739, 1111],
  [931, 909, 1129, 1125],
];
const frame = (b) => [b[0] - 3, b[1] - 3, b[2] - b[0] + 6, b[3] - b[1] + 6];
const prepared = new Map();
const bonusFrames = {
  "star-gold": [24, 156, 383, 383],
  "star-blue": [437, 168, 378, 377],
  "i-upgrade": [880, 183, 335, 367],
  "e-moldboss": [0, 646, 454, 487],
  "e-chiliboss": [458, 650, 362, 488],
  "e-general": [824, 647, 430, 491],
};
const decorFrames = {
  "d-daisy": [15, 34, 391, 371],
  "d-pink": [439, 44, 363, 369],
  "d-pot": [864, 44, 370, 377],
  "d-hedge": [5, 501, 405, 309],
  "d-tree": [436, 421, 371, 417],
  "d-bench": [866, 475, 380, 362],
  "d-rocks": [22, 898, 389, 328],
  "d-fence": [439, 890, 382, 332],
  "d-mushrooms": [861, 892, 385, 328],
};
const expansionFrames = {
  "t-garlic": [0, 0, 418, 414],
  "t-chili": [418, 0, 418, 414],
  "t-truffle": [836, 0, 418, 414],
  "e-onion": [0, 414, 418, 412],
  "e-popcorn": [418, 414, 418, 412],
  "e-mint": [836, 414, 418, 412],
  lock: [0, 826, 418, 428],
  reward: [418, 826, 418, 428],
  pulse: [836, 826, 418, 428],
};
const interfaceFrames = Object.fromEntries(
  [
    "ad-video",
    "treasure",
    "coin-global",
    "coin-battle",
    "confirm",
    "i-close",
    "recharge",
    "mode-map",
    "shop-bag",
  ].map((id, i) => [id, [(i % 3) * 418, Math.floor(i / 3) * 418, 418, 418]]),
);
const sceneryFrames = {
  "s-parasol": [124, 113, 213, 266],
  "s-flowers": [490, 157, 282, 231],
  "s-olive": [915, 108, 246, 279],
  "s-lantern": [106, 495, 233, 290],
  "s-stall": [485, 512, 292, 270],
  "s-jars": [918, 530, 260, 263],
  "s-wheels": [107, 920, 257, 226],
  "s-mill": [495, 876, 266, 291],
  "s-cheese-rocks": [896, 916, 282, 239],
};
export function artFor(id) {
  id =
    {
      blizzard: "freeze",
      chili: "rally",
      "i-target": "i-full",
      coin: "coin-global",
      reward: "treasure",
    }[id] || id;
  if (prepared.has(id)) return prepared.get(id);
  if (interfaceFrames[id])
    return {
      url: new URL("../assets/interface-atlas.webp", import.meta.url).href,
      size: [1254, 1254],
      box: interfaceFrames[id],
    };
  if (sceneryFrames[id])
    return {
      url: new URL("../assets/scenery-atlas.webp", import.meta.url).href,
      size: [1254, 1254],
      box: sceneryFrames[id],
    };
  if (expansionFrames[id])
    return {
      url: new URL("../assets/expansion-atlas.webp", import.meta.url).href,
      size: [1254, 1254],
      box: expansionFrames[id],
    };
  if (bonusFrames[id])
    return {
      url: new URL("../assets/bonus-atlas.webp", import.meta.url).href,
      size: [1254, 1254],
      box: bonusFrames[id],
    };
  if (decorFrames[id])
    return {
      url: new URL("../assets/decor-atlas.webp", import.meta.url).href,
      size: [1254, 1254],
      box: decorFrames[id],
    };
  let name =
    id === "pizza" || id === "shop"
      ? id
      : id.startsWith("t-")
        ? id.slice(2)
        : null;
  if (name && towerFrames[name])
    return {
      url: new URL("../assets/towers-atlas.webp", import.meta.url).href,
      size: [1536, 1024],
      box: towerFrames[name],
    };
  if (id.startsWith("e-") && enemyFrames[id.slice(2)])
    return {
      url: new URL("../assets/enemies-atlas.webp", import.meta.url).href,
      size: [1254, 1254],
      box: enemyFrames[id.slice(2)],
    };
  let i = iconNames.indexOf(id);
  if (i >= 0)
    return {
      url: new URL("../assets/icons-atlas.webp", import.meta.url).href,
      size: [1254, 1254],
      box: frame(iconBounds[i]),
    };
  i = id.startsWith("a-") ? ammoNames.indexOf(id.slice(2)) : -1;
  if (i >= 0)
    return {
      url: new URL("../assets/ammo-atlas.webp", import.meta.url).href,
      size: [1254, 1254],
      box: frame(ammoBounds[i]),
    };
  return null;
}
let clipSerial = 0;
function fit(a, w, h) {
  const [x, y, cw, ch] = a.box,
    k = Math.min(w / cw, h / ch);
  return {
    x: (w - cw * k) / 2 - x * k,
    y: (h - ch * k) / 2 - y * k,
    width: a.size[0] * k,
    height: a.size[1] * k,
  };
}
export function rasterIcon(id, cls = "") {
  const a = artFor(id);
  if (!a) return null;
  const c = "spriteClip" + ++clipSerial,
    f = fit(a, 64, 64);
  return `<svg class="rasterSprite ${cls}" viewBox="0 0 64 64" aria-hidden="true"><defs><clipPath id="${c}" clipPathUnits="userSpaceOnUse"><rect width="64" height="64"/></clipPath></defs><g clip-path="url(#${c})"><image href="${a.url}" x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}"/></g></svg>`;
}
export function placeArt(el, id, attrs, parent) {
  const a = artFor(id);
  if (!a) return el("use", { href: "#" + id, ...attrs }, parent);
  // Prepared frames already have independent alpha; they need no per-instance clipping DOM.
  if (a.isolated)
    return el(
      "image",
      {
        href: a.url,
        "data-raster": id,
        preserveAspectRatio: "xMidYMid meet",
        ...attrs,
      },
      parent,
    );
  const { x = 0, y = 0, width = 64, height = 64, ...rest } = attrs,
    c = "spriteClip" + ++clipSerial,
    n = el(
      "g",
      { ...rest, transform: `translate(${x} ${y})`, "data-raster": id },
      parent,
    ),
    d = el("defs", {}, n),
    clip = el("clipPath", { id: c, clipPathUnits: "userSpaceOnUse" }, d);
  el("rect", { x: 0, y: 0, width, height }, clip);
  const clipped = el("g", { "clip-path": `url(#${c})` }, n);
  el("image", { href: a.url, ...fit(a, width, height) }, clipped);
  return n;
}

// Convert atlas frames to independent textures before creating any scene nodes.
// A cropped bitmap has its own alpha and bounds, so filters and transforms never see neighboring cells.
let preparing;
export function prepareRasterImages() {
  if (!preparing)
    preparing = prepareFrames().catch((error) => {
      preparing = null;
      throw error;
    });
  return preparing;
}
async function prepareFrames() {
  const images = new Map(),
    ids = [
      ...new Set([
        ...Object.keys(towerFrames).map((n) =>
          n === "pizza" || n === "shop" ? n : "t-" + n,
        ),
        ...Object.keys(enemyFrames).map((n) => "e-" + n),
        ...iconNames,
        ...ammoNames.map((n) => "a-" + n),
        ...Object.keys(bonusFrames),
        ...Object.keys(expansionFrames),
        ...Object.keys(decorFrames),
        ...Object.keys(interfaceFrames),
        ...Object.keys(sceneryFrames),
      ]),
    ];
  const load = (url) => {
    if (!images.has(url))
      images.set(
        url,
        new Promise((resolve, reject) => {
          let im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = url;
        }),
      );
    return images.get(url);
  };
  await Promise.all(
    ids.map(async (id) => {
      let a = artFor(id),
        im = await load(a.url),
        [x, y, w, h] = a.box,
        canvas = document.createElement("canvas");
      const scale = Math.min(1, 256 / Math.max(w, h));
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(im, x, y, w, h, 0, 0, canvas.width, canvas.height);
      const url = canvas.toBlob
        ? URL.createObjectURL(
            await new Promise((resolve) => canvas.toBlob(resolve, "image/png")),
          )
        : canvas.toDataURL("image/png");
      prepared.set(id, {
        url,
        size: [canvas.width, canvas.height],
        box: [0, 0, canvas.width, canvas.height],
        isolated: true,
      });
    }),
  );
}
