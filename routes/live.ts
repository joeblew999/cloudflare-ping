// `/live`: Void's live stream (src/live.ts). `GET` opens a page's one SSE connection; `POST`
// subscribes it to a run's topic, or unsubscribes it.
import { defineHandler } from "void";
import { live } from "../src/live";

export const GET = defineHandler((c) => live.connect(c));

export const POST = defineHandler((c) => live.control(c));
