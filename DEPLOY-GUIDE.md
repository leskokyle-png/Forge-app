# The Forge — Deploy It To Your Phone

This gets your dashboard live at a web address and onto your home screen like a
real app. You can do the whole thing **from your phone** — no computer needed.

Budget about 30 minutes the first time. After that, it just works.

---

## What you're doing, in plain terms

Your dashboard is a folder of code. To use it as an app, that code needs to live
on a host that turns it into a live web page. You'll:

1. Put the code in a free **GitHub** account (storage for the code).
2. Connect it to **Vercel** (free host that builds + serves it).
3. Add the live page to your phone's home screen.

Your data is stored **on your phone**, so when your fiancée adds it to *her*
phone, her numbers and yours never mix.

---

## Step 1 — Get the project folder

The folder is called **forge-app**. Download it from this chat to your phone
(it'll come as a zip — your phone can hold it in Files / Downloads).

You don't need to open or edit anything inside it.

---

## Step 2 — Make a free GitHub account + upload the folder

1. In your phone browser, go to **github.com** and tap **Sign up**. Free.
2. Once logged in, tap the **+** (top right) → **New repository**.
3. Name it `forge-app`. Leave everything else default. Tap **Create repository**.
4. On the new repo page, tap **uploading an existing file** (it's a link in the
   text, or go to the **Add file → Upload files** menu).
5. Upload the **contents** of the forge-app folder — that is, `index.html`,
   `package.json`, `vite.config.js`, and the `src` and `public` folders.
   - On iPhone: unzip first (tap the zip in Files, it expands to a folder), then
     select all the items inside and upload.
   - **Important:** upload the files *inside* forge-app, not the zip itself.
6. Tap **Commit changes**.

> If uploading folders from a phone is fiddly, see "Easier phone option" at the
> bottom — you can skip GitHub entirely.

---

## Step 3 — Connect Vercel (the host)

1. Go to **vercel.com** in your browser. Tap **Sign Up** → **Continue with
   GitHub** (this links the two accounts in one tap). Free.
2. Tap **Add New… → Project**.
3. You'll see your `forge-app` repo listed. Tap **Import**.
4. Vercel auto-detects it's a Vite app. **Don't change any settings.** Just tap
   **Deploy**.
5. Wait ~1 minute. You'll get a **"Congratulations"** screen with a live URL like
   `forge-app-xxxx.vercel.app`. Tap it.

That URL is your app, live on the internet. Bookmark it.

---

## Step 4 — Add it to your home screen

**iPhone (Safari):**
1. Open your Vercel URL in Safari.
2. Tap the **Share** icon (square with up-arrow).
3. Scroll down → **Add to Home Screen** → **Add**.

**Android (Chrome):**
1. Open your Vercel URL in Chrome.
2. Tap the **⋮** menu (top right).
3. Tap **Add to Home screen** → **Add**.

Now there's a **Forge** icon on your home screen. It opens full-screen, no
browser bars — indistinguishable from an app store app.

---

## Step 5 — Your fiancée

Send her the same Vercel URL. She opens it on *her* phone and does Step 4. Her
data saves to her phone, yours to yours. They never touch.

(If you'd rather she have a totally separate copy, she can repeat Steps 2–3 under
her own accounts — but it isn't necessary for keeping numbers separate.)

---

## Easier phone option (skip GitHub)

If the GitHub folder upload is annoying on mobile, Vercel has a direct path:

1. On a tablet or any computer later, you can drag the `forge-app` folder
   straight into **vercel.com/new** — but this needs the Vercel CLI or a desktop
   browser, so it's not ideal phone-only.
2. **Simplest phone-only route:** ask me to host the built version and I can walk
   you through Netlify Drop (**app.netlify.com/drop**), where you drag the
   pre-built `dist` folder and get an instant URL with no GitHub. Tell me and
   I'll generate the ready-to-drop build for you.

---

## Things worth knowing

- **Your in-chat logs don't carry over.** This hosted version is a fresh start —
  different storage. Treat day one of the app as your real starting point.
- **Updates later:** when I improve the dashboard, you replace the files in your
  GitHub repo and Vercel rebuilds automatically within a minute. I'll give you
  the new files when that happens.
- **Clearing your browser data** can wipe localStorage. Once we add the
  Garmin/MyFitnessPal importer, I'll also add an Export button so you can back up
  your history to a file.
- **Cost:** $0. GitHub, Vercel, and Netlify all have free tiers far beyond what a
  personal app needs.
