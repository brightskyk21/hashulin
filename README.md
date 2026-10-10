# 하슐랭 (Hashulin)

모임별 맛집 지도와 방문 기록. 카카오로 로그인하고, 장소·방문 날짜·각자의 점수와 감상을 저장합니다.
운영 주소: https://hashulin.onrender.com/v2/

## 현재 화면

- **리뷰**: 기존 리뷰와 새 방문을 날짜순으로 표시합니다. 같은 장소·날짜는 한 카드에 모으고, 작성자 필터는 해당 사람의 평가만 표시합니다. 수정은 리뷰 상세에서 합니다. 아래로 스크롤하면 24개씩 이어서 표시하고, 실패한 경우에만 다시 시도 버튼을 표시합니다. 추가 로딩은 기존 카드·사진·펼친 감상을 유지합니다.
- **점수**: 방문 전체 만족도 1.0–10.0, 0.1점 단위. 얇은 연속 스펙트럼 위 이모지와 숫자 색이 구간에 따라 바뀝니다. 새 기록은 점수를 직접 선택해야 저장됩니다.
- **사진**: 기록 작성 중 선택한 사진은 해당 방문에 연결합니다. 기존 사진은 날짜를 추측하지 않고 장소 연결을 유지합니다. 대표 사진 한 장을 표시하며 갤러리는 자동으로 다음 페이지를 읽습니다.
- **지도**: 전체 장소의 평균 점수를 사용합니다. 축척에 따라 묶음·점·이모지와 점수를 표시하며, 데이터 갱신 시 보고 있던 위치를 유지합니다. 모바일에서는 지도 제목과 점수 범례를 생략하여 지도를 더 크게 표시합니다. 기존·새 리뷰가 있는 장소는 가고 싶은 곳으로 바꿀 수 없으며, 새 리뷰를 저장하면 다녀온 곳으로 전환됩니다.
- **일정**: 다가오는 일정을 먼저 표시하고, 달력을 펼쳐 날짜별 일정을 봅니다.
- **모임**: 프로필 설정 → 모임 생성 또는 초대 코드/링크로 참여. 모임장은 이름 변경, 초대, 멤버 관리가 가능합니다.

## 코드 구조와 수정 위치

```text
src/
  client/               화면 원본: 기능별 JS·CSS·HTML
    auth/               로그인·세션 복구·가입 안내
    groups/             모임 설정·초대·멤버·기존 작성자 연결
    reviews/            리뷰 목록·상세·작성·대표 사진·평균 점수 배지
    scores/             점수 기준·색상·이모지 이미지
    map/                검색·마커·클러스터·지도 화면
    places/             장소 상세·방문 상태·장소 데이터
    photos/             갤러리·무한 스크롤·뷰어·업로드·썸네일
    calendar/           일정 목록·달력·편집
    core/               공유 상태·API·화면 전환·기능 간 연결
    shared/             DOM·날짜·대화상자 공통 함수
    styles/             글꼴과 공통 레이아웃
  server/               같은 기능 이름으로 나눈 API와 서버 처리
    middleware/         보안 헤더·기존 API 접근 제어
    shared/             검증·커서 페이지·공통 조회
    legacy/             이전 API 및 기존 리뷰 읽기 호환
scripts/build-client.js 원본을 배포용 JS·CSS·HTML로 묶음
public/v2/              생성된 앱 파일 — 직접 수정하지 않음
public/legacy/          이전 화면과 자산 — 기존 URL도 계속 제공
server.js               환경변수 로딩·서버 실행·종료
db/migrations/         현재 DB 마이그레이션 (적용된 파일 보존)
db/legacy/             이전 SQL 보관 (실행하지 않음)
test/                   기능 회귀·API·권한 검사
```

| 수정하려는 것 | 먼저 확인할 파일 |
| --- | --- |
| 리뷰 카드·작성자 필터 | `src/client/reviews/feed.js`, `model.js`, `data.js`, `styles.css` |
| 카드 모서리 이모지·원 | `src/client/reviews/score-badge.js`, `badge.css`, `src/client/scores/emoji.js` |
| 점수 스펙트럼·점수 색상 | `src/client/scores/scale.js`, `styles.css`, `src/client/reviews/composer.js` |
| 리뷰 작성·사진 재시도 | `src/client/reviews/composer.js`, `composer.html`; 서버 `reviews/routes.js`, `photos/routes.js` |
| 로그인 유지·가입 단계 | `src/client/auth/session.js`, `onboarding.js`; 서버 `auth/router.js`, `profile.js` |
| 초대·모임·기존 작성자 연결 | `src/client/groups/`; 서버 `groups/`, `legacy/archive.js` |
| 지도 크기·검색·마커 | `src/client/map/map.js`, `clusters.js`, `styles.css`; 서버 `map/search.js` |
| 장소 버튼·상세 | `src/client/places/detail.js`, `detail.html`, `styles.css` |
| 갤러리·무한 스크롤·사진 | `src/client/photos/gallery.js`, `pagination.js`, `viewer.js`, `styles.css`; 서버 `photos/` |
| 일정 | `src/client/calendar/`; 서버 `calendar/routes.js` |

`src/client/scripts.json`과 `styles.json`이 묶는 순서를 정합니다. HTML은 `index.html`의
`<!-- include: 기능/파일.html -->`로 조립합니다. 브라우저 초기화는 `start.js`에서 수행합니다.
기존 공유 상태와 핸들러 등록 순서를 유지한 구조이며, 각 파일이 독립 ES 모듈인 것은 아닙니다.
새 프레임워크나 빌드 의존성은 추가하지 않았습니다.

원본 수정 → `npm run build` → 필요한 검사 → 생성물도 함께 커밋합니다.
`npm test`는 생성물이 최신인지 검사하므로, 빌드를 빠뜨린 소스가 배포되는 것을 막습니다.

## 개발 및 배포

Node 22 이상을 사용합니다.

```bash
cp .env.example .env
npm ci
npm run build
PORT=4174 npm start
npm test
```

`npm start`는 실행 전 빌드를 수행합니다. `npm run dev` 중 화면 원본을 수정했다면 `npm run build` 후 새로고침합니다.

환경변수는 `.env.example`을 참고합니다. `SUPABASE_SERVICE_KEY`와 네이버 검색 비밀 키는 서버에만 둡니다.
브라우저 설정은 Supabase 공개 키와 네이버 지도 클라이언트 ID만 반환합니다.
카카오 및 Supabase 로그인 허용 주소, 네이버 Maps 허용 주소에는 실제 개발/운영 origin이 등록되어야 합니다.

- 저장소: `brightskyk21/hashulin`, 배포 브랜치 `main`
- Render 서비스: `hashulin`, `srv-d8roqs37uimc73fg5ue0`
- Build: `npm ci --include=dev && npm test && npm prune --omit=dev`
- Start: `npm start`, health check: `/healthz`
- 스키마: `db/migrations/001`–`011` 적용 완료. 운영 DB에 재실행하지 않습니다.
- 배포 순서: 로컬 테스트 → 추가형 DB 마이그레이션 → Git push → Render 배포 → 운영 화면 확인.
- 새 마이그레이션 010은 이전 앱과 호환됩니다. 앱 롤백 시 사진 연결 컬럼이나 기존 데이터를 삭제하지 않습니다.

## 데이터와 권한

V2 API는 사용자 JWT와 Supabase RLS로 모임 접근을 확인합니다. 이전 작성자 연결은 모임장 지정과 당사자 확인이 모두 필요하며, 표시 이름을 바꿔 다른 사람의 리뷰를 수정할 수 없습니다. 평가·일정·사진 수정은 버전 충돌을 확인하고 변경 이력을 남깁니다.

초대는 7일 유효한 일회용 링크/코드입니다. 새 초대를 만들면 이전 미사용 초대가 취소됩니다. 멤버 탈퇴/제거는 기존 기록을 보존하면서 접근 권한과 미사용 초대를 회수합니다.

사진은 비공개 `group-photos` 버킷을 사용합니다. RLS 조회 후 서버에서 5분 유효 URL을 발급하며, 화면 주변 480px 범위의 썸네일을 미리 요청하고, 사용자·모임별로 발급 URL을 재사용합니다. JPG/PNG/WebP, 장당 8MB, 한 번에 10장까지 지원합니다. 서버에서 이미지 해석·회전·최대 2400px 변환·EXIF 제거를 수행합니다. HEIC는 JPG로 변환해야 합니다.

기록 저장과 사진 전송은 별도 단계입니다. 사진 전송이 실패해도 저장된 점수·감상은 유지하고, 같은 업로드 키로 실패한 사진만 재시도합니다. 완료된 사진은 다시 저장하지 않습니다.

방문과 사진 목록은 24개 커서 페이지로 조회합니다. 기존 리뷰는 모임 평균과 작성자 연결을 위해 메타데이터를 함께 읽습니다. 지도는 현재 모임의 전체 장소 요약을 받으며, 달력은 표시 월 42일과 향후 90일을 읽습니다. 대규모 공개 서비스용 전체 서버 페이지네이션이 완료된 구조는 아닙니다.

## 검증

`npm test`는 Node 회귀 테스트와 앱 진입·정적 자산 검사와 PGlite의 001–011 마이그레이션/권한 검사를 실행합니다. 작성자 필터, 기존 기록 통합, 커서 경계, 초대, 세션 복구, 다른 모임 접근 차단, 수정 충돌, 사진 재시도 및 방문·모임·장소 연결을 검사합니다.

2026-10-10의 010 적용 전후: 기존 리뷰 87개, 새 방문/리뷰 각 1개, 사진 58개(기존 연결 57개) 보존. 모바일 작성·필터·수정·사진 오류 재시도는 분리된 테스트 화면에서 확인했습니다. 운영 사용자 기록을 테스트용으로 수정하지 않습니다.

과거 이전 작업과 검증 이력은 `db/migrations/README.md`에 보관합니다. 이 파일의 현재 상태가 과거의 배포 보류 메모보다 우선합니다.
