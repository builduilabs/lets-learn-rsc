import "./webpack-apis";
import {
  Dispatch,
  SetStateAction,
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

  function navigate(path: string) {
    startTransition(() => {
      setCache((cache) => {
        let newCache = new Map(cache);
        newCache.delete(path);
        return newCache;
      });
      setPath(path);

      window.history.pushState({}, "", path);
      document.documentElement.scrollTop = 0;
    });
  }

  useEffect(() => {
    function onPopState(_event: PopStateEvent) {
      startTransition(() => {
        setPath(location.pathname);
      });
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

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

  return (
    <RouterProvider navigate={navigate}>{use(serverOutput)}</RouterProvider>
  );
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
