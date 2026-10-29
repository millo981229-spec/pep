import { z } from 'zod';
import { activityCategories, regions } from '@/lib/catalog';
import {
  AppError,
  assertOrigin,
  body,
  failure,
  requireUser,
  supabase,
} from '@/lib/platform';

export async function GET() {
  try {
    const { user, token } = await requireUser();
    const [profile, saved, coupons, ledger, participations] = await Promise.all(
      [
        supabase(
          `/rest/v1/profiles?id=eq.${user.id}&select=display_name,balance,interests,gender&limit=1`,
          {},
          token,
        ),
        supabase(
          `/rest/v1/saved_activities?user_id=eq.${user.id}&select=id,activity_id,note,activities(id,title,region,city,category,description,duration,price,reward,image,date,is_demo,tags)&order=created_at.desc&limit=50`,
          {},
          token,
        ),
        supabase(
          `/rest/v1/redemptions?user_id=eq.${user.id}&select=id,cost,created_at,expires_at,status,redeem_code,offers(title,merchant)&order=created_at.desc&limit=50`,
          {},
          token,
        ),
        supabase(
          `/rest/v1/point_ledger?user_id=eq.${user.id}&select=id,amount,description,created_at&order=created_at.desc&limit=50`,
          {},
          token,
        ),
        supabase(
          `/rest/v1/participations?user_id=eq.${user.id}&select=id,activity_id,region,note,status,created_at,activities(id,title,region,city,category,description,duration,price,reward,image,date,is_demo,tags)&order=created_at.desc&limit=50`,
          {},
          token,
        ),
      ],
    );
    return Response.json(
      { profile, saved, coupons, ledger, participations },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}
const uuid = z.uuid();
const inputSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('save'),
      activityId: uuid,
      note: z.string().trim().max(300).default(''),
    })
    .strict(),
  z
    .object({
      action: z.literal('note'),
      id: uuid,
      note: z.string().trim().max(300),
    })
    .strict(),
  z.object({ action: z.literal('remove'), id: uuid }).strict(),
  z
    .object({ action: z.literal('exchange'), offerId: uuid, requestId: uuid })
    .strict(),
  z
    .object({
      action: z.literal('profile'),
      displayName: z.string().trim().min(1).max(30),
      interests: z.array(z.enum(activityCategories)).max(8),
      gender: z.enum(['unspecified', 'woman', 'man', 'other']),
    })
    .strict(),
  z
    .object({
      action: z.literal('participate'),
      activityId: uuid,
      region: z.enum(regions.map((r) => r.id) as [string, ...string[]]),
      note: z.string().trim().min(10).max(500),
    })
    .strict(),
]);
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { user, token } = await requireUser();
    const input = inputSchema.parse(await body(request));
    if (input.action === 'exchange') {
      const result = await supabase(
        '/rest/v1/rpc/exchange_offer',
        {
          method: 'POST',
          body: JSON.stringify({
            p_offer_id: input.offerId,
            p_request_id: input.requestId,
          }),
        },
        token,
      );
      return Response.json({
        message: '교환을 완료했습니다. 내 쿠폰함에서 확인해 주세요.',
        result,
      });
    }
    if (input.action === 'profile')
      await supabase(
        `/rest/v1/profiles?id=eq.${user.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            display_name: input.displayName,
            interests: input.interests,
            gender: input.gender,
          }),
        },
        token,
      );
    if (input.action === 'save')
      await supabase(
        '/rest/v1/saved_activities?on_conflict=user_id,activity_id',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify({
            user_id: user.id,
            activity_id: input.activityId,
            note: input.note,
          }),
        },
        token,
      );
    if (input.action === 'note' || input.action === 'remove') {
      const changed = z.array(z.object({ id: z.uuid() })).parse(
        await supabase(
          `/rest/v1/saved_activities?id=eq.${input.id}&user_id=eq.${user.id}&select=id`,
          {
            method: input.action === 'remove' ? 'DELETE' : 'PATCH',
            ...(input.action === 'note'
              ? { body: JSON.stringify({ note: input.note }) }
              : {}),
            headers: { Prefer: 'return=representation' },
          },
          token,
        ),
      );
      if (!changed.length)
        throw new AppError(
          404,
          '저장한 활동을 찾을 수 없습니다. 목록을 다시 불러와 주세요.',
        );
    }
    if (input.action === 'participate')
      await supabase(
        '/rest/v1/participations?on_conflict=user_id,activity_id',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify({
            user_id: user.id,
            activity_id: input.activityId,
            region: input.region,
            note: input.note,
          }),
        },
        token,
      );
    return Response.json({
      message:
        input.action === 'participate'
          ? '참여 확인을 요청했습니다. 운영자 확인 전에는 마일리지가 적립되지 않습니다.'
          : '저장했습니다.',
    });
  } catch (error) {
    return failure(error);
  }
}
