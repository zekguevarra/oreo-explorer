// Finds tours (place + date) in Facebook post and story captions.
// A keyword/date parser reads lines like "📍 Dahican – Nov 22 (JOINER) ₱1,499/pax".

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** When a post says "Nov 22" with no year, pick the year that makes sense relative to the post date. */
function resolveYear(month, day, postDate) {
  const base = new Date(postDate);
  let year = base.getUTCFullYear();
  const candidate = Date.UTC(year, month, day);
  if (candidate < base.getTime() - 60 * 86400_000) year += 1; // "Jan 5" posted in December
  return year;
}

const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE_RE = new RegExp(
  `${MONTH_RE}\\.?\\s*(\\d{1,2})(?:\\s*(?:-|–|to|&|and)\\s*(?:${MONTH_RE}\\.?\\s*)?(\\d{1,2}))?(?:,?\\s*(20\\d{2}))?`,
  "i",
);
const NUM_DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}|\d{2}))?\b/;
const PRICE_RE = /(?:₱|php|p)\s?([\d,]{3,})(?:\s*\/\s*(pax|head|person))?/i;
const SLOTS_RE = /(\d+)\s*(?:slots?|seats?|pax left)/i;

function cleanPlace(text) {
  return text
    .replace(/\p{Extended_Pictographic}|️/gu, "")
    .replace(PRICE_RE, "")
    .replace(SLOTS_RE, "")
    .replace(/\((?:joiners?|exclusive(?: only)?)\)/gi, "")
    .replace(/\b(joiners?|exclusive only|slots? left|left|last|only|available)\b/gi, "")
    .replace(/[|•@!]/g, " ")
    .replace(/^[\s\-–:,.*#]+|[\s\-–:,.*#(]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseText(message, postDate) {
  const tours = [];
  const postMentionsJoiner = /joiner/i.test(message);

  for (const rawLine of message.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let dateStart = null;
    let dateEnd = null;
    let matched = "";

    const m = line.match(DATE_RE);
    if (m) {
      const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
      const day = Number(m[2]);
      const year = m[5] ? Number(m[5]) : resolveYear(month, day, postDate);
      dateStart = iso(year, month, day);
      if (m[4]) {
        const endMonth = m[3] ? MONTHS[m[3].slice(0, 3).toLowerCase()] : month;
        dateEnd = iso(year + (endMonth < month ? 1 : 0), endMonth, Number(m[4]));
      }
      matched = m[0];
    } else {
      const n = line.match(NUM_DATE_RE);
      if (n && Number(n[1]) <= 12) {
        const month = Number(n[1]) - 1;
        const day = Number(n[2]);
        const year = n[3] ? Number(n[3].length === 2 ? `20${n[3]}` : n[3]) : resolveYear(month, day, postDate);
        dateStart = iso(year, month, day);
        matched = n[0];
      }
    }
    if (!dateStart) continue;

    const place = cleanPlace(line.replace(matched, " "));
    // Skip lines that are just a header like "SCHEDULE FOR NOVEMBER 22".
    if (place.length < 3 || /schedule|thank|happy|merry/i.test(place)) continue;

    const lower = line.toLowerCase();
    const type = lower.includes("exclusive") ? "exclusive" : lower.includes("joiner") || postMentionsJoiner ? "joiner" : "tour";
    const price = line.match(PRICE_RE)?.[0]?.trim() ?? null;
    const slots = line.match(SLOTS_RE)?.[0]?.trim() ?? null;

    tours.push({ place, dateStart, dateEnd, price, slots, type });
  }
  return tours;
}

/** Returns tours found in one post/story caption, with a link back to it. */
export function analyzeItem(item, kind) {
  const tours = parseText(item.message ?? item.caption ?? "", item.createdTime);
  return tours.map((t) => ({ ...t, source: kind, sourceUrl: item.permalink, postedAt: item.createdTime }));
}
