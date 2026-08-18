declare module 'marked-terminal' {
  import type { MarkedExtension } from 'marked';

  export interface MarkedTerminalOptions {
    width?: number;
    reflowText?: boolean;
    tab?: number;
    unescape?: boolean;
    emoji?: boolean;
    image?: (href: string, title: string | null, text: string) => string;
    [key: string]: unknown;
  }

  export function markedTerminal(
    options?: MarkedTerminalOptions,
    highlightOptions?: unknown,
  ): MarkedExtension;

  const Renderer: unknown;
  export default Renderer;
}
