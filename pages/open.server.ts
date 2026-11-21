// `/open?to=<page>#token=…`: where `cloudflare-ping open` sends the browser (pages/open.tsx). The
// token is in the fragment, so it never reaches the server's logs; the page reads it.
import { defineHandler, defineHead, type InferProps } from "void";
import { localPath } from "../src/local-path";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler((c) => ({ to: localPath(c.req.query("to")) }));

export const head = defineHead(() => ({ title: "Signing in" }));
