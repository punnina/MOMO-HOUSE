import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manuscript = await readFile(resolve(root, "editions/text/index.html"), "utf8");
const housePath = resolve(root, "index.html");
let house = await readFile(housePath, "utf8");

const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const startMarker = "<!-- HOUSE_MANUSCRIPT_START -->";
const endMarker = "<!-- HOUSE_MANUSCRIPT_END -->";

function sectionFor(roomNumber) {
  const match = manuscript.match(new RegExp(`<section class="room" id="room${roomNumber}">([\\s\\S]*?)</section>`));
  if (!match) throw new Error(`Canonical manuscript is missing Room ${roomNumber}`);
  return match[1];
}

function capture(html, expression, label) {
  const match = html.match(expression);
  if (!match) throw new Error(`Could not find ${label}`);
  return match[1].trim();
}

const rooms = [];
for (let number = 3; number <= 12; number++) {
  const source = sectionFor(number);
  const title = capture(source, /<h2>([\s\S]*?)<\/h2>/, `Room ${number} title`);
  const subtitle = capture(source, /<div class="sub">([\s\S]*?)<\/div>/, `Room ${number} subtitle`);
  const paragraphs = [...source.matchAll(/<p(?: class="([^"]*)")?>([\s\S]*?)<\/p>/g)]
    .map(([, classes = "", body], index) => `<p${classes || index === 0 ? ` class="${classes || "first"}"` : ""}>${body.trim()}</p>`)
    .join("\n    ");
  rooms.push(`<div class="scene-text low" id="t-room${number}">
  <div class="center-col">
    <div class="kicker">Room ${roman[number]}</div>
    <div class="whisper">${subtitle}</div>
  </div>
</div>

<div class="reader" id="r-room${number}">
  <div class="page"><div class="flow">
    <h2>${title}</h2>
    <div class="sub">${subtitle}</div>
    ${paragraphs}
  </div></div>
</div>`);
}

const replacement = `${startMarker}\n${rooms.join("\n\n")}\n${endMarker}`;
const block = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
if (!block.test(house)) throw new Error("House manuscript markers are missing");
house = house.replace(block, replacement);
await writeFile(housePath, house);

console.log("Rooms III–XII are synchronized from the canonical manuscript.");
