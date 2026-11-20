# Commands

<script setup>
import { data } from "./cli.data";
</script>

Each command does what a page of the app does, through the same API route. Run them from the repo
with `vp run`, or anywhere with the `cloudflare-ping` package. `cloudflare-ping help` prints this
same list: both read it from `packages/shared/src/commands.ts`.

<p v-for="line in data.common" :key="line">{{ line }}</p>

## Signing in

<p>{{ data.signingIn }}</p>

## Every command

<section v-for="command in data.commands" :key="command.name" class="command">
  <h3 :id="command.name">{{ command.name }}</h3>
  <p>{{ command.about }}.</p>
  <p v-if="command.signedIn"><strong>Needs this machine signed in</strong> (<a href="#signing-in">Signing in</a>).</p>
  <div class="language-sh"><pre><code>cloudflare-ping {{ command.use }}</code></pre></div>
  <ul>
    <li v-if="command.task">In the repo: <code>vp run {{ command.task }}</code></li>
    <li>On the web: <code>{{ command.page }}</code></li>
    <li>API: <code>{{ command.api }}</code></li>
    <li v-if="command.tool">MCP tool: <code>{{ command.tool }}</code>, at <code>/mcp</code></li>
  </ul>
</section>

## The CLI, as a package

<!--@include: ../../README.md#package-->
