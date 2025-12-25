/* core.js */
const App = (function() {
  // Dependencies check
  if (typeof agnesData === "undefined") throw new Error("agnesData missing");
  if (typeof Fuse === "undefined") throw new Error("Fuse.js missing");

  // 1. Prepare Data
  const docs = agnesData.map(d => ({
    ...d,
    // Ensure categories is always an array
    categories: Array.isArray(d.categories) ? d.categories : [],
    _keywordsText: (d.keywords || []).join(" "),
    _dateSafe: d.date || ""
  }));

  const byId = new Map(docs.map(d => [String(d.id), d]));

  // 2. Setup Search Engine
  const fuse = new Fuse(docs, {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.35,
    minMatchCharLength: 2,
    keys: [
      { name: "question", weight: 0.60 },
      { name: "_keywordsText", weight: 0.28 },
      { name: "answer", weight: 0.12 }
    ]
  });

  // 3. Helper: Clean up search terms
  function tokenize(str) {
    return (str || "").toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim().split(" ").filter(Boolean);
  }

  // --- Public API ---
  return {
    getById: (id) => byId.get(String(id)),
    
    getRandom: () => docs[Math.floor(Math.random() * docs.length)],
    
    // NEW: Flattens the arrays to get a unique list of all categories
    getCategories: () => {
      const set = new Set();
      docs.forEach(d => {
        d.categories.forEach(c => set.add(c));
      });
      return [...set].sort((a, b) => a.localeCompare(b, "sv"));
    },

    getCount: () => docs.length,

    search: (query, categoryFilter) => {
      const terms = tokenize(query);

      // Case A: No text -> Filter by category
      if (!terms.length) {
        return docs
          .filter(d => !categoryFilter || d.categories.includes(categoryFilter))
          .sort((a, b) => b._dateSafe.localeCompare(a._dateSafe));
      }

      // Case B: Text Search
      const maps = terms.map(t => {
        const res = fuse.search(t, { limit: 500 });
        const m = new Map();
        for (const r of res) {
          // NEW: Check if the category array includes the filter
          if (categoryFilter && !r.item.categories.includes(categoryFilter)) {
            continue;
          }
          m.set(String(r.item.id), (r.score ?? 1));
        }
        return m;
      });

      if (!maps.length) return [];

      const first = maps[0];
      const scored = [];

      for (const [id, sc] of first.entries()) {
        let total = sc;
        let match = true;
        for (let i = 1; i < maps.length; i++) {
          const v = maps[i].get(id);
          if (v === undefined) { match = false; break; }
          total += v;
        }
        if (match) scored.push({ id, score: total });
      }

      scored.sort((a, b) => a.score - b.score);
      const scoreMap = new Map(scored.map(x => [x.id, x.score]));

      return docs
        .filter(d => scoreMap.has(String(d.id)))
        .sort((a, b) => (scoreMap.get(String(a.id)) - scoreMap.get(String(b.id))) || (b._dateSafe.localeCompare(a._dateSafe)));
    }
  };
})();