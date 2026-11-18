import "dotenv/config";

const env = (key, fallback = "") => (process.env[key] ?? "").trim() || fallback;

export const config = {
  port: Number(env("PORT", "3000")),
  businessName: env("BUSINESS_NAME", "Oreo Explorer"),
  fbPageUrl: env("FB_PAGE_URL", "https://www.facebook.com/profile.php?id=61573751794406"),
  ownerName: env("OWNER_NAME", "Riojhon Palomo"),
  ownerFbUrl: env("OWNER_FB_URL", "https://www.facebook.com/riojhon.palomo"),
  messengerUrl: env("MESSENGER_URL", "https://m.me/61573751794406"),
  tiktokUrl: env("TIKTOK_URL", "https://www.tiktok.com/@oreo.explorer"),
  contactPhone: env("CONTACT_PHONE"),
  fbPageId: env("FB_PAGE_ID"),
  fbToken: env("FB_PAGE_ACCESS_TOKEN"),
  fbGraphVersion: env("FB_GRAPH_VERSION", "v23.0"),
  demoMode: env("DEMO_MODE", "true").toLowerCase() === "true",
  cacheMs: Number(env("CACHE_MINUTES", "10")) * 60_000,
};

export const hasFacebook = () => Boolean(config.fbPageId && config.fbToken);

/** Settings safe to send to the browser (no tokens). */
export const publicConfig = () => ({
  businessName: config.businessName,
  fbPageUrl: config.fbPageUrl,
  ownerName: config.ownerName,
  ownerFbUrl: config.ownerFbUrl,
  messengerUrl: config.messengerUrl,
  tiktokUrl: config.tiktokUrl,
  contactPhone: config.contactPhone,
  liveFacebook: hasFacebook(),
  demoMode: !hasFacebook() && config.demoMode,
});
