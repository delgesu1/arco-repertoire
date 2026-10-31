import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_FILTERS } from "./filter";
import { isChamberPath } from "./launch";
import { chamberFiltersFromParams, paramsFromChamberFilters } from "./url-state";

const read = (qs: string) => chamberFiltersFromParams(new URLSearchParams(qs));
const write = (qs: string, patch: Parameters<typeof paramsFromChamberFilters>[0] extends infer F ? Partial<F> : never) => {
  const cur = new URLSearchParams(qs);
  return decodeURIComponent(paramsFromChamberFilters({ ...chamberFiltersFromParams(cur), ...patch }, cur).toString());
};

describe("chamber URL state", () => {
  it("starts empty", () => {
    expect(read("")).toEqual(EMPTY_CHAMBER_FILTERS);
  });
  it("reads the form, the ensemble and the instruments", () => {
    const f = read("form=short&ens=string-quartet&lv=3&with=clarinet,viola");
    expect(f.form).toBe("short");
    expect(f.formation).toBe("string-quartet");
    expect(f.level).toBe(3);
    expect(f.exact).toBe(false);
    expect(f.instruments).toEqual(["clarinet", "viola"]);
  });
  it("drops unknown values and repeated instruments", () => {
    const f = read("form=sonata&ens=duo&with=clarinet,kazoo,clarinet,,viola-damore");
    expect(f.form).toBeNull();
    expect(f.formation).toBeNull();
    expect(f.instruments).toEqual(["clarinet", "viola-damore"]);
  });
  it("ignores the violin list's own parameters", () => {
    const f = read("type=concerto&set=piano&board=ABRSM");
    expect(f.type).toBeNull();
    expect(f.setting).toBeNull();
    expect(f.board).toBeNull();
    expect(write("type=concerto&set=piano&board=ABRSM", {})).toBe("");
  });
  it("shares the violin list's other parameters", () => {
    const f = read("q=trout&mode=major&ch=lyrical,folk&min=10&max=30&era=classical&g=F&pop=well-known&lv=5&exact=1");
    expect(f).toMatchObject({
      q: "trout",
      mode: "major",
      character: ["lyrical", "folk"],
      minMin: 10,
      maxMin: 30,
      era: "classical",
      gender: "F",
      popularity: "well-known",
      level: 5,
      exact: true,
      sort: "relevance",
    });
  });
  it("writes what it reads", () => {
    const qs = "form=short&ens=string-quartet&lv=3&with=clarinet,viola";
    expect(write(qs, {})).toBe(qs);
  });
  it("adds and removes instruments", () => {
    expect(write("ens=winds-strings", { instruments: ["horn"] })).toBe("ens=winds-strings&with=horn");
    expect(write("with=horn,viola", { instruments: ["viola"] })).toBe("with=viola");
    expect(write("with=horn", { instruments: [] })).toBe("");
  });
  it("keeps a size only among same-instrument ensembles", () => {
    expect(read("ens=same-instrument&with=cello&parts=4").parts).toBe(4);
    expect(read("ens=string-quartet&parts=4").parts).toBeNull();
    expect(read("ens=same-instrument&parts=x").parts).toBeNull();
    expect(write("ens=same-instrument&parts=4", { formation: null })).toBe("");
  });
  it("keeps the open piece and leaves defaults out", () => {
    expect(write("piece=100031&form=work", { form: null })).toBe("piece=100031");
    expect(write("q=trout&sort=level", { sort: "relevance" })).toBe("q=trout");
  });
});

describe("isChamberPath", () => {
  it("knows the chamber section's pages", () => {
    expect(isChamberPath("/chamber")).toBe(true);
    expect(isChamberPath("/piece/100098/schubert-piano-quintet-in-a-major-d-667-trout")).toBe(true);
    expect(isChamberPath("/piece/86/accolay-concerto-no-1-in-a-minor")).toBe(false);
  });

  it("counts the pages of composers with chamber works only", () => {
    expect(isChamberPath("/composer/jenkins-john")).toBe(true);
    expect(isChamberPath("/composer/boccherini-luigi")).toBe(false);
    expect(isChamberPath("/composer/bruch-max")).toBe(false);
    expect(isChamberPath("/composers")).toBe(false);
  });
});
