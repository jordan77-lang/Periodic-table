const fs = require("fs");
const path = require("path");

const sourcePath = path.join(__dirname, "source.html");
const html = fs.readFileSync(sourcePath, "utf8");

const CATEGORY_LABELS = {
  alkali: "Alkali metal",
  alkaline: "Alkaline earth metal",
  transition: "Transition metal",
  post: "Post-transition metal",
  metalloid: "Metalloid",
  nonmetal: "Nonmetal",
  halogen: "Halogen",
  noble: "Noble gas",
  lanthanide: "Lanthanide",
  actinide: "Actinide",
};

const CATEGORY_COLORS = {
  alkali: "#fdd9a6",
  alkaline: "#fdecc2",
  transition: "#cbe5ff",
  post: "#dcecff",
  metalloid: "#e6d5f5",
  nonmetal: "#c8f7d8",
  halogen: "#ffd8f2",
  noble: "#d6f3ff",
  lanthanide: "#ffeac7",
  actinide: "#ffe0d4",
};

function style(props) {
  return Object.entries(props)
    .map(([key, value]) => {
      const cssKey = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
      return `${cssKey}: ${value}`;
    })
    .join("; ");
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "").replace(/&shy;/g, "");
}

function parseTitle(title) {
  const parts = title.split("\\n");
  return {
    name: parts[0],
    number: parts[1].replace("Atomic Number: ", ""),
    mass: parts[2].replace("Atomic Mass: ", ""),
  };
}

function parseElementBlock(block) {
  if (block.includes('class="pt-element blank"')) {
    const styleMatch = block.match(/style="([^"]+)"/);
    return { blank: true, gridStyle: styleMatch ? styleMatch[1] : "" };
  }

  const attrsMatch = block.match(/^<div class="pt-element"([^>]*)>/);
  const attrs = attrsMatch ? attrsMatch[1] : "";
  const typeMatch = attrs.match(/data-type="([^"]+)"/);
  const titleMatch = attrs.match(/title="([^"]+)"/);
  const styleMatch = attrs.match(/style="([^"]+)"/);
  const number = stripTags(block.match(/<div class="number">([^<]*)<\/div>/)?.[1] || "");
  const symbol = stripTags(block.match(/<div class="symbol">([^<]*)<\/div>/)?.[1] || "");
  const name = stripTags(block.match(/<div class="name">([\s\S]*?)<\/div>/)?.[1] || "");
  const mass = stripTags(block.match(/<div class="mass">([^<]*)<\/div>/)?.[1] || "");
  const title = titleMatch ? parseTitle(titleMatch[1]) : { name, number, mass };
  const type = typeMatch ? typeMatch[1] : "";
  const category = CATEGORY_LABELS[type] || type;

  return {
    blank: false,
    gridStyle: styleMatch ? styleMatch[1] : "",
    type,
    category,
    number: title.number || number,
    symbol,
    name: title.name || name,
    mass: title.mass || mass,
    ariaLabel: `${title.name || name}, symbol ${symbol}, atomic number ${title.number || number}, atomic mass ${title.mass || mass}, ${category}`,
  };
}

const wrapperMatch = html.match(/<div class="pt-wrapper">([\s\S]*?)<\/div>\s*<\/body>/);
if (!wrapperMatch) {
  throw new Error("Could not find pt-wrapper content in index.html");
}

const blocks = wrapperMatch[1]
  .split(/(?=<div class="pt-element)/)
  .map((chunk) => chunk.trim())
  .filter((chunk) => chunk.startsWith('<div class="pt-element'));

const elements = [];
const gridCells = blocks.map((block) => {
  const fullBlock = block.endsWith("</div>") ? block : `${block}</div>`;
  const parsed = parseElementBlock(fullBlock);
  if (!parsed.blank) {
    elements.push(parsed);
  }
  return parsed;
});

elements.sort((a, b) => Number(a.number) - Number(b.number));

const elementButtonStyle = (cell) =>
  style({
    position: "relative",
    padding: "7px 4px",
    textAlign: "center",
    border: "1px solid #767676",
    background: CATEGORY_COLORS[cell.type] || "#f4f4f4",
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "Arial, sans-serif",
    color: "#1a1a1a",
    width: "100%",
    boxSizing: "border-box",
    lineHeight: "1.2",
    ...(cell.gridStyle ? parseInlineGridStyle(cell.gridStyle) : {}),
  });

function parseInlineGridStyle(gridStyle) {
  const props = {};
  gridStyle.split(";").forEach((rule) => {
    const [rawKey, rawValue] = rule.split(":").map((part) => part.trim());
    if (!rawKey || !rawValue) {
      return;
    }
    if (rawKey === "grid-column") {
      props.gridColumn = rawValue;
    }
  });
  return props;
}

function gridStyleAttr(cell) {
  return cell.gridStyle ? ` style="${cell.gridStyle}"` : "";
}

function renderGroupNumbersRow() {
  return `<div class="pt-group-row" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => {
    const group = index + 1;
    return `<div class="pt-group-num">${group}</div>`;
  }).join("")}</div>`;
}

function renderStudentGridCell(cell) {
  if (cell.blank) {
    return `<div class="pt-element blank"${gridStyleAttr(cell)} aria-hidden="true"></div>`;
  }

  return `<button type="button" class="pt-element" data-type="${cell.type}" data-category="${cell.category}"${gridStyleAttr(cell)} aria-label="${cell.ariaLabel}" aria-controls="pt-detail-content">
<span class="number" aria-hidden="true">${cell.number}</span>
<span class="symbol" aria-hidden="true">${cell.symbol}</span>
<span class="name" aria-hidden="true">${cell.name}</span>
<span class="mass" aria-hidden="true">${cell.mass}</span>
</button>`;
}

function renderHostedGridCell(cell) {
  if (cell.blank) {
    return `<div class="pt-a11y-blank" aria-hidden="true"${gridStyleAttr(cell)}></div>`;
  }

  return `<button type="button" class="pt-a11y-element" data-type="${cell.type}"${gridStyleAttr(cell)} aria-label="${cell.ariaLabel}">
<span class="pt-a11y-number" aria-hidden="true">${cell.number}</span>
<span class="pt-a11y-symbol" aria-hidden="true">${cell.symbol}</span>
<span class="pt-a11y-name" aria-hidden="true">${cell.name}</span>
<span class="pt-a11y-mass" aria-hidden="true">${cell.mass}</span>
</button>`;
}

function renderHostedLegendItems() {
  return Object.entries(CATEGORY_LABELS)
    .map(
      ([key, label]) =>
        `<li><span class="pt-a11y-legend-swatch" data-type="${key}" aria-hidden="true"></span><span>${label}</span></li>`
    )
    .join("\n");
}

function renderHostedTableRows() {
  return elements
    .map(
      (el) => `<tr>
<th scope="row">${el.number}</th>
<td>${el.symbol}</td>
<td>${el.name}</td>
<td>${el.mass}</td>
<td>${el.category}</td>
</tr>`
    )
    .join("\n");
}

const HOSTED_URL = "https://jordan77-lang.github.io/Periodic-table/";
const FULL_VERSION_URL = "https://jordan77-lang.github.io/Periodic-table/hosted.html";
const COMPACT_EMBED_URL = `${HOSTED_URL}?embed=1&size=compact`;
const LARGE_TABLE_URL = `${HOSTED_URL}?size=large`;

const studentDetailScript = `
(function () {
  var params = new URLSearchParams(location.search);
  var size = params.get("size");
  if (!size && params.get("embed") === "1") {
    size = "compact";
  }
  if (!size) {
    size = "medium";
  }
  document.body.classList.add("pt-size-" + size);
  if (params.get("embed") === "1") {
    document.body.classList.add("pt-embed");
  }

  var wrapper = document.querySelector(".pt-wrapper");
  var detailContent = document.getElementById("pt-detail-content");
  if (!wrapper || !detailContent) {
    return;
  }

  var tiles = wrapper.querySelectorAll(".pt-element:not(.blank)");
  var selectedTile = null;

  function updateDetailPanel(tile) {
    var number = tile.querySelector(".number").textContent;
    var symbol = tile.querySelector(".symbol").textContent;
    var name = tile.querySelector(".name").textContent;
    var mass = tile.querySelector(".mass").textContent;
    var category = tile.getAttribute("data-category") || "";

    detailContent.innerHTML =
      '<p class="pt-detail-symbol">' + symbol + "</p>" +
      "<h3 class=\\"pt-detail-name\\">" + name + "</h3>" +
      '<dl class="pt-detail-list">' +
      "<dt>Atomic number</dt><dd>" + number + "</dd>" +
      "<dt>Symbol</dt><dd>" + symbol + "</dd>" +
      "<dt>Atomic mass (u)</dt><dd>" + mass + "</dd>" +
      "<dt>Category</dt><dd>" + category + "</dd>" +
      "</dl>";
  }

  function selectTile(tile) {
    if (selectedTile) {
      selectedTile.classList.remove("is-selected");
    }
    selectedTile = tile;
    tile.classList.add("is-selected");
    updateDetailPanel(tile);
  }

  tiles.forEach(function (tile) {
    tile.addEventListener("click", function () {
      selectTile(tile);
    });
    tile.addEventListener("focus", function () {
      selectTile(tile);
    });
  });
})();`;

const hostedTileScript = `
(function () {
  var wrapper = document.querySelector(".pt-a11y-grid");
  if (!wrapper) {
    return;
  }

  var tiles = wrapper.querySelectorAll(".pt-a11y-element");
  var activeTile = null;

  function setActiveTile(tile) {
    activeTile = tile || null;
    tiles.forEach(function (item) {
      item.style.pointerEvents = !tile || item === tile ? "auto" : "none";
    });
  }

  tiles.forEach(function (tile) {
    tile.addEventListener("mouseenter", function () { setActiveTile(tile); });
    tile.addEventListener("focus", function () { setActiveTile(tile); });
  });

  wrapper.addEventListener("mouseleave", function () { setActiveTile(null); });
  wrapper.addEventListener("focusout", function (event) {
    if (!wrapper.contains(event.relatedTarget)) {
      setActiveTile(null);
    }
  });
})();`;

const tilePointerStyles = `
  .pt-wrapper:has(.pt-element.is-expanded) .pt-element:not(.blank):not(.is-expanded),
  .pt-wrapper:has(.pt-element:not(.blank):hover) .pt-element:not(.blank):not(:hover),
  .pt-wrapper:has(.pt-element:not(.blank):focus-visible) .pt-element:not(.blank):not(:focus-visible),
  .pt-a11y-grid:has(.pt-a11y-element.is-expanded) .pt-a11y-element:not(.is-expanded),
  .pt-a11y-grid:has(.pt-a11y-element:hover) .pt-a11y-element:not(:hover),
  .pt-a11y-grid:has(.pt-a11y-element:focus-visible) .pt-a11y-element:not(:focus-visible) {
    pointer-events: none;
  }`;

const hostedStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 12px;
    background: #fff;
    font-family: Arial, sans-serif;
    color: #1a1a1a;
  }
  .pt-a11y-root {
    max-width: 1100px;
    margin: 0 auto;
  }
  .pt-a11y-root h2,
  .pt-a11y-root h3 {
    font-family: "Segoe UI", Arial, sans-serif;
  }
  .pt-a11y-root h2 {
    text-align: center;
    margin: 0 0 8px;
    font-size: 1.5rem;
  }
  .pt-a11y-intro {
    text-align: center;
    margin: 0 auto 20px;
    max-width: 760px;
    font-size: 0.95rem;
    color: #444;
  }
  .pt-a11y-skip {
    display: inline-block;
    margin-bottom: 12px;
    padding: 8px 12px;
    background: #003366;
    color: #fff;
    text-decoration: none;
    border-radius: 4px;
  }
  .pt-a11y-skip:focus {
    outline: 3px solid #003366;
    outline-offset: 2px;
  }
  .pt-a11y-legend {
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    justify-content: center;
    font-size: 0.85rem;
  }
  .pt-a11y-legend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pt-a11y-legend-swatch {
    width: 14px;
    height: 14px;
    border: 1px solid #888;
    border-radius: 2px;
    display: inline-block;
  }
  .pt-a11y-grid {
    display: grid;
    grid-template-columns: repeat(18, minmax(44px, 1fr));
    gap: 4px;
    padding: 8px 0 24px;
    margin-bottom: 24px;
    overflow-x: auto;
  }
  .pt-a11y-element {
    position: relative;
    padding: 7px 4px;
    text-align: center;
    border: 1px solid #767676;
    background: #f4f4f4;
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
    color: inherit;
    width: 100%;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }
  .pt-a11y-element:hover,
  .pt-a11y-element:focus-visible {
    transform: scale(2.8);
    z-index: 100;
    box-shadow: 0 10px 14px rgba(0, 0, 0, 0.25);
    outline: 3px solid #003366;
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .pt-a11y-element { transition: none; }
    .pt-a11y-element:hover,
    .pt-a11y-element:focus-visible { transform: none; }
  }
  .pt-a11y-number { display: block; font-size: 0.65rem; font-weight: 600; }
  .pt-a11y-symbol { display: block; font-size: 1.25rem; font-weight: 700; margin: 2px 0; }
  .pt-a11y-name {
    display: block;
    font-size: 0.4rem;
    line-height: 1.15;
    text-transform: uppercase;
    letter-spacing: 0.035em;
  }
  .pt-a11y-mass { display: block; font-size: 0.5rem; color: #333; margin-top: 4px; font-weight: 700; }
  .pt-a11y-blank { border: none; background: transparent; pointer-events: none; min-height: 52px; }
  .pt-a11y-element[data-type="alkali"], .pt-a11y-legend-swatch[data-type="alkali"] { background: #fdd9a6; }
  .pt-a11y-element[data-type="alkaline"], .pt-a11y-legend-swatch[data-type="alkaline"] { background: #fdecc2; }
  .pt-a11y-element[data-type="transition"], .pt-a11y-legend-swatch[data-type="transition"] { background: #cbe5ff; }
  .pt-a11y-element[data-type="post"], .pt-a11y-legend-swatch[data-type="post"] { background: #dcecff; }
  .pt-a11y-element[data-type="metalloid"], .pt-a11y-legend-swatch[data-type="metalloid"] { background: #e6d5f5; }
  .pt-a11y-element[data-type="nonmetal"], .pt-a11y-legend-swatch[data-type="nonmetal"] { background: #c8f7d8; }
  .pt-a11y-element[data-type="halogen"], .pt-a11y-legend-swatch[data-type="halogen"] { background: #ffd8f2; }
  .pt-a11y-element[data-type="noble"], .pt-a11y-legend-swatch[data-type="noble"] { background: #d6f3ff; }
  .pt-a11y-element[data-type="lanthanide"], .pt-a11y-legend-swatch[data-type="lanthanide"] { background: #ffeac7; }
  .pt-a11y-element[data-type="actinide"], .pt-a11y-legend-swatch[data-type="actinide"] { background: #ffe0d4; }
  .pt-a11y-table-wrap { overflow-x: auto; }
  .pt-a11y-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .pt-a11y-table caption { caption-side: top; text-align: left; font-weight: 700; margin-bottom: 8px; }
  .pt-a11y-table th, .pt-a11y-table td { border: 1px solid #767676; padding: 8px 10px; text-align: left; }
  .pt-a11y-table thead th { background: #eef3f8; }
  .pt-a11y-table tbody tr:nth-child(even) { background: #fafafa; }
  ${tilePointerStyles}
`;

const hostedBody = `<section class="pt-a11y-root" aria-labelledby="pt-a11y-heading">
<a class="pt-a11y-skip" href="#pt-a11y-table">Skip to element reference table</a>
<h2 id="pt-a11y-heading">Accessible Periodic Table of the Elements</h2>
<p class="pt-a11y-intro" id="pt-a11y-intro">Each tile is a button. Use Tab to move between elements; focused tiles enlarge with a visible outline. Screen reader users can browse the full element list in the reference table below.</p>
<h3>Element category legend</h3>
<ul class="pt-a11y-legend" aria-label="Element categories by color">
${renderHostedLegendItems()}
</ul>
<h3>Periodic table layout</h3>
<div class="pt-a11y-grid" role="group" aria-describedby="pt-a11y-intro">
${gridCells.map(renderHostedGridCell).join("\n")}
</div>
<div class="pt-a11y-table-wrap" id="pt-a11y-table">
<h3 id="pt-a11y-table-heading">Element reference table</h3>
<table class="pt-a11y-table" aria-labelledby="pt-a11y-table-heading">
<caption>All elements sorted by atomic number</caption>
<thead>
<tr>
<th scope="col">Atomic number</th>
<th scope="col">Symbol</th>
<th scope="col">Name</th>
<th scope="col">Atomic mass (u)</th>
<th scope="col">Category</th>
</tr>
</thead>
<tbody>
${renderHostedTableRows()}
</tbody>
</table>
</div>
</section>`;

const hostedPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Accessible Periodic Table</title>
  <style>${hostedStyles}
  </style>
</head>
<body>
${hostedBody}
<script>${hostedTileScript}</script>
</body>
</html>`;

const studentStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 16px;
    background: #fff;
  }
  body.pt-embed {
    padding: 4px 8px;
  }
  .pt-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .pt-embed-bar {
    display: none;
  }
  .pt-layout {
    display: flex;
    gap: 10px;
    max-width: 980px;
    margin: 0 auto;
    align-items: flex-start;
    font-family: Arial, sans-serif;
  }
  .pt-detail-panel {
    flex: 0 0 150px;
    border: 1px solid #767676;
    border-radius: 4px;
    padding: 10px;
    background: #f8f9fa;
    color: #1a1a1a;
  }
  .pt-detail-heading {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 8px;
    color: #444;
  }
  .pt-detail-symbol {
    font-size: 2.1rem;
    font-weight: 700;
    line-height: 1;
    margin: 0 0 4px;
  }
  .pt-detail-name {
    font-size: 0.92rem;
    font-weight: 700;
    margin: 0 0 10px;
    line-height: 1.2;
  }
  .pt-detail-list {
    margin: 0;
    font-size: 0.76rem;
    line-height: 1.4;
  }
  .pt-detail-list dt {
    font-weight: 700;
    margin-top: 6px;
  }
  .pt-detail-list dd {
    margin: 0;
  }
  .pt-detail-empty {
    font-size: 0.78rem;
    color: #555;
    margin: 0;
    line-height: 1.35;
  }
  .pt-wrapper {
    display: grid;
    grid-template-columns: repeat(18, minmax(40px, 1fr));
    gap: 3px;
    flex: 1 1 auto;
    min-width: 0;
    padding: 2px 0 4px;
  }
  .pt-group-row {
    display: contents;
  }
  .pt-group-num {
    text-align: center;
    font-weight: 700;
    font-size: 0.78rem;
    color: #444;
    padding: 4px 0 2px;
    pointer-events: none;
  }
  button.pt-element {
    position: relative;
    padding: 6px 3px;
    text-align: center;
    border: 1px solid #b4b4b4;
    background: #f4f4f4;
    cursor: pointer;
    border-radius: 4px;
    font: inherit;
    color: inherit;
    width: 100%;
    display: block;
    min-height: 36px;
  }
  button.pt-element.is-selected,
  button.pt-element:focus-visible {
    outline: 3px solid #003366;
    outline-offset: 1px;
    z-index: 2;
  }
  button.pt-element:hover {
    outline: 2px solid #003366;
    outline-offset: 1px;
  }
  button.pt-element .number { display: block; font-size: 0.55rem; font-weight: 600; }
  button.pt-element .symbol { display: block; font-size: 0.95rem; font-weight: 700; margin: 2px 0; }
  button.pt-element .name {
    display: block;
    font-size: 0.34rem;
    line-height: 1.15;
    text-transform: uppercase;
    letter-spacing: 0.035em;
  }
  button.pt-element .mass { display: block; font-size: 0.38rem; color: #333; margin-top: 2px; font-weight: 700; }
  .pt-element.blank { border: none; background: transparent; cursor: default; pointer-events: none; }
  button.pt-element[data-type="alkali"] { background: #fdd9a6; }
  button.pt-element[data-type="alkaline"] { background: #fdecc2; }
  button.pt-element[data-type="transition"] { background: #cbe5ff; }
  button.pt-element[data-type="post"] { background: #dcecff; }
  button.pt-element[data-type="metalloid"] { background: #e6d5f5; }
  button.pt-element[data-type="nonmetal"] { background: #c8f7d8; }
  button.pt-element[data-type="halogen"] { background: #ffd8f2; }
  button.pt-element[data-type="noble"] { background: #d6f3ff; }
  button.pt-element[data-type="lanthanide"] { background: #ffeac7; }
  button.pt-element[data-type="actinide"] { background: #ffe0d4; }
  body.pt-size-compact .pt-layout { max-width: 980px; }
  body.pt-size-compact .pt-detail-panel { flex-basis: 130px; padding: 8px; }
  body.pt-size-compact .pt-detail-symbol { font-size: 1.75rem; }
  body.pt-size-compact .pt-detail-name { font-size: 0.82rem; }
  body.pt-size-compact .pt-detail-list { font-size: 0.7rem; }
  body.pt-size-compact .pt-wrapper {
    grid-template-columns: repeat(18, minmax(34px, 1fr));
    gap: 2px;
  }
  body.pt-size-compact button.pt-element { padding: 4px 2px; min-height: 34px; }
  body.pt-size-compact button.pt-element .symbol { font-size: 0.82rem; }
  body.pt-size-large .pt-layout { max-width: 1100px; }
  body.pt-size-large .pt-detail-panel { flex-basis: 180px; }
  body.pt-size-large .pt-wrapper {
    grid-template-columns: repeat(18, minmax(46px, 1fr));
    gap: 4px;
  }
  body.pt-size-large button.pt-element .symbol { font-size: 1.15rem; }
`;

const studentPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Periodic Table</title>
  <style>${studentStyles}
  </style>
</head>
<body>
<p class="pt-embed-bar">
  <a href="${LARGE_TABLE_URL}" target="_blank" rel="noopener noreferrer">Open larger periodic table</a>
  &nbsp;|&nbsp;
  <a href="${FULL_VERSION_URL}" target="_blank" rel="noopener noreferrer">Accessible version with full element list</a>
</p>
<main aria-labelledby="pt-page-title">
<h1 id="pt-page-title" class="pt-sr-only">Periodic table of the elements</h1>
<p class="pt-sr-only" id="pt-table-help">Interactive periodic table. Tab between element buttons in the grid. Element details appear in the panel to the left and are announced by your screen reader. Group numbers 1 through 18 are shown above the table.</p>
<div class="pt-layout">
<aside class="pt-detail-panel" id="pt-detail-panel" aria-live="polite" aria-atomic="true" aria-labelledby="pt-detail-heading">
<h2 id="pt-detail-heading" class="pt-detail-heading">Element details</h2>
<div id="pt-detail-content">
<p class="pt-detail-empty">Tab to or click an element in the table.</p>
</div>
</aside>
<div class="pt-wrapper" role="group" aria-labelledby="pt-page-title" aria-describedby="pt-table-help">
${renderGroupNumbersRow()}
${gridCells.map(renderStudentGridCell).join("\n")}
</div>
</div>
</main>
<script>${studentDetailScript}</script>
</body>
</html>`;

const iframeSnippet = `<!--
  Canvas iframe embed

  RESIZING IN CANVAS:
  Canvas does not provide drag-to-resize handles for iframes in the rich text
  editor. To adjust size, edit the HTML and change:
    1. height="..." on the iframe (vertical space)
    2. max-width in the iframe style (horizontal space)
    3. size= in the iframe src URL: compact | medium | large

  PRESETS (copy one block):

  COMPACT (default — best for assignments):
    src: ${COMPACT_EMBED_URL}
    height: 580, max-width: 100%

  MEDIUM:
    src: ${HOSTED_URL}?embed=1&size=medium
    height: 780, max-width: 100%

  LARGE:
    src: ${LARGE_TABLE_URL}
    height: 1000, max-width: 100%
-->
<p>
  <a href="${LARGE_TABLE_URL}" target="_blank" rel="noopener noreferrer">Open larger periodic table in a new tab</a>
  &nbsp;|&nbsp;
  <a href="${FULL_VERSION_URL}" target="_blank" rel="noopener noreferrer">Accessible version with element list</a>
  &nbsp;|&nbsp;
  <span style="font-size: 0.9rem; color: #444;">Click or tab an element to view details on the left</span>
</p>
<iframe
  src="${COMPACT_EMBED_URL}"
  title="Periodic table of the elements with group numbers 1 through 18"
  width="100%"
  height="560"
  style="border: 1px solid #767676; border-radius: 4px; max-width: 980px; width: 100%; display: block; margin: 0 auto;"
  loading="lazy"
></iframe>`;

function renderGridCell(cell) {
  if (cell.blank) {
    return `<div aria-hidden="true" style="${style({
      border: "none",
      background: "transparent",
      pointerEvents: "none",
      minHeight: "52px",
      ...parseInlineGridStyle(cell.gridStyle),
    })}"></div>`;
  }

  return `<button type="button" aria-label="${cell.ariaLabel}" style="${elementButtonStyle(cell)}">
<span style="${style({ display: "block", fontSize: "0.65rem", fontWeight: "600" })}" aria-hidden="true">${cell.number}</span>
<span style="${style({ display: "block", fontSize: "1.25rem", fontWeight: "700", margin: "2px 0" })}" aria-hidden="true">${cell.symbol}</span>
<span style="${style({ display: "block", fontSize: "0.4rem", lineHeight: "1.15", textTransform: "uppercase", letterSpacing: "0.035em" })}" aria-hidden="true">${cell.name}</span>
<span style="${style({ display: "block", fontSize: "0.5rem", color: "#333", marginTop: "4px", fontWeight: "700" })}" aria-hidden="true">${cell.mass}</span>
</button>`;
}

function renderTableRows() {
  return elements
    .map(
      (el, index) => `<tr style="${style({ background: index % 2 === 1 ? "#fafafa" : "#fff" })}">
<th scope="row" style="${style({ border: "1px solid #767676", padding: "8px 10px", textAlign: "left", background: "#eef3f8" })}">${el.number}</th>
<td style="${style({ border: "1px solid #767676", padding: "8px 10px", textAlign: "left" })}">${el.symbol}</td>
<td style="${style({ border: "1px solid #767676", padding: "8px 10px", textAlign: "left" })}">${el.name}</td>
<td style="${style({ border: "1px solid #767676", padding: "8px 10px", textAlign: "left" })}">${el.mass}</td>
<td style="${style({ border: "1px solid #767676", padding: "8px 10px", textAlign: "left" })}">${el.category}</td>
</tr>`
    )
    .join("\n");
}

function renderLegendItems() {
  return Object.entries(CATEGORY_LABELS)
    .map(
      ([key, label]) =>
        `<li style="${style({ display: "inline-flex", alignItems: "center", margin: "4px 8px" })}"><span aria-hidden="true" style="${style({
          width: "14px",
          height: "14px",
          border: "1px solid #888",
          borderRadius: "2px",
          display: "inline-block",
          marginRight: "6px",
          background: CATEGORY_COLORS[key],
        })}"></span><span>${label}</span></li>`
    )
    .join("\n");
}

const embedContent = `<!--
  Canvas embedding instructions (Pages and New Quizzes):
  1. Edit the page or quiz question and open the HTML editor (</>).
  2. Paste everything from the opening <div id="pt-a11y-root"> through its closing </div>.
     Do not include <!DOCTYPE>, <html>, <head>, <body>, or <style> tags.
  3. Canvas removes <style> blocks, so this version uses inline styles only.
  4. Save and preview.
-->
<div id="pt-a11y-root" aria-labelledby="pt-a11y-heading" style="${style({
  maxWidth: "1100px",
  margin: "24px auto",
  fontFamily: "Arial, sans-serif",
  color: "#1a1a1a",
})}">
<a href="#pt-a11y-table" style="${style({
  display: "inline-block",
  marginBottom: "12px",
  padding: "8px 12px",
  background: "#003366",
  color: "#fff",
  textDecoration: "none",
  borderRadius: "4px",
})}">Skip to element reference table</a>

<h2 id="pt-a11y-heading" style="${style({
  textAlign: "center",
  margin: "0 0 8px",
  fontSize: "1.5rem",
  fontFamily: "Segoe UI, Arial, sans-serif",
})}">Accessible Periodic Table of the Elements</h2>

<p id="pt-a11y-intro" style="${style({
  textAlign: "center",
  margin: "0 auto 20px",
  maxWidth: "760px",
  fontSize: "0.95rem",
  color: "#444",
})}">Each tile is a button. Use Tab to move between elements. Screen reader users can browse the full element list in the reference table below.</p>

<h3 style="${style({
  fontSize: "1rem",
  margin: "0 0 8px",
  fontFamily: "Segoe UI, Arial, sans-serif",
})}">Element category legend</h3>
<ul aria-label="Element categories by color" style="${style({
  margin: "0 0 16px",
  padding: "0",
  listStyle: "none",
  textAlign: "center",
  fontSize: "0.85rem",
})}">
${renderLegendItems()}
</ul>

<h3 style="${style({
  fontSize: "1rem",
  margin: "0 0 8px",
  fontFamily: "Segoe UI, Arial, sans-serif",
})}">Periodic table layout</h3>
<div role="group" aria-describedby="pt-a11y-intro" style="${style({
  display: "grid",
  gridTemplateColumns: "repeat(18, minmax(44px, 1fr))",
  gap: "4px",
  padding: "16px 8px",
  marginBottom: "28px",
  maxWidth: "100%",
  overflowX: "auto",
})}">
${gridCells.map(renderGridCell).join("\n")}
</div>

<div id="pt-a11y-table" style="${style({ overflowX: "auto" })}">
<h3 id="pt-a11y-table-heading" style="${style({
  fontSize: "1rem",
  margin: "0 0 8px",
  fontFamily: "Segoe UI, Arial, sans-serif",
})}">Element reference table</h3>
<table aria-labelledby="pt-a11y-table-heading" style="${style({
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.9rem",
})}">
<caption style="${style({ captionSide: "top", textAlign: "left", fontWeight: "700", marginBottom: "8px" })}">All elements sorted by atomic number</caption>
<thead>
<tr>
<th scope="col" style="${style({ border: "1px solid #767676", padding: "8px 10px", textAlign: "left", background: "#eef3f8" })}">Atomic number</th>
<th scope="col" style="${style({ border: "1px solid #767676", padding: "8px 10px", textAlign: "left", background: "#eef3f8" })}">Symbol</th>
<th scope="col" style="${style({ border: "1px solid #767676", padding: "8px 10px", textAlign: "left", background: "#eef3f8" })}">Name</th>
<th scope="col" style="${style({ border: "1px solid #767676", padding: "8px 10px", textAlign: "left", background: "#eef3f8" })}">Atomic mass (u)</th>
<th scope="col" style="${style({ border: "1px solid #767676", padding: "8px 10px", textAlign: "left", background: "#eef3f8" })}">Category</th>
</tr>
</thead>
<tbody>
${renderTableRows()}
</tbody>
</table>
</div>
</div>`;

const fullPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Accessible Periodic Table (Canvas Embed)</title>
  <style>
    body { margin: 0; padding: 16px; background: #fff; }
    #pt-a11y-root button:focus-visible {
      outline: 3px solid #003366;
      outline-offset: 2px;
      transform: scale(2.2);
      z-index: 10;
      position: relative;
    }
    @media (prefers-reduced-motion: reduce) {
      #pt-a11y-root button:focus-visible { transform: none; }
    }
  </style>
</head>
<body>
${embedContent}
</body>
</html>`;

const embedOnlyPath = path.join(__dirname, "canvas-embed-accessible.html");
const previewPath = path.join(__dirname, "index-accessible.html");
const hostedPath = path.join(__dirname, "hosted.html");
const studentPath = path.join(__dirname, "index.html");
const iframeSnippetPath = path.join(__dirname, "canvas-iframe-embed.html");

fs.writeFileSync(embedOnlyPath, embedContent, "utf8");
fs.writeFileSync(previewPath, fullPage, "utf8");
fs.writeFileSync(hostedPath, hostedPage, "utf8");
fs.writeFileSync(studentPath, studentPage, "utf8");
fs.writeFileSync(iframeSnippetPath, iframeSnippet, "utf8");

console.log(`Generated ${elements.length} elements`);
console.log(`Wrote ${studentPath} (GitHub Pages / student view)`);
console.log(`Wrote ${embedOnlyPath}`);
console.log(`Wrote ${previewPath}`);
console.log(`Wrote ${hostedPath}`);
console.log(`Wrote ${iframeSnippetPath}`);
console.log(`Student URL: ${HOSTED_URL}`);
console.log(`Compact embed URL: ${COMPACT_EMBED_URL}`);
console.log(`Large table URL: ${LARGE_TABLE_URL}`);
console.log(`Full accessible URL: ${FULL_VERSION_URL}`);
