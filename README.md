# 제일플러스 JPD 정적 홈페이지 (www.jpd.kr)

Cloudflare에 배포되는 정적 사이트입니다. 제품 페이지는 데이터 파일에서 자동 생성합니다.

## 구조

- `data/products.mjs`: 회사 정보, 카테고리 3개, 제품 20개 (이름·설명·규격·가격·사진·FAQ)
- `scripts/build.mjs`: 데이터 파일로 `index.html`, `products/*.html`, `sitemap.xml`을 생성
- `scripts/serve.mjs`: 로컬 미리보기 서버 (Cloudflare처럼 확장자 없는 주소 지원)
- `images/products/`: 제품 사진 (`<제품주소>-<번호>.jpg`, 긴 변 1200px)
- `_redirects`: 이전 주소(`/bag`, `/products/chemical-waste-bags`)의 301 이동 규칙
- 직접 수정하는 파일: `privacy.html`, `404.html`, `css/style.css`, `js/main.js`

생성되는 HTML 파일(`index.html`, `products/*.html`, `sitemap.xml`)은 직접 고치지 마세요. 다시 빌드하면 덮어씁니다.

## 제품 추가·수정

1. 사진을 `images/products/<제품주소>-1.jpg` 형식으로 넣습니다. 맥에서는 아래 명령으로 크기를 줄일 수 있습니다.
   `sips -Z 1200 -s format jpeg -s formatOptions 62 원본.jpg --out images/products/새제품-1.jpg`
2. `data/products.mjs`의 `products` 목록에 항목을 추가하거나 수정합니다. 기존 항목을 복사해 쓰면 편합니다.
3. 아래 명령으로 빌드하고 미리 봅니다.

```bash
node scripts/build.mjs
node scripts/serve.mjs
```

브라우저에서 http://localhost:8765 를 엽니다.

4. 커밋하고 GitHub에 푸시하면 Cloudflare에 배포됩니다.

## 콘텐츠 기준

- 가격·규격·제품코드는 다음(Daum) 카페 "제일플러스 제품" 게시판 글을 기준으로 합니다: https://cafe.daum.net/jeilplus/llIa
- 카페에 가격이 있는 제품은 가격을 공개하고, 없는 제품은 견적 문의로 표시합니다.
- 카페에 금액이 적힌 제품만 구조화 데이터에 판매 가격(Offer)을 넣습니다. 금액이 없으면 `price`를 비워 두세요. 페이지에 "견적 문의"로 표시되고 Offer는 생략됩니다.
- 성능을 보증하는 표현은 쓰지 않습니다. 폐기물 봉투는 분류용이며 내화학 성능을 보증하지 않는다는 안내를 유지합니다.
- 고객사 이름은 확인과 동의 없이 사이트에 적지 않습니다.

## 회사 정보

`data/products.mjs`의 `company`에서 바꾸고 다시 빌드하면 전 페이지에 반영됩니다. `privacy.html`은 직접 수정해야 합니다.

- 대표전화 02-487-0396 / 휴대전화 010-3782-9982 / 이메일 s-bar@hanmail.net
- 주소: 경기도 안산시 단원구 지원로 196

## 검색엔진 등록

### 구글

1. Google Search Console에 `https://www.jpd.kr` 속성을 등록하고 소유권을 확인합니다 (DNS 또는 HTML 파일 방식).
2. `https://www.jpd.kr/sitemap.xml`을 제출합니다.
3. URL 검사에서 메인, `/products/`, 카테고리 3개, 주요 제품 페이지의 색인 생성을 요청합니다.
4. Google 비즈니스 프로필에 업체(주소·전화·웹사이트)를 등록합니다.

### 네이버

1. 네이버 서치어드바이저에 사이트맵을 다시 제출하고, 주요 페이지 수집을 요청합니다.

### 카페 연동

카페에 새 제품 글을 쓸 때 글 끝에 사이트의 해당 제품 페이지 링크를 붙입니다. 사이트 설명을 카페보다 자세하게 유지해야 구글이 사이트 페이지를 원본으로 봅니다.

### 구조화 데이터 검사

Google Rich Results Test(https://search.google.com/test/rich-results)에서 메인과 제품 페이지를 검사합니다.
