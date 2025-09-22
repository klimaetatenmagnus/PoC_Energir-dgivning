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
