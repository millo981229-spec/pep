# 기획·사용성 보완 검증 근거

2026-10-30 KST. 실제 API 키·운영 DB 없이 별도 로컬 테스트 서버와 Chromium에서 검사했다. 실제 사용자 인터뷰나 공개 서비스에서의 개인정보·AI 운영 검증 결과가 아니다.

## 실행 결과

- [브라우저 출력](browser-checks.txt): 390px·1280px에서 체험 로그인, 10,000P 잔액, 1,200P 사용 후 8,800P, 추가 6,000P 사용 후 2,800P, 중복·잔액 부족·저장 실패·재로그인 유지 검사를 통과했다.
- 같은 브라우저 검사에 사용 완료 쿠폰을 MY에서 다시 열기, 재사용 버튼 비활성화, 차감 완료 안내, 쿠폰 사진 높이 일치, AI 준비 버튼 비활성화와 활동 탐색 이동 검사가 포함된다.
- [Express 출력](auth-checks.txt): 임시 JSON 저장소에서 해시·세션·GPS 검증·동시 중복 방지·계정 분리·재시작 유지를 통과했다.
- [외부 서비스 경계 출력](provider-checks.txt): 모의 전송을 사용한 14개 검사 통과, 실패 0개. 실제 Supabase 또는 OpenAI 호출은 하지 않았다.
- [기존 탐색 회귀 검사 출력](preview-checks.txt): 사진·검색·분야 바로가기·GPS·직원 확인·모바일 검사를 통과했다.
- 직접 Next 프로덕션 빌드의 TypeScript 검사와 `npm run lint`를 통과했다. Prisma 생성부터 실행하는 전체 스크립트의 정상화나 Lighthouse 점수를 뜻하지 않는다.

검사 소스: [체험 흐름](../../../scripts/verify-preview-login.mjs), [Express](../../../scripts/verify-express-auth.mjs), [외부 서비스 경계](../../../scripts/verify-platform.mjs).

## 화면 사진

| 화면                     | 휴대폰 390px                   | PC 1280px                       |
| ------------------------ | ------------------------------ | ------------------------------- |
| 곳곳드림 잔액            | [보기](my-390.png)             | [보기](my-1280.png)             |
| 쿠폰 사용 완료           | [보기](coupon-used-390.png)    | [보기](coupon-used-1280.png)    |
| MY 사용 쿠폰 재조회      | [보기](coupon-history-390.png) | [보기](coupon-history-1280.png) |
| AI 준비 상태와 탐색 대안 | [보기](ai-status-390.png)      | [보기](ai-status-1280.png)      |

## 재현

`node scripts/build-web-preview.mjs`로 만든 HTML을 루트 `index.html`에 반영한 뒤 다음을 실행한다. 브라우저 검사는 Playwright·Chromium이 준비된 실행 환경이 필요하다. 실제 계정이나 운영 자료는 사용하지 않는다.

```bash
EVIDENCE_DIR=docs/evidence/planning-review node scripts/verify-preview-login.mjs
npm run auth:test
node scripts/verify-platform.mjs
```

이 기록은 해당 코드의 자동 검사 근거다. 시장 수요, 재방문율, 지역 경제 효과, 운영 DB 확장성, 실제 AI 추천 품질은 별도 검증이 필요하다.
