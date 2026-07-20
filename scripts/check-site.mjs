import { readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const book = JSON.parse(await readFile(resolve(root, "content/book.json"), "utf8"));
const pages = [
  "index.html",
  "editions/text/index.html",
  "editions/living/index.html",
  "experiences/quiet/index.html"
];

const expectedExperienceLinks = {
  "index.html": ["./", "editions/text/", "editions/living/", "experiences/quiet/"],
  "editions/text/index.html": ["../../", "./", "../living/", "../../experiences/quiet/"],
  "editions/living/index.html": ["../../", "../text/", "./", "../../experiences/quiet/"],
  "experiences/quiet/index.html": ["../../", "../../editions/text/", "../../editions/living/", "./"]
};

const htmlByPage = new Map();
for (const page of pages) {
  const html = await readFile(resolve(root, page), "utf8");
  htmlByPage.set(page, html);
  if (!/<title>[^<]+<\/title>/i.test(html)) throw new Error(`${page} has no title`);
}

for (const edition of ["editions/text/index.html", "editions/living/index.html"]) {
  const html = htmlByPage.get(edition);
  for (const room of book.rooms) {
    if (!html.includes(`id="room${room.number}"`)) {
      throw new Error(`${edition} is missing Room ${room.number}: ${room.title}`);
    }
  }
}

for (const [page, expectedLinks] of Object.entries(expectedExperienceLinks)) {
  const html = htmlByPage.get(page);
  if (!html.includes('aria-label="Choose a Momo experience"')) {
    throw new Error(`${page} has no experience switcher`);
  }
  for (const href of expectedLinks) {
    if (!html.includes(`href="${href}"`)) {
      throw new Error(`${page} is missing an experience link: ${href}`);
    }
  }
}

const house = htmlByPage.get("index.html");
const canonical = htmlByPage.get("editions/text/index.html");
const normalizeParagraph = value => value.replace(/<[^>]+>/g, " ").replace(/&rsquo;/g, "’")
  .replace(/&mdash;/g, "—").replace(/&hellip;/g, "…").replace(/\s+/g, " ").trim();
const paragraphsWithin = html => [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)]
  .map(match => normalizeParagraph(match[1]));
for (const room of book.rooms) {
  if (!house.includes(`id="r-room${room.number}"`)) {
    throw new Error(`The continuous House is missing Room ${room.number}: ${room.title}`);
  }
  if (room.number >= 3) {
    const next = room.number + 1;
    const houseStart = house.indexOf(`id="r-room${room.number}"`);
    const houseEnd = next <= 12 ? house.indexOf(`id="t-room${next}"`, houseStart) : house.indexOf('id="t-end"', houseStart);
    const canonicalStart = canonical.indexOf(`id="room${room.number}"`);
    const canonicalEnd = next <= 12 ? canonical.indexOf(`id="room${next}"`, canonicalStart) : canonical.indexOf("to-be-continued", canonicalStart);
    const houseParagraphs = paragraphsWithin(house.slice(houseStart, houseEnd));
    const canonicalParagraphs = paragraphsWithin(canonical.slice(canonicalStart, canonicalEnd));
    if (JSON.stringify(houseParagraphs) !== JSON.stringify(canonicalParagraphs)) {
      throw new Error(`The House prose has drifted from the canonical manuscript in Room ${room.number}`);
    }
  }
}
if (!house.includes("walk all twelve") || !house.includes("all twelve rooms")) {
  throw new Error("The House does not clearly identify its complete twelve-room walk");
}

const localLinks = [];
for (const [page, html] of htmlByPage) {
  for (const match of html.matchAll(/href="([^"#][^"]*)"/g)) {
    const href = match[1].split("#")[0].split("?")[0];
    if (/^(?:https?:|mailto:|javascript:)/.test(href)) continue;
    localLinks.push([page, href]);
  }
}

for (const [page, href] of localLinks) {
  const target = resolve(root, dirname(page), href, href.endsWith("/") ? "index.html" : "");
  await access(target).catch(() => { throw new Error(`${page} has a broken link: ${href}`); });
}

console.log(`Momo House is complete: ${book.rooms.length} rooms across ${pages.length} experiences.`);
