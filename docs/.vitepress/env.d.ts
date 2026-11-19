// What a .vue file is, for TypeScript in the docs' theme.
declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent;
  export default component;
}
