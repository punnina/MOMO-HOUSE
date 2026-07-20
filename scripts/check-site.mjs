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

