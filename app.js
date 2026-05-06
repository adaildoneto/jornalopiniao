const WP_BASE = "https://jornalopiniao.net/wp-json/wp/v2";
const SITE_URL = "https://jornalopiniao.net";
const NEWSROOM_EMAIL = "redacao@jornalopiniao.net";
const WHATSAPP_NUMBER = "";
const DEFAULT_IMAGE = "https://i0.wp.com/jornalopiniao.net/wp-content/uploads/2019/02/14708185_1085435801551868_8420624485574874253_n.png?fit=900%2C900&ssl=1";

const fallbackPosts = [
  {
    id: "fallback-1",
    title: { rendered: "Jornal Opiniao" },
    excerpt: { rendered: "Nao foi possivel carregar as noticias agora. Toque em atualizar ou acesse o site oficial." },
    content: { rendered: "<p>O feed de noticias esta temporariamente indisponivel. Atualize o app em alguns instantes ou use o link para acessar o Jornal Opiniao.</p>" },
    link: SITE_URL,
    date: new Date().toISOString(),
    categories: [],
    _embedded: {}
  }
];

const state = {
  posts: [],
  filteredPosts: [],
  categories: new Map(),
  selectedId: null,
  activeCategoryId: "",
  searchTerm: ""
};

const els = {
  clockLabel: document.querySelector("#clockLabel"),
  todayLabel: document.querySelector("#todayLabel"),
  refreshButton: document.querySelector("#refreshButton"),
  appTabs: document.querySelectorAll(".app-tab"),
  appViewTriggers: document.querySelectorAll(".app-view-trigger"),
  appViews: document.querySelectorAll(".app-view"),
  heroMedia: document.querySelector("#heroMedia"),
  heroTitle: document.querySelector("#heroTitle"),
  heroExcerpt: document.querySelector("#heroExcerpt"),
  heroReadButton: document.querySelector("#heroReadButton"),
  coverLeadGrid: document.querySelector("#coverLeadGrid"),
  coverLatestGrid: document.querySelector("#coverLatestGrid"),
  popularList: document.querySelector("#popularList"),
  newsList: document.querySelector("#newsList"),
  statusLine: document.querySelector("#statusLine"),
  searchInput: document.querySelector("#searchInput"),
  navChips: document.querySelectorAll(".nav-chip"),
  readerPanel: document.querySelector("#readerPanel"),
  readerEmpty: document.querySelector("#readerEmpty"),
  readerArticle: document.querySelector("#readerArticle"),
  readerImage: document.querySelector("#readerImage"),
  readerMeta: document.querySelector("#readerMeta"),
  readerTitle: document.querySelector("#readerTitle"),
  readerExcerpt: document.querySelector("#readerExcerpt"),
  readerBody: document.querySelector("#readerBody"),
  readerLink: document.querySelector("#readerLink"),
  reportForm: document.querySelector("#reportForm"),
  whatsappButton: document.querySelector("#whatsappButton"),
  formFeedback: document.querySelector("#formFeedback")
};

function stripHtml(value = "") {
  const div = document.createElement("div");
  div.innerHTML = value;
  return div.textContent.replace(/\s+/g, " ").trim();
}

function normalizeImageUrl(url = "") {
  if (!url) return DEFAULT_IMAGE;

  try {
    const parsed = new URL(url, window.location.href);
    const smartIndex = parsed.pathname.indexOf("/smart/");

    if (parsed.hostname === "i0.wp.com" && smartIndex >= 0) {
      const original = decodeURIComponent(parsed.pathname.slice(smartIndex + 7));
      return original.startsWith("http") ? original : url;
    }
  } catch {
    return DEFAULT_IMAGE;
  }

  return url;
}

function sanitizeArticleHtml(value = "") {
  const template = document.createElement("template");
  template.innerHTML = value || "<p>A materia completa ainda nao esta disponivel no app.</p>";

  template.content.querySelectorAll("script, style, iframe, object, embed, form, input, button").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const unsafeLink = ["href", "src"].includes(name) && /^\s*javascript:/i.test(attribute.value);

      if (name.startsWith("on") || name === "style" || unsafeLink) {
        node.removeAttribute(attribute.name);
      }
    });

    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener");
    }

    if (node.tagName === "IMG") {
      node.setAttribute("src", normalizeImageUrl(node.getAttribute("src")));
      node.setAttribute("loading", "lazy");
      node.setAttribute("alt", node.getAttribute("alt") || "");
    }
  });

  return template.innerHTML;
}

function applyImageFallback(img) {
  img.addEventListener("error", () => {
    if (img.src !== DEFAULT_IMAGE) {
      img.src = DEFAULT_IMAGE;
    }
  }, { once: true });
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateValue));
}

function getImage(post) {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const image = media?.media_details?.sizes?.large?.source_url ||
    media?.media_details?.sizes?.medium_large?.source_url ||
    media?.source_url ||
    DEFAULT_IMAGE;

  return normalizeImageUrl(image);
}

function getCategoryName(post) {
  const id = post.categories?.[0];
  return state.categories.get(id) || "Noticia";
}

function setStatus(message) {
  els.statusLine.textContent = message;
}

function setView(view) {
  els.appViews.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.viewPanel === view);
  });
  els.appTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ${response.status}`);
  }
  return response.json();
}

async function loadCategories() {
  try {
    const categories = await fetchJson(`${WP_BASE}/categories?per_page=100`);
    state.categories = new Map(categories.map((category) => [category.id, category.name]));
    els.navChips.forEach((chip) => {
      const slug = chip.dataset.slug;
      if (!slug) return;
      const match = categories.find((category) => category.slug === slug);
      if (match) chip.dataset.category = String(match.id);
    });
  } catch (error) {
    console.warn("Categorias indisponiveis", error);
  }
}

async function loadPosts() {
  setStatus("Conectando ao WordPress...");
  try {
    const categoryParam = state.activeCategoryId ? `&categories=${state.activeCategoryId}` : "";
    const posts = await fetchJson(`${WP_BASE}/posts?per_page=18&_embed=1${categoryParam}`);
    state.posts = posts.length ? posts : fallbackPosts;
    setStatus(`${state.posts.length} noticias carregadas de jornalopiniao.net`);
  } catch (error) {
    console.warn("Feed indisponivel", error);
    state.posts = fallbackPosts;
    setStatus("Feed temporariamente indisponivel. Mostrando acesso direto ao site.");
  }
  applyFilters();
  renderHero(state.filteredPosts[0] || state.posts[0]);
  renderCover();
}

function applyFilters() {
  const term = state.searchTerm.toLowerCase();
  state.filteredPosts = state.posts.filter((post) => {
    const text = `${stripHtml(post.title?.rendered)} ${stripHtml(post.excerpt?.rendered)} ${stripHtml(post.content?.rendered)}`.toLowerCase();
    return !term || text.includes(term);
  });
  renderList();
}

function renderHero(post) {
  if (!post) return;
  const title = stripHtml(post.title?.rendered);
  els.heroTitle.textContent = title;
  els.heroExcerpt.textContent = stripHtml(post.excerpt?.rendered) || "Leia a materia completa no Jornal Opiniao.";
  els.heroReadButton.dataset.id = post.id;
  els.heroMedia.style.backgroundImage = `linear-gradient(0deg, rgba(0,0,0,.88), rgba(0,0,0,.32) 56%, rgba(0,0,0,.08)), url("${getImage(post)}")`;
}

function createCoverCard(post, variant = "compact") {
  const button = document.createElement("button");
  button.className = `cover-card ${variant}`;
  button.type = "button";

  const img = document.createElement("img");
  img.src = getImage(post);
  img.alt = "";
  img.loading = "lazy";
  applyImageFallback(img);

  const content = document.createElement("span");
  content.className = "cover-card-copy";

  const meta = document.createElement("span");
  meta.className = "news-meta";
  meta.textContent = `${getCategoryName(post)} | ${formatDate(post.date)}`;

  const title = document.createElement("strong");
  title.textContent = stripHtml(post.title?.rendered);

  content.append(meta, title);
  button.append(img, content);
  button.addEventListener("click", () => selectPost(post.id));

  return button;
}

function renderCover() {
  const posts = state.filteredPosts.length ? state.filteredPosts : state.posts;
  els.coverLeadGrid.innerHTML = "";
  els.coverLatestGrid.innerHTML = "";
  els.popularList.innerHTML = "";

  posts.slice(1, 5).forEach((post, index) => {
    els.coverLeadGrid.append(createCoverCard(post, index === 0 ? "wide" : "compact"));
  });

  posts.slice(5, 11).forEach((post) => {
    const button = document.createElement("button");
    button.className = "headline-link";
    button.type = "button";
    const category = document.createElement("span");
    category.textContent = getCategoryName(post);
    const title = document.createElement("strong");
    title.textContent = stripHtml(post.title?.rendered);
    button.append(category, title);
    button.addEventListener("click", () => selectPost(post.id));
    els.coverLatestGrid.append(button);
  });

  posts.slice(0, 5).forEach((post) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = stripHtml(post.title?.rendered);
    button.addEventListener("click", () => selectPost(post.id));
    item.append(button);
    els.popularList.append(item);
  });
}

function renderList() {
  els.newsList.innerHTML = "";

  if (!state.filteredPosts.length) {
    const empty = document.createElement("div");
    empty.className = "status-line";
    empty.textContent = "Nenhuma noticia encontrada para essa busca.";
    els.newsList.append(empty);
    return;
  }

  state.filteredPosts.forEach((post) => {
    const button = document.createElement("button");
    button.className = `news-item${state.selectedId === post.id ? " selected" : ""}`;
    button.type = "button";
    button.dataset.id = post.id;

    const img = document.createElement("img");
    img.className = "news-thumb";
    img.src = getImage(post);
    img.alt = "";
    img.loading = "lazy";
    applyImageFallback(img);

    const content = document.createElement("div");
    content.className = "news-content";

    const meta = document.createElement("div");
    meta.className = "news-meta";
    const category = document.createElement("span");
    category.textContent = getCategoryName(post);
    const date = document.createElement("span");
    date.textContent = formatDate(post.date);
    meta.append(category, date);

    const title = document.createElement("h3");
    title.textContent = stripHtml(post.title?.rendered);
    const excerpt = document.createElement("p");
    excerpt.textContent = stripHtml(post.excerpt?.rendered);

    content.append(meta, title, excerpt);

    button.append(img, content);
    button.addEventListener("click", () => selectPost(post.id));
    els.newsList.append(button);
  });
}

function selectPost(id) {
  const post = state.posts.find((item) => String(item.id) === String(id));
  if (!post) return;

  state.selectedId = post.id;
  renderList();
  renderHero(post);
  setView("leitura");

  els.readerEmpty.classList.add("hidden");
  els.readerArticle.classList.remove("hidden");
  els.readerImage.src = getImage(post);
  els.readerImage.alt = stripHtml(post.title?.rendered);
  applyImageFallback(els.readerImage);
  els.readerMeta.textContent = `${getCategoryName(post)} | ${formatDate(post.date)}`;
  els.readerTitle.textContent = stripHtml(post.title?.rendered);
  els.readerExcerpt.textContent = stripHtml(post.excerpt?.rendered) || "A materia completa esta disponivel no site do Jornal Opiniao.";
  els.readerBody.innerHTML = sanitizeArticleHtml(post.content?.rendered);
  els.readerBody.querySelectorAll("img").forEach(applyImageFallback);
  els.readerLink.href = post.link || SITE_URL;
  els.readerPanel?.scrollTo({ top: 0, behavior: "smooth" });
}

function updateClock() {
  const now = new Date();
  els.clockLabel.textContent = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Rio_Branco"
  }).format(now);
  els.todayLabel.textContent = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Rio_Branco"
  }).format(now);
}

function buildReportMessage() {
  const name = document.querySelector("#reportName").value.trim() || "Nao informado";
  const contact = document.querySelector("#reportContact").value.trim() || "Nao informado";
  const place = document.querySelector("#reportPlace").value.trim();
  const type = document.querySelector("#reportType").value;
  const message = document.querySelector("#reportMessage").value.trim();
  const anonymous = document.querySelector("#anonymousToggle").checked ? "Sim" : "Nao";

  return [
    "Canal de denuncia - App Jornal Opiniao",
    "",
    `Tipo: ${type}`,
    `Local: ${place}`,
    `Preservar identidade: ${anonymous}`,
    `Nome: ${name}`,
    `Contato: ${contact}`,
    "",
    "Relato:",
    message
  ].join("\n");
}

function sendEmail(event) {
  event.preventDefault();
  if (!els.reportForm.reportValidity()) return;

  const subject = encodeURIComponent("Denuncia do leitor - App Jornal Opiniao");
  const body = encodeURIComponent(buildReportMessage());
  els.formFeedback.textContent = "Abrindo seu aplicativo de e-mail para concluir o envio.";
  window.location.href = `mailto:${NEWSROOM_EMAIL}?subject=${subject}&body=${body}`;
}

function sendWhatsapp() {
  if (!els.reportForm.reportValidity()) return;

  const body = encodeURIComponent(buildReportMessage());
  const url = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${body}`
    : `https://wa.me/?text=${body}`;
  els.formFeedback.textContent = "Abrindo WhatsApp para concluir o envio.";
  window.open(url, "_blank", "noopener");
}

function bindEvents() {
  els.refreshButton.addEventListener("click", loadPosts);
  els.appTabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });
  els.appViewTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => setView(trigger.dataset.view));
  });
  els.heroReadButton.addEventListener("click", () => {
    const id = els.heroReadButton.dataset.id || state.filteredPosts[0]?.id || state.posts[0]?.id;
    if (id) selectPost(id);
  });
  els.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim();
    applyFilters();
  });
  els.navChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      els.navChips.forEach((item) => item.classList.remove("active"));
      chip.classList.add("active");
      state.activeCategoryId = chip.dataset.category || "";
      setView("capa");
      loadPosts();
    });
  });
  els.reportForm.addEventListener("submit", sendEmail);
  els.whatsappButton.addEventListener("click", sendWhatsapp);
}

async function init() {
  updateClock();
  setInterval(updateClock, 60000);
  bindEvents();
  await loadCategories();
  await loadPosts();

  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init();
