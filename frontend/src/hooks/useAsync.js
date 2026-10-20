import { useCallback, useEffect, useRef, useState } from "react";

/** Runs an async loader on mount (and on reload). Returns { data, error, loading, reload }. */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useRef(loader);
  run.current = loader;

  const load = useCallback(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    run.current(ctrl.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => { if (error.name !== "AbortError") setState({ data: null, error, loading: false }); });
    return () => ctrl.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => load(), [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: load };
}
