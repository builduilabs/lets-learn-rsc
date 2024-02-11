import { ReactNode } from "react";
import Link from "../bundler/client-app/link";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html>
      <head>
        <title>Let's learn RSC!</title>
        <link rel="icon" href="data:;base64,iVBORw0KGgo=" />
        {/* @ts-ignore precedence allows react to load the stylesheet */}
        <link rel="stylesheet" href="/global.css" precedence="default" />
      </head>

      <body>
        <div>
          <p>Nav</p>
          <div>
            <Link href="/">Home</Link>
          </div>
          <div>
            <Link href="/counter">Client components</Link>
          </div>
          <div>
            <Link href="/server-actions">Server actions</Link>
          </div>
        </div>
        <div>{children}</div>
      </body>
    </html>
  );
}
