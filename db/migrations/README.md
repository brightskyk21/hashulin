# V2 migration and release status

Last verified: 2026-10-10 (Asia/Seoul). **NOT READY FOR PRODUCTION CUTOVER.**
No Git push or Render deployment has been performed. Applied database changes are listed below;
application changes remain local. Do not rerun applied migrations or the original schema.sql.

## Existing data

Verified source counts: 48 places, 87 reviews (민혁 42, 하진 45), 47 place photos,
10 couple photos, 40 events, 10 wish tickets and 2 wish uses. All original IDs, scores,
comments, dates, author labels and URLs are preserved. No source rows were rewritten.
The score remains mandatory, 1.0–10.0 in 0.1 increments. New reviews require a comment.

A private local JSON snapshot covers these seven tables. SHA-256 and deserialization were
verified. This is a row/metadata backup, NOT a Storage binary backup or a tested full restore.
The source photos bucket remains public to avoid breaking current Render image URLs.

## Applied migrations

- 001_accounts_and_groups.sql: authenticated profiles, private groups/members, owner-created
  one-use invites. No direct client membership/invite-table grants.
- 002_visits_and_reviews.sql: group places, visits and own-author reviews. Composite foreign
  keys prevent cross-group references. Same place/day shares a visit; repeat own submissions
  update one review. Score/comment validated inside RPCs as well as the API.
- 003_invites_and_permissions.sql: revoke explicit anon grants left by managed defaults;
  place_with_stats uses security_invoker; invite rotation/revoke/preview; transactional
  redemption and idempotent retry for an existing member.
- 004_legacy_archive.sql: member-only read-only access to original data through an explicit
  h_legacy_access binding. The original data is bound to 민혁 · 하진, UUID
  fc3e17a9-811b-4a09-b68b-4301924b137a. Users cannot change this binding.

Legacy author labels are NOT verified account identities. Never claim old reviews by matching
an editable display name. Explicitly map each historical author to a verified auth UUID before
allowing edits. The local UI displays original reviews with place photos and author filters. Accepted authors can edit
their own scores/comments through the dedicated RPC. Full gallery/calendar interfaces remain incomplete.

## Verified behavior

- Clean npm ci, full npm test and npm audit --omit=dev passed in a complete temporary copy.
  Registry audit: zero known vulnerabilities. This does not prove application security.
- API tests: public-key configuration, secret-key rejection, missing auth, protected legacy
  reads, outsider denial, blocked legacy mutations, no-store and no-referrer headers.
- PGlite: three users, member isolation, own reviews, precision/blank validation, atomic
  rollback, duplicate submission, invite expiry/one-use/rotation/revocation/preview,
  explicit anon revoke, original score/comment preservation, archive binding protection.
- Live transaction tests: two authors on one visit and outsider denial; rolled back.
- Live concurrent invite redemption: exactly one success and one rejection. Temporary
  auth users/groups were cleaned up. No source data was touched.
- Chrome: real Kakao login, profile/group, create/edit review, refresh, logout/re-login,
  original archive visibility, invite generation/revocation. Synthetic visit was removed.
- Local HTTP: /healthz, /v2/, Supabase browser bundle and /api/v2/config return 200;
  unauthenticated V2 content returns 401. Legacy APIs fail closed without bridge config.
- Production read-only smoke: /, /api/places, /api/reviews and /api/events still return 200.
  The old unauthenticated write paths were identified by source review, not destructive tests.
- GitHub test workflow added locally; it has not run on GitHub.

## Supabase advisor interpretation

The final security scan no longer reports anonymous SECURITY DEFINER execution or the
stats-view definer issue. Nine authenticated SECURITY DEFINER RPCs remain flagged: access
is intentional and relies on explicit caller/membership/owner checks and fixed search_path.
Nine RLS-without-policy notices are expected for RPC/server-only tables; direct client access
is denied. Neither fact protects old service-role server endpoints. Password-leak protection
is disabled; current app UI uses Kakao OAuth. Revisit before enabling password sign-up.

References:
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Render and production risk

Live: https://hashulin.onrender.com
GitHub: brightskyk21/hashulin, main; deployed b399a40a0b53b48621b3bce2bca5436c08390d0f.
Build npm install; start npm start; Auto-Deploy On Commit; health-check path empty.
Production lacks SUPABASE_PUBLISHABLE_KEY and LEGACY_GROUP_ID. Production OAuth return
URL /v2/ is not configured yet. Current local callback return is http://localhost:4174/v2/.
Kakao callback remains https://edzagjjwfoqqlgptljlw.supabase.co/auth/v1/callback.

The deployed legacy server uses service-role and has no caller authentication on content
routes. Its private data is still publicly readable through those endpoints; source code also
allows unauthenticated modifications. Existing photos remain public.

Local lib/security.js adds fail-closed legacy membership checks, blocks all old writes until
identity/ownership integration is complete, and adds headers. It is NOT deployed. Old pages
do not send the authenticated token, so pushing this code as-is would break map/gallery/
calendar use. /healthz and graceful termination are prepared locally.

## Release gates, in order

1. Integrate verified auth and group scoping for every existing map/review/photo/calendar
   request; finish equivalent workflows before replacing the old UI. Deny anonymous and
   cross-group access server-side/DB-side. Remove obsolete wish routes from the exposed app.
2. Map original reviewers to verified accounts, preserving original data and preventing
   nickname-based takeover. Join original and new records without duplicating place identity.
3. Add private image delivery, short-lived signed URLs, real file type/size checks, mobile
   upload error handling and cleanup. Back up Storage bytes and verify a restore before moving.
4. Define group leave/remove/owner handoff and retention of shared records. Keep a member
   from modifying another person's review. Add abuse limits that cannot be bypassed via RPC.
5. Improve drafts, duplicate-save/error/retry states, place search/selection, and record list
   pagination. Verify local-date/time behavior and clear ownership in calendar editing.
6. Confirm invite behavior on two real devices across Kakao login. Current policy: owner only,
   7 days, one successful redeemer, one active link per group, revoke/rotate old links.
   Multiple friends need clear one-person-use wording or independently revocable links.
7. Configure Render public key/group ID/production redirects, /healthz and a runtime matching
   dependencies (locked Supabase requires Node >=20; CI uses 22). Use npm ci and deploy only
   after checks pass; On Commit currently does not wait for the newly added GitHub checks.
8. Final data reconciliation/restore test, review commit, production smoke on mobile and desktop,
   then switch the release. Keep the previous application revision and source rows recoverable.

## Step 1 implementation update (2026-10-10)

005_legacy_authors.sql is applied. Do not rerun. Group owner nominates a historical author to
an existing group member; that specific account accepts. Editable nicknames grant no rights.
One account per historical label, one label per account; accepted assignments cannot be changed
through the app. Pending assignments can be corrected. Raw tables have no client grants.
User explicitly confirmed the signed-in account owns historical 민혁 reviews. Nomination and
acceptance completed through the real Chrome UI: 42 reviews linked. 하진 (45) remains unassigned.
No original review was edited during this operation. An exact normalized row comparison against
the prior snapshot passed for all five source tables: places/reviews/place_photos/couple_photos/events.

The authenticated edit RPC checks current membership, accepted author ownership, score precision
and nonblank comment. Optimistic score/comment comparison rejects stale overwrites. Each changed
review stores its previous full row in a server-only audit table in the same transaction. This audit
covers new RPC edits; it does not intercept the old deployed server's still-unprotected write paths.

Photo cards use the original place_id, never inferred visit dates. Desktop photos sit next to reviews;
mobile uses one cover photo below. Visit cards show only the earliest uploaded place photo; the full set remains available in the photo dialog. Accessible photo dialog supports previous/next, arrow keys and Escape.
Photos use existing public URLs; private delivery remains a release gate. Group-level gallery images
are not incorrectly assigned to restaurants. Mobile compose button is now visible.

Validation: API suite and PGlite passed with added nickname-takeover, pending-replacement,
wrong-account acceptance, owner-without-authorship, score precision, immutable accepted assignment,
stale update, audit preservation and removed-member/anonymous-denial tests. Chrome verified real
photo loading, dialog next/previous, accepted author status after refresh, prefilled legacy edit form,
member filter, and 390x844 responsive layout. Original live review content was not changed for testing.
No Git commit/push or Render deployment. Remaining steps are the other release gates above;
only the second author's assignment awaits their real account and confirmation.

### 006_maps_gallery_calendar.sql — 적용 완료 (2026-10-10)

원본 장소 48곳/일정 40개를 명시적 기존 모임으로 복사했습니다. h_media는 비공개 사진 메타데이터, h_events는 버전과 취소 상태를 갖는 공동 일정입니다. 사진 57개는 별도 서버 작업으로 private group-photos에 변환 복사·다운로드 해시 검증했고 원본 바이트도 백업했습니다. 원본 7개 테이블은 변경되지 않았습니다. 재실행하지 마세요.

장소 저장/방문 기록, 일정 저장/취소/복원, 사진 설명/휴지통/복원은 JWT 기반 RPC를 거칩니다. 사진 서명은 사용자 RLS 조회 후 서버 전용 Storage 권한으로 수행합니다. PGlite 테스트에서 타 모임 접근 차단·사진 작성자/모임장 검사·일정 공동 편집·낡은 버전 거부·원본 보존을 통과했습니다. 신규 이미지 검증 테스트 2개 포함 Node 테스트 5개 통과. 실제 Chrome에서 57장 갤러리·기존 일정 표시 확인. 지도 목록 48곳, 네이버 배경 지도와 점수 마커 표시 확인. 네이버 허용 주소에 localhost:4174를 사용자 승인 후 추가했습니다.

운영 전환 보류: 실제 두 기기 초대/권한 회수, 기존 홈페이지 전환, Render 환경변수/Node22/로그인 URL 및 원본 공개 사진 비공개 전환 순서를 먼저 확정해야 합니다.

### 007_membership_and_review_conflicts.sql — 적용 완료 (2026-10-10)

재실행하지 마세요. 본인 탈퇴/모임장 내보내기, 미사용 초대 취소, 멤버십 변경 이력, 새 리뷰 버전/변경 이력, 서버 전용 사진 업로드 확정 RPC를 추가했습니다. 탈퇴 시 기존 리뷰·사진·작성자 연결을 지우지 않습니다. 모임장은 본인 탈퇴가 불가능하며 양도는 아직 지원하지 않습니다.

PGlite의 가상 계정으로 탈퇴/내보내기 권한, 제거 후 접근 차단, 취소된 초대 및 사용한 초대 재사용 차단, 새 초대 재가입과 기록 보존, 리뷰 충돌 및 이전 RPC 우회 차단, 동일 요청 재시도, 업로드 완료 시 멤버십 검사를 통과했습니다. Node 테스트 6개 통과. 실제 Chrome에서는 모임장 관리 화면을 확인했습니다. 실제 두 계정/두 기기 전체 흐름은 미검증입니다.

실제 DB에는 스키마만 적용했고 사용자 멤버십 변경 이력은 0건입니다. 원본 7개 테이블은 백업과 동일하며 V2 장소 48/일정 40/사진 57개가 보존됐습니다. Git/Render 전환은 수행하지 않았습니다.

### 008_efficient_reads.sql — 적용 완료 (2026-10-10)

재실행 금지. h_media.thumb_path 추가(기존 경로/원본 보존), media_group_read의 auth.uid() initplan 처리, 필요한 사진/방문 커서·장소별 사진·평가 작성자 인덱스 4개와 SECURITY INVOKER 집계/대표 사진 RPC를 추가했습니다. RLS 반복 계산 성능 경고는 재검사에서 없어졌고 외래키 인덱스 안내는 18→16개입니다. 미사용 인덱스를 무조건 삭제하지 않았습니다.

기존 57장 썸네일을 별도 작업으로 생성·업로드·SHA-256 다운로드 대조한 후 thumb_path에 연결했습니다. 상세 이미지 57장과 원본 테이블은 그대로입니다. 새 서버가 신규 썸네일을 생성합니다. 썸네일 실패 시 상세 이미지로 대체합니다. 원본 백업 작업과 달리 Storage에는 사진당 상세+썸네일 2개가 있으며 두 경로 모두 기준으로 정합성을 검사해야 합니다.

노드 10개 및 001–008 PGlite 검사 통과. 다중 페이지 누락/중복과 페이지 밖 평가를 포함한 지도 집계, 익명/타 모임 차단 확인. 실제 운영 배포는 미수행.
