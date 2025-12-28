    const App = (function() {
      if (typeof agnesData === "undefined") throw new Error("agnesData missing");
      if (typeof Fuse === "undefined") throw new Error("Fuse.js missing");

      const docs = agnesData.map(d => ({
        ...d,
        categories: Array.isArray(d.categories) ? d.categories : [],
        _keywordsText: (d.keywords || []).join(" "),
        _dateSafe: d.date || ""
      }));

      const byId = new Map(docs.map(d => [String(d.id), d]));

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

      function tokenize(str) {
        return (str || "").toLowerCase()
          .replace(/[^\p{L}\p{N}\s]+/gu, " ")
          .replace(/\s+/g, " ")
          .trim().split(" ").filter(Boolean);
      }

      return {
        getById: (id) => byId.get(String(id)),
        getRandom: () => docs[Math.floor(Math.random() * docs.length)],
        getCategories: () => {
          const set = new Set();
          docs.forEach(d => { d.categories.forEach(c => set.add(c)); });
          return [...set].sort((a, b) => a.localeCompare(b, "sv"));
        },
        getCount: () => docs.length,
        search: (query, categoryFilter) => {
          const terms = tokenize(query);
          if (!terms.length) {
            return docs
              .filter(d => !categoryFilter || d.categories.includes(categoryFilter))
              .sort((a, b) => b._dateSafe.localeCompare(a._dateSafe));
          }
          const LIMIT = 500;
          const MIN_FULL_RESULTS = 15;
          const TERM_BONUS = 0.05;

          function passesCategory(item) {
            return !categoryFilter || item.categories.includes(categoryFilter);
          }

          const fullRes = fuse.search(query, { limit: LIMIT }).filter(r => passesCategory(r.item));
          const fullMap = new Map();
          for (const r of fullRes) fullMap.set(String(r.item.id), (r.score ?? 1));

          if (fullRes.length >= MIN_FULL_RESULTS || terms.length === 1) {
            return docs
              .filter(d => fullMap.has(String(d.id)))
              .sort((a, b) => (fullMap.get(String(a.id)) - fullMap.get(String(b.id))) || (b._dateSafe.localeCompare(a._dateSafe)));
          }

          const agg = new Map();
          for (const t of terms) {
            const res = fuse.search(t, { limit: LIMIT });
            for (const r of res) {
              if (!passesCategory(r.item)) continue;
              const id = String(r.item.id);
              const s = (r.score ?? 1);
              const prev = agg.get(id);
              if (!prev) { agg.set(id, { sum: s, count: 1, best: s }); } 
              else { prev.sum += s; prev.count += 1; if (s < prev.best) prev.best = s; }
            }
          }

          const finalScore = new Map();
          const ids = new Set([...fullMap.keys(), ...agg.keys()]);
          for (const id of ids) {
            const full = fullMap.get(id);
            const a = agg.get(id);
            const count = a ? a.count : 0;
            const avg = a ? (a.sum / a.count) : 1;
            const best = a ? a.best : avg;
            const aggScore = (best * 0.7) + (avg * 0.3);
            const base = (full !== undefined) ? (full * 0.65 + aggScore * 0.35) : aggScore;
            finalScore.set(id, base - (count * TERM_BONUS));
          }
          return docs
            .filter(d => finalScore.has(String(d.id)))
            .sort((a, b) => (finalScore.get(String(a.id)) - finalScore.get(String(b.id))) || (b._dateSafe.localeCompare(a._dateSafe)));
        }
      };
    })();
