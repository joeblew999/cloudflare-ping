---
name: cloudflare-ping
description: Use cloudflare-ping, probes from around the world run from Cloudflare's data centres, to fetch a site from the Cloudflare data centres the probes reach, start and read runs, and see how many tests are left. Use when asked to probe, warm or check a site from Cloudflare's data centres, or about cloudflare-ping's runs.
---

# cloudflare-ping

cloudflare-ping (https://cloudflare-ping.gedw99.workers.dev) sends one test from probes in a place (a country such as
`TH`, a city, a network) to its own Worker. The Worker, in the Cloudflare data centre each probe
reached, fetches the target from there and records every fetch: a run. Tests are counted,
so starting a run or a test spends them; reading runs, limits and logs spends none.

## How to reach it

- **MCP**, when this agent has the server `cloudflare-ping` (`https://cloudflare-ping.gedw99.workers.dev/mcp`): the tools below.
  The first time, it signs in through the browser, as an account the app allows.
- **The CLI** otherwise: `npx cloudflare-ping <command> --json`. The first command that needs
  it shows a link and a code to approve in the browser; in CI, set `CLOUDFLARE_PING_TOKEN`.

## Working rules

- Check `limits` before starting runs or tests. Without the app's own token, the count
  is that of a Cloudflare address other customers share, and it can be 0 at any moment.
- A run in the background (the default) answers once the probes reach the data centres; the
  fetches come after. Read them a little later with `show <run id>`, or on the run's page.
- Only targets on the app's allowed list can be fetched; others are refused before any test is
  spent.
- Pass a failure on in the app's own words: they say what went wrong (a test refused, a probe that didn't reach the Worker).
- Each step of a run is in the Worker's logs under the run's ID; `trace <ray id>` reads one
  request's Cloudflare log.

## Commands and tools

| Command | MCP tool | What it does | On the web |
| --- | --- | --- | --- |
| `cloudflare-ping test [--from TH] [--path /where] [--probes 1] [--host <target>]` | `test` | One test, to our probe or straight to a target (spends tests, needs sign-in) | `/` |
| `cloudflare-ping run [--target <url>] [--from TH] [--probes 2] [--repeat 1] [--inline] [--everywhere [--at BKK,SIN]]` | `run` | Start a run and follow its fetches as they're recorded; --everywhere: from every data centre the map reached (spends tests, needs sign-in) | `/runs` |
| `cloudflare-ping runs` | `runs` | The newest runs | `/runs` |
| `cloudflare-ping show <run id>` | `show` | One run and its fetches | `/runs/<id>` |
| `cloudflare-ping limits` | `limits` | How many tests the app has left this hour | `/runs` |
| `cloudflare-ping places [<what>] [--kind <kind>] [--limit <n>]` | `places` | Find a place to test from: continents, regions, countries, US states, cities and networks with probes, and Cloudflare's data centres | `/` |
| `cloudflare-ping coverage [--place Europe|TH] [--no-cities]` | `coverage` | All of Cloudflare's data centres and every probe, on a world map | `/coverage` |
| `cloudflare-ping map [--id <map id>]` | `map` | Which Cloudflare data centres the probes reach, and what it cost to find out | `/map` |
| `cloudflare-ping remap [--level country|city] [--countries TH,SG]` | `remap` | Start a new map: one test per place, worked through on a queue (spends tests, needs sign-in) | `/map` |
| `cloudflare-ping trace <ray id> [--minutes 60]` | `trace` | A request's Cloudflare log, by its cf-ray (needs sign-in) | `/trace/<ray>` |
| `cloudflare-ping init` | - | Set this project's coding agents up to use the app: its skill, its MCP server | `/docs/agents` |
| `cloudflare-ping sign-in` | - | Sign this machine in | `/login` |
| `cloudflare-ping sign-out` | - | Sign this machine out | `Sign out` |
| `cloudflare-ping whoami` | - | Who this machine is signed in as | `the top bar` |

Every command takes --site <url> (another copy of the app; the deployed one unless given), and those that print results take --json.

Signing in: These need this machine signed in: test, run, remap, trace. The first time, the command prints a link and a code: open the link, approve the code, and it carries on. If the sign-in has expired, it asks again. cloudflare-ping whoami shows whether you're signed in. In CI, set CLOUDFLARE_PING_TOKEN instead.

The docs: https://cloudflare-ping.gedw99.workers.dev/docs/ ("From an AI agent": https://cloudflare-ping.gedw99.workers.dev/docs/agents).
