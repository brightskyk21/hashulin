# 하슐랭 코드 작업 안내

- 먼저 이 파일과 `README.md`의 기능별 경로표를 읽고 해당 폴더만 검색한다. 단순 UI 수정 때문에 전체 저장소나 DB를 다시 읽지 않는다.
- 화면 원본은 `src/client/<기능>/`의 JS·CSS·HTML이다. `public/v2/app.js`, `app.css`, `index.html`은 생성물이므로 직접 고치거나 분석 대상으로 먼저 읽지 않는다.
- API는 `src/server/<기능>/`에 있다. `server.js`는 실행 진입점이고 `src/server/app.js`는 라우터·미들웨어를 연결한다.
- 브라우저는 현재 classic-script 공유 상태를 사용한다. 새 파일은 `src/client/scripts.json` 또는 `styles.json`에 등록한다. 초기화 순서는 `start.js`에 명시되어 있다. 모듈 방식 전환이나 전역 이름 변경을 기능 수정과 섞지 않는다.
- CSS는 공통·기능 스타일 다음에 `styles/forms.css`를 마지막으로 묶는다. 모바일·터치 화면 입력 글자는 이 파일에서 최소 16px로 유지한다. 기능별 축소 규칙이나 확대 금지 viewport로 우회하지 않는다. 다른 반응형·상태별 규칙은 해당 기능 CSS에서 수정한다.
- 변경 후 `npm run build`, `npm test`. UI 변경은 영향받는 화면과 모바일/PC 크기만 확인한다. 새 실패나 추가 변경이 없으면 같은 검사를 반복하지 않는다.
- 운영 데이터로 테스트하지 않는다. DB 변경이 없다면 Supabase 전체 조회나 마이그레이션 실행은 필요 없다. 적용된 `db/migrations/001`–`011` 및 기존 리뷰·사진은 보존한다.
- `public/legacy`, `src/server/legacy`, `db/legacy`는 이전 서비스 호환용이다. 현재 화면 수정 시 건드리지 않는다.
- GitHub 계정은 **brightskyk21**. Render 배포 상태는 확인한 사실만 보고한다. Git push를 배포 완료로 간주하지 않는다.
