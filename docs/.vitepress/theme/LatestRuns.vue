<script setup lang="ts">
// The newest runs, live from the app (runs.ts), each linked to its page in the app.
import { onMounted, ref } from "vue";
import { latestRuns, type RunSummary } from "./runs";

const runs = ref<Array<RunSummary>>([]);
const state = ref<"loading" | "ready" | "away">("loading");

// Here, not in the template: a Vue template can't reach `URL` (only a few globals).
const pathOf = (target: string) => new URL(target).pathname;
const startedAt = (createdAt: string) => createdAt.slice(0, 16).replace("T", " ");

onMounted(async () => {
  try {
    runs.value = await latestRuns(5);
    state.value = "ready";
  } catch {
    // `vitepress dev` serves the docs alone, without the app.
    state.value = "away";
  }
});
</script>

<template>
  <div class="latest-runs">
    <p v-if="state === 'loading'">Asking the app…</p>
    <p v-else-if="state === 'away'">
      The newest runs show here when the docs are served by the app (<code>/docs/</code>).
    </p>
    <p v-else-if="runs.length === 0">No runs yet.</p>
    <table v-else>
      <thead>
        <tr>
          <th>Started</th>
          <th>From</th>
          <th>Probes</th>
          <th>Recorded</th>
          <th>Target</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="run in runs" :key="run.id">
          <td>
            <a :href="`/runs/${run.id}`" target="_self">{{ startedAt(run.createdAt) }}</a>
          </td>
          <td>{{ run.fromPlace ?? "?" }}</td>
          <td>{{ run.probes ?? "?" }} × {{ run.repeat ?? 1 }}</td>
          <td>{{ run.fetches }} fetches</td>
          <td>{{ pathOf(run.target) }}</td>
        </tr>
      </tbody>
    </table>
    <p><a href="/runs" target="_self">All runs, and start one</a></p>
  </div>
</template>
