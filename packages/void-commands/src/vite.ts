// A page built into one HTML string, its script and its style inside it, for the build (Node only).
// What an MCP App's page must be: the host shows it walled off, where it can load nothing, so
// everything comes with it. Built as yagipass/nestodo builds its stats app in its Void app.
// `mcpApps` makes each app's page a module the Worker imports (`virtual:mcp-app/<name>`, from
// `<dir>/<name>.tsx`), so it reads nothing from disk; `onePage` is the same build for a script's
// own page (`vp run mcp:host`).
import { build, type Plugin } from "vite-plus";

const PREFIX = "virtual:mcp-app/";

export async function onePage(entry: string, title: string) {
  const result = await build({
    configFile: false,
    logLevel: "warn",
    build: {
      write: false,
      cssCodeSplit: false,
      rolldownOptions: { input: entry, output: { codeSplitting: false } },
    },
  });
  if (Array.isArray(result) || !("output" in result)) {
    throw new Error(`${entry} didn't build into one bundle`);
  }
  const [script, ...rest] = result.output;
  const styles = rest.flatMap((file) =>
    file.type === "asset" && file.fileName.endsWith(".css") ? [String(file.source)] : [],
  );
  const others = rest.filter((file) => !(file.type === "asset" && file.fileName.endsWith(".css")));
  if (others.length > 0) {
    throw new Error(
      `${entry} must build into one script and its style, but built ${result.output.map((file) => file.fileName).join(", ")}`,
    );
  }
  const html = [
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>`,
    `<style>${styles.join("\n")}</style></head><body><div id="root"></div>`,
    // A `</script` inside the code would end the tag early.
    `<script type="module">${script.code.replaceAll("</script", "<\\/script")}</script></body></html>`,
  ].join("");
  const files = script.moduleIds.filter(
    (file) => !file.startsWith("\0") && !file.includes("/node_modules/"),
  );
  return { html, files };
}

// Each MCP App's page, from `<dir>/<name>.tsx`, as the default export of `virtual:mcp-app/<name>`.
export function mcpApps(options: { dir: string }): Plugin {
  return {
    name: "void-commands:mcp-apps",
    resolveId: (id) => (id.startsWith(PREFIX) ? `\0${id}` : null),
    async load(id) {
      if (!id.startsWith(`\0${PREFIX}`)) {
        return null;
      }
      const name = id.slice(PREFIX.length + 1);
      const { html, files } = await onePage(`${options.dir}/${name}.tsx`, name);
      for (const file of files) {
        this.addWatchFile(file);
      }
      return `export default ${JSON.stringify(html)};`;
    },
  };
}
