// Every place (plan 2026-11-20-04), from the lists the app reads and nothing else: Globalping's
// probes (src/sources/reduce.ts) say which places exist and how many probes each has; the name
// lists put words to Globalping's codes; Cloudflare's placed data centres add its own. What's
// sent to Globalping for each is its own location text, as globalping.io fills it in
// (`Bangkok+TH`, `Ashburn+US-VA`, a continent by its name). Pure: the tests run it as it is.
import type { Place } from "@cloudflare-ping/shared/places";
import type { CountryList, Datacentre, Names, ProbeIndex } from "./reduce";

// The one rule for which continent a country is in, for its probes and its data centres alike,
// everywhere (places, coverage): the countries list's; the probe network's own only for a country
// the list doesn't know. (The two disagree for Russia: the probe network says Europe, the list
// Asia.)
export function continentRule(countries: CountryList, cities: ProbeIndex["cities"]) {
  const probeContinent = new Map(cities.map((each) => [each.country, each.continent]));
  return (country: string | null): string =>
    country ? (countries[country]?.continent ?? probeContinent.get(country) ?? "") : "";
}

export type PlacedDatacentre = Datacentre & { country: string | null };

export function placesOf(lists: {
  probes: ProbeIndex;
  continents: Names;
  countries: CountryList;
  states: Names;
  datacentres: Array<PlacedDatacentre>;
}): Array<Place> {
  const { probes, continents, countries, states } = lists;
  const continentOf = continentRule(countries, probes.cities);
  const tally = new Map<string, Place>();
  const count = (key: string, place: Omit<Place, "probes">, probes: number) => {
    const found = tally.get(key);
    if (found) {
      found.probes += probes;
    } else {
      tally.set(key, { ...place, probes });
    }
  };
  const country = (code: string) => countries[code]?.name ?? code;

  for (const city of probes.cities) {
    const code = continentOf(city.country);
    const continent = continents[code] ?? code;
    count(
      `continent|${code}`,
      {
        kind: "continent",
        name: continent,
        within: null,
        codes: [code],
        magic: continent,
        country: null,
      },
      city.probes,
    );
    count(
      `region|${city.region}`,
      {
        kind: "region",
        name: city.region,
        within: null,
        codes: [],
        magic: city.region,
        country: null,
      },
      city.probes,
    );
    count(
      `country|${city.country}`,
      {
        kind: "country",
        name: country(city.country),
        within: continent,
        codes: [city.country],
        magic: city.country,
        country: city.country,
      },
      city.probes,
    );
    const state = city.state ? `${city.country}-${city.state}` : null;
    if (state) {
      count(
        `state|${state}`,
        {
          kind: "state",
          name: states[state] ?? state,
          within: country(city.country),
          codes: [state],
          magic: state,
          country: city.country,
        },
        city.probes,
      );
    }
    count(
      `city|${city.country}|${city.state ?? ""}|${city.city}`,
      {
        kind: "city",
        name: city.city,
        within: state
          ? `${states[state] ?? state} (${state})`
          : `${country(city.country)} (${city.country})`,
        codes: [],
        magic: `${city.city}+${state ?? city.country}`,
        country: city.country,
      },
      city.probes,
    );
  }

  for (const network of probes.networks) {
    const asns = network.asns.map((asn) => `AS${asn}`);
    count(
      `network|${network.name}`,
      {
        kind: "network",
        name: network.name,
        within: asns.join(", "),
        codes: asns,
        magic: network.name,
        country: null,
      },
      network.probes,
    );
  }

  for (const centre of lists.datacentres) {
    count(
      `datacentre|${centre.code}`,
      {
        kind: "datacentre",
        name: centre.code,
        within: centre.name,
        codes: [centre.code],
        magic: centre.code,
        country: centre.country,
      },
      0,
    );
  }

  return [...tally.values()];
}
