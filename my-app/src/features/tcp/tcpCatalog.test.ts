import { describe, expect, it } from "vitest";
import {
  DEVICES,
  ROAD_TYPES,
  SIGN_CATEGORIES,
  SIGN_SHAPES,
  TOOLS,
  TOOLS_REQUIRING_MAP,
} from "./tcpCatalog";

describe("tcpCatalog", () => {
  it("exposes consistent sign categories and built-in signs", () => {
    expect(SIGN_CATEGORIES.regulatory.signs[0]?.id).toBe("stop");
    expect(Object.keys(SIGN_CATEGORIES).length).toBeGreaterThanOrEqual(6);
  });

  it("lists six sign shape options for the custom sign editor", () => {
    expect(SIGN_SHAPES.map((s) => s.id)).toEqual([
      "diamond",
      "rect",
      "octagon",
      "circle",
      "triangle",
      "shield",
    ]);
  });

  it("requires a geocoded map for drawing tools but not select/pan", () => {
    expect(TOOLS_REQUIRING_MAP.has("road")).toBe(true);
    expect(TOOLS_REQUIRING_MAP.has("select")).toBe(false);
    expect(TOOLS_REQUIRING_MAP.has("pan")).toBe(false);
  });

  it("keeps devices, road presets, and tools in sync with the editor", () => {
    expect(DEVICES.length).toBeGreaterThanOrEqual(10);
    expect(ROAD_TYPES.map((r) => r.id)).toContain("2lane");
    expect(TOOLS.map((t) => t.id)).toContain("erase");
  });
});
