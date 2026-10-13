# South FL Deal Checker

A plain, Zillow-style website for checking South Florida auction and listing deals:
property cards, a map, photos, profit math, a due diligence checklist, an AI property
analysis, and an AI "title attorney" that examines the county records you paste in.

The site is just three files (`index.html`, `app.js`, `styles.css`). It runs free on
GitHub Pages. Nothing secret is stored in the code: API keys are typed into
**Settings** and stay in each person's own browser.

> The AI title attorney is still AI. It is not your lawyer and not title insurance.
> Get a written title report before bidding real money.

---

## 1. Put it online (GitHub Pages, free)

1. Make a free account at <https://github.com>.
2. Click **New repository**. Name it `deal-checker`. Choose **Public** (free Pages needs
   a public repo; the code has no keys or property data in it). Click **Create**.
3. Click **uploading an existing file**, drag in every file from this folder
   (`index.html`, `app.js`, `styles.css`, `supabase-setup.sql`, `README.md`, `.nojekyll`),
   then **Commit changes**.
4. Go to **Settings → Pages**. Under *Build and deployment*, pick
   **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
5. After a minute your site is live at `https://YOUR-USERNAME.github.io/deal-checker/`.

At this point the site works for **one browser**: properties you add are saved on that
computer only. Do step 2 to share a list with your partner.

## 2. Shared list for you and your partner (Supabase, free)

1. Make a free account at <https://supabase.com> → **New project** (any name,
   region *East US*). Save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste everything from `supabase-setup.sql`,
   press **Run**.
3. Open **Authentication → URL Configuration**. Set **Site URL** to your GitHub Pages
   address (`https://YOUR-USERNAME.github.io/deal-checker/`) and add the same address
   under **Redirect URLs**.
4. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
5. On the website: **Settings** → paste both → **Save settings** → type your email →
   **Email me a sign-in link** → click the link in your email.
6. Your partner does step 5 on their device with their own email.
7. Once you have both signed in, go back to Supabase **Authentication → Sign In / Providers**
   and turn **off** "Allow new users to sign up", so nobody else can get in.

Free-plan note: Supabase pauses a free project after about a week with no use. If the
site says it cannot reach Supabase, log in to supabase.com and press **Restore**.

## 3. Turn on the AI (Anthropic API, pay per use)

1. Go to <https://console.anthropic.com> → sign up → **Billing**: add $5–10 of credit
   and set a **monthly spend limit**.
2. **API keys → Create key**. Copy it.
3. On the website: **Settings → Anthropic API key** → paste → **Save settings**.

Rough cost: a property analysis is a few cents; a title examination is roughly
5–15 cents depending on how much you paste and which model you pick.

The key stays in your browser. Do not paste it anywhere else, and do not share screenshots
of the Settings panel. If it ever leaks, delete it in the Anthropic console and make a new one.

## 4. Photos and maps

* **Map pins** use OpenStreetMap (free). The site finds each address automatically,
  about one per second. If a pin is wrong, drag it, or paste a Google Maps link on the
  property page.
* **Satellite view** on every property page uses Google's free embed (no key needed).
* **Your own photos:** on Zillow, Realtor.com or the auction page, right-click a photo →
  **Copy image address**, then paste it on the property page and press **Add photo**.
  With Supabase connected you can also upload photos and screenshots.
* **Automatic Street View photos (optional):** create a Google Maps Platform key at
  <https://console.cloud.google.com>, enable **Street View Static API**, restrict the key
  to your `github.io` address, and paste it in **Settings**. Google gives a free monthly
  allowance; a billing card is required to turn the key on.

## 5. Load the watchlist

**Settings → Import a .json file** and pick `watchlist-import.json` (the file from Claude).
Imports never overwrite a property that is already on the list.

## How the deal score works (0–100)

| Part | Points | What it measures |
|---|---|---|
| Profit margin | 40 | value − 8% selling − 8% rehab (0 for vacant) − 1.5% holding − 0.7% doc stamps − $140 − liens that survive, compared with a 25% target |
| Title risk | 35 | from the AI title attorney's risk score |
| Homework done | 15 | the 14-item due diligence checklist |
| Land-bank fit | 10 | land worth more than the building, vacant land, or higher-density zoning |

A property shows **Title not checked** until the AI title attorney has run, and **PASS**
whenever the attorney flags a deal-breaker.
