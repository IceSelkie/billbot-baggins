export function bitsHot(i: number): number {
  let ret: number = 0;
  while (i) {
    ret += i % 2;
    i >>>= 1; // valid for 32 bits only
  }
  return ret;
}

export function oneHot(i: number): number {
  return 1 << i; // valid for 31 bits only
}

export function highestHot(i: number): number {
  let ret = 0;
  while (i) {
    i >>>= 1;
    ret++;
  }
  return ret;
}

export function lowestHot(i: number): number {
  if (!i) return -1;
  let ret = 0;
  while (i && i % 2 == 0) {
    i >>>= 1;
    ret++;
  }
  return ret;
}
