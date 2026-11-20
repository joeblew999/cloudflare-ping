import { defineHandler, defineHead, type InferProps } from "void";
import { show, showParams } from "../../src/commands/runs";

export type Props = InferProps<typeof loader>;

// The same as `GET /api/runs/<id>` (src/commands/runs.ts); no such run is Void's 404 page.
export const loader = defineHandler.withValidator({ params: showParams })((_c, { params }) =>
  show(params),
);

export const head = defineHead<Props>((_c, props) => ({
  title: `A run of ${new URL(props.run.target).pathname}`,
}));
