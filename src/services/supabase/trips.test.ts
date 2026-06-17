import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getUserTrips, joinTripByCode, normalizeInviteCode } from './trips';
import { supabase } from './client';

vi.mock('./client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function createBuilder(result: unknown) {
  type Builder = Record<'select' | 'eq' | 'is' | 'in' | 'or' | 'order' | 'single' | 'maybeSingle' | 'insert', ReturnType<typeof vi.fn>>;
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.or = vi.fn(() => builder);
  builder.order = vi.fn(() => result);
  builder.single = vi.fn(() => result);
  builder.maybeSingle = vi.fn(() => result);
  builder.insert = vi.fn(() => result);
  return builder;
}

describe('trips service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes invite codes to match generated uppercase codes', () => {
    expect(normalizeInviteCode(' abcd2345 ')).toBe('ABCD2345');
  });

  it('filters user trips by creator or active membership', async () => {
    const membershipsBuilder = createBuilder({ data: [{ trip_id: 'trip-1' }], error: null });
    const tripsBuilder = createBuilder({ data: [], error: null });
    membershipsBuilder.is.mockReturnValueOnce({ data: [{ trip_id: 'trip-1' }], error: null });
    vi.mocked(supabase.from)
      .mockReturnValueOnce(membershipsBuilder as never)
      .mockReturnValueOnce(tripsBuilder as never);

    await getUserTrips('user-1');

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'trip_participants');
    expect(membershipsBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(membershipsBuilder.is).toHaveBeenCalledWith('left_at', null);
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'trips');
    expect(tripsBuilder.or).toHaveBeenCalledWith('creator_id.eq.user-1,id.in.(trip-1)');
  });

  it('uses normalized invite code when joining a trip', async () => {
    const trip = { id: 'trip-1', max_participants: 10 };
    const findTripBuilder = createBuilder({ data: trip, error: null });
    const existingBuilder = createBuilder({ data: null, error: null });
    const countBuilder = createBuilder({ count: 0, error: null });
    const insertBuilder = createBuilder({ error: null });
    countBuilder.eq.mockReturnValueOnce({ count: 0, error: null });
    vi.mocked(supabase.from)
      .mockReturnValueOnce(findTripBuilder as never)
      .mockReturnValueOnce(existingBuilder as never)
      .mockReturnValueOnce(countBuilder as never)
      .mockReturnValueOnce(insertBuilder as never);

    await joinTripByCode(' abcd2345 ', 'user-1');

    expect(findTripBuilder.eq).toHaveBeenCalledWith('invite_code', 'ABCD2345');
  });
});
