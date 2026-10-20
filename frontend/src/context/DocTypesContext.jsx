import { createContext, useContext, useMemo } from "react";
import { api } from "../api/endpoints";
import { useAsync } from "../hooks/useAsync";

const Ctx = createContext(null);

/** Loads GET /doc-types once; every page reads the document types from here. */
export function DocTypesProvider({ children }) {
  const { data, error, loading, reload } = useAsync((signal) => api.docTypes(signal));
  const value = useMemo(() => {
    const types = data || [];
    return { types, byId: Object.fromEntries(types.map((t) => [t.type_id, t])), loading, error, reload };
  }, [data, error, loading, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useDocTypes = () => useContext(Ctx);
