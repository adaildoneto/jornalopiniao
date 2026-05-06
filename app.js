const WP_BASE = "https://jornalopiniao.net/wp-json/wp/v2";
const SITE_URL = "https://jornalopiniao.net";
const NEWSROOM_EMAIL = "redacao@jornalopiniao.net";
const WHATSAPP_NUMBER = "";
const DEFAULT_IMAGE = "https://i0.wp.com/jornalopiniao.net/wp-content/uploads/2019/02/14708185_1085435801551868_8420624485574874253_n.png?fit=900%2C900&ssl=1";
const POSTS_PER_PAGE = 20;
const MIN_COVER_POSTS = 12;
const MIN_READING_POSTS = 16;
const LIKE_STORAGE_KEY = "jornalopiniao-liked-posts";
const CITY_FILTERS = {
  todas: {
    label: "Todas as cidades",
    terms: [],
    categorySlugs: []
  },
  "rio-branco": {
    label: "Rio Branco",
    terms: ["rio branco", "rio-branco", "capital do acre"],
    categorySlugs: ["rio-branco"]
  },
  "boca-do-acre": {
    label: "Boca do Acre",
    terms: ["boca do acre", "boca-do-acre", "amazonas"],
    categorySlugs: ["boca-do-acre"]
  }
};

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
  cityCategories: new Map(),
  selectedId: null,
  activeCategoryId: "",
  activeCity: "todas",
  searchTerm: "",
  page: 0,
  totalPages: 1,
  hasMore: true,
  isLoadingMore: false,
  storyIndex: 0,
  likedPosts: new Set(JSON.parse(localStorage.getItem(LIKE_STORAGE_KEY) || "[]"))
};

const els = {
  clockLabel: document.querySelector("#clockLabel"),
  todayLabel: document.querySelector("#todayLabel"),
  refreshButton: document.querySelector("#refreshButton"),
  appTabs: document.querySelectorAll(".app-tab"),
  appViewTriggers: document.querySelectorAll(".app-view-trigger"),
  appViews: document.querySelectorAll(".app-view"),
  cityChips: document.querySelectorAll(".city-chip"),
  heroMedia: document.querySelector("#heroMedia"),
  heroTitle: document.querySelector("#heroTitle"),
  heroExcerpt: document.querySelector("#heroExcerpt"),
  heroReadButton: document.querySelector("#heroReadButton"),
  storyBg: document.querySelector("#storyBg"),
  storyProgress: document.querySelector("#storyProgress"),
  storyPrevZone: document.querySelector("#storyPrevZone"),
  storyNextZone: document.querySelector("#storyNextZone"),
  storyMeta: document.querySelector("#storyMeta"),
  storyTitle: document.querySelector("#storyTitle"),
  storyExcerpt: document.querySelector("#storyExcerpt"),
  storyLikeButton: document.querySelector("#storyLikeButton"),
  storyShareButton: document.querySelector("#storyShareButton"),
  storyReadButton: document.querySelector("#storyReadButton"),
  storyFeedback: document.querySelector("#storyFeedback"),
  coverLeadGrid: document.querySelector("#coverLeadGrid"),
  coverLatestGrid: document.querySelector("#coverLatestGrid"),
  coverLoadMoreButton: document.querySelector("#coverLoadMoreButton"),
  popularList: document.querySelector("#popularList"),
  newsList: document.querySelector("#newsList"),
  feedLoadMoreButton: document.querySelector("#feedLoadMoreButton"),
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

function getPostText(post) {
  return `${stripHtml(post.title?.rendered)} ${stripHtml(post.excerpt?.rendered)} ${stripHtml(post.content?.rendered)}`.toLowerCase();
}

function matchesCity(post) {
  const config = CITY_FILTERS[state.activeCity] || CITY_FILTERS.todas;
  if (!config.terms.length) return true;

  const categoryIds = state.cityCategories.get(state.activeCity) || [];
  const hasCityCategory = post.categories?.some((id) => categoryIds.includes(id));
  if (hasCityCategory) return true;

  const text = getPostText(post);
  return config.terms.some((term) => text.includes(term));
}

function setStatus(message) {
  els.statusLine.textContent = message;
}

function updateStatusCount() {
  const cityLabel = CITY_FILTERS[state.activeCity]?.label || "Todas as cidades";
  const suffix = state.hasMore ? "mais materias disponiveis" : "fim do feed";
  setStatus(`${state.filteredPosts.length} noticias exibidas | ${cityLabel} | ${suffix}`);
}

async function setCity(city) {
  state.activeCity = CITY_FILTERS[city] ? city : "todas";
  els.cityChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.city === state.activeCity);
  });
  applyFilters();
  updateStatusCount();
  renderHero(state.filteredPosts[0] || state.posts[0]);
  renderCover();
  await ensureMinimumPosts();
}

function setView(view) {
  els.appViews.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.viewPanel === view);
  });
  els.appTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
  if (view === "stories") {
    renderStory();
    ensureMinimumPosts();
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ${response.status}`);
  }
  return response.json();
}

async function fetchPostsPage(page) {
  const categoryParam = state.activeCategoryId ? `&categories=${state.activeCategoryId}` : "";
  const response = await fetch(`${WP_BASE}/posts?per_page=${POSTS_PER_PAGE}&page=${page}&_embed=1${categoryParam}`);

  if (!response.ok) {
    throw new Error(`Falha ${response.status}`);
  }

  state.totalPages = Number(response.headers.get("X-WP-TotalPages")) || page;
  return response.json();
}

async function loadCategories() {
  try {
    const categories = await fetchJson(`${WP_BASE}/categories?per_page=100`);
    state.categories = new Map(categories.map((category) => [category.id, category.name]));
    state.cityCategories = new Map(Object.entries(CITY_FILTERS).map(([city, config]) => [
      city,
      categories
        .filter((category) => config.categorySlugs.includes(category.slug))
        .map((category) => category.id)
    ]));
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
  state.posts = [];
  state.filteredPosts = [];
  state.page = 0;
  state.totalPages = 1;
  state.hasMore = true;
  try {
    await loadMorePosts();
    await ensureMinimumPosts();
  } catch (error) {
    console.warn("Feed indisponivel", error);
    state.posts = fallbackPosts;
    state.hasMore = false;
    setStatus("Feed temporariamente indisponivel. Mostrando acesso direto ao site.");
  }
  applyFilters();
  renderHero(state.filteredPosts[0] || state.posts[0]);
  renderCover();
}

async function loadMorePosts() {
  if (state.isLoadingMore || !state.hasMore) return;

  state.isLoadingMore = true;
  updateLoadMoreButtons();

  try {
    const nextPage = state.page + 1;
    const posts = await fetchPostsPage(nextPage);
    const knownIds = new Set(state.posts.map((post) => String(post.id)));
    const freshPosts = posts.filter((post) => !knownIds.has(String(post.id)));

    state.posts = [...state.posts, ...freshPosts];
    state.page = nextPage;
    state.hasMore = state.page < state.totalPages && posts.length > 0;

    if (!state.posts.length) {
      state.posts = fallbackPosts;
      state.hasMore = false;
    }
  } finally {
    state.isLoadingMore = false;
    applyFilters();
    renderHero(state.filteredPosts[0] || state.posts[0]);
    renderCover();
    renderStory();
    updateLoadMoreButtons();
  }
}

async function ensureMinimumPosts() {
  const targetCount = Math.max(MIN_COVER_POSTS, MIN_READING_POSTS);
  let attempts = 0;
  while (state.filteredPosts.length < targetCount && state.hasMore && attempts < 8) {
    attempts += 1;
    await loadMorePosts();
  }
}

function updateLoadMoreButtons() {
  [els.coverLoadMoreButton, els.feedLoadMoreButton].forEach((button) => {
    if (!button) return;
    button.hidden = !state.hasMore && !state.isLoadingMore;
    button.disabled = state.isLoadingMore;
    button.textContent = state.isLoadingMore ? "Carregando materias..." : "Carregar mais materias";
  });
}

function applyFilters() {
  const term = state.searchTerm.toLowerCase();
  state.filteredPosts = state.posts.filter((post) => {
    const text = getPostText(post);
    const matchesSearch = !term || text.includes(term);
    return matchesCity(post) && matchesSearch;
  });
  renderList();
  updateStatusCount();
  renderStory();
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

  if (!state.filteredPosts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-cover";
    empty.textContent = "Nenhuma noticia encontrada para esta cidade agora.";
    els.coverLeadGrid.append(empty);
    return;
  }

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

function getStoryPosts() {
  return state.filteredPosts.length ? state.filteredPosts : state.posts;
}

function getCurrentStory() {
  const posts = getStoryPosts();
  if (!posts.length) return null;
  state.storyIndex = Math.min(Math.max(state.storyIndex, 0), posts.length - 1);
  return posts[state.storyIndex];
}

function persistLikes() {
  localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify([...state.likedPosts]));
}

function renderStory() {
  const posts = getStoryPosts();
  const post = getCurrentStory();

  if (!post) {
    els.storyTitle.textContent = "Nenhuma materia disponivel";
    els.storyExcerpt.textContent = "Atualize o feed para carregar os stories.";
    els.storyMeta.textContent = "Stories";
    els.storyBg.style.backgroundImage = `url("${DEFAULT_IMAGE}")`;
    els.storyProgress.innerHTML = "";
    return;
  }

  const postId = String(post.id);
  const liked = state.likedPosts.has(postId);
  const progress = posts.slice(0, Math.min(posts.length, 12)).map((_, index) => {
    const active = index === state.storyIndex ? " active" : "";
    const seen = index < state.storyIndex ? " seen" : "";
    return `<span class="story-progress-item${active}${seen}"></span>`;
  }).join("");

  els.storyBg.style.backgroundImage = `url("${getImage(post)}")`;
  els.storyMeta.textContent = `${getCategoryName(post)} | ${formatDate(post.date)} | ${state.storyIndex + 1} de ${posts.length}`;
  els.storyTitle.textContent = stripHtml(post.title?.rendered);
  els.storyExcerpt.textContent = stripHtml(post.excerpt?.rendered) || "Toque em Ler para abrir a materia completa.";
  els.storyLikeButton.textContent = liked ? "Curtido" : "Curtir";
  els.storyLikeButton.setAttribute("aria-pressed", String(liked));
  els.storyFeedback.textContent = "";
  els.storyProgress.innerHTML = progress;
}

async function nextStory() {
  const posts = getStoryPosts();
  if (!posts.length) return;

  if (state.storyIndex < posts.length - 1) {
    state.storyIndex += 1;
    renderStory();
    return;
  }

  if (state.hasMore) {
    await loadMorePosts();
    state.storyIndex = Math.min(state.storyIndex + 1, getStoryPosts().length - 1);
    renderStory();
  }
}

function previousStory() {
  if (state.storyIndex > 0) {
    state.storyIndex -= 1;
    renderStory();
  }
}

function toggleStoryLike() {
  const post = getCurrentStory();
  if (!post) return;

  const postId = String(post.id);
  if (state.likedPosts.has(postId)) {
    state.likedPosts.delete(postId);
  } else {
    state.likedPosts.add(postId);
  }

  persistLikes();
  renderStory();
}

async function shareStory() {
  const post = getCurrentStory();
  if (!post) return;

  const title = stripHtml(post.title?.rendered);
  const url = post.link || SITE_URL;

  try {
    if (navigator.share) {
      await navigator.share({ title, text: "Veja esta materia do Jornal Opiniao", url });
      return;
    }

    await navigator.clipboard.writeText(url);
    els.storyFeedback.textContent = "Link copiado para compartilhar.";
  } catch {
    els.storyFeedback.textContent = "Nao foi possivel compartilhar agora.";
  }
}

function readCurrentStory() {
  const post = getCurrentStory();
  if (post) selectPost(post.id);
}

function renderList() {
  els.newsList.innerHTML = "";

  if (!state.filteredPosts.length) {
    const empty = document.createElement("div");
    empty.className = "status-line";
    empty.textContent = "Nenhuma noticia encontrada para essa cidade ou busca.";
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

  updateLoadMoreButtons();
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
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Rio_Branco"
  }).format(now);
  els.todayLabel.textContent = `Rio Branco, AC e Boca do Acre, AM | ${dateLabel}`;
}

function buildReportMessage() {
  const name = document.querySelector("#reportName").value.trim() || "Nao informado";
  const contact = document.querySelector("#reportContact").value.trim() || "Nao informado";
  const city = document.querySelector("#reportCity").value;
  const place = document.querySelector("#reportPlace").value.trim();
  const type = document.querySelector("#reportType").value;
  const message = document.querySelector("#reportMessage").value.trim();
  const anonymous = document.querySelector("#anonymousToggle").checked ? "Sim" : "Nao";

  return [
    "Canal de denuncia - App Jornal Opiniao",
    "",
    `Tipo: ${type}`,
    `Cidade: ${city}`,
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
  els.cityChips.forEach((chip) => {
    chip.addEventListener("click", () => setCity(chip.dataset.city));
  });
  els.coverLoadMoreButton.addEventListener("click", loadMorePosts);
  els.feedLoadMoreButton.addEventListener("click", loadMorePosts);
  els.storyPrevZone.addEventListener("click", previousStory);
  els.storyNextZone.addEventListener("click", nextStory);
  els.storyLikeButton.addEventListener("click", toggleStoryLike);
  els.storyShareButton.addEventListener("click", shareStory);
  els.storyReadButton.addEventListener("click", readCurrentStory);
  els.heroReadButton.addEventListener("click", () => {
    const id = els.heroReadButton.dataset.id || state.filteredPosts[0]?.id || state.posts[0]?.id;
    if (id) selectPost(id);
  });
  els.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim();
    applyFilters();
    ensureMinimumPosts();
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
