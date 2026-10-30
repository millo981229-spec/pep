import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const isConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
function config() {
  if (!isConfigured())
    throw new AppError(
      503,
      '로그인·저장 서비스를 준비 중입니다. Supabase 연결 설정이 필요합니다.',
    );
  let url: URL;
  try {
    url = new URL(process.env.SUPABASE_URL!);
  } catch {
    throw new AppError(503, '서비스 연결 설정을 확인해 주세요.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new AppError(503, '서비스 연결 설정을 확인해 주세요.');
  return { url: url.origin, key: process.env.SUPABASE_PUBLISHABLE_KEY! };
}

const databaseErrors: Record<string, { status: number; message: string }> = {
  authentication_required: { status: 401, message: '로그인 후 이용해 주세요.' },
  daily_limit_reached: {
    status: 429,
    message: '오늘의 AI 추천 10회를 모두 이용했어요. 내일 다시 이용해 주세요.',
  },
  offer_unavailable: {
    status: 409,
    message:
      '이 혜택은 소진되었거나 유효기간이 지났습니다. 다른 혜택을 선택해 주세요.',
  },
  coupon_unavailable: {
    status: 409,
    message: '이미 사용했거나 유효기간이 지난 쿠폰입니다.',
  },
  insufficient_balance: {
    status: 409,
    message: '마일리지가 부족합니다. 잔액을 확인해 주세요.',
  },
  idempotency_conflict: {
    status: 409,
    message: '교환 요청이 일치하지 않습니다. 곳곳드림에서 다시 시작해 주세요.',
  },
  participation_unavailable: {
    status: 409,
    message: '이미 처리되었거나 확인할 수 없는 참여 요청입니다.',
  },
  activity_unavailable: {
    status: 409,
    message: '현재 참여할 수 없는 활동입니다.',
  },
};
export async function supabase(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<unknown> {
  const { url, key } = config();
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set('apikey', key);
    headers.set('Content-Type', 'application/json');
    // New publishable keys (sb_publishable_...) are API keys, not JWTs.
    // Anonymous calls use only apikey; authenticated calls use the verified session JWT.
    if (token) headers.set('Authorization', `Bearer ${token}`);
    else headers.delete('Authorization');
    response = await fetch(`${url}${path}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      headers,
    });
  } catch {
    throw new AppError(
      504,
      '연결 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (!response.ok) {
    let problem: unknown;
    try {
      problem = await response.json();
    } catch {
      /* Never forward provider bodies or proxy errors. */
    }
    const parsed = z
      .object({
        code: z.union([z.string(), z.number()]).optional(),
        error_code: z.string().optional(),
        message: z.string().optional(),
      })
      .safeParse(problem);
    if (parsed.success && parsed.data.code === 'P0001') {
      const known = databaseErrors[parsed.data.message || ''];
      if (known) throw new AppError(known.status, known.message);
    }
    if (
      parsed.success &&
      ['PGRST202', 'PGRST205', '42P01', '42883'].includes(
        typeof parsed.data.code === 'string' ? parsed.data.code : '',
      )
    )
      throw new AppError(
        503,
        '서비스 데이터 설정이 완료되지 않았습니다. 운영자에게 문의해 주세요.',
      );
    if (path.startsWith('/auth/v1/') && parsed.success) {
      const authCode = parsed.data.error_code || parsed.data.code;
      if (authCode === 'email_not_confirmed')
        throw new AppError(403, '이메일 인증을 완료한 뒤 로그인해 주세요.');
      if (authCode === 'invalid_credentials')
        throw new AppError(400, '이메일 또는 비밀번호를 확인해 주세요.');
      if (
        typeof authCode === 'string' &&
        ['refresh_token_not_found', 'refresh_token_already_used'].includes(
          authCode,
        )
      )
        throw new AppError(
          401,
          '로그인이 만료되었습니다. 다시 로그인해 주세요.',
        );
    }
    if (response.status === 401)
      throw new AppError(
        401,
        '로그인이 만료되었거나 입력 정보가 올바르지 않습니다. 다시 로그인해 주세요.',
      );
    if (response.status === 429)
      throw new AppError(429, '요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    if (response.status >= 500)
      throw new AppError(
        503,
        '서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      );
    throw new AppError(
      response.status === 403 ? 403 : 400,
      '요청을 처리할 수 없습니다. 입력 정보·잔액·재고를 확인해 주세요.',
    );
  }
  return response.status === 204 ? null : response.json();
}
const userSchema = z.object({ id: z.uuid(), email: z.string().optional() });
export async function requireUser() {
  const jar = await cookies();
  const token = jar.get('gotgot-session')?.value;
  if (!token) throw new AppError(401, '로그인 후 이용해 주세요.');
  // Validate with the identity provider; never trust client-decoded token claims.
  const user = userSchema.parse(await supabase('/auth/v1/user', {}, token));
  return { user, token };
}
export async function persistSession(data: unknown) {
  const session = z
    .object({
      access_token: z.string().min(1),
      refresh_token: z.string().min(1),
      expires_in: z.number().positive().max(86400),
    })
    .parse(data);
  const jar = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  jar.set('gotgot-session', session.access_token, {
    ...options,
    maxAge: session.expires_in,
  });
  jar.set('gotgot-refresh', session.refresh_token, {
    ...options,
    maxAge: 60 * 60 * 24 * 7,
  });
}
export function assertOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    throw new AppError(403, '이 사이트에서 다시 시도해 주세요.');
}
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new AppError(415, 'JSON 형식으로 요청해 주세요.');
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, '입력 내용을 확인해 주세요.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8192) {
      await reader.cancel();
      throw new AppError(413, '입력 내용이 너무 깁니다.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new AppError(400, '입력 형식을 확인해 주세요.');
  }
}
export function failure(error: unknown) {
  const status =
    error instanceof AppError
      ? error.status
      : error instanceof z.ZodError
        ? 400
        : 500;
  const message =
    error instanceof AppError
      ? error.message
      : status === 400
        ? '입력값의 형식과 길이를 확인해 주세요.'
        : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  return Response.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
