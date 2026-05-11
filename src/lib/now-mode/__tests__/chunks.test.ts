import { generateChunks, anyChunkFits } from "../chunks";

describe("generateChunks", () => {
  test("estimate <= chunkMax → single chunk equal to estimate", () => {
    expect(generateChunks(30)).toEqual([30]);
    expect(generateChunks(60)).toEqual([60]);
  });

  test("estimate divisible by chunkMax → N full chunks", () => {
    expect(generateChunks(120)).toEqual([60, 60]);
    expect(generateChunks(180)).toEqual([60, 60, 60]);
  });

  test("remainder >= chunkMin → full chunks + remainder", () => {
    expect(generateChunks(90)).toEqual([60, 30]);
    expect(generateChunks(75)).toEqual([60, 15]);
  });

  test("remainder < chunkMin → redistribute last two", () => {
    expect(generateChunks(70)).toEqual([35, 35]);
    expect(generateChunks(130)).toEqual([60, 35, 35]);
  });

  test("estimate < chunkMin (edge) → single chunk equal to estimate", () => {
    expect(generateChunks(10)).toEqual([10]);
  });

  test("custom min/max respected", () => {
    expect(generateChunks(90, 20, 45)).toEqual([45, 45]);
    expect(generateChunks(100, 20, 45)).toEqual([45, 28, 27]);
  });
});

describe("anyChunkFits", () => {
  test("returns true when any chunk <= chosen", () => {
    expect(anyChunkFits([60, 30], 30)).toBe(true);
    expect(anyChunkFits([60, 30], 45)).toBe(true);
  });

  test("returns false when all chunks > chosen", () => {
    expect(anyChunkFits([60, 60], 30)).toBe(false);
  });
});
