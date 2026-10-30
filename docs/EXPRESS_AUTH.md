# Express 회원가입·로그인

`server.js`가 Express API와 Next.js 화면을 같은 주소에서 실행한다. 프론트엔드는 `fetch`와 `credentials: 'same-origin'`으로 API를 호출하며, 로그인 상태는 JavaScript에서 읽을 수 없는 `HttpOnly` 쿠키로 유지한다.

## 실행

```bash
npm ci
npm run dev
```

브라우저에서 `http://localhost:3000`을 연다. `npm run build && npm start`는 HTTPS 프록시를 사용하는 운영 실행 방식이다. 운영 환경에서 `AUTH_STORE_PATH`는 재배포 후에도 보존되는 디스크 경로로 지정해야 한다.

## API

### `POST /api/register`

```json
{ "username": "gotgot_user", "password": "12자 이상의 비밀번호" }
```

중복되지 않은 아이디를 저장하고 바로 로그인한다. 아이디는 문자나 숫자로 시작하는 3~24자의 문자·숫자·점·밑줄·하이픈을 허용한다.

### `POST /api/login`

```json
{ "username": "gotgot_user", "password": "12자 이상의 비밀번호" }
```

성공하면 7일 동안 유효한 `gotgot-session` 쿠키를 발급한다.

### `GET /api/session`

현재 세션의 사용자를 반환한다. 브라우저 새로고침 시 프론트엔드가 이 API로 로그인 상태를 복원한다.

### `POST /api/logout`

서버 세션을 폐기하고 쿠키를 삭제한다.

### `POST /api/check-in`

로그인된 사용자의 산책 장소 ID, 현재 위도·경도, GPS 정확도, 측정 시간을 받는다. 서버가 예약 없는 등록 장소인지·250m 반경·100m 이하 오차·5분 이내 측정값을 다시 확인한 뒤 장소당 한 번만 포인트와 MY 방문 기록을 저장한다. 정확한 위도·경도는 저장하지 않고 판정된 거리와 정확도만 기록한다.

## 저장과 보안

- 비밀번호 원문은 저장하지 않는다. 사용자마다 16바이트 salt를 새로 만들고 Node.js `crypto.scrypt`로 64바이트 해시를 저장한다.
- 로그인 검증에는 `timingSafeEqual`을 사용한다. 존재하지 않는 아이디도 scrypt 연산을 수행해 응답 시간 차이를 줄인다.
- 브라우저에는 `HttpOnly`, `SameSite=Lax`, 운영 시 `Secure` 속성의 세션 쿠키만 저장한다.
- 서버 파일에는 세션 토큰 원문 대신 SHA-256 해시만 저장한다.
- JSON 요청은 8KB로 제한하고 서버에서 아이디·비밀번호 길이와 형식을 다시 검사한다.
- 인증 요청은 IP와 경로별로 15분 동안 12회로 제한한다.
- GPS 인증은 IP와 경로별로 15분 동안 8회로 제한하고 중복 활동은 트랜잭션 안에서 거부한다.
- 저장은 임시 파일을 완성한 뒤 원본 경로로 원자적으로 교체하며 파일 권한을 `0600`으로 설정한다.
- `data/auth-store.json`은 Git에서 제외한다. 오류 응답에는 해시·파일 경로·스택을 보내지 않는다.

JSON 저장 방식은 한 대의 Node 서버에서 실행하는 개발·심사용 구성이다. 여러 서버 인스턴스로 확장할 때는 PostgreSQL 같은 공동 데이터베이스와 중앙 세션 저장소로 옮겨야 한다.

## 검증

```bash
npm run auth:test
WEB_BASE_URL=http://127.0.0.1:3000 node scripts/verify-login-ui.mjs
```

첫 검사는 회원가입, scrypt 저장, 잘못된 로그인, GPS 반경 밖 거부·1회 적립·중복 방지·좌표 비저장, 세션 파일 재로딩, 로그아웃을 확인한다. 두 번째 검사는 실제 브라우저 화면에서 회원가입, 자동 로그인, 새로고침 유지, `HttpOnly` 쿠키와 로그아웃을 확인한다.
