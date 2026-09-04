// Run with: npx tsx src/components/EnumeratorPerformance/utils/dataUtils.test.ts
//
// These are the derivations behind every figure on the enumerator dashboard. They were previously
// spread across a useEffect, three useMemos, the render body and five chart modules, so none of
// them could be checked without rendering. Nothing here touches React, i18n or Highcharts.

import assert from 'node:assert/strict';
import { EnumeratorDailyStat } from '../types';
import {
  processEnumeratorData,
  applyDateRange,
  dateBounds,
  uniqueDates,
  summarise,
  byVolume,
  byQuality,
  displayTotal,
  displayAlerts,
  displayErrorRate,
  shareOfAverage,
  qualityScore,
  findBestEnumerator,
  toTrend,
  tallyAlertFlags
} from './dataUtils';

const stat = (submitted_by: string, date: string | null, count: number, alert_flag?: string) =>
  ({ submitted_by, date, count, alert_flag } as unknown as EnumeratorDailyStat);

// ana: 10 on 01-01 (2 alerted), 5 on 01-10. bo: 4 on 01-05, all alerted.
const ROLLUP = [
  stat('ana', '2026-01-01', 8),
  stat('ana', '2026-01-01', 2, '3'),
  stat('ana', '2026-01-10', 5),
  stat('bo', '2026-01-05', 4, '7'),
  stat('', '2026-01-05', 99),          // no enumerator — dropped
  stat('ana', null, 3)                 // unparseable date — counts, but has no day
];

const processed = processEnumeratorData(ROLLUP);

// ---- grouping ----
assert.deepEqual(processed.map(e => e.name), ['ana', 'bo'], 'busiest first, blank names dropped');
assert.equal(processed[0].totalSubmissions, 18, 'the undated row still counts toward the total');
assert.equal(processed[0].submissionsWithAlerts, 2);
assert.equal(processed[1].errorRate, 100);

// A row with no day is excluded from the trend but not from the totals.
assert.deepEqual(toTrend(processed[0].dailyStats), [
  { date: '2026-01-01', count: 10 },
  { date: '2026-01-10', count: 5 }
]);

// ---- bounds ----
assert.deepEqual(dateBounds(processed), { min: '2026-01-01', max: '2026-01-10' });
assert.deepEqual(dateBounds([]), { min: null, max: null }, 'empty rollup does not invent a date');

// ---- date filtering ----
{
  const inRange = applyDateRange(processed, '2026-01-01', '2026-01-05');
  const ana = inRange.find(e => e.name === 'ana')!;
  assert.equal(ana.filteredTotal, 10, 'the 01-10 rows and the undated row fall outside');
  assert.equal(ana.filteredErrorRate, 20);
  assert.deepEqual(uniqueDates(inRange), ['2026-01-01', '2026-01-05'], 'ascending, deduplicated');

  // Everyone is kept, including those with nothing in range — dropping them here would
  // silently change who appears in the charts.
  const narrow = applyDateRange(processed, '2026-01-10', '2026-01-10');
  assert.equal(narrow.length, 2);
  assert.equal(narrow.find(e => e.name === 'bo')!.filteredTotal, 0);
}

// ---- THE REGRESSION THIS CANDIDATE EXISTS FOR ----
// An enumerator with nothing in the selected range must read 0, not their all-time total.
// Eight sites used `||`, which treats a filtered total of 0 as "no value" and falls back.
{
  const narrow = applyDateRange(processed, '2026-01-10', '2026-01-10');
  const bo = narrow.find(e => e.name === 'bo')!;
  assert.equal(bo.totalSubmissions, 4, 'bo has 4 all-time');
  assert.equal(displayTotal(bo), 0, 'but 0 in range — NOT 4');
  assert.equal(displayAlerts(bo), 0, 'same rule for alerts');
  assert.equal(displayErrorRate(bo), 0);

  // …and they must not be counted into, or ranked among, the visible figures.
  assert.equal(summarise(narrow).totalSubmissions, 5, 'only ana\'s 01-10 rows');
  assert.deepEqual(byVolume(narrow).map(e => e.name), ['ana'], 'zero-volume enumerators drop out');
  assert.deepEqual(byQuality(narrow).map(e => e.name), ['ana']);
}

// Unfiltered data still falls back to the all-time figures.
assert.equal(displayTotal(processed[1]), 4, 'no filter applied → all-time total');

// ---- summary ----
{
  const all = applyDateRange(processed, '', '');
  const s = summarise(all);
  assert.equal(s.totalSubmissions, 19, 'ana 15 dated + bo 4; the undated row has no day to match');
  assert.equal(s.totalAlerts, 6);
  assert.equal(Math.round(s.avgErrorRate), 32);
  assert.deepEqual(summarise([]), { totalSubmissions: 0, totalAlerts: 0, avgErrorRate: 0 },
    'no divide-by-zero on an empty dashboard');
}

// ---- ranking ----
{
  const all = applyDateRange(processed, '', '');
  assert.deepEqual(byVolume(all).map(e => e.name), ['ana', 'bo'], 'busiest first');
  assert.deepEqual(byQuality(all).map(e => e.name), ['ana', 'bo'], 'lowest error rate first');

  // Ties on quality break on volume, the same way findBestEnumerator does.
  const tie = [
    { name: 'few', errorRate: 0, filteredTotal: 3, totalSubmissions: 3, dailyStats: [], submissionsWithAlerts: 0, submissionTrend: [] },
    { name: 'many', errorRate: 0, filteredTotal: 30, totalSubmissions: 30, dailyStats: [], submissionsWithAlerts: 0, submissionTrend: [] }
  ];
  assert.deepEqual(byQuality(tie).map(e => e.name), ['many', 'few'], 'equal quality → higher volume wins');
}

// ---- quality score + best enumerator ----
assert.equal(qualityScore({ errorRate: 25, filteredErrorRate: undefined }), 75);
assert.equal(qualityScore(undefined), 100, 'no enumerator degrades rather than throwing');

{
  assert.equal(findBestEnumerator([]).name, '', 'empty input returns the zeroed placeholder');

  const all = applyDateRange(processed, '', '');
  // Nobody has 10+ submissions except ana (15); ana also has the better rate.
  assert.equal(findBestEnumerator(all).name, 'ana');

  // When nobody clears the bar, the threshold halves rather than the answer being arbitrary.
  const small = [
    { name: 'sloppy', errorRate: 90, filteredTotal: 6, totalSubmissions: 6, dailyStats: [], submissionsWithAlerts: 5, submissionTrend: [] },
    { name: 'careful', errorRate: 10, filteredTotal: 6, totalSubmissions: 6, dailyStats: [], submissionsWithAlerts: 1, submissionTrend: [] }
  ];
  assert.equal(findBestEnumerator(small, 10).name, 'careful', 'halved threshold (5) admits both');

  // Below even the halved threshold, volume decides.
  const tiny = [
    { name: 'one', errorRate: 0, filteredTotal: 1, totalSubmissions: 1, dailyStats: [], submissionsWithAlerts: 0, submissionTrend: [] },
    { name: 'two', errorRate: 50, filteredTotal: 2, totalSubmissions: 2, dailyStats: [], submissionsWithAlerts: 1, submissionTrend: [] }
  ];
  assert.equal(findBestEnumerator(tiny, 10).name, 'two', 'nobody qualifies → most submissions');
}

// ---- share of average ----
{
  const all = applyDateRange(processed, '', '');
  // ana 15, bo 4 → mean 9.5; ana is 158% of it.
  assert.equal(shareOfAverage(all[0], all), 158);
  assert.equal(shareOfAverage(all[0], []), 0, 'no divide-by-zero with nobody to average');
}

// ---- alert tally ----
{
  const all = applyDateRange(processed, '', '');
  assert.deepEqual(tallyAlertFlags(all), [{ name: '7', y: 4 }, { name: '3', y: 2 }],
    'most frequent first, unflagged rows ignored');
}

console.log('dataUtils: all assertions passed');
