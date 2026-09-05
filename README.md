# Card Show Planner — latest working prototype

This version keeps the existing UK card-show demo data and adds the first Supabase connection layer.

## Supabase details already prepared
Project URL:
https://fafkcpkhwjopelvkupwe.supabase.co

The app uses the Supabase JavaScript CDN and your publishable key. Supabase's current docs support this browser setup.

## How to use
1. Open `index.html` in a browser or serve this folder from a simple static host.
2. Tap ⚙️.
3. The Project URL is pre-filled.
4. Paste your Supabase **publishable** key into the key box.
5. Save connection.
6. The app will try to read the `Events` table.
7. If it cannot connect, it safely falls back to the included demo data.

Do NOT use or paste a Supabase secret/service key into this app.

## Important
The Save Event button is wired for signed-in Supabase users, but authentication has not been built into this prototype yet. That is the next development step.

## Files
- index.html — app shell
- styles.css — mobile-first styling
- app.js — app + Supabase connection
- events.json — current demo event data
