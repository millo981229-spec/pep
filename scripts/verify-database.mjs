import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = process.env.PLATFORM_TEST_DEPS
  ? createRequire(resolve(process.env.PLATFORM_TEST_DEPS, 'package.json'))
  : createRequire(import.meta.url);
// Optional test-only PostgreSQL WASM runtime, not a production dependency.
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const activity = '33333333-3333-4333-8333-333333333333';
const offer = '44444444-4444-4444-8444-444444444444';
const key = '55555555-5555-4555-8555-555555555555';
const secondKey = '66666666-6666-4666-8666-666666666666';
after(async () => db.close());

test('migration applies to an isolated PostgreSQL database', async () => {
  // Minimal Supabase Auth contracts. This does not simulate the Auth HTTP service.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  await db.exec(
    readFileSync(
      resolve(projectRoot, 'supabase/migrations/202610290001_platform.sql'),
      'utf8',
    ),
  );
});

test('new Auth users receive profiles with zero balances', async () => {
  await db.query('insert into auth.users(id) values($1),($2)', [a, b]);
  const profiles = (await db.query('select id,balance from public.profiles'))
    .rows;
  assert.equal(profiles.length, 2);
  assert.ok(profiles.every((profile) => profile.balance === 0));
  await db.query(
    `insert into public.activities(id,title,region,city,category,description,duration,price,date,reward,active,is_demo)
    values($1,'검증 활동','jeonnam','순천시','자연·생태','독립 테스트','1시간',0,'미정',100,true,false)`,
    [activity],
  );
  await db.query(
    `insert into public.offers(id,title,merchant,region,description,cost,stock,is_demo,active,expires_at)
    values($1,'검증 쿠폰','검증 업체','전남','독립 테스트',60,2,false,true,now()+interval '1 day')`,
    [offer],
  );
});

test('members see only their profile and cannot write financial balance', async () => {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`,
  );
  const profiles = (await db.query('select * from public.profiles')).rows;
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].id, a);
  await assert.rejects(
    db.query('update public.profiles set balance=1000 where id=$1', [a]),
    /permission denied/,
  );
});

test('another account cannot create, read, update, or delete owner data', async () => {
  await db.query(
    'insert into public.saved_activities(user_id,activity_id,note) values($1,$2,$3)',
    [a, activity, '내 자료'],
  );
  await assert.rejects(
    db.query(
      'insert into public.saved_activities(user_id,activity_id,note) values($1,$2,$3)',
      [b, activity, '타인 자료'],
    ),
    /row-level security/,
  );
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
  assert.equal(
    (await db.query('select * from public.saved_activities')).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        'update public.saved_activities set note=$1 where user_id=$2 returning id',
        ['도용', a],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        'delete from public.saved_activities where user_id=$1 returning id',
        [a],
      )
    ).rows.length,
    0,
  );
});

test('insufficient balance rolls back both stock and coupon creation', async () => {
  await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);
  await assert.rejects(
    db.query('select public.exchange_offer($1,$2)', [offer, key]),
    /insufficient_balance/,
  );
  await db.exec('reset role');
  assert.equal(
    (await db.query('select stock from public.offers where id=$1', [offer]))
      .rows[0].stock,
    2,
  );
  assert.equal(
    (await db.query('select count(*)::int as n from public.redemptions'))
      .rows[0].n,
    0,
  );
});

test('retrying one exchange key issues exactly one coupon and one ledger entry', async () => {
  await db.query('update public.profiles set balance=100 where id=$1', [a]);
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`,
  );
  const first = (
    await db.query('select public.exchange_offer($1,$2) as id', [offer, key])
  ).rows[0].id;
  const retry = (
    await db.query('select public.exchange_offer($1,$2) as id', [offer, key])
  ).rows[0].id;
  assert.equal(first, retry);
  const issuedCoupon = (
    await db.query('select redeem_code from public.redemptions where id=$1', [
      first,
    ])
  ).rows[0];
  assert.match(issuedCoupon.redeem_code, /^GGT-[A-F0-9]{32}$/);
  await db.exec('reset role');
  assert.equal(
    (await db.query('select balance from public.profiles where id=$1', [a]))
      .rows[0].balance,
    40,
  );
  assert.equal(
    (await db.query('select stock from public.offers where id=$1', [offer]))
      .rows[0].stock,
    1,
  );
  assert.equal(
    (await db.query('select count(*)::int as n from public.redemptions'))
      .rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        'select count(*)::int as n, sum(amount)::int as amount from public.point_ledger',
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        'select sum(amount)::int as amount from public.point_ledger',
      )
    ).rows[0].amount,
    -60,
  );
});

test('a coupon owner can confirm only their own valid coupon once', async () => {
  const redemption = (await db.query('select id from public.redemptions'))
    .rows[0];
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${b}',false);`,
  );
  await assert.rejects(
    db.query('select public.consume_own_coupon($1)', [redemption.id]),
    /coupon_unavailable/,
  );
  await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);
  const used = (
    await db.query('select public.consume_own_coupon($1) as id', [
      redemption.id,
    ])
  ).rows[0].id;
  assert.equal(used, redemption.id);
  await assert.rejects(
    db.query('select public.consume_own_coupon($1)', [redemption.id]),
    /coupon_unavailable/,
  );
  await db.exec('reset role');
});

test('only a trusted operator can consume a scanned barcode once', async () => {
  await db.query('update public.profiles set balance=100 where id=$1', [b]);
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${b}',false);`,
  );
  const redemption = (
    await db.query('select public.exchange_offer($1,$2) as id', [
      offer,
      secondKey,
    ])
  ).rows[0].id;
  const code = (
    await db.query('select redeem_code from public.redemptions where id=$1', [
      redemption,
    ])
  ).rows[0].redeem_code;
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
  await assert.rejects(
    db.query('select public.use_coupon($1)', [code]),
    /permission denied/,
  );
  await db.exec('reset role');
  const used = (await db.query('select public.use_coupon($1) as id', [code]))
    .rows[0].id;
  assert.ok(used);
  await assert.rejects(
    db.query('select public.use_coupon($1)', [code]),
    /coupon_unavailable/,
  );
  assert.equal(
    (
      await db.query('select status from public.redemptions where id=$1', [
        used,
      ])
    ).rows[0].status,
    'used',
  );
});

test('database quota admits ten AI requests and rejects the eleventh', async () => {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`,
  );
  for (let i = 0; i < 10; i++)
    await db.query('select public.reserve_ai_request()');
  await assert.rejects(
    db.query('select public.reserve_ai_request()'),
    /daily_limit_reached/,
  );
  await db.exec('reset role');
  assert.equal(
    (await db.query('select count from public.ai_usage where user_id=$1', [a]))
      .rows[0].count,
    10,
  );
});

test('only an operator approves participation and approval rewards once', async () => {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`,
  );
  await db.query(
    'insert into public.participations(user_id,activity_id,region,note) values($1,$2,$3,$4)',
    [a, activity, 'jeonnam', '지역 활동 참여 확인을 요청합니다.'],
  );
  const id = (await db.query('select id from public.participations')).rows[0]
    .id;
  await assert.rejects(
    db.query('select public.approve_participation($1)', [id]),
    /permission denied/,
  );
  await assert.rejects(
    db.query("update public.participations set status='approved'"),
    /permission denied/,
  );
  await db.exec('reset role');
  await db.query('select public.approve_participation($1)', [id]);
  await assert.rejects(
    db.query('select public.approve_participation($1)', [id]),
    /participation_unavailable/,
  );
  assert.equal(
    (await db.query('select balance from public.profiles where id=$1', [a]))
      .rows[0].balance,
    140,
  );
});

test('archived history remains owner-only and anonymous members cannot access private data', async () => {
  await db.query('update public.activities set active=false where id=$1', [
    activity,
  ]);
  await db.query('update public.offers set active=false where id=$1', [offer]);
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`,
  );
  assert.equal(
    (await db.query('select * from public.activities')).rows.length,
    1,
  );
  assert.equal((await db.query('select * from public.offers')).rows.length, 1);
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
  assert.equal(
    (await db.query('select * from public.activities')).rows.length,
    0,
  );
  // Account b also exchanged this offer above, so its own archived coupon title
  // remains readable while unrelated activities stay hidden.
  assert.equal((await db.query('select * from public.offers')).rows.length, 1);
  await db.exec('reset role; set role anon');
  assert.equal(
    (await db.query('select * from public.activities')).rows.length,
    0,
  );
  await assert.rejects(
    db.query('select * from public.profiles'),
    /permission denied/,
  );
  await assert.rejects(
    db.query('select public.exchange_offer($1,$2)', [offer, key]),
    /permission denied/,
  );
});
