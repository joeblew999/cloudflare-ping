// The coverage map as an MCP App (plan 2026-11-21-02): the coverage tool's answer drawn on the
// site's own world map, inside an AI's chat. The same map (src/WorldMap.tsx), the same points
// (src/coverage-points.ts), the same answer checked by the same schema the command answers with
// (src/commands/coverage-answer.ts). The host lets it load nothing, so everything comes with it,
// built into one page (void-commands/vite): the world's outline too. When the answer has no
// cities (`cities: false`, which keeps an answer small for the model), it asks the same tool for
// them, a continent at a time, so each answer stays small.
import { useApp, useDocumentTheme, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { coverageHeadline } from "@cloudflare-ping/shared/coverage";
import world from "../../public/world.svg?raw";
import { coverageAnswer, type CoverageAnswer } from "../commands/coverage-answer";
import { coveragePoints } from "../coverage-points";
import { WorldMap } from "../WorldMap";
import "@cloudflare-ping/theme/vars.css";
import "./coverage.css";

// The land's outline, from the same file the site draws (public/world.svg: one path).
const LAND = /\sd="([^"]+)"/.exec(world)?.[1] ?? "";

function CoverageApp() {
  const [answer, setAnswer] = useState<CoverageAnswer | null>(null);
  const [asked, setAsked] = useState<Record<string, unknown>>({});
  const [cities, setCities] = useState<CoverageAnswer["cities"]>([]);
  const [note, setNote] = useState("Waiting for the coverage tool's answer…");
  const { app, error } = useApp({
    appInfo: { name: "cloudflare-ping coverage map", version: "1" },
    capabilities: {},
    onAppCreated: (created) => {
      created.ontoolinput = ({ arguments: given }) => setAsked(given ?? {});
      created.ontoolresult = (result) => {
        const parsed = coverageAnswer.safeParse(result.structuredContent);
        if (parsed.success) {
          setAnswer(parsed.data);
          setCities(parsed.data.cities);
          setNote("");
        } else {
          setNote("The answer isn't the coverage tool's.");
        }
      };
    },
  });
  useHostStyles(app, app?.getHostContext());
  // The host says light or dark (`data-theme`); VitePress's colours follow `.dark`.
  const theme = useDocumentTheme();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // No cities in the answer (asked for without them): the same tool, a continent at a time.
  useEffect(() => {
    if (!app || !answer || asked.cities !== false) {
      return;
    }
    const places = answer.place ? [answer.place.value] : answer.continents.map((each) => each.name);
    setNote(`Drawing the probe cities, ${places.length === 1 ? "" : "a continent at a time"}…`);
    void Promise.all(
      places.map((place) =>
        app.callServerTool({ name: "coverage", arguments: { place, cities: true } }),
      ),
    ).then((results) => {
      setCities(
        results.flatMap(
          (result) => coverageAnswer.safeParse(result.structuredContent).data?.cities ?? [],
        ),
      );
      setNote("");
    });
  }, [app, answer, asked]);

  if (error) {
    return <p className="note">Couldn&apos;t connect to the chat: {error.message}</p>;
  }
  if (!answer) {
    return <p className="note">{note}</p>;
  }
  return (
    <figure className="coverage">
      <WorldMap
        points={coveragePoints({ cities, datacentres: answer.datacentres })}
        zoom={answer.place !== null}
        land={LAND}
        label={coverageHeadline(answer)}
      />
      <figcaption>
        <span className="key dc" /> Cloudflare data centres · <span className="key probe" /> Probes
        · {coverageHeadline(answer)}
        {note ? ` ${note}` : ""}
      </figcaption>
    </figure>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <CoverageApp />
    </StrictMode>,
  );
}
