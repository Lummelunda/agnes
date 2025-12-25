/* ui.js - Handles DOM & Display */

// --- 1. View Helpers (HTML Generation) ---
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
  
  const shareHtml = ` · <a href="#id-${escapeHtml(String(d.id))}" class="share" data-share="${escapeHtml(String(d.id))}">Dela</a>`;
  
  // NEW: Join the categories array for display
  const catString = (d.categories && d.categories.length > 0) 
    ? d.categories.join(", ") 
    : "";

  return `
    <div class="question">${q}</div>
    <p class="answer">${a}</p>
    <div class="card-meta">
      ${escapeHtml(d.date || "")}
      ${catString ? " · " + escapeHtml(catString) : ""}
      ${d.url ? ` · <a href="${escapeHtml(d.url)}" target="_blank" rel="noopener">Källa</a>` : ""}
      ${shareHtml}
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
  
  // Panels
  sharedWrap: document.getElementById("sharedWrap"),
  sharedCard: document.getElementById("sharedCard"),
  sharedClose: document.getElementById("sharedClose"),
  randomWrap: document.getElementById("randomWrap"),
  randomCard: document.getElementById("randomCard"),
  randomClose: document.getElementById("randomClose"),
  
  // Controls
  toggleBtn: document.getElementById("toggleCategories"),
  toggleLabel: document.getElementById("toggleLabel"),
  toggleHint: document.getElementById("toggleHint"),
  themeBtn: document.getElementById("themeToggle"),
  ingress: document.getElementById("ingress")
};

// --- 3. State ---
let state = {
  cat: "",
  limit: 20,
  interacted: false
};

// --- 4. Logic/Controller ---

function updateUI(scroll = false) {
  const query = els.input.value.trim();
  
  const hash = (location.hash || "").replace("#", "");
  if (hash.startsWith("id-")) {
    state.interacted = true;
    showShared(hash.replace("id-", ""));
    return;
  }

  if (!query && !state.cat && !state.interacted) {
    showRandom();
    if (scroll) scrollToTop();
    return;
  }

  hidePanels();
  state.interacted = true;
  
  const results = App.search(query, state.cat);
  renderList(results, query);
  
  if (scroll) scrollToTop();
}

function renderList(list, query) {
  els.results.innerHTML = "";
  
  if (!list.length) {
    els.hitsLine.textContent = "Inga träffar.";
    els.loadMoreWrap.style.display = "none";
    els.results.innerHTML = `<div class="empty">Prova andra ord eller välj en annan kategori.</div>`;
    return;
  }

  const catPart = state.cat ? ` i ${state.cat}` : "";
  els.hitsLine.textContent = `${list.length} träffar${catPart}`;

  const visible = list.slice(0, Math.min(state.limit, list.length));
  
  visible.forEach(d => {
    const el = document.createElement("div");
    el.className = "card";
    el.id = `id-${d.id}`;
    el.innerHTML = renderCard(d, query, false);
    els.results.appendChild(el);
  });

  attachEvents(els.results);

  const canLoadMore = state.limit < list.length;
  els.loadMoreWrap.style.display = canLoadMore ? "flex" : "none";
  els.loadMoreBtn.disabled = !canLoadMore;
}

function showShared(id) {
  hidePanels();
  els.results.innerHTML = "";
  els.loadMoreWrap.style.display = "none";
  
  const d = App.getById(id);
  
  if (d) {
    els.hitsLine.textContent = "Delad fråga";
    els.sharedWrap.style.display = "block";
    els.sharedCard.innerHTML = renderCard(d, "", true);
    attachEvents(els.sharedWrap);
  } else {
    els.hitsLine.textContent = "Hittar inte den delade länken.";
    els.sharedWrap.style.display = "block";
    els.sharedCard.innerHTML = `<div class="empty">Länken verkar felaktig.</div>`;
  }
  scrollToTop();
}

function showRandom() {
  hidePanels();
  els.results.innerHTML = "";
  els.loadMoreWrap.style.display = "none";
  els.hitsLine.textContent = "Slumpad fråga";
  
  els.randomWrap.style.display = "block";
  const d = App.getRandom();
  els.randomCard.innerHTML = renderCard(d, "", true);
  attachEvents(els.randomWrap);
}

// --- 5. Event Handling ---

function attachEvents(scope) {
  scope.querySelectorAll(".tag").forEach(tag => {
    tag.addEventListener("click", () => {
      state.interacted = true;
      history.replaceState(null, "", location.pathname + location.search);
      hidePanels();
      
      const kw = tag.getAttribute("data-kw");
      const cur = els.input.value.trim();
      els.input.value = cur ? (cur + " " + kw) : kw;
      
      syncClearBtn();
      state.limit = 20;
      updateUI(true);
    });
  });

  scope.querySelectorAll(".share").forEach(a => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      const id = a.getAttribute("data-share");
      const url = `${location.origin}${location.pathname}#id-${id}`;
      location.hash = `id-${id}`;
      try { await navigator.clipboard.writeText(url); } catch {}
    });
  });
}

function hidePanels() {
  els.sharedWrap.style.display = "none";
  els.sharedCard.innerHTML = "";
  els.randomWrap.style.display = "none";
  els.randomCard.innerHTML = "";
}

function scrollToTop() {
  const h = els.sticky.getBoundingClientRect().height;
  const y = els.resultsTop.getBoundingClientRect().top + window.scrollY - h - 8;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

function syncClearBtn() {
  els.clearBtn.style.display = els.input.value.trim() ? "block" : "none";
}

let timer;
els.input.addEventListener("input", () => {
  if (els.input.value.trim()) state.interacted = true;
  syncClearBtn();
  state.limit = 20;
  clearTimeout(timer);
  timer = setTimeout(() => updateUI(false), 140);
});

els.clearBtn.addEventListener("click", () => {
  state.interacted = true;
  history.replaceState(null, "", location.pathname + location.search);
  hidePanels();
  els.input.value = "";
  syncClearBtn();
  state.limit = 20;
  els.input.focus();
  updateUI(true);
});

els.loadMoreBtn.onclick = () => {
  state.limit += 20;
  const results = App.search(els.input.value.trim(), state.cat);
  renderList(results, els.input.value.trim());
};

const cats = App.getCategories();
cats.forEach(c => {
  const chip = document.createElement("button");
  chip.className = "chip";
  chip.textContent = c;
  chip.addEventListener("click", () => {
    state.interacted = true;
    history.replaceState(null, "", location.pathname + location.search);
    hidePanels();
    
    if (state.cat === c) state.cat = "";
    else state.cat = c;
    
    document.querySelectorAll("#categories .chip").forEach(el => el.classList.remove("active"));
    if (state.cat) chip.classList.add("active");
    
    if (window.innerWidth <= 640) {
      els.toggleLabel.textContent = state.cat ? `Kategori: ${state.cat}` : "Filtrera efter kategori";
      els.cats.style.display = "none";
      els.toggleBtn.setAttribute("aria-expanded", "false");
      els.toggleHint.textContent = "Visa";
    }

    state.limit = 20;
    updateUI(true);
  });
  els.cats.appendChild(chip);
});

let isCatOpen = window.innerWidth > 640;
els.toggleBtn.addEventListener("click", () => {
  isCatOpen = !isCatOpen;
  els.cats.style.display = isCatOpen ? "flex" : "none";
  els.toggleBtn.setAttribute("aria-expanded", String(isCatOpen));
  els.toggleHint.textContent = isCatOpen ? "Dölj" : "Visa";
});

function initTheme() {
  const saved = localStorage.getItem("theme");
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  updateThemeText(saved || (sysDark ? "dark" : "light"));
}
function updateThemeText(mode) {
  els.themeBtn.textContent = (mode === "dark") ? "Ljus" : "Mörk";
}
els.themeBtn.addEventListener("click", () => {
  const curr = document.documentElement.getAttribute("data-theme");
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const mode = curr || (sysDark ? "dark" : "light");
  const newMode = mode === "dark" ? "light" : "dark";
  localStorage.setItem("theme", newMode);
  document.documentElement.setAttribute("data-theme", newMode);
  updateThemeText(newMode);
});

window.addEventListener("scroll", () => {
  if (window.scrollY > 6) els.sticky.classList.add("scrolled");
  else els.sticky.classList.remove("scrolled");
}, { passive: true });

window.addEventListener("hashchange", () => {
  state.limit = 20;
  updateUI(true);
});

els.sharedClose.addEventListener("click", () => {
  state.interacted = true;
  history.replaceState(null, "", location.pathname + location.search);
  state.limit = 20;
  updateUI(true);
});

els.randomClose.addEventListener("click", () => {
  state.interacted = true;
  state.limit = 20;
  updateUI(true);
});

initTheme();
els.ingress.textContent = `Sök bland ${App.getCount()} svar. Baserat på podden “Fråga Agnes Wold”.`;
syncClearBtn();
updateUI(false);