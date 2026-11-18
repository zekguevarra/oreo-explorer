const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = (id, cls = "ico") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}" /></svg>`;
const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${url} → ${r.status}`))));

document.documentElement.classList.add("js");

let cfg = {};
let tours = [];
let filter = "all";

// ---------- dates ----------
const parseDay = (iso) => new Date(`${iso}T00:00:00`);
const fmt = (iso, opts) => parseDay(iso).toLocaleDateString("en-PH", opts);
const dayCount = (t) => (t.dateEnd ? Math.round((parseDay(t.dateEnd) - parseDay(t.dateStart)) / 86400000) + 1 : 1);

function formatRange(start, end) {
  if (!end || end === start) return fmt(start, { weekday: "short", month: "short", day: "numeric" });
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth
    ? `${fmt(start, { month: "short", day: "numeric" })}–${parseDay(end).getDate()}`
    : `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(end, { month: "short", day: "numeric" })}`;
}

function countdown(start) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((parseDay(start) - today) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}

const timeAgo = (iso) => {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / 1440);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
};

// Match a trip to one of our destination photos.
const PLACE_PHOTOS = [
  [/dahican|mati/i, "dahican-aerial"],
  [/sebu/i, "lake-sebu"],
  [/\bapo\b/i, "mt-apo"],
  [/samal|talikud/i, "samal"],
  [/tinuy|enchanted|bislig/i, "tinuyan"],
  [/eden/i, "eden"],
];
const photoFor = (place) => PLACE_PHOTOS.find(([re]) => re.test(place))?.[1] ?? null;

function splitPrice(price) {
  if (!price) return { amount: "Ask us", unit: "for rates" };
  const [amount, unit] = price.split(/\s*\/\s*/);
  return { amount: amount.trim(), unit: unit ? `per ${unit.replace(/pax|head/i, "person")}` : "" };
}

// ---------- links ----------
function applyLinks() {
  const set = (sel, url) =>
    $$(sel).forEach((a) => {
      if (url) a.href = url;
      else a.classList.add("is-off"), a.removeAttribute("href"), a.setAttribute("aria-disabled", "true");
    });
  set(".js-messenger", cfg.messengerUrl);
  set(".js-fbpage", cfg.fbPageUrl);
  set(".js-owner", cfg.ownerFbUrl);
  set(".js-tiktok", cfg.tiktokUrl);
  $$(".js-owner-name").forEach((el) => (el.textContent = cfg.ownerName));
  if (cfg.contactPhone) {
    const p = $(".js-phone");
    p.hidden = false;
    p.href = `tel:${cfg.contactPhone.replace(/\s/g, "")}`;
    $(".js-phone-text").textContent = cfg.contactPhone;
  }
  $("#demo-banner").hidden = !cfg.demoMode;
}

// ---------- nav: solid once the hero has scrolled past ----------
const nav = $("#nav");
const hero = $(".hero");
const syncNav = () => nav.classList.toggle("solid", window.scrollY > hero.offsetHeight - 90);
window.addEventListener("scroll", syncNav, { passive: true });
syncNav();

// ---------- hero: next trip ----------
function renderNextTrip() {
  const next = tours.find((t) => t.type === "joiner") ?? tours[0];
  const chip = $("#next-trip");
  if (!next) return;
  const { amount } = splitPrice(next.price);
  chip.innerHTML = `<span class="tag">Next ${esc(next.type === "joiner" ? "joiner" : "trip")}</span>
    <strong>${esc(next.place)}</strong>
    <span>${esc(formatRange(next.dateStart, next.dateEnd))}</span>
    ${next.price ? `<span class="price">${esc(amount)}</span>` : ""}`;
  chip.hidden = false;
}

// ---------- trips ----------
function renderTrips() {
  const list = $("#trips");
  const rows = tours.filter((t) => filter === "all" || t.type === filter);
  if (!rows.length) {
    list.innerHTML = `<li class="trips-empty">No ${filter === "all" ? "" : filter + " "}trips posted right now. <a href="${esc(cfg.messengerUrl)}" target="_blank" rel="noopener">Message us</a> and we'll plan one with you.</li>`;
    return;
  }
  list.innerHTML = rows
    .map((t) => {
      const photo = photoFor(t.place);
      const days = dayCount(t);
      const { amount, unit } = splitPrice(t.price);
      const from = t.source === "story" ? "from our story" : t.source === "post" ? "from our post" : "";
      return `<li class="trip">
        <a href="${esc(cfg.messengerUrl || cfg.fbPageUrl)}" target="_blank" rel="noopener" aria-label="Reserve ${esc(t.place)}, ${esc(formatRange(t.dateStart, t.dateEnd))}">
          <div class="trip-date"><span class="d">${parseDay(t.dateStart).getDate()}</span><span class="m">${fmt(t.dateStart, { month: "short" })}</span><span class="w">${days > 1 ? `${days} days` : fmt(t.dateStart, { weekday: "short" })}</span></div>
          <div class="trip-thumb${photo ? "" : " blank"}">${photo ? `<img src="/img/${photo}-800.webp" alt="" loading="lazy" />` : icon("pin")}</div>
          <div class="trip-main">
            <h3>${esc(t.place)}</h3>
            <div class="trip-meta">
              <span class="tag ${esc(t.type)}">${esc(t.type)}</span>
              <span class="when">${esc(formatRange(t.dateStart, t.dateEnd))}, ${countdown(t.dateStart)}</span>
              ${t.slots ? `<span>${esc(t.slots)} left</span>` : ""}
              ${from ? `<span>${from}</span>` : ""}
            </div>
          </div>
          <div class="trip-price"><strong>${esc(amount)}</strong><small>${esc(unit)}</small></div>
          <span class="trip-cta">${icon("arrow-up-right")}</span>
        </a>
      </li>`;
    })
    .join("");
}

// Segmented filter with a sliding pill.
const seg = $("#filter");
const pill = $(".seg-pill", seg);
function movePill(btn, instant = false) {
  if (instant) pill.style.transition = "none";
  pill.style.width = `${btn.offsetWidth}px`;
  pill.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
  if (instant) requestAnimationFrame(() => (pill.style.transition = ""));
}
$$("button", seg).forEach((btn) =>
  btn.addEventListener("click", () => {
    $$("button", seg).forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    movePill(btn);
    filter = btn.dataset.filter;
    renderTrips();
  }),
);
const syncPill = () => movePill($('[aria-selected="true"]', seg), true);
window.addEventListener("resize", syncPill);
document.fonts?.ready.then(syncPill);
syncPill();

// ---------- places: reveal once ----------
const mosaic = $("#mosaic");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && (mosaic.classList.add("in"), io.disconnect())),
    { threshold: 0.15 },
  );
  io.observe(mosaic);
} else mosaic.classList.add("in");

// ---------- posts ----------
function renderPosts({ source, items }) {
  const box = $("#posts");
  if (source === "none" || !items.length) {
    const href = encodeURIComponent(cfg.fbPageUrl);
    box.className = "fb-embed";
    box.innerHTML = `<iframe title="Oreo Explorer on Facebook" width="500" height="700" loading="lazy"
      src="https://www.facebook.com/plugins/page.php?href=${href}&tabs=timeline&width=500&height=700&small_header=true&adapt_container_width=true&hide_cover=false"
      allow="encrypted-media"></iframe>`;
    return;
  }
  box.innerHTML = items
    .slice(0, 6)
    .map((p) => {
      const text = p.message || "Photo/video post";
      let [first, ...rest] = text.split("\n").filter(Boolean);
      // ALL-CAPS headers shout in the display face; show them in Title Case.
      if (/[A-Z]{4}/.test(first) && first === first.toUpperCase()) {
        first = first.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, s, c) => s + c.toUpperCase());
      }
      const media = p.images?.[0];
      const head = media
        ? `<div class="post-media"><img src="${esc(media)}" alt="" loading="lazy" />${p.isVideo ? `<span class="tag tour badge">Video</span>` : ""}</div>`
        : "";
      const body = media
        ? `<p class="post-text">${esc(text)}</p>`
        : `<p class="post-lead">${esc(first)}</p>${rest.length ? `<p class="post-text">${esc(rest.join("\n"))}</p>` : ""}`;
      return `<a class="post${media ? "" : " text-only"}" href="${esc(p.permalink)}" target="_blank" rel="noopener">
        ${head}
        <div class="post-body">
          <span class="post-date">${timeAgo(p.createdTime)}</span>
          ${body}
          <span class="post-more">Open on Facebook ${icon("arrow-up-right")}</span>
        </div>
      </a>`;
    })
    .join("");
}

// ---------- stories ----------
let storyTimer;
let lastFocus;
function renderStories({ items }) {
  const box = $("#stories");
  if (!items.length) return (box.innerHTML = "");
  box.innerHTML = items
    .map(
      (s, i) => `<button class="story" data-i="${i}" aria-label="Open story from ${timeAgo(s.createdTime)}">
        <span class="story-ring">${s.image ? `<img class="story-thumb" src="${esc(s.image)}" alt="" />` : `<img class="story-thumb" src="/img/${photoFor(s.caption || "") || "hero-dahican"}-800.webp" alt="" />`}</span>
        <span>${timeAgo(s.createdTime)}</span>
      </button>`,
    )
    .join("");
  $$(".story", box).forEach((b) => b.addEventListener("click", () => ((lastFocus = b), openStory(items, Number(b.dataset.i)))));
}

function openStory(items, i) {
  const s = items[i];
  if (!s) return closeStory();
  const viewer = $("#story-viewer");
  viewer.hidden = false;
  $("#story-content").innerHTML = s.video
    ? `<video src="${esc(s.video)}" autoplay playsinline muted></video>`
    : s.image
      ? `<img src="${esc(s.image)}" alt="Story" />`
      : `<p>${esc(s.caption || "Oreo Explorer")}</p>`;
  $("#story-link").href = s.permalink || cfg.fbPageUrl;
  const bar = $(".story-progress span");
  bar.classList.remove("run");
  void bar.offsetWidth;
  bar.classList.add("run");
  $(".story-close").focus();
  clearTimeout(storyTimer);
  storyTimer = setTimeout(() => openStory(items, i + 1), 6000);
}
function closeStory() {
  clearTimeout(storyTimer);
  $("#story-viewer").hidden = true;
  $("#story-content").innerHTML = "";
  lastFocus?.focus();
}
$(".story-close").addEventListener("click", closeStory);
$("#story-viewer").addEventListener("click", (e) => e.target.id === "story-viewer" && closeStory());

// ---------- chat ----------
const log = $("#chat-log");
const link = (url, text) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text));

function say(html, who = "bot") {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.innerHTML = html;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

const answers = {
  tours() {
    const joiners = tours.filter((t) => t.type !== "exclusive").slice(0, 6);
    if (!joiners.length) return `No joiner trips are posted right now. ${link(cfg.messengerUrl, "Message us on Messenger")} and we'll tell you what's next.`;
    return (
      "Upcoming joiner trips:\n\n" +
      joiners.map((t) => `• ${esc(t.place)}: ${esc(formatRange(t.dateStart, t.dateEnd))}${t.price ? ` (${esc(t.price)})` : ""}`).join("\n") +
      `\n\nTo reserve a seat, ${link(cfg.messengerUrl, "message us on Messenger")}.`
    );
  },
  pickup: () => "We pick up in Davao City, Tagum and Panabo. The exact time and spot are confirmed when you book.",
  rent: () => `Yes, we rent out vans with a driver for any trip in Mindanao. ${link(cfg.messengerUrl, "Message us")} with your date, destination and number of passengers.`,
  book: () => `Booking takes three steps:\n1. Pick a trip from the schedule\n2. ${link(cfg.messengerUrl, "Message us on Messenger")} with your name, the trip and how many are coming\n3. Pay the downpayment to hold your seat`,
  custom: () => `We plan custom and exclusive trips for any group size. Tell us where you'd like to go on ${link(cfg.messengerUrl, "Messenger")}.`,
  human: () =>
    `Talk to us directly:\n• Page: ${link(cfg.messengerUrl, "Messenger")}\n• Owner: ${link(cfg.ownerFbUrl, cfg.ownerName)}` +
    (cfg.tiktokUrl ? `\n• TikTok: ${link(cfg.tiktokUrl, "@oreo.explorer")}` : ""),
  price: () => {
    const priced = tours.filter((t) => t.price).slice(0, 5);
    return priced.length
      ? "Current rates:\n" + priced.map((t) => `• ${esc(t.place)}: ${esc(t.price)}`).join("\n") + "\n\nOther trips are priced by group size, so just ask."
      : `Rates depend on the destination and group size. ${link(cfg.messengerUrl, "Message us")} for a quote.`;
  },
};

const quick = [
  ["Joiner trips", "tours"],
  ["Prices", "price"],
  ["Pick-up points", "pickup"],
  ["Rent a van", "rent"],
  ["How to book", "book"],
  ["Talk to a person", "human"],
];

function intentOf(text) {
  const t = text.toLowerCase();
  if (/joiner|tour|sched|available|trip|when|date|slot/.test(t)) return "tours";
  if (/price|rate|how much|magkano|pila|cost|₱/.test(t)) return "price";
  if (/pick ?up|tagum|panabo|meet/.test(t)) return "pickup";
  if (/rent|van|driver|vehicle/.test(t)) return "rent";
  if (/book|reserve|reserv|down ?payment|dp/.test(t)) return "book";
  if (/custom|itinerary|private|exclusive/.test(t)) return "custom";
  if (/owner|person|human|contact|call|number|tiktok|messenger/.test(t)) return "human";
  return null;
}

function handle(text, intent = intentOf(text)) {
  say(esc(text), "user");
  setTimeout(() => {
    say(intent ? answers[intent]() : `I'm not sure about that one, but our team can help. ${link(cfg.messengerUrl, "Continue on Messenger")}`);
  }, 320);
}

$("#chat-quick").innerHTML = quick.map(([label, key]) => `<button type="button" data-k="${key}">${label}</button>`).join("");
$$("#chat-quick button").forEach((b) => b.addEventListener("click", () => handle(b.textContent, b.dataset.k)));
$("#chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chat-input");
  if (input.value.trim()) handle(input.value.trim());
  input.value = "";
});

let greeted = false;
const toggleBtn = $("#chat-toggle");
function toggleChat(open) {
  $("#chat").hidden = !open;
  toggleBtn.setAttribute("aria-expanded", String(open));
  toggleBtn.innerHTML = icon(open ? "x" : "chat");
  if (open && !greeted) {
    greeted = true;
    say(`Hi! Ask about joiner trips, prices or pick-up, or tap a question below.`);
  }
  if (open) $("#chat-input").focus({ preventScroll: true });
}
toggleBtn.addEventListener("click", () => toggleChat($("#chat").hidden));
$(".chat-close").addEventListener("click", () => (toggleChat(false), toggleBtn.focus()));

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("#story-viewer").hidden) closeStory();
  else if (!$("#chat").hidden) (toggleChat(false), toggleBtn.focus());
});

// ---------- boot ----------
$("#year").textContent = new Date().getFullYear();

cfg = await getJSON("/api/config").catch(() => ({}));
applyLinks();
syncNav();

getJSON("/api/posts").then(renderPosts).catch(() => renderPosts({ source: "none", items: [] }));
getJSON("/api/stories").then(renderStories).catch(() => renderStories({ items: [] }));
getJSON("/api/tours")
  .then((d) => {
    tours = d.tours;
    renderTrips();
    renderNextTrip();
  })
  .catch(() => {
    $("#trips").innerHTML = `<li class="trips-empty">Couldn't load the schedule right now. Please message us on Messenger.</li>`;
  });
