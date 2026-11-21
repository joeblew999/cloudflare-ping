# One place picker, built the way components are built

Status: 2026-11-21, built, tried in a browser on all five boxes, deployed. The user: "the way that
a location is picked is a joke. It varies all over the place. You don't use the same component.
The component's not built properly", "It's not even a proper component", "Just build it all.
Fully here on main and deploy it and make sure it all is unified", and, on a separate stylesheet,
no: the picker is a form field and looks like every other one.

## What was wrong

- Two components (`PlacePicker`, `PlaceChips`), each with its own keys and ARIA written by hand.
- Its data fetched by itself: every place (3,139, 405 KB) from `/api/places` on first focus, so for
  2 to 10 seconds the box showed nothing.
- The box held what's sent (`Bangkok+TH`), not the place's name; one Backspace left `Bangkok+T`,
  sent as typed.
- The list was wider than its box and covered the fields beside it.
- Chips dropped typed text without a word: a map with "sing" typed and not picked would have been
  sent as every country.
- Coverage jumped to a place as soon as it was picked.

## How it's built now

- One component, `src/PlacePicker.tsx`, on Downshift 9.4.0 (`useCombobox`, and
  `useMultipleSelection` for chips): the keys, the list, and what screen readers are told are the
  library's. It renders its own label, so every field is `.form .field` markup with the site's
  input styles (pages/style.css): no stylesheet of its own.
- Which places each field takes is written once: `PLACE_FIELDS` in
  packages/shared/src/places.ts (from, coverage, countries, data centres; one or several). It's in
  the plain places module, not the command definitions, so the browser doesn't load zod.
- The data is the page's: each loader gives `places: defer(() => placesFor(...its fields))`
  (src/commands/places.ts), every place of those kinds, the same search the API runs. The page
  shows at once; the box says "Loading places…" until they come, or the lists' error if they
  can't be read.
- The value is the picked places' `magic`; the box shows the name ("Bangkok, Thailand (TH)").
  Typing after a pick unpicks it. Typed text that isn't picked keeps the form from being sent, with
  the browser's own message ("Pick one from the list"), and says so under the box.
- A pick is a click or Enter. Leaving the box never picks. Enter never sends the form (the test,
  run and map forms spend tests).
- The list is the box's width, in the CLI's groups; long names wrap.
- Coverage: pick, then Show (a plain GET form; the picker sends its pick under `place`). A link on
  the page (the table, Everywhere) puts its place in the box.

## Found while trying it

- Downshift reports changes a render late, so text kept from `onStateChange` lost keys when typed
  fast ("bangkok" came out "Thailand, Asiaag"). The text is kept from the box's own `onChange`.
- Chrome makes a scrolling list a Tab stop, so Tab from an open list went to the list, which then
  closed: focus fell to the page. The list is `tabIndex={-1}`.
- The search didn't find a place by how it's shown, so Backspace after a pick said "Nothing
  matches". `scoreOf` now matches the start of "name, within" too (a test in places.test.ts).

## Costs

- The From box's places are about 2,800 (360 KB of JSON, much less compressed) in every Probe and
  Runs page. The list needs them all to search as you type; fetching them on focus was the slow
  part before.
- The picker's code is 50 KB (16 KB gzipped), Downshift included.

## Left alone

- `/api/places` with nothing asked still answers every place: the CLI counts them by kind.
- Noisy matches ("th" finds "Republic of the Congo"; networks named "The…"), and "From ?" for
  everywhere runs in the runs list: separate fixes.
