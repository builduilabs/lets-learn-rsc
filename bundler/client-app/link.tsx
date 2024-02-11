"use client";

import { MouseEvent } from "react";
import { useRouter } from "./use-router";

export default function Link({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  let { push } = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      push(href);
    }
  }

  return (
    <a href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
