// Funksione statistikore të pastra: numra brenda, numra jashtë.
// Asnjë prekje e DOM-it këtu, që të mund t'i thërras nga Console.

// Mban vetëm numrat e vërtetë. Një ditë pa vlerë NUK bëhet zero — thjesht nuk numërohet.
export function clean(values) {
  return values.filter(value => typeof value === 'number' && Number.isFinite(value));
}

export function mean(numbers) {
  const values = clean(numbers);
  if (values.length === 0) return null;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

export function std(numbers) {
  const values = clean(numbers);
  if (values.length === 0) return null;
  const average = mean(values);
  let sumOfSquares = 0;
  for (const value of values) sumOfSquares += (value - average) * (value - average);
  // Pjesëtoj me n, jo me n-1: kjo është shpërndarja e vetë këtyre ditëve, jo mostër e një popullate.
  return Math.sqrt(sumOfSquares / values.length);
}

export function movingAvg(numbers, windowSize) {
  const result = [];
  for (let index = 0; index < numbers.length; index++) {
    // Para se dritarja të mbushet nuk ka mesatare të vërtetë, prandaj null dhe nuk vizatohet.
    if (index < windowSize - 1) {
      result.push(null);
      continue;
    }
    result.push(mean(numbers.slice(index - windowSize + 1, index + 1)));
  }
  return result;
}

export function pctChange(from, to) {
  // Pa bazë ose me bazë zero nuk ka përqindje kuptimplote.
  if (from === null || to === null || from === 0) return null;
  return (to - from) / from * 100;
}

export function zScore(value, average, deviation) {
  // Nëse të gjitha ditët kanë të njëjtin numër, devijimi është 0 dhe z nuk ka kuptim.
  if (value === null || average === null || !deviation) return 0;
  return (value - average) / deviation;
}

export function corr(first, second) {
  const pairs = [];
  for (let index = 0; index < Math.min(first.length, second.length); index++) {
    const a = first[index];
    const b = second[index];
    if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b]);
  }
  if (pairs.length < 3) return null;
  const meanFirst = mean(pairs.map(pair => pair[0]));
  const meanSecond = mean(pairs.map(pair => pair[1]));
  let sumProducts = 0;
  let sumFirstSquares = 0;
  let sumSecondSquares = 0;
  for (const [a, b] of pairs) {
    const deltaFirst = a - meanFirst;
    const deltaSecond = b - meanSecond;
    sumProducts += deltaFirst * deltaSecond;
    sumFirstSquares += deltaFirst * deltaFirst;
    sumSecondSquares += deltaSecond * deltaSecond;
  }
  const denominator = Math.sqrt(sumFirstSquares * sumSecondSquares);
  if (denominator === 0) return null;
  return sumProducts / denominator;
}

// Vlerat në shkallën 0–1, që metrika me njësi të ndryshme të vizatohen bashkë.
export function normalize(values) {
  const real = clean(values);
  if (real.length === 0) return values.map(() => null);
  const low = Math.min(...real);
  const high = Math.max(...real);
  if (high === low) return values.map(value => (Number.isFinite(value) ? 0.5 : null));
  return values.map(value => (Number.isFinite(value) ? (value - low) / (high - low) : null));
}

// Krahason gjysmën e parë me gjysmën e dytë. Nën 3% e quaj të qëndrueshme.
export function trendDirection(values, flatBand = 3) {
  const real = clean(values);
  if (real.length < 4) return 'flat';
  const half = Math.floor(real.length / 2);
  const change = pctChange(mean(real.slice(0, half)), mean(real.slice(half)));
  if (change === null || Math.abs(change) < flatBand) return 'flat';
  return change > 0 ? 'up' : 'down';
}

export function round(value, decimals = 1) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}
