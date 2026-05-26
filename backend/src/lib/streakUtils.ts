/**
 * Streak update logic for preparation consistency tracking.
 *
 * A "preparation day" is any day the user submits a test or accesses revision.
 * Called fire-and-forget after each such event.
 */

import User from '../models/User';

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Update currentStreak and longestStreak for a user. */
export async function updateStreak(userId: string): Promise<void> {
  const user = await User.findById(userId).select('currentStreak longestStreak lastActivityDate').lean();
  if (!user) return;

  const today     = toDateString(new Date());
  const yesterday = toDateString(new Date(Date.now() - 86_400_000));
  const last      = user.lastActivityDate ? toDateString(user.lastActivityDate) : null;

  if (last === today) return; // already recorded today — no change

  const newStreak =
    last === yesterday
      ? (user.currentStreak ?? 0) + 1
      : 1; // gap or first ever

  const newLongest = Math.max(user.longestStreak ?? 0, newStreak);

  await User.findByIdAndUpdate(userId, {
    $set: {
      currentStreak:   newStreak,
      longestStreak:   newLongest,
      lastActivityDate: new Date(),
    },
  });
}
