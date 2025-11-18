import "react";

declare module "react" {
  interface SVGAttributes<T> {
    lineHeight?: string | number;
  }

  interface HTMLAttributes<T> {
    xmlns?: string;
  }

  interface InputHTMLAttributes<T> {
    xmlns?: string;
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "pkt-icon": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        name?: string;
        size?: string;
        skin?: string;
      };
    }
  }

  interface Window {
    pktIconPath?: string;
  }
}

export {};
