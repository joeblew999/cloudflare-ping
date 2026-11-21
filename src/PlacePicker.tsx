// The place picker (plan 2026-11-21-04): the one box for every location field on the website, a
// test's and a run's From, the coverage place, a map's countries and a run everywhere's data
// centres. Which places a field takes is written once, in PLACE_FIELDS
// (packages/shared/src/places.ts). The page's loader hands them over (placesFor,
// src/commands/places.ts), deferred so the page shows at once. Every keypress runs the same
// search `GET /api/places` runs, and the list shows the places in the CLI's groups. Downshift's
// combobox (useCombobox, with useMultipleSelection for several, as chips) does the keys, the
// list and what screen readers are told. It looks like every other field: the site's form styles
// (pages/style.css).
//
// What the field holds is what's sent: each picked place's `magic` ("TH", "Bangkok+TH", "BKK").
// The box shows the place's name. Typing after a pick unpicks it. Typed text that isn't picked
// keeps the form from being sent ("Pick one from the list"), so a form never goes with less than
// it shows. A place is picked by a click or Enter, never by leaving the box, and Enter never sends
// the form: the test, run and map forms spend tests.
import {
  KIND_LABELS,
  groupByKind,
  searchPlaces,
  type Place,
  type PlaceField,
} from "@cloudflare-ping/shared/places";
import type { Deferred } from "@void/react";
import { useCombobox, useMultipleSelection, type UseComboboxReturnValue } from "downshift";
import {
  Suspense,
  use,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type { PickerPlaces } from "./commands/places";

type Props = {
  label: string;
  field: PlaceField;
  // From the page's loader: placesFor(...the page's fields), deferred, or at once where the page
  // is cached whole (Coverage: Void doesn't cache a page with deferred props).
  places: PickerPlaces | Deferred<PickerPlaces>;
  // The picked places' `magic`: one at most, unless the field takes several.
  value: ReadonlyArray<string>;
  onChange: (value: Array<string>) => void;
  // For a plain form (the coverage page's): each picked place is sent under this name.
  name?: string;
  placeholder?: string;
  // One place must be picked.
  required?: boolean;
  // The server's words about the field.
  error?: string;
};

const PICK = "Pick one from the list";
const NOTHING = "Nothing matches that";

export function PlacePicker(props: Props) {
  return (
    <Suspense fallback={<Unready label={props.label} words="Loading places…" />}>
      <Ready {...props} />
    </Suspense>
  );
}

function Ready(props: Props) {
  const found = "then" in props.places ? use(props.places) : props.places;
  const places = useMemo(
    () => (found.ok ? found.places.filter((each) => props.field.kinds.includes(each.kind)) : []),
    [found, props.field],
  );
  if (!found.ok) {
    return <Unready label={props.label} words={`Places couldn't be loaded: ${found.error}`} />;
  }
  return props.field.several ? (
    <Several {...props} places={places} />
  ) : (
    <One {...props} places={places} />
  );
}

// The box while there are no places to pick from.
function Unready({ label, words }: { label: string; words: string }) {
  const id = useId();
  return (
    <div className="field place-picker">
      <label htmlFor={id}>{label}</label>
      <input id={id} disabled placeholder={words} />
    </div>
  );
}

type Loaded = Omit<Props, "places"> & { places: Array<Place> };

// How a place is shown, in the list and in the box: "Bangkok, Thailand (TH)".
const said = (place: Place | null) =>
  place ? `${place.name}${place.within ? `, ${place.within}` : ""}` : "";

const keyOf = (place: Place | null) => (place ? `${place.kind}|${place.magic}` : null);

// The place a value is: its magic, or one of its codes ("EU" is Europe).
function placeOf(places: ReadonlyArray<Place>, value: string) {
  const wanted = value.toLowerCase();
  return (
    places.find((each) => each.magic.toLowerCase() === wanted) ??
    places.find((each) => each.codes.some((code) => code.toLowerCase() === wanted))
  );
}

// What's offered for what's typed: the best 8 of each kind, in the CLI's groups, in the order the
// list shows them (Downshift counts the items in that order).
function offered(places: ReadonlyArray<Place>, typed: string, picked: ReadonlyArray<string>) {
  const found = searchPlaces(places, { q: typed, perKind: 8 }).filter(
    (each) => !picked.includes(each.magic),
  );
  return groupByKind(found).flatMap((group) => group.places);
}

// Enter picks (Downshift, when the list is open); it never sends the form.
const enterNeverSends = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === "Enter") {
    event.preventDefault();
  }
};

// Typed text that isn't picked keeps the form from being sent, with the browser's own message.
function useUnpicked(unpicked: boolean) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.setCustomValidity(unpicked ? PICK : "");
  }, [unpicked]);
  return input;
}

// Downshift tells of a pick after the render that follows it, so the text in the box is kept as
// it's typed, from the box's own onChange: kept a render later, fast typing would lose keys.
const { InputKeyDownEnter, ItemClick } = useCombobox.stateChangeTypes;

// One place.
function One({ label, places, value, onChange, name, placeholder, required, error }: Loaded) {
  const picked = (value[0] && placeOf(places, value[0])) || null;
  const [text, setText] = useState(() => (picked ? said(picked) : (value[0] ?? "")));
  // The value the text was last set for: another value from the page (a link to another place)
  // puts its place in the box (React's "adjusting state when a prop changes").
  const key = value.join("\n");
  const [textFor, setTextFor] = useState(key);
  if (key !== textFor) {
    setTextFor(key);
    setText(picked ? said(picked) : (value[0] ?? ""));
  }
  // The picked place's name in the box: the list offers every place, as for an empty box.
  const typed = picked && text === said(picked) ? "" : text;
  const items = useMemo(() => offered(places, typed, []), [places, typed]);
  const unpicked = text.trim() !== "" && !picked;
  const input = useUnpicked(unpicked);
  const combobox = useCombobox<Place>({
    items,
    itemToString: said,
    itemToKey: keyOf,
    selectedItem: picked,
    inputValue: text,
    defaultHighlightedIndex: 0,
    onStateChange: (changes) => {
      if (
        (changes.type === InputKeyDownEnter || changes.type === ItemClick) &&
        changes.selectedItem
      ) {
        setText(said(changes.selectedItem));
        setTextFor(changes.selectedItem.magic);
        onChange([changes.selectedItem.magic]);
      }
    },
  });
  // Typing after a pick unpicks it.
  const type = (next: string) => {
    setText(next);
    if (picked) {
      setTextFor("");
      onChange([]);
    }
  };
  const hint = hintOf(error, unpicked, items);
  const hintId = useId();
  return (
    <div className="field place-picker">
      <label {...combobox.getLabelProps()}>{label}</label>
      <div className="place-box">
        <input
          {...combobox.getInputProps({
            ref: input,
            onChange: (event: ChangeEvent<HTMLInputElement>) => type(event.target.value),
            onKeyDown: enterNeverSends,
            placeholder,
            required,
            autoComplete: "off",
            spellCheck: false,
            "aria-describedby": hint ? hintId : undefined,
            "aria-invalid": error ? true : undefined,
          })}
        />
        <List combobox={combobox} items={items} />
      </div>
      <Hint id={hintId} error={error} words={hint} />
      {name && picked ? <input type="hidden" name={name} value={picked.magic} /> : null}
    </div>
  );
}

// Several places, each a chip: a click or Enter adds one, its × (or Backspace) takes it off.
function Several({ label, places, value, onChange, name, placeholder, error }: Loaded) {
  const [text, setText] = useState("");
  const items = useMemo(() => offered(places, text, value), [places, text, value]);
  const unpicked = text.trim() !== "";
  const input = useUnpicked(unpicked);
  // The chips are the values themselves, each shown by its place's name.
  const selection = useMultipleSelection<string>({
    selectedItems: [...value],
    onSelectedItemsChange: ({ selectedItems }) => onChange(selectedItems),
  });
  const combobox = useCombobox<Place>({
    items,
    itemToString: said,
    itemToKey: keyOf,
    selectedItem: null,
    inputValue: text,
    defaultHighlightedIndex: 0,
    onStateChange: (changes) => {
      if (
        (changes.type === InputKeyDownEnter || changes.type === ItemClick) &&
        changes.selectedItem
      ) {
        setText("");
        onChange([...value, changes.selectedItem.magic]);
      }
    },
  });
  const hint = hintOf(error, unpicked, items);
  const hintId = useId();
  return (
    <div className="field place-picker">
      <label {...combobox.getLabelProps()}>{label}</label>
      <div className="place-box">
        <div className="place-chips">
          {value.map((each, index) => {
            const place = placeOf(places, each);
            return (
              <span
                key={each}
                className="chip"
                title={place ? said(place) : each}
                {...selection.getSelectedItemProps({ selectedItem: each, index })}
              >
                {place?.name ?? each}
                <button
                  type="button"
                  aria-label={`Take off ${place?.name ?? each}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    selection.removeSelectedItem(each);
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
          <input
            {...combobox.getInputProps(
              selection.getDropdownProps({
                ref: input,
                preventKeyAction: combobox.isOpen,
                onChange: (event: ChangeEvent<HTMLInputElement>) => setText(event.target.value),
                onKeyDown: enterNeverSends,
                placeholder: value.length === 0 ? placeholder : "",
                autoComplete: "off",
                spellCheck: false,
                "aria-describedby": hint ? hintId : undefined,
                "aria-invalid": error ? true : undefined,
              }),
            )}
          />
        </div>
        <List combobox={combobox} items={items} />
      </div>
      <Hint id={hintId} error={error} words={hint} />
      {name
        ? value.map((each) => <input key={each} type="hidden" name={name} value={each} />)
        : null}
    </div>
  );
}

// What's said under the box: the server's words, or why the form won't be sent yet.
function hintOf(error: string | undefined, unpicked: boolean, items: ReadonlyArray<Place>) {
  return error ?? (unpicked ? (items.length === 0 ? NOTHING : PICK) : null);
}

function Hint({ id, error, words }: { id: string; error?: string; words: string | null }) {
  return words ? (
    <span id={id} className={error ? "place-said different" : "place-said"}>
      {words}
    </span>
  ) : null;
}

// The list under the box, in groups by kind. Out of the Tab order: the browser would otherwise
// stop on it (it scrolls), and Tab would land on a list that closes as the box is left.
function List({
  combobox,
  items,
}: {
  combobox: UseComboboxReturnValue<Place>;
  items: ReadonlyArray<Place>;
}) {
  const menu = combobox.getMenuProps();
  const shown = combobox.isOpen && items.length > 0;
  let index = -1;
  return (
    <ul {...menu} className="place-list" hidden={!shown} tabIndex={-1}>
      {shown
        ? groupByKind(items).map((group) => {
            const heading = `${menu.id}-${group.kind}`;
            return (
              <li key={group.kind} role="presentation">
                <span id={heading} className="place-group">
                  {KIND_LABELS[group.kind]}
                </span>
                <ul role="group" aria-labelledby={heading}>
                  {group.places.map((place) => {
                    index += 1;
                    return (
                      <li
                        key={keyOf(place)}
                        className={index === combobox.highlightedIndex ? "place active" : "place"}
                        {...combobox.getItemProps({ item: place, index })}
                      >
                        <span>
                          <strong>{place.name}</strong>
                          {place.within ? `, ${place.within}` : ""}
                        </span>
                        {place.kind === "datacentre" ? null : (
                          <span className="place-probes">
                            {place.probes.toLocaleString("en-US")}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })
        : null}
    </ul>
  );
}
