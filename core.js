/* core.js - Logic & Search Engine */
const App = (function() {
  // Dependencies check
  if (typeof agnesData === "undefined") throw new Error("agnesData missing: make sure data.js is loaded first.");
  if (typeof Fuse === "undefined") throw new Error("Fuse.js missing: make sure the Fuse.js CDN is loaded.");

  // 1. Prepare Data
  const docs = agnesData.map(d => ({
    ...d,
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

      // Case A: No text -> Filter by category only
      if (!terms.length) {
        return docs
          .filter(d => !categoryFilter || d.categories.includes(categoryFilter))
          .sort((a, b) => b._dateSafe.localeCompare(a._dateSafe));
      }

      // Case B: Text Search via Fuse.js
      const results = fuse.search(query).filter(r => {
        return !categoryFilter || r.item.categories.includes(categoryFilter);
      });

      return results.map(r => r.item);
    }
  };
})();
