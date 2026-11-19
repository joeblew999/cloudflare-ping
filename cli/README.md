# cloudflare-ping

Our own Globalping, run from Cloudflare's own data centres: a Globalping test is only the way into
a data centre, and our Worker there does the fetching, and records it. These are its commands; each
does what its page on https://cloudflare-ping.gedw99.workers.dev does, through the same API.

```sh
npx cloudflare-ping test --from TH          # one Globalping test, to our probe
npx cloudflare-ping run --from DE --repeat 3 # start a run and follow its fetches
npx cloudflare-ping runs                     # the newest runs
npx cloudflare-ping show <run id>            # one run and its fetches
npx cloudflare-ping trace <ray id>           # a request's Cloudflare log, by its cf-ray
npx cloudflare-ping whoami                   # sign-in, sign-out too
npx cloudflare-ping help
```

Starting a test or a run, or reading Cloudflare's logs, needs you signed in: the first command that
needs it shows a link and a code; approve it in the browser and it stays signed in
(`~/.config/cloudflare-ping/tokens.json`). In CI, set `CLOUDFLARE_PING_TOKEN`. Every command takes
`--site <url>` and `--json`.

Node 22 or later. One file, no dependencies. How it's built, and why:
https://github.com/joeblew999/cloudflare-ping
