import { z } from 'zod';
import { connection } from 'next/server';
import {
  previewOffers,
  offerCategories,
  categories,
  activityCategories,
  regions,
  type Activity,
} from '@/lib/catalog';
import { subregions } from '@/lib/locations';
import { catalogPageSize, filterActivities } from '@/lib/catalog-filter';
import { regionalActivities } from '@/lib/regional-catalog';
import { failure, isConfigured, supabase } from '@/lib/platform';

const activity = z.object({
  id: z.uuid(),
  title: z.string(),
  region: z.string(),
  city: z.string(),
  category: z.enum(activityCategories),
  description: z.string(),
  duration: z.string(),
  price: z.number(),
  reward: z.number().int().min(0).max(100000).optional().default(0),
  image: z.string(),
  date: z.string(),
  is_demo: z.boolean(),
  tags: z.array(z.string()),
});
const offer = z.object({
  id: z.uuid(),
  title: z.string(),
  merchant: z.string(),
  region: z.string(),
  category: z.enum(offerCategories).optional().default('지역상생'),
  cost: z.number(),
  stock: z.number(),
  description: z.string(),
  terms: z
    .string()
    .optional()
    .default('교환 전 사용처와 이용 조건을 확인해 주세요.'),
  is_demo: z.boolean(),
});
const fields =
  'id,title,region,city,category,description,duration,price,reward,image,date,is_demo,tags';
const querySchema = z
  .object({
    region: z
      .string()
      .refine(
        (value) =>
          value === 'all' || regions.some((region) => region.id === value),
      )
      .default('all'),
    district: z.string().max(30).default('all'),
    category: z.enum(categories).default('전체'),
    query: z.string().trim().max(100).default(''),
    page: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .refine(
    (value) =>
      value.district === 'all' ||
      subregions[value.region]?.includes(value.district),
  );

export async function GET(request: Request) {
  await connection();
  try {
    const params = new URL(request.url).searchParams;
    const requestedActivity = params.get('activityId');
    const configured = isConfigured();
    if (requestedActivity) {
      const local = regionalActivities.find(
        (item) => item.id === requestedActivity,
      );
      if (local)
        return Response.json({
          activities: [local],
          offers: [],
          preview: !configured,
          hasMore: false,
        });
      const id = z.uuid().parse(requestedActivity);
      const result = configured
        ? await supabase(
            `/rest/v1/activities?select=${fields}&active=eq.true&id=eq.${id}&limit=1`,
          )
        : [];
      return Response.json({
        activities: z.array(activity).parse(result),
        offers: [],
        preview: !configured,
        hasMore: false,
      });
    }
    const filters = querySchema.parse(Object.fromEntries(params));
    const local = filterActivities(regionalActivities, filters);
    const offset = filters.page * catalogPageSize;
    const localPage = local.slice(offset, offset + catalogPageSize + 1);
    const databaseParams = new URLSearchParams({
      select: fields,
      active: 'eq.true',
      order: 'id',
      limit: String(catalogPageSize + 1 - localPage.length),
      offset: String(Math.max(0, offset - local.length)),
    });
    if (filters.region !== 'all')
      databaseParams.set('region', `eq.${filters.region}`);
    if (filters.district !== 'all')
      databaseParams.set('city', `like.*${filters.district}*`);
    if (filters.category !== '전체')
      databaseParams.set('category', `eq.${filters.category}`);
    if (filters.query) {
      // Quote PostgREST values; escape LIKE wildcards and quoted-value delimiters.
      const value = filters.query
        .replaceAll('\\', '\\\\')
        .replace(/[%_*]/g, '\\$&')
        .replaceAll('"', '\\"');
      const pattern = `"*${value}*"`;
      databaseParams.set(
        'or',
        `(title.ilike.${pattern},city.ilike.${pattern},category.ilike.${pattern})`,
      );
    }
    const [live, offers] = await Promise.all([
      configured && localPage.length <= catalogPageSize
        ? supabase(`/rest/v1/activities?${databaseParams}`)
        : Promise.resolve([]),
      configured
        ? supabase(
            '/rest/v1/offers?select=id,title,merchant,region,category,cost,stock,description,terms,is_demo&active=eq.true&order=cost&limit=24',
          )
        : Promise.resolve(previewOffers),
    ]);
    const combined: Activity[] = [
      ...localPage,
      ...z.array(activity).parse(live),
    ];
    return Response.json({
      activities: combined.slice(0, catalogPageSize),
      offers: configured ? z.array(offer).parse(offers) : offers,
      hasMore: combined.length > catalogPageSize,
      preview: !configured,
    });
  } catch (error) {
    return failure(error);
  }
}
