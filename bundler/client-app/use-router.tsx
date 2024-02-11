import { ReactNode, createContext, useContext } from "react";

type Routing = {
  push: (path: string) => void;
};

let Context = createContext<Routing>({
  push: () => {},
});

export function useRouter() {
  return useContext(Context);
}

export function RouterProvider({
  push,
  children,
}: {
  push: (path: string) => void;
  children: ReactNode;
}) {
  return <Context.Provider value={{ push }}>{children}</Context.Provider>;
}
