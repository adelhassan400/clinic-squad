import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, User, Phone, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useListPatients, getListPatientsQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 8;

export function GlobalSearch() {
  const { clinic } = useAuth();
  const clinicId = clinic?.id ?? "";
  const [, setLocation] = useLocation();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Debounce typing
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);

  const params = { search: debounced || undefined };
  const { data, isFetching } = useListPatients(clinicId, params, {
    query: {
      enabled: !!clinicId && debounced.length >= 1,
      queryKey: getListPatientsQueryKey(clinicId, params),
      staleTime: 5_000,
    },
  });

  const results = (data?.data ?? []).slice(0, MAX_RESULTS);

  // Reset highlight when results change
  useEffect(() => { setHighlight(0); }, [debounced, results.length]);

  // Cmd/Ctrl+K to focus, Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      } else if (e.key === "Escape") {
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        }
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Outside click closes
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [open]);

  function go(patientId: string) {
    setOpen(false);
    setQuery("");
    setLocation(`/patients/${patientId}`);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => Math.min(h + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (results[highlight]) {
        e.preventDefault();
        go(results[highlight].id);
      }
    }
  }

  const showDropdown = open && debounced.length >= 1;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
      <div className="relative">
        <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query) setOpen(true); }}
          onKeyDown={onInputKey}
          placeholder="Search patients (PT-0001, name)…"
          className={cn(
            "w-full h-9 ps-9 pe-16 rounded-lg text-sm",
            "bg-muted/40 border border-border focus:bg-background",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
            "placeholder:text-muted-foreground/70 transition-colors"
          )}
          data-testid="input-global-search"
        />
        {query ? (
          <button
            type="button"
            onClick={() => { setQuery(""); setOpen(false); inputRef.current?.focus(); }}
            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden md:flex absolute end-2 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 h-5 rounded border border-border bg-background text-[10px] font-mono text-muted-foreground/80 select-none">
            ⌘K
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1.5 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {isFetching && results.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              No patients match "{debounced}"
            </div>
          ) : (
            <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
              {results.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => go(p.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 flex items-center gap-3 transition-colors",
                      i === highlight ? "bg-primary/10" : "hover:bg-muted/60"
                    )}
                    data-testid={`global-search-result-${p.code ?? p.id}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{p.name}</span>
                        {p.code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                            {p.code}
                          </span>
                        )}
                      </div>
                      {p.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />{p.phone}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
              {data && data.total > results.length && (
                <li className="px-3 py-2 text-[11px] text-muted-foreground text-center border-t border-border">
                  Showing {results.length} of {data.total} — refine your search
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
