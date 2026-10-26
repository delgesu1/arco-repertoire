import { describe, expect, it } from "vitest";
import { programText, programTitle, roman } from "./details";
import type { PieceBase } from "./types";

const base = { composerName: "Felix Mendelssohn", dates: "1809–1847" } as PieceBase;
const concerto = { ...base, title: "Concerto in E minor, Op. 64", type: "concerto", settings: ["orchestra"] };

describe("program text", () => {
  it("numbers movements in Roman numerals", () => {
    expect(roman(1)).toBe("I");
    expect(roman(4)).toBe("IV");
    expect(roman(9)).toBe("IX");
    expect(roman(14)).toBe("XIV");
  });

  it("names the violin where the catalogue leaves it implicit", () => {
    expect(programTitle(concerto)).toBe("Violin Concerto in E minor, Op. 64");
    expect(programTitle({ ...base, title: "Sonata No. 1 in G major, Op. 78", type: "sonata", settings: ["piano"] })).toBe(
      "Violin Sonata No. 1 in G major, Op. 78",
    );
    expect(programTitle({ ...base, title: "Concerto for Two Violins in D minor, BWV 1043", type: "duet", settings: ["orchestra"] })).toBe(
      "Concerto for Two Violins in D minor, BWV 1043",
    );
    // chamber titles already name their ensemble
    expect(programTitle({ ...base, title: "Piano Quintet in A major, D. 667" })).toBe("Piano Quintet in A major, D. 667");
  });

  it("writes composer, title and movements", () => {
    expect(programText(concerto, { movements: ["Allegro molto appassionato", "Andante", "Allegro molto vivace"], kind: "movements" })).toBe(
      "Felix Mendelssohn (1809–1847)\nViolin Concerto in E minor, Op. 64\nI. Allegro molto appassionato\nII. Andante\nIII. Allegro molto vivace",
    );
    expect(programText(concerto, null)).toBe("Felix Mendelssohn (1809–1847)\nViolin Concerto in E minor, Op. 64");
  });

  it("numbers a set's pieces 1, 2, 3", () => {
    expect(programText({ ...base, title: "6 Pieces" }, { movements: ["Polonaise", "Guitarre"], kind: "pieces" })).toBe(
      "Felix Mendelssohn (1809–1847)\n6 Pieces\n1. Polonaise\n2. Guitarre",
    );
  });
});
