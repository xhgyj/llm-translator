const INITIAL_STATE = new Uint32Array([
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
]);

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
  0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
  0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
  0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

const HEX = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, "0"));

export function sha256Hex(value: string): string {
  const data = new TextEncoder().encode(value);
  const blockCount = Math.ceil((data.length + 9) / 64);
  const blocks = new Uint8Array(blockCount * 64);
  blocks.set(data);
  blocks[data.length] = 0x80;

  const bitLength = BigInt(data.length) * 8n;
  const lengthOffset = blocks.length - 8;
  for (let index = 0; index < 8; index += 1) {
    blocks[lengthOffset + index] = Number((bitLength >> BigInt((7 - index) * 8)) & 0xffn);
  }

  const state = INITIAL_STATE.slice();
  const w = new Uint32Array(64);

  for (let offset = 0; offset < blocks.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const base = offset + i * 4;
      w[i] =
        (blocks[base] << 24) |
        (blocks[base + 1] << 16) |
        (blocks[base + 2] << 8) |
        blocks[base + 3];
    }

    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = add32(w[i - 16], s0, w[i - 7], s1);
    }

    let a = state[0];
    let b = state[1];
    let c = state[2];
    let d = state[3];
    let e = state[4];
    let f = state[5];
    let g = state[6];
    let h = state[7];

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = add32(h, s1, ch, K[i], w[i]);
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = add32(s0, maj);

      h = g;
      g = f;
      f = e;
      e = add32(d, temp1);
      d = c;
      c = b;
      b = a;
      a = add32(temp1, temp2);
    }

    state[0] = add32(state[0], a);
    state[1] = add32(state[1], b);
    state[2] = add32(state[2], c);
    state[3] = add32(state[3], d);
    state[4] = add32(state[4], e);
    state[5] = add32(state[5], f);
    state[6] = add32(state[6], g);
    state[7] = add32(state[7], h);
  }

  return Array.from(state)
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
}

function add32(...values: number[]): number {
  let result = 0;
  for (const value of values) {
    result = (result + value) >>> 0;
  }
  return result;
}

function rotr(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}
