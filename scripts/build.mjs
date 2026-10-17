// 사용법: node scripts/build.mjs
// data/products.mjs를 읽어 index.html, products/*.html, sitemap.xml을 생성합니다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { company as C, categories, products } from "../data/products.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = new Date().toISOString().slice(0, 10);
const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));
const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const won = (n) => n.toLocaleString("ko-KR") + "원";
const telLink = (t) => "tel:" + t.replace(/-/g, "");
const abs = (path) => C.origin + path;
const productPath = (p) => `/products/${p.slug}`;
const categoryPath = (c) => `/products/${c.slug}`;
const imgPath = (file) => `/images/products/${file}`;

// JPEG 크기 읽기 (외부 라이브러리 없이 SOF 마커 탐색)
const sizeCache = {};
function jpegSize(file) {
  if (sizeCache[file]) return sizeCache[file];
  const buf = readFileSync(join(ROOT, "images/products", file));
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return (sizeCache[file] = { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) });
    }
    i += 2 + len;
  }
  throw new Error("JPEG 크기를 읽을 수 없습니다: " + file);
}
function img(image, attrs = "", alt = image.alt) {
  const { w, h } = jpegSize(image.file);
  return `<img src="${imgPath(image.file)}" alt="${esc(alt)}" width="${w}" height="${h}" ${attrs}/>`;
}
// 가격은 카페 게시글에 적힌 금액만 씁니다. 금액이 없으면 price를 비워 두고 "견적 문의"로 표시합니다.
const isPrice = (n) => typeof n === "number" && n > 0;
const knownPrices = (p) => (p.options ? p.options.map((o) => o.price) : [p.price]).filter(isPrice);
const priceLabel = (p) => {
  const prices = knownPrices(p);
  if (!prices.length) return "견적 문의";
  const many = p.options && p.options.length > 1;
  return `${won(Math.min(...prices))}${many ? "~" : ""} / ${p.priceUnit}`;
};

function jsonLd(graph) {
  return `<script type="application/ld+json">\n${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2)}\n    </script>`;
}

const orgRef = { "@id": abs("/#company") };
const organization = {
  "@type": ["Organization", "LocalBusiness"],
  "@id": abs("/#company"),
  name: C.name,
  alternateName: C.alternateName,
  url: abs("/"),
  logo: abs("/favicon.svg"),
  image: abs(imgPath(products[0].images[0].file)),
  telephone: "+82-2-487-0396",
  email: C.email,
  sameAs: [C.cafe],
  contactPoint: [
    { "@type": "ContactPoint", telephone: "+82-2-487-0396", contactType: "sales", areaServed: "KR", availableLanguage: "Korean" },
    { "@type": "ContactPoint", telephone: "+82-10-3782-9982", contactType: "sales", areaServed: "KR", availableLanguage: "Korean" },
  ],
  address: { "@type": "PostalAddress", streetAddress: C.street, addressLocality: C.locality, addressRegion: C.region, addressCountry: "KR" },
};

function breadcrumbLd(items) {
  return { "@type": "BreadcrumbList", itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })) };
}

function productLd(p) {
  const ld = {
    "@type": "Product",
    "@id": abs(productPath(p)) + "#product",
    name: p.name,
    description: p.description,
    category: catBySlug[p.category].name,
    image: p.images.map((i) => abs(imgPath(i.file))),
    url: abs(productPath(p)),
    brand: { "@type": "Brand", name: "JPD" },
    manufacturer: orgRef,
  };
  const code = p.specs.find(([k]) => k === "제품코드");
  if (code && !code[1].includes("시리즈")) ld.sku = code[1];
  const material = p.specs.find(([k]) => k === "재질");
  if (material) ld.material = material[1];
  // 카페에 적힌 금액이 있는 제품만 Offer를 넣습니다. 금액이 없는 제품에 임의 가격을 넣지 않습니다.
  const prices = knownPrices(p);
  if (prices.length) {
    ld.offers = p.options && p.options.length > 1
      ? { "@type": "AggregateOffer", priceCurrency: "KRW", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length, seller: orgRef }
      : { "@type": "Offer", priceCurrency: "KRW", price: prices[0], url: abs(productPath(p)), seller: orgRef };
  }
  return ld;
}

// ───────── 공통 레이아웃 ─────────
function layout({ path, title, description, ogType = "website", ogImage, ld, body, robots = "index, follow, max-image-preview:large" }) {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="robots" content="${robots}" />
    <meta name="theme-color" content="#09243f" />
    <link rel="canonical" href="${abs(path)}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/css/style.css" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="${esc(C.name)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${abs(path)}" />
    <meta property="og:image" content="${abs(ogImage)}" />
    ${jsonLd(ld)}
    <script src="/js/main.js" defer></script>
  </head>
  <body>
    <a class="skip-link" href="#main-content">본문 바로가기</a>
    <header class="site-header" data-header>
      <div class="utility-bar"><div class="container utility-inner"><span>반도체·클린룸 현장 소모품 · SUS 맞춤 제작</span><div><a href="${telLink(C.tel)}">${C.tel}</a><a href="${telLink(C.mobile)}">${C.mobile}</a></div></div></div>
      <div class="container nav-wrap">
        <a class="brand" href="/" aria-label="${esc(C.name)} 홈"><span class="brand-mark" aria-hidden="true">J</span><span><strong>JPD</strong><small>제일플러스</small></span></a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation" data-menu-toggle><span class="sr-only">메뉴 열기</span><i></i><i></i><i></i></button>
        <nav id="primary-navigation" class="primary-nav" aria-label="주요 메뉴" data-menu>${categories.map((c) => `<a href="${categoryPath(c)}"${path.startsWith(categoryPath(c)) || (bySlug[path.split("/").pop()]?.category === c.slug) ? ' aria-current="true"' : ""}>${c.name}</a>`).join("")}<a href="/products/">전체 제품</a><a href="#contact">문의하기</a></nav>
        <a class="header-call" href="${telLink(C.mobile)}">전화 문의</a>
      </div>
    </header>

    <main id="main-content"${path === "/" ? "" : ' class="detail-main"'}>
${body}
${contactSection()}
    </main>

    <footer class="site-footer"><div class="container"><p><strong>${esc(C.name)}</strong> · ${esc(C.address)} · <a href="/privacy">개인정보처리방침</a></p><p>© <span data-year></span> Jeilplus JPD.</p></div></footer>
    <div class="mobile-actions"><a href="${telLink(C.tel)}"><span>대표전화</span><strong>${C.tel}</strong></a><a href="${telLink(C.mobile)}"><span>휴대전화</span><strong>${C.mobile}</strong></a><a href="mailto:${C.email}"><span>이메일</span><strong>문의하기</strong></a></div>
  </body>
</html>
`;
}

function contactSection(heading = "제품·규격·수량을<br />알려주세요.") {
  return `      <section id="contact" class="contact-section">
        <div class="container contact-grid">
          <div><p class="eyebrow">B2B CONTACT</p><h2>${heading}</h2><p>전화 또는 이메일로 문의하시면 견적과 납품 조건을 안내해 드립니다. 맞춤 제작은 도면이나 현장 치수를 함께 보내 주세요.</p></div>
          <div class="contact-list"><a href="${telLink(C.tel)}"><span>대표전화</span><strong>${C.tel}</strong></a><a href="${telLink(C.mobile)}"><span>휴대전화</span><strong>${C.mobile}</strong></a><a href="mailto:${C.email}"><span>이메일</span><strong>${C.email}</strong></a><div><span>주소</span><strong>${esc(C.address)}</strong></div></div>
        </div>
      </section>`;
}

function breadcrumbs(items) {
  return `      <nav class="container breadcrumbs" aria-label="현재 위치"><ol>${items.map(([name, path], i) => (i === items.length - 1 ? `<li aria-current="page">${esc(name)}</li>` : `<li><a href="${path}">${esc(name)}</a></li>`)).join("")}</ol></nav>`;
}

function productCard(p, { lazy = true } = {}) {
  return `<article class="product-card"><a class="card-link" href="${productPath(p)}"><div class="photo-frame product-photo">${img(p.images[0], lazy ? 'loading="lazy" ' : "")}</div><div class="product-body"><span class="type-label ${p.tagClass || "label-default"}">${esc(p.tag)}</span><h3>${esc(p.name)}</h3><p>${esc(p.short)}</p><strong class="card-price">${priceLabel(p)}</strong><span class="product-link">자세히 보기 →</span></div></a></article>`;
}

// ───────── 메인 페이지 ─────────
function homePage() {
  const bags = ["acid-waste-bag", "alkali-waste-bag", "organic-waste-bag"].map((s) => bySlug[s]);
  const body = `      <section class="hero">
        <div class="container hero-grid">
          <div>
            <p class="eyebrow">SEMICONDUCTOR · CLEANROOM SUPPLIES</p>
            <h1>반도체·클린룸<br /><em>현장 소모품 전문</em></h1>
            <p class="hero-summary">제일플러스는 반도체 FAB과 클린룸에서 쓰는 산·알칼리·유기 지정폐기물 봉투, 탄화사고 예방 발열감지 스티커, 웨이퍼 물류가방 같은 소모품을 공급하고, SUS304 보관함·수레·테이블을 현장 치수에 맞춰 제작합니다.</p>
            <div class="hero-actions"><a class="button button-primary" href="/products/">전체 제품 보기</a><a class="button button-light" href="${telLink(C.mobile)}">${C.mobile}</a></div>
          </div>
          <div class="hero-photos" aria-label="산·알칼리·유기 폐기물 봉투 3종">
${bags.map((p, i) => `            <article><a href="${productPath(p)}"><div class="photo-frame">${img(p.images[0], i === 0 ? 'fetchpriority="high" ' : "")}</div><strong class="${p.tagClass}">${p.name.replace(" 폐기물 봉투", "")}</strong></a></article>`).join("\n")}
          </div>
        </div>
      </section>

      <section class="section section-muted">
        <div class="container">
          <div class="section-heading"><p>FEATURED · 탄화사고 예방</p><h2>30도 발열감지 폐기물 봉투</h2></div>
          <p class="section-lead">성상별 색상(산 노랑 · 알칼리 파랑 · 유기 분홍)으로 구분하는 3중 지퍼 폐기물 봉투에 30도 변온 스티커를 붙였습니다. 봉투 안에서 반응열이 생기면 붉은 경고 문구가 나타나 탄화·화재 사고를 미리 알아챌 수 있습니다.</p>
          <div class="product-grid">${bags.map((p) => productCard(p)).join("")}</div>
        </div>
      </section>

${categories.map((c, ci) => `      <section class="section${ci % 2 ? " section-muted" : ""}" id="${c.slug}">
        <div class="container">
          <div class="section-heading section-heading-row"><div><p>${c.eyebrow}</p><h2>${c.name}</h2></div><a class="text-link" href="${categoryPath(c)}">${c.name} 전체 보기 →</a></div>
          <p class="section-lead">${esc(c.lead)}</p>
          <div class="product-grid product-grid-compact">${products.filter((p) => p.category === c.slug && !bags.includes(p)).slice(0, 4).map((p) => productCard(p)).join("")}</div>
        </div>
      </section>`).join("\n\n")}

      <section class="section">
        <div class="container">
          <div class="section-heading"><p>WHY JPD</p><h2>제일플러스를 찾는 이유</h2></div>
          <div class="reason-grid">
            <div><strong>현장에서 시작한 제품</strong><p>반도체 생산 현장의 요청으로 만든 제품이 대부분입니다. 기존 제품의 규격·인쇄·색상 변경도 상담해 드립니다.</p></div>
            <div><strong>소량 맞춤 제작</strong><p>SUS304 보관함, 수레, 테이블, 지그를 도면이나 현장 치수만으로 1대부터 제작합니다.</p></div>
            <div><strong>구매 시스템 등록</strong><p>지정폐기물함, 이지 분리함 등은 아이마켓코리아에 등록되어 있어 기업 구매 절차로 주문하실 수 있습니다.</p></div>
          </div>
        </div>
      </section>`;
  const ld = [
    organization,
    { "@type": "WebSite", "@id": abs("/#website"), url: abs("/"), name: C.name, inLanguage: "ko-KR", publisher: orgRef },
    { "@type": "ItemList", name: "제일플러스 JPD 제품", itemListElement: products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(productPath(p)), name: p.name })) },
  ];
  return layout({
    path: "/",
    title: "제일플러스 JPD | 반도체 지정폐기물 봉투·클린룸 소모품·SUS 맞춤 제작",
    description: "산·알칼리·유기 지정폐기물 봉투, 30도 발열감지 스티커, 냄새방지 지정폐기물함, 웨이퍼 물류가방 등 반도체·클린룸 소모품 공급과 SUS304 보관함·수레 맞춤 제작. 안산 제일플러스 02-487-0396.",
    ogImage: imgPath(bags[0].images[0].file),
    ld,
    body,
  });
}

// ───────── 전체 제품 / 카테고리 ─────────
function listPage({ path, title, description, eyebrow, h1, lead, groups, crumbs }) {
  const body = `${breadcrumbs(crumbs)}
      <section class="subpage-hero"><div class="container"><p class="eyebrow">${eyebrow}</p><h1>${h1}</h1><p>${esc(lead)}</p></div></section>
${groups.map((g, gi) => `      <section class="section${gi % 2 ? " section-muted" : ""}"${g.id ? ` id="${g.id}"` : ""}>
        <div class="container">
          ${g.heading ? `<div class="section-heading section-heading-row"><div><p>${g.eyebrow}</p><h2>${g.heading}</h2></div>${g.link ? `<a class="text-link" href="${g.link}">${g.heading} 페이지 →</a>` : ""}</div>` : ""}
          <div class="product-grid product-grid-compact">${g.items.map((p) => productCard(p)).join("")}</div>
        </div>
      </section>`).join("\n")}`;
  const ld = [
    organization,
    breadcrumbLd(crumbs),
    { "@type": "CollectionPage", name: title, url: abs(path), mainEntity: { "@type": "ItemList", itemListElement: groups.flatMap((g) => g.items).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(productPath(p)), name: p.name })) } },
  ];
  return layout({ path, title, description, ld, body, ogImage: imgPath(groups[0].items[0].images[0].file) });
}

function allProductsPage() {
  return listPage({
    path: "/products/",
    title: "전체 제품 | 폐기물 봉투·클린룸 소모품·SUS 맞춤 제작 | 제일플러스 JPD",
    description: "제일플러스 JPD 전체 제품 목록. 반도체 지정폐기물 봉투와 폐기물함, 클린룸·FAB 소모품, SUS304 맞춤 제작 사례를 규격·가격과 함께 확인하세요.",
    eyebrow: "ALL PRODUCTS",
    h1: "전체 제품",
    lead: "폐기물 관리 용품, 클린룸·FAB 소모품, SUS 맞춤 제작 사례를 한 곳에 모았습니다. 제품을 누르면 규격·가격·사용 방법을 볼 수 있습니다.",
    crumbs: [["홈", "/"], ["전체 제품", "/products/"]],
    groups: categories.map((c) => ({ id: c.slug, eyebrow: c.eyebrow, heading: c.name, link: categoryPath(c), items: products.filter((p) => p.category === c.slug) })),
  });
}

function categoryPage(c) {
  return listPage({
    path: categoryPath(c),
    title: c.title,
    description: c.description,
    eyebrow: c.eyebrow,
    h1: c.name,
    lead: c.lead,
    crumbs: [["홈", "/"], ["전체 제품", "/products/"], [c.name, categoryPath(c)]],
    groups: [{ items: products.filter((p) => p.category === c.slug) }],
  });
}

// ───────── 제품 상세 ─────────
function productPage(p) {
  const c = catBySlug[p.category];
  const crumbs = [["홈", "/"], [c.name, categoryPath(c)], [p.name, productPath(p)]];
  const summary = p.specs.slice(0, 3);
  const gallery = `<div class="gallery" data-gallery>
            <div class="photo-frame detail-photo">${img(p.images[0], 'fetchpriority="high" data-gallery-main ')}</div>
            ${p.images.length > 1 ? `<div class="gallery-thumbs">${p.images.map((im, i) => `<button type="button" data-gallery-thumb data-src="${imgPath(im.file)}" data-alt="${esc(im.alt)}"${i === 0 ? ' aria-current="true"' : ""}><span class="sr-only">${i + 1}번 사진 보기</span>${img(im, 'loading="lazy" ', "")}</button>`).join("")}</div>` : ""}
          </div>`;
  const priceBlock = p.options
    ? `<table class="price-table"><caption class="sr-only">${esc(p.name)} 규격별 가격</caption><thead><tr><th scope="col">규격</th><th scope="col">크기</th><th scope="col">제품코드</th><th scope="col">판매가</th></tr></thead><tbody>${p.options.map((o) => `<tr><th scope="row">${o.label}</th><td>${o.size}</td><td>${o.code || "문의"}</td><td>${isPrice(o.price) ? won(o.price) : "견적 문의"}</td></tr>`).join("")}</tbody></table>`
    : "";
  const body = `${breadcrumbs(crumbs)}
      <section class="product-detail-hero">
        <div class="container detail-grid">
          ${gallery}
          <div class="detail-copy">
            <span class="type-label ${p.tagClass || "label-default"}">${esc(p.tag)}</span>
            <h1>${p.h1 || esc(p.name)}</h1>
            <p class="detail-product-name">${esc(p.name)}</p>
            <p class="detail-lead">${esc(p.lead)}</p>
            <dl class="detail-summary">${summary.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}<div><dt>판매가</dt><dd class="price">${priceLabel(p)}${p.custom && knownPrices(p).length ? ' <small>(기본 규격 기준)</small>' : ""}</dd></div></dl>
            <div class="detail-actions"><a class="button button-primary" href="${telLink(C.mobile)}">${C.mobile} 전화 문의</a><a class="button button-outline" href="mailto:${C.email}?subject=${encodeURIComponent(`[견적 문의] ${p.name}`)}">이메일 견적 문의</a></div>
            ${p.imarket ? `<p class="imarket">아이마켓코리아 코드 <strong>${p.imarket}</strong></p>` : ""}
          </div>
        </div>
      </section>

      <section class="section section-muted">
        <div class="container prose-grid">
          <div class="section-heading"><p>PRODUCT DETAIL</p><h2>제품 설명</h2></div>
          <div class="prose">${p.body.map((t) => `<p>${esc(t)}</p>`).join("")}</div>
        </div>
      </section>
${p.chemicals ? `
      <section class="section application-section">
        <div class="container">
          <div class="section-heading"><p>${esc(p.tag)} WASTE</p><h2>${esc(p.chemicalsTitle)}</h2></div>
          <div class="chemical-grid">${p.chemicals.map((x) => `<div class="chemical-item"><strong>${esc(x)}</strong></div>`).join("")}</div>
          <p class="application-note">${esc(p.caution)}</p>
        </div>
      </section>
` : ""}
      <section class="section">
        <div class="container detail-spec-grid">
          <div class="section-heading"><p>SPECIFICATION</p><h2>${p.custom ? "제작 규격" : "규격 및 가격"}</h2></div>
          <div class="spec-content">
            ${priceBlock}
            <dl class="common-spec">${p.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}${p.options ? "" : `<div><dt>판매가</dt><dd>${priceLabel(p)}</dd></div>`}</dl>
            <p class="spec-note">${esc(p.priceNote || (p.custom ? "위 규격 기준 판매가입니다. 치수·구성을 바꾸면 금액이 달라지므로 도면이나 현장 치수를 보내 주시면 견적을 드립니다." : "표시 가격은 판매가 기준이며 수량·납품 조건에 따라 달라질 수 있습니다. 부가세 포함 여부와 대량 단가는 문의해 주세요."))}</p>
            ${p.caution && !p.chemicals ? `<p class="spec-note spec-caution">${esc(p.caution)}</p>` : ""}
          </div>
        </div>
      </section>
${p.faq ? `
      <section class="section section-muted">
        <div class="container detail-spec-grid">
          <div class="section-heading"><p>FAQ</p><h2>자주 묻는 질문</h2></div>
          <div class="faq">${p.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
        </div>
      </section>
` : ""}
      <section class="section">
        <div class="container"><div class="section-heading"><p>RELATED</p><h2>함께 찾는 제품</h2></div><div class="related-products">${p.related.map((s) => bySlug[s]).map((r) => `<a href="${productPath(r)}"><span>${esc(catBySlug[r.category].name)}</span><strong>${esc(r.name)}</strong></a>`).join("")}</div></div>
      </section>`;
  return layout({
    path: productPath(p),
    title: p.title,
    description: p.description,
    ogType: "product",
    ogImage: imgPath(p.images[0].file),
    ld: [organization, breadcrumbLd(crumbs), productLd(p)],
    body,
  });
}

// ───────── 사이트맵 ─────────
function sitemap() {
  const urls = [
    ["/", "1.0"],
    ["/products/", "0.9"],
    ...categories.map((c) => [categoryPath(c), "0.8"]),
    ...products.map((p) => [productPath(p), "0.8"]),
    ["/privacy", "0.2"],
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(([path, pr]) => {
    const p = bySlug[path.split("/").pop()];
    const images = p ? p.images.map((i) => `\n    <image:image><image:loc>${abs(imgPath(i.file))}</image:loc></image:image>`).join("") : "";
    return `  <url>\n    <loc>${abs(path)}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <priority>${pr}</priority>${images}\n  </url>`;
  }).join("\n")}
</urlset>
`;
}

// ───────── 쓰기 ─────────
function write(rel, content) {
  const file = join(ROOT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

for (const p of products) {
  if (!catBySlug[p.category]) throw new Error(`알 수 없는 카테고리: ${p.slug}`);
  for (const r of p.related) if (!bySlug[r]) throw new Error(`알 수 없는 관련 제품 ${r} (${p.slug})`);
}
write("index.html", homePage());
write("products/index.html", allProductsPage());
for (const c of categories) write(`products/${c.slug}.html`, categoryPage(c));
for (const p of products) write(`products/${p.slug}.html`, productPage(p));
write("sitemap.xml", sitemap());
console.log(`생성 완료: 메인 1, 목록 ${1 + categories.length}, 제품 ${products.length}, sitemap.xml`);
