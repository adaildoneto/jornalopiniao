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
  storyTrack: document.querySelector("#storyTrack"),
  storyProgress: document.querySelector("#storyProgress"),
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

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function createReaderSlides(value = "") {
  const template = document.createElement("template");
  template.innerHTML = sanitizeArticleHtml(value);
  const blocks = [...template.content.children].filter((node) => stripHtml(node.outerHTML).length || node.querySelector?.("img"));
  const usableBlocks = blocks.length ? blocks : [document.createElement("p")];

  if (!blocks.length) {
    usableBlocks[0].textContent = "A materia completa ainda nao esta disponivel no app.";
  }

  const slides = [];
  let current = [];
  let currentLength = 0;

  usableBlocks.forEach((block) => {
    const blockLength = stripHtml(block.outerHTML).length;
    const shouldBreak = current.length && currentLength + blockLength > 760;

    if (shouldBreak) {
      slides.push(current.join(""));
      current = [];
      currentLength = 0;
    }

    current.push(block.outerHTML);
    currentLength += blockLength;
  });

  if (current.length) slides.push(current.join(""));

  return slides.map((slide, index) => `
    <section class="reader-slide">
      <div class="reader-slide-counter">${index + 1} / ${slides.length}</div>
      ${slide}
    </section>
  `).join("");
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
    syncStorySlider();
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
  const visiblePosts = posts.slice(0, 20);
  const wasInitialized = window.jQuery?.(els.storyTrack).hasClass("slick-initialized");

  if (wasInitialized) {
    window.jQuery(els.storyTrack).slick("unslick");
  }

  els.storyTrack.innerHTML = "";

  if (!visiblePosts.length) {
    els.storyProgress.innerHTML = "";
    els.storyTrack.innerHTML = `
      <article class="story-slide">
        <div class="story-bg" style="background-image: url('${DEFAULT_IMAGE}')"></div>
        <div class="story-shade"></div>
        <div class="story-content">
          <p class="story-meta">Stories</p>
          <h3>Nenhuma materia disponivel</h3>
          <p class="story-feedback">Atualize o feed para carregar os stories.</p>
        </div>
      </article>
    `;
    return;
  }

  els.storyTrack.innerHTML = visiblePosts.map((post, index) => {
    const postId = String(post.id);
    const liked = state.likedPosts.has(postId);
    const title = escapeHtml(stripHtml(post.title?.rendered));
    const meta = escapeHtml(`${getCategoryName(post)} | ${formatDate(post.date)} | ${index + 1} de ${visiblePosts.length}`);
    const image = escapeHtml(getImage(post).replace(/'/g, "%27"));

    return `
      <article class="story-slide" data-post-id="${postId}">
        <div class="story-bg" style="background-image: url('${image}')"></div>
        <div class="story-shade"></div>
        <div class="story-content">
          <p class="story-meta">${meta}</p>
          <h3>${title}</h3>
          <div class="story-actions">
            <button class="story-action-button story-like-action" type="button" aria-pressed="${liked}" data-post-id="${postId}" aria-label="${liked ? "Descurtir" : "Curtir"}">
              <span aria-hidden="true">${liked ? "♥" : "♡"}</span>
            </button>
            <button class="story-action-button story-share-action" type="button" data-post-id="${postId}" aria-label="Compartilhar">
              <span aria-hidden="true">↗</span>
            </button>
            <button class="story-action-button story-read-action" type="button" data-post-id="${postId}" aria-label="Ler materia">
              <span aria-hidden="true">≡</span>
            </button>
          </div>
          <p class="story-feedback" role="status" aria-live="polite"></p>
        </div>
      </article>
    `;
  }).join("");

  renderStoryProgress(visiblePosts.length);
  if (document.querySelector('[data-view-panel="stories"]').classList.contains("active")) {
    syncStorySlider();
  }
}

function renderStoryProgress(total) {
  els.storyProgress.innerHTML = Array.from({ length: total }, (_, index) => {
    const active = index === state.storyIndex ? " active" : "";
    const seen = index < state.storyIndex ? " seen" : "";
    return `<span class="story-progress-item${active}${seen}"></span>`;
  }).join("");
}

function syncStorySlider() {
  if (!window.jQuery || !window.jQuery.fn?.slick || !els.storyTrack.children.length) return;

  const $track = window.jQuery(els.storyTrack);
  if ($track.hasClass("slick-initialized")) return;

  $track.off("afterChange.jornalOpiniao");
  $track.on("afterChange.jornalOpiniao", async (_event, _slick, currentSlide) => {
    state.storyIndex = currentSlide;
    renderStoryProgress(getStoryPosts().slice(0, 20).length);

    if (currentSlide >= getStoryPosts().slice(0, 20).length - 2 && state.hasMore) {
      await loadMorePosts();
    }
  });

  $track.slick({
    arrows: false,
    dots: false,
    infinite: false,
    initialSlide: Math.min(state.storyIndex, Math.max(els.storyTrack.children.length - 1, 0)),
    mobileFirst: true,
    speed: 220,
    swipe: true,
    touchThreshold: 12
  });
}

function findPostById(id) {
  return state.posts.find((post) => String(post.id) === String(id));
}

function toggleStoryLike(postId) {
  const post = findPostById(postId);
  if (!post) return;

  const normalizedPostId = String(post.id);
  if (state.likedPosts.has(normalizedPostId)) {
    state.likedPosts.delete(normalizedPostId);
  } else {
    state.likedPosts.add(normalizedPostId);
  }

  persistLikes();
  els.storyTrack.querySelectorAll(`.story-like-action[data-post-id="${normalizedPostId}"]`).forEach((button) => {
    const liked = state.likedPosts.has(normalizedPostId);
    button.innerHTML = `<span aria-hidden="true">${liked ? "♥" : "♡"}</span>`;
    button.setAttribute("aria-label", liked ? "Descurtir" : "Curtir");
    button.setAttribute("aria-pressed", String(liked));
  });
}

async function shareStory(postId, feedbackElement) {
  const post = findPostById(postId);
  if (!post) return;

  const title = stripHtml(post.title?.rendered);
  const url = post.link || SITE_URL;

  try {
    if (navigator.share) {
      await navigator.share({ title, text: "Veja esta materia do Jornal Opiniao", url });
      return;
    }

    await navigator.clipboard.writeText(url);
    feedbackElement.textContent = "Link copiado para compartilhar.";
  } catch {
    feedbackElement.textContent = "Nao foi possivel compartilhar agora.";
  }
}

function readCurrentStory(postId) {
  const post = findPostById(postId);
  if (post) selectPost(post.id, { slideMode: true });
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

function destroyReaderSlider() {
  if (window.jQuery?.(els.readerBody).hasClass("slick-initialized")) {
    window.jQuery(els.readerBody).slick("unslick");
  }
  els.readerBody.classList.remove("reader-body-slider");
}

function syncReaderSlider() {
  if (!window.jQuery || !window.jQuery.fn?.slick) return;

  const $reader = window.jQuery(els.readerBody);
  if ($reader.hasClass("slick-initialized")) return;

  $reader.slick({
    adaptiveHeight: true,
    arrows: false,
    dots: true,
    infinite: false,
    mobileFirst: true,
    speed: 220,
    swipe: true,
    touchThreshold: 12
  });
}

function selectPost(id, options = {}) {
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
  destroyReaderSlider();
  els.readerBody.innerHTML = options.slideMode ? createReaderSlides(post.content?.rendered) : sanitizeArticleHtml(post.content?.rendered);
  els.readerBody.classList.toggle("reader-body-slider", Boolean(options.slideMode));
  els.readerBody.querySelectorAll("img").forEach(applyImageFallback);
  els.readerLink.href = post.link || SITE_URL;
  if (options.slideMode) syncReaderSlider();
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
  els.storyTrack.addEventListener("click", (event) => {
    const action = event.target.closest(".story-action-button");
    if (!action) return;

    const postId = action.dataset.postId;
    if (action.classList.contains("story-like-action")) toggleStoryLike(postId);
    if (action.classList.contains("story-share-action")) shareStory(postId, action.closest(".story-content").querySelector(".story-feedback"));
    if (action.classList.contains("story-read-action")) readCurrentStory(postId);
  });
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
