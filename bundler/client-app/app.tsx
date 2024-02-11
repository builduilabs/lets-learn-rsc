import "./webpack-apis";
import {
  Dispatch,
  SetStateAction,
  Suspense,
  startTransition,
  use,
  useEffect,
  useState,
} from "react";
import {
  encodeReply,
  createFromFetch,
  // @ts-expect-error
} from "react-server-dom-webpack/client";
import { RouterProvider } from "./use-router";

let initialCache = new Map();

type Update = {
  setCache: Dispatch<SetStateAction<Map<string, any>>>;
};

let update: Update = {
  setCache: () => {},
};

export function App() {
  let url = new URL(window.location.href);
  let [path, setPath] = useState(url.pathname);
  let [cache, setCache] = useState(initialCache);

  function push(path: string) {
    startTransition(() => {
      setCache((cache) => {
        let newCache = new Map(cache);
        newCache.delete(path);
        return newCache;
      });
      setPath(path);
    });
  }

  useEffect(() => {
    update.setCache = setCache;
    return () => {
      update.setCache = () => {};
    };
  });

  if (!cache.has(path)) {
    let encodedUrl = encodeURIComponent(path);
    let p = fetch(`/__rsc?path=${encodedUrl}`, {
      headers: {
        Accept: "text/x-component",
      },
    });

    let lazyRoot = createFromFetch(p, {
      callServer,
    });

    cache.set(path, lazyRoot);
  }

  let serverOutput = cache.get(path);

  return <RouterProvider push={push}>{use(serverOutput)}</RouterProvider>;
}

async function callServer(id: string, args: unknown) {
  let body = await encodeReply(args);
  let path = location.pathname;

  let p = fetch("/__rsc", {
    method: "POST",
    headers: {
      Accept: "text/x-component",
      "x-rsc-server-reference": id,
      "x-rsc-path": path,
    },
    body,
  });

  let rscTree = createFromFetch(p, {
    callServer,
  });

  startTransition(() => {
    update.setCache((cache) => {
      let newCache = new Map(cache);
      newCache.set(path, rscTree);
      return newCache;
    });
  });
}
