---
layout: home

hero:
  name: cloudflare-ping
  text: Our own Globalping, run from Cloudflare's data centres
  tagline: A Globalping probe is only the way in. Our Worker, in the data centre it reaches, does the fetching, and records it.
  actions:
    - theme: brand
      text: Open the app
      link: https://cloudflare-ping.gedw99.workers.dev/
      target: _self
    - theme: alt
      text: What you can do
      link: /guide
    - theme: alt
      text: How it works
      link: /how-it-works

features:
  - title: One test, a whole data centre
    details: Globalping counts tests. Here one test only has to reach a data centre; from there our Worker fetches as much as you ask, and the target runs in that same data centre.
  - title: The same on the web and in a terminal
    details: Every action is one API route, one page and one command, in the repo with vp run and anywhere with the cloudflare-ping package.
  - title: Proven a step at a time
    details: Each step's question, its answer, and the raw evidence from Globalping and from Cloudflare's own logs.
---

## The newest runs

<LatestRuns />
