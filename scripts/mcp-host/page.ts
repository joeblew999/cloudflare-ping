// `vp run mcp:host`'s page (plan 2026-11-21-02): an MCP Apps host, built from the official pieces
// every host uses (`@modelcontextprotocol/ext-apps`'s AppBridge and PostMessageTransport, the
// SDK's client), so the agent can see a tool's app as a host shows it. It talks to the app's /mcp
// through scripts/mcp-host.ts, which signs the requests in. `?tool=coverage&args={"place":"TH"}`
// calls it at once. It calls only tools that say they only read: it never spends tests.
import {
  AppBridge,
  PostMessageTransport,
  RESOURCE_MIME_TYPE,
  getToolUiResourceUri,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client, StreamableHTTPClientTransport, type Tool } from "@modelcontextprotocol/client";

// What every external origin gets inside the frame, unless the app's resource names it: nothing,
// as in Claude ("All external origins are blocked by default"). The app's own script and style
// are inline, its images data: URLs.
function withPolicy(
  html: string,
  csp: { connectDomains?: Array<string>; resourceDomains?: Array<string> },
) {
  const connect = (csp.connectDomains ?? []).join(" ") || "'none'";
  const resources = (csp.resourceDomains ?? []).join(" ");
  const policy = [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${resources}`,
    `style-src 'unsafe-inline' ${resources}`,
    `img-src data: blob: ${resources}`,
    `font-src data: ${resources}`,
    `connect-src ${connect}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  return html.includes("<head>") ? html.replace("<head>", `<head>${meta}`) : `${meta}${html}`;
}

const say = (id: string, text: string) => {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
};

function layout() {
  document.title = "mcp:host";
  const style = document.createElement("style");
  style.textContent =
    "body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1100px}iframe{width:100%;height:560px;border:1px solid #8884;border-radius:8px}code{font-size:13px}";
  document.head.appendChild(style);
  document.getElementById("root")?.replaceChildren(
    ...[
      ["h1", "mcp:host"],
      ["p", "Tools that only read: "],
      ["p", ""],
      ["p", ""],
      ["div", ""],
    ].map(([tag = "p", text = ""], index) => {
      const element = document.createElement(tag);
      element.textContent = text;
      const id = ["", "tools-line", "status", "app-status", "app"][index];
      if (id) {
        element.id = id;
      }
      if (index === 1) {
        const tools = document.createElement("code");
        tools.id = "tools";
        element.appendChild(tools);
      }
      return element;
    }),
  );
}

async function main() {
  layout();
  const client = new Client({ name: "cloudflare-ping mcp:host", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", window.location.href)));
  const { tools } = await client.listTools();
  const readOnly = tools.filter((each) => each.annotations?.readOnlyHint === true);
  say(
    "tools",
    readOnly
      .map((each) => `${each.name}${getToolUiResourceUri(each) ? " (has an app)" : ""}`)
      .join(", "),
  );

  const query = new URLSearchParams(window.location.search);
  const name = query.get("tool");
  if (!name) {
    say("status", "Add ?tool=<name>&args=<JSON> to call a tool.");
    return;
  }
  const tool: Tool | undefined = readOnly.find((each) => each.name === name);
  if (!tool) {
    say("status", `${name}: not a tool that only reads, so this host won't call it.`);
    return;
  }
  const parsed: unknown = JSON.parse(query.get("args") ?? "{}");
  const args =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed))
      : {};
  say("status", `Calling ${name} ${JSON.stringify(args)}…`);
  const result = await client.callTool({ name, arguments: args });
  const size = JSON.stringify(result).length;
  say(
    "status",
    `${name} ${JSON.stringify(args)}: ${result.isError ? "an error" : "answered"}, ${size.toLocaleString("en-US")} characters${size > 150_000 ? " (over Claude's limit of about 150,000)" : ""}.`,
  );

  const uri = getToolUiResourceUri(tool);
  if (!uri) {
    say("app", "No app: the answer is all a host shows.");
    return;
  }
  const read = await client.readResource({ uri });
  const page = read.contents.find((each) => each.mimeType === RESOURCE_MIME_TYPE);
  if (!page || !("text" in page)) {
    say("app", `${uri}: no page of type ${RESOURCE_MIME_TYPE}.`);
    return;
  }
  const ui = page._meta?.ui;
  const csp = typeof ui === "object" && ui !== null && "csp" in ui ? ui.csp : undefined;
  const allowed = typeof csp === "object" && csp !== null ? csp : {};
  const frame = document.createElement("iframe");
  // A walled-off frame, as hosts use: its own opaque origin, scripts only.
  frame.setAttribute("sandbox", "allow-scripts");
  frame.title = uri;
  frame.srcdoc = withPolicy(page.text, {
    connectDomains:
      "connectDomains" in allowed && Array.isArray(allowed.connectDomains)
        ? allowed.connectDomains.map(String)
        : [],
    resourceDomains:
      "resourceDomains" in allowed && Array.isArray(allowed.resourceDomains)
        ? allowed.resourceDomains.map(String)
        : [],
  });
  document.getElementById("app")?.replaceChildren(frame);
  const window_ = frame.contentWindow;
  if (!window_) {
    say("app", "The frame has no window.");
    return;
  }
  const bridge = new AppBridge(
    client,
    { name: "cloudflare-ping mcp:host", version: "1" },
    { openLinks: {}, serverTools: {}, serverResources: {}, logging: {} },
  );
  bridge.addEventListener("sizechange", ({ height }) => {
    if (typeof height === "number") {
      frame.style.height = `${height}px`;
    }
  });
  bridge.oninitialized = () => {
    say("app-status", `${uri}: the app is connected and has the answer.`);
    void bridge.sendToolInput({ arguments: args });
    void bridge.sendToolResult(result);
  };
  await bridge.connect(new PostMessageTransport(window_, window_));
}

main().catch((caught: unknown) => {
  say("status", `Failed: ${caught instanceof Error ? caught.message : String(caught)}`);
});
