# 곳곳 웹 실행과 현재 구현 범위

2026-10-30 (KST). 설치 없이 PC·모바일 브라우저에서 사용하는 Next.js 웹이다. 독도를 포함한 지역 정보 518개가 있으며 14개 관심활동 분류 모두 전국 기준 최소 4개를 제공한다. 경북 22개 시·군에 명소 2곳씩과 독도 안내를 포함한다. 자료별 확인 상태와 한계는 [지역 카탈로그](REGIONAL_CATALOG.md)를 참고한다. Express 아이디·비밀번호 인증, 세션 유지, 공공 산책 장소 5곳의 GPS 방문 적립을 구현·검증했다. 실제 제휴 쿠폰·AI의 운영 서비스 연결은 아직 완료되지 않았다.

## 바로 화면 보기

```bash
cd /workspace/pep
npm ci
npm run dev
```

Node.js 24가 필요하다. `npm run dev`는 `server.js`에서 Express API와 Next.js를 함께 실행한다. 정상적인 환경에서는 npm ci의 postinstall이 Prisma Client를 생성한다. 보호된 기존 소스·lockfile은 설치 과정에서 수정하지 않는다.

홈 `/`, 탐색 `/explore`, 지역 지도 `/map`, AI 추천 `/recommend`, 교환소 `/rewards`, 마이 페이지 `/my`를 제공한다. 미연결 상태에서도 공개 방문·참여 정보 518개를 탐색할 수 있으며 6개 분야의 혜택 예시 15개는 실제 교환이 불가능하다. 예약 없는 공공 산책 구간 5곳만 GPS로 200P씩 적립할 수 있고 나머지는 자료의 확인 수준을 표시한다.

서버 없이 디자인을 확인하려면 다음 명령으로 하나의 HTML 파일을 만든다. 빌더는 현재 설치된 tsx의 esbuild 의존성을 사용한다. 실제 인증·DB·AI 없이 구성과 탐색 동작을 보여주는 파일이다.

```bash
node scripts/build-web-preview.mjs
```

출력: `.next/preview/곳곳-웹-미리보기.html`. 다운로드해서 최신 브라우저에서 연다. React·폰트·그림을 포함하므로 인터넷이 필요 없다. 빌드가 `.next`를 정리한 뒤에는 다시 생성한다. 이 파일은 배포 서비스나 실서비스 검증을 대신하지 않는다.

## 나머지 실제 서비스 연결 준비

환경 설정에 존재하는 변수 이름만 확인했으며 현재 Supabase·AI 값은 제공되지 않았다. 비밀값은 채팅·Git에 기록하지 않는다.

1. 별도의 개발용 Supabase 프로젝트를 준비한다. `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 `.env.local` 또는 안전한 환경 설정에 입력한다. publishable/anon 키를 사용하며 service_role 키를 이 변수에 넣지 않는다.
2. `supabase/migrations/202610290001_platform.sql` 전체를 검토한다. 이 파일은 아직 실제 프로젝트에 적용하지 않았다. 기존 테이블·데이터와 충돌하지 않는 개발 프로젝트인지 확인하고 별도 승인 후 적용한다. 설치·빌드 명령은 운영 DB를 변경하지 않는다.
3. 현재 회원가입·로그인은 Express JSON 저장소를 사용한다. Supabase의 RLS 보호 자료까지 같은 로그인으로 사용하려면 Express 세션의 사용자 ID를 운영 DB 사용자와 안전하게 연결하도록 서버 API를 통합해야 한다. 비밀번호 재설정, 개인정보 처리방침·탈퇴 및 보관 정책은 공개 운영 전에 추가해야 한다.
4. Auth 기존 회원도 SQL의 프로필 생성 대상으로 포함된다. DB는 사용자별 RLS와 컬럼 권한으로 잔액 직접 변경을 금지한다. 쿠폰 교환은 함수에서 잔액·재고·발급·원장을 하나의 트랜잭션으로 처리한다. 회원 UUID는 요청 입력이 아닌 검증된 세션에서 정한다.
5. 실제 활동·혜택은 사용권과 운영 조건을 확인한 뒤 운영자가 등록해야 한다. 기본 상태 `active=false`, `is_demo=true`이며 자동으로 실사용 자료나 적립금을 만들지 않는다. 지도는 지역 선택용 개략도로 실제 행정 경계·축척·길찾기 지도가 아니다.
6. Express GPS 인증은 예약 없는 등록 장소·반경 250m·정확도 100m 이하·5분 이내 측정값을 서버가 재검사하고 활동당 한 번만 포인트 원장·잔액·방문 기록을 함께 갱신한다. 정확한 좌표는 저장하지 않는다. 그 밖의 수동 참여 요청은 신뢰된 운영자가 `approve_participation`을 실행한 뒤 적립한다. 교환 쿠폰에는 서버 발급 Code 128 바코드가 생기며 쿠폰 소유자의 직원확인 버튼 또는 신뢰된 운영자의 `use_coupon` 스캔으로 한 번만 사용 처리된다. 운영자 스캔 UI·취소/환불 정책은 아직 없다.
7. 실제 AI 연결에는 서버용 `AI_API_KEY`, `AI_MODEL`이 필요하다. 현재 OpenAI Chat Completions의 JSON 응답을 사용한다. API 키 없이 AI가 동작한 것처럼 표시하지 않는다. 로그인 사용자별 KST 하루 10회 DB 카운터·요청 400자·18초 제한·출력 스키마 및 활동 ID 검증이 있다. AI 비용은 프로젝트 예산·경보도 별도로 설정해야 한다. 후보는 조건에 맞는 실제 활동 최대 48개이며 초기 추천 품질/다양성 최적화가 필요하다.

필요 네트워크: npm/GitHub 패키지 프리셋, Prisma 생성용 `binaries.prisma.sh`, 선택한 Supabase 프로젝트 호스트, AI 연결용 `api.openai.com`. 자체 제공 한글 폰트를 사용하므로 Google Fonts 접속은 더 이상 필요하지 않다. 특정 호스트 차단은 환경 설정에서 허용하며 프록시·TLS·체크섬 검증을 우회하지 않는다.

## 데이터와 구조

- `src/lib/catalog.ts`: 지역 소개 및 명시적인 가상 미리보기 자료.
- `server.js`, `server/auth-store.js`, `server/check-in.js`: Express 회원가입·로그인, GPS 거리 판정·중복 적립 방지, scrypt 비밀번호 해시, 서버 세션과 JSON 저장소.
- `src/lib/platform.ts`: Supabase 요청, 세션 검증, 입력 크기·Origin 검사, 안전한 오류 처리.
- `src/app/api/`: 인증, 공개 목록/단건, 사용자 자료 CRUD, 쿠폰 교환, AI 추천.
- `src/components/`: 웹 화면, 활동 카드, 지도, 모달, 아이콘.
- `supabase/migrations/`: 새 서비스의 Auth 연계 PostgreSQL 테이블·RLS·업무 함수. 실제 적용 전 검토 필요.
- 기존 `prisma/schema.prisma`와 `src/lib/db.ts`: 원래 보일러플레이트의 직접 DB 연결 경로로 유지한다. 새 웹 기능은 인증 사용자 JWT를 Supabase Data API에 전달해 RLS를 적용하며, 두 경로가 동일 모델이라고 가정하거나 Prisma migrate로 새 SQL 테이블을 덮어쓰지 않는다. 운영 전 스키마 관리 경로를 통합할 계획이 필요하다.
- 폰트: Pretendard 1.3.9 기반 약 457KB 서브셋. 예약 이름을 보존하기 위해 내부명을 Gotgot Sans로 변경. `public/fonts/OFL.txt`와 `FONT_INFO.md` 참고. 지역 그림은 이 프로젝트에서 작성한 SVG 일러스트다.

## 검증과 제한

- Next 타입 생성·TypeScript·ESLint 및 프로덕션 Next 빌드는 별도로 확인한다. 실제 결과는 아래 구현 기록을 참고한다.
- 정상 권장 명령: `npm run check`, `npm run db:validate`, `npm run build`. 현재 클라우드에서는 Prisma CLI의 엔진 다운로드가 정책 403으로 차단된다. 이를 숨기기 위해 검사·보안 검증을 끄지 않는다.
- 이번 환경의 Prisma Client는 동일 버전의 공식 내부 생성기와 WASM 파서로 바이너리 다운로드 없이 생성했다. 기존 설치 스크립트가 정상화된 것은 아니며 새 환경 재현에는 네트워크 설정이 필요하다. 이 내부 API 경로를 공개 운영의 설치 방법으로 고정하지 않는다.
- Express 인증과 GPS 적립은 API에서 검증했다. 쿠폰 화면의 직원확인 흐름은 PC·390px Chromium에서 검증했고 Supabase 소유자·1회 사용 함수는 분리된 PostgreSQL에서 검증했다. Supabase 운영 DB·AI·실제 제휴 쿠폰은 라이브 연결로 검증되지 않았다.
- 첫 화면 390px·1280px 스크린샷과 웹 브라우저 탐색 기록을 확보한다. 로그인 후 Lighthouse 3회 측정은 실제 인증 연결 이후에 수행해야 하며 아직 점수를 주장하지 않는다.
- 공개 운영 전에 관리자 기능, 회원 복구·삭제, 쿠폰 사용·취소, 지역 콘텐츠 갱신, 지도 위치 데이터, 실시간 서비스 모니터링과 실제 동시 요청 검증이 필요하다. 지역·소지역·분류·검색어는 서버에서 전체 카탈로그에 적용한 뒤 24개씩 나누어 읽는다.

이 문서는 구현 상태 안내이며 추가 DB 적용·유료 호출·배포·Git 커밋/푸시를 승인하지 않는다.

## 첫 구현 검증 기록

- `next typegen`, `tsc --noEmit`, `eslint . --max-warnings=0`, `prettier --check .` 통과.
- `next build` 통과. 타입 검사를 포함하며 웹 화면과 Next API 경로를 생성한다. Express 인증 API는 `server.js`가 먼저 처리한다.
- `npm run auth:test`와 실제 Chromium 화면 검사에서 회원가입, scrypt 저장, 자동 로그인, `HttpOnly` 세션, 새로고침 유지, 재시작 후 세션 복원, 로그아웃을 확인했다.
- Chromium 실제 개발 서버에서 390px·1280px 각각 홈·탐색·지도·추천·교환소·마이 페이지를 열어 HTTP 표시와 가로 넘침 없음, JS 오류 없음 확인. 각 크기에서 분야 필터·상세 보기·Escape 닫기·전남 지역 선택을 확인했다.
- 독립 HTML 미리보기에서도 전체 화면·검색·17개 지역 선택을 확인했다. 이 환경은 `file://` 직접 이동을 차단하므로 동일 HTML 내용을 Chromium에 주입해 검증했으며 실제 사용자의 로컬 파일 열기 환경까지 보장하지 않는다.
- Express 인증·GPS 통합 검사와 분리된 PostgreSQL 검사 11개가 통과했다. 상세 절차와 한계는 [검증 재현 방법](PLATFORM_TESTS.md)을 참고한다. 이 테스트는 심사 항목의 통과나 점수를 뜻하지 않는다.
- `npm run check`·`npm run build` 전체 스크립트는 Prisma CLI 다운로드 차단이 남아 있으며, 위 Next 직접 빌드 결과와 구분한다. Supabase 운영 DB·AI 호출·쿠폰 사용·동시 다중 연결·배포·로그인 후 Lighthouse는 미검증이다.

예약·참가 등록 조건을 확인할 수 없는 행사 35개는 자동 적립에서 제외했다. 보호센터 안내와 단순화한 적립 흐름은 [예약 없는 방문 인증](WALKIN_REWARDS.md)을 참고한다.
