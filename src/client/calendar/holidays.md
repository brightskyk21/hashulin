# 대한민국 공휴일 데이터

`holiday-dates.js`는 2025–2028년의 날짜와 명칭을 담은 읽기 전용 자료다.
`holidays.js`에서 같은 날의 명칭을 합치고 달력·선택일·향후 90일 목록에 표시한다.
일요일은 달력 숫자만 붉게 표시하고, 매주 반복되는 별도 일정으로 만들지 않는다.
모임 일정 테이블, 편집·취소 API, 사용자 작성 일정 개수에는 포함하지 않는다.

## 출처와 기준

- 한국천문연구원 [2025](https://astro.kasi.re.kr/kor/life/post/calendarData?year=2025), [2026](https://astro.kasi.re.kr/kor/life/post/calendarData?year=2026), [2027](https://astro.kasi.re.kr/kor/life/post/calendarData?year=2027), [2028](https://astro.kasi.re.kr/kor/life/post/calendarData?year=2028) 달력 자료의 국경일·공휴일 표.
- 인사혁신처 [2025-01-27 임시공휴일](https://www.mpm.go.kr/mpm/comm/newsPress/newsPressRelease/?boardId=bbs_0000000000000029&cntId=4008&mode=view), [2025-06-03 대통령선거일](https://www.mpm.go.kr/mpm/comm/noti/mpmNotice/?boardId=bbs_0000000000000205&cntId=928&mode=view) 공고를 추가 반영했다.
- 인사혁신처 [2026년 노동절·제헌절 공휴일 지정](https://www.mpm.go.kr/mpm/comm/newsPress/newsPressRelease/?boardId=bbs_0000000000000029&cntId=4250&mode=view)을 반영했다. 두 날의 지정과 대체공휴일 적용은 2026년부터이며 2025년에는 소급하지 않는다.
- 마지막 확인: 2026-10-11. KASI 장기 달력 자료는 월력요항 확정 고시와 다르며 이후 법령·임시공휴일 지정에 따라 변경될 수 있다.

## 갱신

외부 키·실시간 호출 없이 동작한다. 새 연도 월력요항 또는 임시공휴일 공고가 나오면 위 공식 출처를 확인하고 해당 연도의 `[월-일, 명칭]` 행을 추가·수정한 뒤 빌드하여 배포한다. 자동 갱신 기능은 없다.

지원하지 않는 연도를 이동하면 정보 미지원 안내를 표시한다. 빈 자료를 공휴일이 없는 해로 간주하거나 임의의 대체공휴일을 계산하지 않는다.
검사는 `test/calendar-holidays.test.js`에 있다. 동일 날짜 중복 명칭, 설·추석 연휴, 대체공휴일 예외, 연도 경계, 모임 일정과의 분리를 유지한다.
