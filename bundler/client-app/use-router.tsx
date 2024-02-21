import { ReactNode, createContext, useContext } from "react";

type Routing = {
  navigate: (path: string) => void;
};

let Context = createContext<Routing>({
  navigate: () => {},
});

export function useRouter() {
  return useContext(Context);
}

export function RouterProvider({
  navigate,
  children,
}: {
  navigate: (path: string) => void;
  children: ReactNode;
}) {
  return <Context.Provider value={{ navigate }}>{children}</Context.Provider>;
}
