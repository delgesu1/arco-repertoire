import { describe, expect, it } from "vitest";
import { filtersFromParams, paramsFromFilters } from "./url-state";

const sortFor = (qs: string) => filtersFromParams(new URLSearchParams(qs)).sort;
const pick = (qs: string, sort: "known" | "level" | "composer" | "length" | "relevance") => {
  const cur = new URLSearchParams(qs);
  return paramsFromFilters({ ...filtersFromParams(cur), sort }, cur).toString();
};

describe("sort", () => {
  it("defaults to best match with a search and best known without", () => {
    expect(sortFor("")).toBe("known");
    expect(sortFor("q=brahms")).toBe("relevance");
    expect(sortFor("sort=relevance")).toBe("known");
    expect(sortFor("sort=composer")).toBe("composer");
  });
  it("keeps composer when picked during a search", () => {
    const qs = pick("q=brahms", "composer");
    expect(qs).toBe("q=brahms&sort=composer");
    expect(sortFor(qs)).toBe("composer");
  });
  it("leaves the default out of the URL", () => {
    expect(pick("q=brahms&sort=level", "relevance")).toBe("q=brahms");
    expect(pick("sort=level", "known")).toBe("");
  });
});
