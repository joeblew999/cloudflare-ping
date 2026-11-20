// The place picker (plan 2026-11-20-04): a text box that suggests places as you type, as
// globalping.io's Location box does. Every place comes from `GET /api/places` (the same places the
// CLI and MCP get), loaded once when a box is first used; every keypress then runs the same
// `searchPlaces` the API runs, in the browser, and shows the places in the same groups the CLI
// does. Nothing here knows a place: kinds, names and what's sent to Globalping all come with the
// places. `PlacePicker` holds one place (a test's From); `PlaceChips` several (the map's
// countries, a run everywhere's data centres).
import {
  FROM_KINDS,
  KIND_LABELS,
  groupByKind,
  searchPlaces,
  type Place,
  type PlaceKind,
} from "@cloudflare-ping/shared/places";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { fetch } from "void/client";

// Every place, fetched once for every box on the page.
let loading: Promise<Array<Place>> | null = null;
function loadPlaces(): Promise<Array<Place>> {
  loading ??= fetch("/api/places", { query: {} }).then(
    (found) => found.places,
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

function usePlaces() {
  const [places, setPlaces] = useState<Array<Place> | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () => {
    if (!places) {
      loadPlaces().then(setPlaces, () => setFailed(true));
    }
  };
  return { places, failed, load };
}

// How a place is read out: "Bangkok, Thailand (TH)".
const said = (place: Place) => `${place.name}${place.within ? `, ${place.within}` : ""}`;

// The place a value names, if it's one of them: what's sent to Globalping, or one of its codes.
function placeOf(places: Array<Place> | null, value: string) {
  const wanted = value.trim().toLowerCase();
  return wanted === ""
    ? undefined
    : places?.find(
        (each) =>
          each.magic.toLowerCase() === wanted ||
          each.codes.some((code) => code.toLowerCase() === wanted),
      );
}

// The suggestions under a box, and the keys that move through them.
function useSuggestions(options: {
  places: Array<Place> | null;
  query: string;
  kinds: ReadonlyArray<PlaceKind>;
  exclude?: ReadonlyArray<string>;
  onPick: (place: Place) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const found =
    options.places && options.query.trim() !== ""
      ? searchPlaces(options.places, { q: options.query, kinds: options.kinds, perKind: 8 }).filter(
          (each) => !options.exclude?.includes(each.magic),
        )
      : [];
  const groups = groupByKind(found);
  const flat = groups.flatMap((group) => group.places);
  const shown = open && flat.length > 0;
  const optionId = (at: number) => `${listId}-${at}`;

  useEffect(() => {
    if (shown) {
      document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    }
  });

  const pick = (place: Place) => {
    options.onPick(place);
    setOpen(false);
  };

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((at) => (shown ? Math.min(at + 1, flat.length - 1) : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((at) => Math.max(at - 1, 0));
    } else if (event.key === "Enter") {
      // Enter in a place box picks; it never submits the form, which on the test, run and map
      // forms would spend Globalping tests (a map with no countries picked is every country).
      event.preventDefault();
      if (shown && flat[active]) {
        pick(flat[active]);
      }
    } else if (event.key === "Escape" && shown) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  const typed = () => {
    setOpen(true);
    setActive(0);
  };

  const input = {
    role: "combobox",
    "aria-expanded": shown,
    "aria-controls": listId,
    "aria-autocomplete": "list",
    "aria-activedescendant": shown ? optionId(active) : undefined,
    autoComplete: "off",
    spellCheck: false,
    onKeyDown,
    onBlur: () => setOpen(false),
  } as const;

  let at = -1;
  const list = shown ? (
    <ul role="listbox" id={listId} className="place-list">
      {groups.map((group) => (
        <li key={group.kind} role="presentation">
          <span className="place-group">{KIND_LABELS[group.kind]}</span>
          <ul role="presentation">
            {group.places.map((place) => {
              at += 1;
              const here = at;
              return (
                <li
                  key={`${place.kind}|${place.magic}`}
                  id={optionId(here)}
                  role="option"
                  aria-selected={here === active}
                  className={here === active ? "place active" : "place"}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(place);
                  }}
                  onMouseEnter={() => setActive(here)}
                >
                  <span>
                    <strong>{place.name}</strong>
                    {place.within ? `, ${place.within}` : ""}
                  </span>
                  {place.kind === "datacentre" ? null : (
                    <span className="place-probes">{place.probes.toLocaleString("en-US")}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  ) : null;

  return { input, list, typed, shown };
}

// One place: what's in the box is what's sent to Globalping, picked or typed.
export function PlacePicker({
  name,
  value,
  onChange,
  kinds = FROM_KINDS,
  required,
  onPick,
  unknown = "Sent as typed",
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  kinds?: ReadonlyArray<PlaceKind>;
  required?: boolean;
  // When a suggestion is picked (not typed): a page that acts on the pick at once.
  onPick?: (place: Place) => void;
  // What to say when what's typed is none of the places.
  unknown?: string;
}) {
  const { places, failed, load } = usePlaces();
  const { input, list, typed, shown } = useSuggestions({
    places,
    query: value,
    kinds,
    onPick: (place) => {
      onChange(place.magic);
      onPick?.(place);
    },
  });
  const named = placeOf(places, value);
  return (
    <span className="place-picker">
      <span className="place-box">
        <input
          {...input}
          name={name}
          value={value}
          required={required}
          onFocus={load}
          onChange={(event) => {
            load();
            onChange(event.target.value);
            typed();
          }}
        />
        {list}
      </span>
      <span className="place-said">
        {failed
          ? "Places couldn't be loaded"
          : named
            ? `${said(named)} · ${named.kind === "datacentre" ? "Cloudflare data centre" : `${named.probes.toLocaleString("en-US")} probes`}`
            : shown
              ? "Pick one, or keep what you typed"
              : value.trim() === ""
                ? "Type to search"
                : places
                  ? unknown
                  : ""}
      </span>
    </span>
  );
}

// Several places, each a chip; what's sent is each one's own (a country's code, a data centre's).
export function PlaceChips({
  label,
  value,
  onChange,
  kinds,
  placeholder,
}: {
  // What the box is for, read out by screen readers (chips sit in a group, not a label).
  label: string;
  value: Array<string>;
  onChange: (value: Array<string>) => void;
  kinds: ReadonlyArray<PlaceKind>;
  placeholder: string;
}) {
  const { places, failed, load } = usePlaces();
  const [query, setQuery] = useState("");
  const { input, list, typed } = useSuggestions({
    places,
    query,
    kinds,
    exclude: value,
    onPick: (place) => {
      onChange([...value, place.magic]);
      setQuery("");
    },
  });
  return (
    <span className="place-picker">
      <span className="place-box">
        <span className="place-chips">
          {value.map((each) => {
            const named = placeOf(places, each);
            return (
              <span key={each} className="chip" title={named ? said(named) : each}>
                {named ? `${named.name}${named.kind === "datacentre" ? "" : ` (${each})`}` : each}
                <button
                  type="button"
                  aria-label={`Remove ${named?.name ?? each}`}
                  onClick={() => onChange(value.filter((other) => other !== each))}
                >
                  ×
                </button>
              </span>
            );
          })}
          <input
            {...input}
            aria-label={label}
            value={query}
            placeholder={value.length === 0 ? placeholder : ""}
            onFocus={load}
            onChange={(event) => {
              load();
              setQuery(event.target.value);
              typed();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && query === "" && value.length > 0) {
                onChange(value.slice(0, -1));
              } else {
                input.onKeyDown(event);
              }
            }}
          />
        </span>
        {list}
      </span>
      {failed ? <span className="place-said">Places couldn&apos;t be loaded.</span> : null}
    </span>
  );
}
