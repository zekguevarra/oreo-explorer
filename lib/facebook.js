// Reads the page's posts and active stories from the Facebook Graph API.
// Needs a Page access token with pages_read_engagement (see README).
import { readFile } from "node:fs/promises";
import { config, hasFacebook } from "./config.js";

const cache = new Map();

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < config.cacheMs) return hit.value;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function graph(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${config.fbGraphVersion}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${config.fbToken}` } });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(`Facebook API: ${body.error?.message ?? res.statusText}`);
  }
  return body;
}

/** Collect every image URL in a post (single photo, albums, video thumbnails). */
function imagesFrom(post) {
  const urls = new Set();
  if (post.full_picture) urls.add(post.full_picture);
  for (const a of post.attachments?.data ?? []) {
    if (a.media?.image?.src) urls.add(a.media.image.src);
    for (const s of a.subattachments?.data ?? []) {
      if (s.media?.image?.src) urls.add(s.media.image.src);
    }
  }
  return [...urls];
}

async function loadSample(file) {
  return JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url), "utf8"));
}

export async function getPosts(limit = 10) {
  if (!hasFacebook()) return config.demoMode ? { source: "sample", items: await loadSample("sample-posts.json") } : { source: "none", items: [] };

  return cached(`posts:${limit}`, async () => {
    const body = await graph(`${config.fbPageId}/posts`, {
      limit: String(limit),
      fields:
        "id,message,created_time,permalink_url,full_picture," +
        "attachments{media_type,media,url,subattachments{media,media_type}}",
    });
    const items = body.data.map((p) => ({
      id: p.id,
      message: p.message ?? "",
      createdTime: p.created_time,
      permalink: p.permalink_url,
      images: imagesFrom(p),
      isVideo: (p.attachments?.data ?? []).some((a) => String(a.media_type).includes("video")),
    }));
    return { source: "facebook", items };
  });
}

export async function getStories() {
  if (!hasFacebook()) return config.demoMode ? { source: "sample", items: await loadSample("sample-stories.json") } : { source: "none", items: [] };

  return cached("stories", async () => {
    const body = await graph(`${config.fbPageId}/stories`, {
      fields: "post_id,status,creation_time,media_type,media_id,url",
    });
    const live = body.data.filter((s) => !s.status || s.status === "PUBLISHED");
    // Resolve each story's media to a viewable image/video URL.
    const items = await Promise.all(
      live.map(async (s) => {
        let image = null;
        let video = null;
        try {
          if (s.media_type === "video") {
            const v = await graph(s.media_id, { fields: "source,picture" });
            video = v.source ?? null;
            image = v.picture ?? null;
          } else {
            const p = await graph(s.media_id, { fields: "images" });
            image = p.images?.[0]?.source ?? null;
          }
        } catch {
          /* media may have expired; keep the link only */
        }
        return {
          id: s.post_id ?? s.media_id,
          createdTime: new Date(Number(s.creation_time) * 1000 || s.creation_time).toISOString(),
          mediaType: s.media_type,
          image,
          video,
          permalink: s.url,
        };
      }),
    );
    return { source: "facebook", items };
  });
}
