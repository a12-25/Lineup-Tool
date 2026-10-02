export class LoadNormalizationEngine {
  normalizeShares(rawShares) {
    const entries = Object.entries(rawShares);
    const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);

    if (total <= 0) {
      return Object.fromEntries(entries.map(([key]) => [key, 0]));
    }

    return Object.fromEntries(
      entries.map(([key, value]) => [key, Number((value / total) * 100)])
    );
  }

  normalizeContextualShares(rawShares, minMultiplier = 1.06, maxMultiplier = 1.6) {
    const entries = Object.entries(rawShares);
    const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);

    if (total <= 0) {
      return Object.fromEntries(entries.map(([key]) => [key, 0]));
    }

    return Object.fromEntries(
      entries.map(([key, value]) => {
        const scaled = Number(value || 0) * ((minMultiplier + maxMultiplier) / 2);
        const share = (scaled / total) * 100;
        return [key, Number(share)];
      })
    );
  }
}
