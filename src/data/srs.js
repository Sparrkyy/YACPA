// SM-2 spaced repetition algorithm
// quality: 5=Too easy, 4=Got it, 3=Barely, 1=I see it now (failed)

export function computeNextSrs(srsState, quality) {
  const ef0 = srsState?.easeFactor ?? 2.5;
  const rep0 = srsState?.repetitions ?? 0;
  const int0 = srsState?.interval ?? 0;

  let repetitions, interval;
  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions = rep0 + 1;
    if (rep0 === 0) interval = 1;
    else if (rep0 === 1) interval = 6;
    else interval = Math.round(int0 * ef0);
  }

  const easeFactor = Math.max(1.3, ef0 + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const nextReview = new Date(Date.now() + interval * 86_400_000).toISOString().slice(0, 10);

  return { easeFactor, interval, repetitions, nextReview };
}
