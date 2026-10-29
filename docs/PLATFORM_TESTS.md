# 서버·DB 검증 재현 방법

2026-10-29 KST 기준. 실제 실행 결과와 한계를 구분한다. 운영 계정·실제 고객 자료·운영 DB·유료 AI 호출은 사용하지 않는다.

지역 정보 추가 후의 카탈로그 HTTP·PC/모바일·프로덕션 빌드·HTML 검증은 [지역 카탈로그 검증 기록](evidence/regional-catalog/README.md)을 참고한다.

## 1. 서버 경계 검증 — 14개

Node.js 24와 저장소 의존성이 설치된 상태에서 실행한다.

```bash
cd /workspace/pep
node scripts/verify-platform.mjs
```

실제 `src/lib/platform.ts`를 TypeScript로 변환해 실행하고, 네트워크와 쿠키 저장소만 테스트용으로 대체한다. 실제 환경 변수 대신 가짜 URL·키·토큰을 사용한다.

- publishable key가 익명 요청의 Bearer 토큰으로 잘못 전송되지 않는지.
- 인증 요청에 세션 JWT와 필요한 요청 헤더가 유지되는지.
- AI 일일 제한, 마일리지 잔액 부족, 미적용 마이그레이션, 네트워크 시간 초과를 안전하게 안내하는지.
- 잘못된 설정 URL, 비로그인 요청, 다른 Origin의 상태 변경 요청을 차단하는지.
- JSON 형식과 UTF-8 본문 8KB 제한을 확인하는지.
- 공급자 오류와 내부 예외의 민감한 내용을 응답에 노출하지 않는지.
- 인증 공급자의 숫자 상태 코드·이메일 미인증·잘못된 인증 정보가 안전한 메시지로 처리되는지.
- 연결 설정이 없으면 네트워크 호출 없이 503으로 처리하는지.

**실행 결과: 14개 통과, 실패 0, 건너뜀 0.** 이 결과는 실제 Supabase 로그인·메일 인증·세션 갱신·배포 연동의 성공을 뜻하지 않는다.

## 2. 독립 PostgreSQL 검증 — 10개

선택적 테스트 도구인 `@electric-sql/pglite`를 저장소 밖에 설치한다. 앱의 package.json·lockfile·운영 의존성은 변경하지 않는다. 일반 npm 설치의 TLS·무결성 검증을 유지한다.

```bash
npm install --prefix /tmp/gotgot-sql --no-package-lock --no-audit --no-fund @electric-sql/pglite@0.3.14
cd /workspace/pep
PLATFORM_TEST_DEPS=/tmp/gotgot-sql node scripts/verify-database.mjs
```

`PLATFORM_TEST_DEPS`는 위 테스트 패키지를 설치한 절대 경로다. 스크립트는 메모리 안의 PostgreSQL WASM 엔진에 Auth 계약용 최소 스키마·역할을 만들고 실제 마이그레이션 SQL을 적용한다. 프로세스가 종료되면 테스트 DB는 사라진다. 외부 Supabase 프로젝트에는 접속하지 않는다.

1. 전체 마이그레이션 SQL 적용.
2. Auth 사용자 생성 시 잔액 0인 프로필 생성.
3. 자기 프로필만 조회하고 회원의 잔액 직접 수정 차단.
4. 다른 계정 자료의 생성·조회·수정·삭제 차단.
5. 잔액 부족 시 재고·쿠폰 발급 전체 롤백.
6. 같은 교환 요청 키 재시도 시 쿠폰·원장·잔액·재고를 한 번만 변경.
7. 서버 발급 바코드 코드 형식과 운영자 전용 1회 사용 처리.
8. KST 기준 하루 AI 요청 10회 허용, 11번째 차단.
9. 일반 회원의 참여 승인 차단 및 운영자 승인 시 한 번만 적립.
10. 보관된 활동·쿠폰의 기존 소유자 조회 유지와 다른 회원·익명 접근 차단.

**실행 결과: 10개 통과, 실패 0, 건너뜀 0.** 일반 회원은 쿠폰을 사용 완료로 바꿀 수 없고 신뢰된 운영자만 유효한 바코드를 한 번 사용할 수 있음을 포함한다. 테스트 중 발견된 활동·저장자료 RLS의 순환 참조를 소유자 여부만 반환하는 제한된 함수로 수정하고 재검증했다.

실제 Supabase Auth·PostgREST·운영 DB 역할 설정은 이 테스트에 포함하지 않는다. 한 WASM 엔진의 순차 실행이므로 동시 다중 연결·부하·분산 서버의 검증을 대신하지 않는다. 실제 개발 DB에 적용한 뒤 두 계정의 전체 웹 흐름, 동시 교환, 메일, AI 호출, 배포 서비스를 추가 검증해야 한다.

## 3. Prisma 생성기 다운로드 차단 시 임시 대안

현재 Prisma 7.10.1 CLI는 `prisma generate` 이전에 schema-engine 다운로드를 확인한다. 이 환경에서 `binaries.prisma.sh`가 정책상 403을 반환하면 정규 `npm run check`와 `npm run build`도 해당 단계에서 멈춘다. `--no-engine`은 설치된 버전의 명령에 없으며, 체크섬 검증을 끄거나 가짜 엔진 파일로 대체하지 않는다.

아래 대안은 같은 버전의 공식 npm 패키지에 포함된 WASM 파서와 Client 생성기만 사용한다. Prisma **내부 API**를 사용하는 명시적 임시 대안이므로 정식 CLI 지원과 장기 호환성을 보장하지 않는다. 일반 개발에서는 네트워크 정책을 적용한 뒤 원래의 설치·검사·빌드 명령을 우선한다.

```bash
npm install --prefix /tmp/gotgot-prisma --ignore-scripts --no-package-lock --no-audit --no-fund @prisma/internals@7.10.1 @prisma/client-generator-registry@7.10.1
cd /workspace/pep
PRISMA_GENERATOR_DEPS=/tmp/gotgot-prisma node scripts/generate-client-offline.mjs
```

`--ignore-scripts`는 불필요한 네이티브 엔진 자동 다운로드를 실행하지 않기 위한 것으로, 패키지 TLS·npm 무결성 검증을 비활성화하지 않는다. 헬퍼는 CLI와 생성기 패키지의 버전 일치를 확인하고 제공된 `skipDownload: true` 옵션을 사용한다. Client만 Git 제외 경로 `src/generated_prisma/`에 생성하며 DB 접속·스키마 변경·마이그레이션을 실행하지 않는다.

**실행 결과: 공식 npm 패키지의 API로 Prisma Client 생성 성공.** 정규 CLI 명령의 네트워크 차단이 해결됐다는 뜻은 아니다. 이후 직접 실행한 타입 검사·빌드 결과는 웹 구현 검증 기록과 구분해 확인한다.
