# ⭐ 하슐랭 (Hashulin)

> 하진의 미슐랭. 가는 맛집마다 점수 매기는 우리만의 지도.

네이버 지도에서 가게를 검색해 **북마크**하고, 1.0~10.0 점수와 한 줄 평을 기록하는 페이지.
여러 명이 같은 가게에 점수를 매기면 지도 마커에 **평균 점수**가 색으로 표시됩니다.

## 구조

```
브라우저(index.html + 네이버 지도)
  → /api/search   : 네이버 지역검색 API 프록시 (가게 검색)
  → /api/places   : 가게 저장/목록 (Supabase)
  → /api/.../reviews : 점수·평가 저장 (Supabase)
서버: Express (server.js)  ·  저장소: Supabase(PostgreSQL)  ·  호스팅: Render
```

## 1. 키 발급 (3종류)

| 용도 | 발급처 | 환경변수 |
|------|--------|----------|
| 지도 표시 | [네이버 클라우드 플랫폼](https://www.ncloud.com) → Maps → Application 등록 (Web Dynamic Map) | `NAVER_MAP_CLIENT_ID` |
| 가게 검색 | [네이버 Developers](https://developers.naver.com) → 애플리케이션 등록 → **검색 API** | `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET` |
| 저장소 | [Supabase](https://supabase.com) → 프로젝트 → Settings → API | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |

> 지도 Application 등록 시 **Web 서비스 URL**에 `http://localhost:3000` 과 배포될 Render 주소(`https://xxx.onrender.com`)를 모두 등록해야 지도가 뜹니다.

## 2. Supabase 테이블 만들기

Supabase 대시보드 → SQL Editor → [`db/schema.sql`](db/schema.sql) 내용을 붙여넣고 Run.

## 3. 로컬 실행

```bash
cp .env.example .env      # 값 채우기
npm install
npm run dev               # http://localhost:3000
```

## 4. Render 배포

1. 이 폴더를 **개인 GitHub 계정**의 새 저장소로 push
2. [Render](https://render.com) → New → **Web Service** → 그 저장소 선택
3. 설정:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Environment** 탭에 `.env`의 키들을 그대로 등록 (`PORT`는 생략 — Render가 자동 주입)
5. 배포된 주소를 네이버 지도 Application의 서비스 URL에 추가

## 참고
- 네이버 지역검색 API는 **결과 최대 5건**입니다. 정확한 가게 이름으로 검색하세요.
- 마커 색: 빨강(낮음) → 초록(높음), 회색은 평가 없음.
