/* ui.js - Handles DOM & Display */
(function() {
  // --- 1. View Helpers ---
  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[m]));
  }

  function highlight(text, query) {
    const safeText = escapeHtml(text);
    if (!query) return safeText;
    
    const terms = query.toLowerCase().split(" ").filter(t => t.length >= 2);
    let out = safeText;
    
    terms.forEach(t => {
       const safeTerm = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
       const re = new RegExp(`(${safeTerm})`, "ig");
       out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }

  function renderCard(d, query, isStandalone) {
    const q = isStandalone ? escapeHtml(d.question) : highlight(d.question, query);
    const a = isStandalone ? escapeHtml(d.answer) : highlight(d.answer, query);
    const catString = (d.categories && d.categories.length > 0) ? d.categories.join(", ") : "";

    return `
      <div class="question">${q}</div>
      <p class="answer">${a}</p>
      <div class="card-meta">
        ${escapeHtml(d.date || "")}
        ${catString ? " · " + escapeHtml(catString) : ""}
        ${d.url ? ` · <a href="${escapeHtml(d.url)}" target="_blank" rel="noopener">Källa</a>` : ""}
        · <a href="#id-${d.id}" class="share" data-share="${d.id}">Dela</a>
      </div>
      <div class="tags">
        ${(d.keywords || []).map(k => 
          `<span class="tag" data-kw="${escapeHtml(k)}">${escapeHtml(k)}</span>`
        ).join("")}
      </div>
    `;
  }

  // --- 2. DOM Elements ---
  const els = {
    sticky: document.getElementById("stickyBar"),
    resultsTop: document.getElementById("resultsTop"),
    hitsLine: document.getElementById("hitsLine"),
    input: document.getElementById("searchInput"),
    clearBtn: document.getElementById("clearBtn"),
    cats: document.getElementById("categories"),
    results: document.getElementById("results"),
    loadMoreWrap: document.getElementById("loadMoreWrap"),
    loadMoreBtn: document.getElementById("loadMoreBtn"),
    sharedWrap: document.getElementById("sharedWrap"),
    sharedCard: document.getElementById("sharedCard"),
    sharedClose: document.getElementById("sharedClose"),
    randomWrap: document.getElementById("randomWrap"),
    randomCard: document.getElementById("randomCard"),
    randomClose: document.getElementById("randomClose"),
    toggleBtn: document.getElementById("toggleCategories"),
    toggleLabel: document.getElementById("toggleLabel"),
    toggleHint: document.getElementById("toggleHint"),
    ingress: document.getElementById("ingress")
  };

  // --- 3. State ---
  let state = { cat: "", limit: 20, interacted: false };

  // --- 4. Logic/Controller ---
  function updateUI(scroll = false) {
    const query = els.input.value.trim();
    const hash = (location.hash || "").replace("#id-", "");

    if (hash && !state.interacted) {
      showShared(hash);
      return;
    }

    if (!query && !state.cat && !state.interacted) {
      showRandom();
      return;
    }

    els.sharedWrap.style.display = "none";
    els.randomWrap.style.display = "none";
    
    const results = App.search(query, state.cat);
    renderList(results, query);
    
    if (scroll) {
      const h = els.sticky.getBoundingClientRect().height;
      const y = els.resultsTop.getBoundingClientRect().top + window.scrollY - h - 8;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  }

  function renderList(list, query) {
    els.results.innerHTML = "";
    if (!list.length) {
      els.hitsLine.textContent = "Inga träffar.";
      els.loadMoreWrap.style.display = "none";
      return;
    }

    els.hitsLine.textContent = `${list.length} träffar${state.cat ? " i " + state.cat : ""}`;
    const visible = list.slice(0, state.limit);
    
    visible.forEach(d => {
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = renderCard(d, query, false);
      els.results.appendChild(el);
    });

    attachEvents(els.results);
    els.loadMoreWrap.style.display = state.limit < list.length ? "flex" : "none";
  }

  function showShared(id) {
    const d = App.getById(id);
    els.sharedWrap.style.display = "block";
    els.sharedCard.innerHTML = d ? renderCard(d, "", true) : "Länken verkar felaktig.";
    attachEvents(els.sharedWrap);
  }

  function showRandom() {
    els.randomWrap.style.display = "block";
    els.randomCard.innerHTML = renderCard(App.getRandom(), "", true);
    attachEvents(els.randomWrap);
  }

  function attachEvents(scope) {
    scope.querySelectorAll(".tag").forEach(tag => {
      tag.onclick = () => {
        state.interacted = true;
        els.input.value = (els.input.value.trim() + " " + tag.dataset.kw).trim();
        updateUI(true);
      };
    });

    scope.querySelectorAll(".share").forEach(a => {
      a.onclick = (e) => {
        e.preventDefault();
        const url = `${location.origin}${location.pathname}#id-${a.dataset.share}`;
        navigator.clipboard.writeText(url);
      };
    });
  }

  // --- 5. Event Listeners ---
  els.input.oninput = () => {
    state.interacted = true;
    state.limit = 20;
    updateUI();
  };

  els.loadMoreBtn.onclick = () => {
    state.limit += 20;
    updateUI();
  };

  App.getCategories().forEach(c => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = c;
    chip.onclick = () => {
      state.cat = state.cat === c ? "" : c;
      document.querySelectorAll(".chip").forEach(x => x.classList.toggle("active", x.textContent === state.cat));
      state.interacted = true;
      updateUI(true);
    };
    els.cats.appendChild(chip);
  });

  els.ingress.textContent = `Sök bland ${App.getCount()} svar baserat på podden “Fråga Agnes Wold”.`;
  window.onscroll = () => els.sticky.classList.toggle("scrolled", window.scrollY > 6);
  
  updateUI();
})();
