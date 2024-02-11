import { createRouter } from "@hattip/router";
import { createServer } from "@hattip/adapter-node";
import { fileURLToPath, pathToFileURL } from "url";
import { readFile } from "fs/promises";
import { createElement } from "react";
import {
  renderToReadableStream,
  decodeReply,
  // @ts-ignore
} from "react-server-dom-webpack/server.edge";

import { buildAll } from "./build.js";
import { parseHeaderValue } from "@hattip/headers";

let build = await buildAll();

let app = createRouter();
let cwdUrl = pathToFileURL(`${process.cwd()}/`);
let clientComponentsUrl = new URL("./.learn-rsc/apps/client-app/", cwdUrl);
let rscComponentsUrl = new URL("./.learn-rsc/apps/rsc/", cwdUrl);

app.get("/__rsc", async (ctx) => {
  let url = new URL(ctx.request.url);
  let path = url.searchParams.get("path") ?? "/";
  let requestUrl = new URL(path, url);
  let request = new Request(requestUrl, ctx.request);
  let file = path === "/" ? "index" : path;

  let layoutUrl = new URL(`./layout.js`, rscComponentsUrl);
  let fileUrl = new URL(`./${file}.page.js`, rscComponentsUrl);
  let layout = await import(fileURLToPath(layoutUrl));
  let page = await import(fileURLToPath(fileUrl));

  console.log("🟢 Rendering RSC", requestUrl.pathname);

  if (!layout) {
    throw new Error("Layout not found");
  }

  if (!page) {
    throw new Error("Page not found");
  }

  let reactTree = createElement(
    layout.default,
    {},
    createElement(page.default, {}),
  );
  let stream = renderToReadableStream(reactTree, build.clientComponentMap);

  return new Response(stream, {
    headers: { "Content-type": "text/x-component" },
  });
});

app.post("/__rsc", async (ctx) => {
  let serverReference = ctx.request.headers.get("x-rsc-server-reference");
  let path = ctx.request.headers.get("x-rsc-path");

  if (!serverReference) {
    throw new Error("No server action specified");
  }

  if (!path) {
    throw new Error("No path specified");
  }

  let file = path === "/" ? "index" : path;
  let layoutUrl = new URL(`./layout.js`, rscComponentsUrl);
  let fileUrl = new URL(`./${file}.page.js`, rscComponentsUrl);
  let layout = await import(fileURLToPath(layoutUrl));
  let page = await import(fileURLToPath(fileUrl));

  if (!layout) {
    throw new Error("Layout not found");
  }

  if (!page) {
    throw new Error("Page not found");
  }

  let [actionId, name] = serverReference.split("#");
  console.log("🟣 Running action", name);

  let url = new URL(ctx.request.url);
  let requestUrl = new URL(path, url);
  let request = new Request(requestUrl, ctx.request);

  let args = [];
  let [contentType] = parseHeaderValue(request.headers.get("content-type"));

  if (contentType.value === "text/plain") {
    let text = await request.text();
    args = await decodeReply(text);
  } else if (contentType.value === "multipart/form-data") {
    let formData = await request.formData();
    args = await decodeReply(formData);
  }

  let action = build.serverActionMap[serverReference];
  if (!action) {
    throw new Error(`Could not find action: ${actionId}`);
  }

  let actionModule = await import(action.path);
  let actionFn = actionModule[action.export];

  // invoke the action!
  await actionFn(...args);

  let reactTree = createElement(
    layout.default,
    {},
    createElement(page.default, {}),
  );
  let stream = renderToReadableStream(reactTree, build.clientComponentMap);

  return new Response(stream, {
    headers: { "Content-type": "text/x-component" },
  });
});

app.get("/global.css", async (ctx) => {
  let fileUrl = new URL(`./global.css`, rscComponentsUrl);
  let contents = await readFile(fileUrl, "utf-8");

  return new Response(contents, {
    headers: {
      "Content-Type": "text/css",
    },
  });
});

app.get("/**/*.js", async (ctx) => {
  let url = new URL(ctx.request.url);
  let file = url.pathname;

  let fileUrl = new URL(`./${file}`, clientComponentsUrl);
  let contents = await readFile(fileUrl, "utf-8");

  return new Response(contents, {
    headers: {
      "Content-Type": "application/javascript",
    },
  });
});

app.get("/**/*", async (ctx) => {
  let html = `<script type="module" src="/entries/initialize.js"></script>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
});

createServer(app.buildHandler()).listen(3000, "localhost", () => {
  console.log("Server listening on http://localhost:3000");
});
