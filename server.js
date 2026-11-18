import express from "express";
import { readFile } from "node:fs/promises";
import { config, publicConfig } from "./lib/config.js";
import { getPosts, getStories } from "./lib/facebook.js";
import { analyzeItem } from "./lib/analyzer.js";

const app = express();
app.use(express.static("public"));

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(502).json({ error: err.message });
  });

app.get("/api/config", (_req, res) => res.json(publicConfig()));

app.get("/api/posts", wrap(async (_req, res) => res.json(await getPosts(10))));

app.get("/api/stories", wrap(async (_req, res) => res.json(await getStories())));

app.get(
  "/api/tours",
  wrap(async (_req, res) => {
    const [posts, stories, manual] = await Promise.all([
      getPosts(15).catch(() => ({ items: [] })),
      getStories().catch(() => ({ items: [] })),
      readFile(new URL("./data/manual-tours.json", import.meta.url), "utf8")
        .then((t) => JSON.parse(t).tours ?? [])
        .catch(() => []),
    ]);

    const found = [
      ...posts.items.flatMap((p) => analyzeItem(p, "post")),
      ...stories.items.flatMap((s) => analyzeItem(s, "story")),
    ];

    const all = [...manual.map((t) => ({ ...t, source: "manual", sourceUrl: null })), ...found];

    // Keep upcoming trips only. The same trip is often announced in a post AND a story
    // ("Dahican, Mati City" vs "Dahican"): merge when the date matches and the names share their first word.
    const today = new Date().toISOString().slice(0, 10);
    const firstWord = (p) => p.toLowerCase().match(/[a-z0-9]+/)?.[0] ?? p;
    const tours = [];
    const newestFirst = all.sort((a, b) => String(b.postedAt ?? "").localeCompare(String(a.postedAt ?? "")));
    for (const t of newestFirst) {
      if ((t.dateEnd ?? t.dateStart) < today) continue;
      const same = tours.find((x) => x.dateStart === t.dateStart && firstWord(x.place) === firstWord(t.place));
      if (!same) {
        tours.push({ ...t });
        continue;
      }
      // Fill gaps from the other announcement; keep the longer place name.
      if (t.place.length > same.place.length) same.place = t.place;
      for (const k of ["dateEnd", "price", "slots"]) same[k] ??= t[k];
      if (same.type === "tour") same.type = t.type;
    }
    tours.sort((a, b) => a.dateStart.localeCompare(b.dateStart));
    res.json({ source: posts.source, tours });
  }),
);

app.listen(config.port, () => {
  const cfg = publicConfig();
  console.log(`Oreo Explorer site running at http://localhost:${config.port}`);
  console.log(`  Facebook: ${cfg.liveFacebook ? "live" : cfg.demoMode ? "sample data (no token set)" : "off"}`);
});
