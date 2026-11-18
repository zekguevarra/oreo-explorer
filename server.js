import express from "express";
import { config, publicConfig } from "./lib/config.js";
import { getPosts, getStories } from "./lib/facebook.js";
import { analyzeItem } from "./lib/analyzer.js";
// Imported (not read from disk) so Vercel bundles it with the function. Edit it, then push to update.
import manualTours from "./data/manual-tours.json" with { type: "json" };

const app = express();
// Locally Express serves public/. On Vercel this line is ignored and public/ is served from its CDN.
app.use(express.static("public"));

// Let Vercel's CDN keep API answers for a few minutes, so visitors get instant responses
// and Facebook is called at most once per window instead of on every page view.
const cdnSeconds = Math.max(60, Math.round(config.cacheMs / 1000));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", `public, max-age=0, s-maxage=${cdnSeconds}, stale-while-revalidate=${cdnSeconds * 6}`);
  next();
});

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
    const [posts, stories] = await Promise.all([
      getPosts(15).catch(() => ({ items: [] })),
      getStories().catch(() => ({ items: [] })),
    ]);
    const manual = manualTours.tours ?? [];

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

// Errors from Facebook etc. are already answered by wrap(); this catches anything else so the
// function never hangs in a broken state.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

// Vercel runs the exported app as a function. Locally (npm start), listen on a port.
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    const cfg = publicConfig();
    console.log(`Oreo Explorer site running at http://localhost:${config.port}`);
    console.log(`  Facebook: ${cfg.liveFacebook ? "live" : cfg.demoMode ? "sample data (no token set)" : "off"}`);
  });
}

export default app;
