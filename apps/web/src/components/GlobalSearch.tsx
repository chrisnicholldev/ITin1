import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Monitor, Ticket, BookOpen, ContactRound, Building2, Loader2 } from 'lucide-react';
import { globalSearch, type SearchResults } from '@/api/search';

// ── Helpers ───────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function statusDot(status: string) {
  const colours: Record<string, string> = {
    open: 'bg-blue-500', in_progress: 'bg-yellow-500', pending: 'bg-orange-400',
    resolved: 'bg-green-500', closed: 'bg-zinc-400',
    active: 'bg-green-500', inactive: 'bg-zinc-400', decommissioned: 'bg-red-400',
    in_repair: 'bg-orange-400', in_stock: 'bg-blue-400',
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${colours[status] ?? 'bg-zinc-400'}`} />;
}

// ── Flat list of all result items for keyboard nav ────────────────────────────

interface NavItem { href: string; key: string }

function buildNavItems(results: SearchResults): NavItem[] {
  const items: NavItem[] = [];
  results.assets.forEach(a   => items.push({ href: `/assets/${a.id}`,      key: `asset-${a.id}` }));
  results.tickets.forEach(t  => items.push({ href: `/tickets/${t.id}`,     key: `ticket-${t.id}` }));
  results.docs.forEach(d     => items.push({ href: `/docs/articles/${d.slug}`, key: `doc-${d.slug}` }));
  results.contacts.forEach(c => items.push({ href: `/contacts`,             key: `contact-${c.id}` }));
  results.vendors.forEach(v  => items.push({ href: `/vendors`,              key: `vendor-${v.id}` }));
  return items;
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
        <Icon className="h-3 w-3" /> {label}
      </div>
      {children}
    </div>
  );
}

// ── Result row ────────────────────────────────────────────────────────────────

function Row({ navKey, focused, onClick, children }: {
  navKey: string; focused: boolean; onClick: () => void; children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (focused) ref.current?.scrollIntoView({ block: 'nearest' }); }, [focused]);
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 rounded-md text-sm transition-colors ${
        focused ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
      }`}
      data-key={navKey}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQ = useDebounce(query, 200);

  const { data: results, isFetching } = useQuery({
    queryKey: ['global-search', debouncedQ],
    queryFn: () => globalSearch(debouncedQ),
    enabled: debouncedQ.trim().length >= 2,
    placeholderData: { assets: [], tickets: [], docs: [], contacts: [], vendors: [] },
  });

  const navItems = results ? buildNavItems(results) : [];
  const total = navItems.length;

  // ── Open / close ────────────────────────────────────────────────────────────

  const openSearch = useCallback(() => {
    setOpen(true);
    setQuery('');
    setCursor(0);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const close = useCallback(() => { setOpen(false); setQuery(''); }, []);

  // ── Keyboard shortcut (Cmd+K / Ctrl+K) ──────────────────────────────────────

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); open ? close() : openSearch(); }
      if (!open) return;
      if (e.key === 'Escape') { close(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, total - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
      if (e.key === 'Enter' && navItems[cursor]) { navigate(navItems[cursor].href); close(); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, cursor, navItems, total, navigate, close, openSearch]);

  // Reset cursor when results change
  useEffect(() => { setCursor(0); }, [debouncedQ]);

  function go(href: string) { navigate(href); close(); }

  const empty = results && total === 0 && debouncedQ.trim().length >= 2 && !isFetching;

  // ── Trigger button ────────────────────────────────────────────────────────

  const TriggerButton = () => (
    <button
      onClick={openSearch}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground bg-muted/50 hover:bg-muted transition-colors"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 text-xs bg-background border rounded px-1 py-0.5 font-mono">
        <span>⌘</span><span>K</span>
      </kbd>
    </button>
  );

  return (
    <>
      <TriggerButton />

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4" onClick={close}>
          <div
            className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b">
              {isFetching
                ? <Loader2 className="h-4 w-4 text-zinc-400 animate-spin shrink-0" />
                : <Search className="h-4 w-4 text-zinc-400 shrink-0" />}
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search assets, tickets, docs, contacts…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-zinc-400"
              />
              <kbd className="text-xs text-zinc-400 border rounded px-1.5 py-0.5 font-mono">Esc</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
              {empty && (
                <p className="text-center text-sm text-zinc-400 py-8">No results for "{debouncedQ}"</p>
              )}

              {!results || (total === 0 && !empty) ? (
                <p className="text-center text-sm text-zinc-400 py-8">
                  {debouncedQ.trim().length < 2 ? 'Type at least 2 characters to search' : ''}
                </p>
              ) : null}

              {results && results.assets.length > 0 && (
                <Section icon={Monitor} label="Assets">
                  {results.assets.map(a => {
                    const idx = navItems.findIndex(n => n.key === `asset-${a.id}`);
                    return (
                      <Row key={a.id} navKey={`asset-${a.id}`} focused={cursor === idx} onClick={() => go(`/assets/${a.id}`)}>
                        {statusDot(a.status)}
                        <span className="font-medium truncate">{a.name}</span>
                        <span className="text-zinc-400 font-mono text-xs shrink-0">{a.assetTag}</span>
                        <span className="text-zinc-400 text-xs shrink-0 capitalize">{a.type.toLowerCase().replace('_', ' ')}</span>
                      </Row>
                    );
                  })}
                </Section>
              )}

              {results && results.tickets.length > 0 && (
                <Section icon={Ticket} label="Tickets">
                  {results.tickets.map(t => {
                    const idx = navItems.findIndex(n => n.key === `ticket-${t.id}`);
                    return (
                      <Row key={t.id} navKey={`ticket-${t.id}`} focused={cursor === idx} onClick={() => go(`/tickets/${t.id}`)}>
                        {statusDot(t.status)}
                        <span className="font-mono text-xs text-zinc-400 shrink-0">{t.ticketNumber}</span>
                        <span className="truncate">{t.title}</span>
                      </Row>
                    );
                  })}
                </Section>
              )}

              {results && results.docs.length > 0 && (
                <Section icon={BookOpen} label="Docs">
                  {results.docs.map(d => {
                    const idx = navItems.findIndex(n => n.key === `doc-${d.slug}`);
                    return (
                      <Row key={d.slug} navKey={`doc-${d.slug}`} focused={cursor === idx} onClick={() => go(`/docs/articles/${d.slug}`)}>
                        <span className="truncate">{d.title}</span>
                        {d.folder && <span className="text-zinc-400 text-xs shrink-0">{d.folder}</span>}
                      </Row>
                    );
                  })}
                </Section>
              )}

              {results && results.contacts.length > 0 && (
                <Section icon={ContactRound} label="Contacts">
                  {results.contacts.map(c => {
                    const idx = navItems.findIndex(n => n.key === `contact-${c.id}`);
                    return (
                      <Row key={c.id} navKey={`contact-${c.id}`} focused={cursor === idx} onClick={() => go('/contacts')}>
                        <span className="font-medium truncate">{c.displayName}</span>
                        {c.company && <span className="text-zinc-400 text-xs shrink-0">{c.company}</span>}
                        {c.email && <span className="text-zinc-400 text-xs shrink-0">{c.email}</span>}
                      </Row>
                    );
                  })}
                </Section>
              )}

              {results && results.vendors.length > 0 && (
                <Section icon={Building2} label="Vendors">
                  {results.vendors.map(v => {
                    const idx = navItems.findIndex(n => n.key === `vendor-${v.id}`);
                    return (
                      <Row key={v.id} navKey={`vendor-${v.id}`} focused={cursor === idx} onClick={() => go('/vendors')}>
                        <span className="font-medium truncate">{v.name}</span>
                        <span className="text-zinc-400 text-xs shrink-0 capitalize">{v.type}</span>
                      </Row>
                    );
                  })}
                </Section>
              )}
            </div>

            {/* Footer hint */}
            {total > 0 && (
              <div className="border-t px-4 py-2 flex gap-4 text-xs text-zinc-400">
                <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono">↵</kbd> open</span>
                <span><kbd className="font-mono">Esc</kbd> close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
