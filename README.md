# Oreo Explorer website

Website for **Oreo Explorer**, a travel & tours business in Davao City.

- Business details (services, pick-up points, location)
- **Available tours table** (Place, Date, Type, Price, Slots), built automatically from the page's Facebook posts and stories
- **Latest Facebook posts** and **active stories** (with a story viewer)
- **Chat box** that answers common questions and hands off to Messenger / TikTok
- Contact section with the owner's Facebook ([Riojhon Palomo](https://www.facebook.com/riojhon.palomo))

## Run it

```bash
npm install
cp .env.example .env     # then fill in the values
npm start                # http://localhost:3000
```

Without a Facebook token, the site runs in **preview mode** and shows sample posts and tours so you can see how it looks.
Set `DEMO_MODE=false` to hide the samples. The "Latest updates" section then falls back to Facebook's Page Plugin.

## Connecting Facebook (live posts, stories, tours)

The page owner has to do this, since only a page admin can grant access.

1. Go to <https://developers.facebook.com>, create an app (type **Business**).
2. Open **Graph API Explorer**, select the app, then click **Get Page Access Token**. Choose the Oreo Explorer page and grant
   `pages_show_list`, `pages_read_engagement` and `pages_read_user_content`.
3. Turn it into a **long-lived** token: exchange the user token at **Access Token Debugger**, "Extend Access Token",
   then call `GET /me/accounts` with the long-lived user token. The `access_token` returned for the page does not expire.
4. Put the page's `id` into `FB_PAGE_ID` and the token into `FB_PAGE_ACCESS_TOKEN` in `.env`.

For a site that's public (not just the owner testing it), Meta requires the app to be switched to **Live** mode.
`pages_read_engagement` may need App Review.

> Stories: the site reads them from the Graph API `/{page-id}/stories` endpoint. Facebook only returns stories that are still
> active (24 h), so the strip is empty when there's no story up.

## How the tour table is filled

`/api/tours` reads the captions of the latest 15 posts and all active stories, and picks up every line with a
place and a date. Write schedules in the caption one trip per line:

```
📍 Dahican, Mati – Nov 22 (JOINER) ₱1,499/pax
📍 Lake Sebu – Nov 29-30 (JOINER) ₱2,850/pax
📍 Eden Nature Park – Nov 23 (EXCLUSIVE)
```

Text that only appears inside a poster image or video isn't read, so type the dates in the caption too.
Past trips are hidden automatically. If a post and a story announce the same trip, they're merged into one row.

To add a tour by hand (e.g. one announced only in a group chat), edit `data/manual-tours.json`.

## Chat box

Facebook shut down the website Messenger chat plugin in 2024, and TikTok has no embeddable chat. So the chat box answers
common questions on the site (upcoming joiner tours, prices, pick-up points, van rental, how to book) using live tour data.
It sends visitors to **Messenger** (`MESSENGER_URL`) or **TikTok** (`TIKTOK_URL`) to talk to a person.

## Photos

The destination photos in `public/img` are from Wikimedia Commons under CC BY / CC BY-SA licences. The credit line
in the site footer is required by those licences: keep it if you keep the photos. Swap in Oreo Explorer's own trip photos
whenever possible; real photos of your joiners beat stock every time. Keep the same file names (`<name>-800.webp` and
`<name>-1600.webp`), or update `PLACE_PHOTOS` in `public/app.js` and the `<img>` tags in `public/index.html`.

## Deploying (GitHub → Render → GoDaddy domain)

GitHub Pages can't host this site: it needs the Node server to keep the Facebook token secret. Use Render:

1. Push this folder to a new GitHub repository. `.env` is git-ignored, so the token never reaches GitHub.
2. On [Render](https://render.com), sign in with GitHub, choose **New → Blueprint**, and pick the repo.
   Render reads `render.yaml` and asks for `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN` and `CONTACT_PHONE`.
3. Every `git push` to `main` redeploys the site.
4. Custom domain: in Render, open the service, go to **Settings → Custom Domains**, and add `yourdomain.com`
   and `www.yourdomain.com`. Then, in GoDaddy **DNS**, add the records Render lists:
   - an A record for `@`
   - a CNAME record for `www`

   Render sets up HTTPS on its own.

On the free plan the site sleeps after ~15 minutes without visitors (the first load then takes ~30–50 s). Set
`plan: starter` in `render.yaml` to keep it always on.
