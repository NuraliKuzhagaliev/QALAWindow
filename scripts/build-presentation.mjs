import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const base =
  "C:/Users/nural/.cache/codex-runtimes/codex-primary-runtime/dependencies";
const { Presentation, PresentationFile } = await import(
  pathToFileURL(
    base + "/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs",
  ).href
);
const { finalizePresentation } = await import(
  pathToFileURL(
    "C:/Users/nural/.codex/plugins/cache/openai-primary-runtime/presentations/26.1011.51657/skills/presentations/container_tools/artifact_tool_utils.mjs",
  ).href
);
const source = JSON.parse(
  await fs.readFile("submission/presentation-source.json", "utf8"),
);
await fs.mkdir(".tmp/presentation", { recursive: true });
await fs.mkdir("submission/slides", { recursive: true });
const presentation = Presentation.create({
  slideSize: { width: 1280, height: 720 },
});
const ink = "#172B28",
  green = "#123F36",
  lime = "#D5EE8A",
  paper = "#F6F3EC",
  muted = "#536953";
function rect(slide, x, y, w, h, fill, radius = false) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { fill: "none", width: 0 },
  });
}
function text(slide, value, x, y, w, h, size = 26, color = ink, bold = false) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  box.text = value;
  box.text.style = { typeface: "Arial", fontSize: size, color, bold };
  return box;
}
for (let index = 0; index < source.slides.length; index++) {
  const spec = source.slides[index],
    slide = presentation.slides.add();
  slide.background.fill = paper;
  slide.speakerNotes.text = spec.notes;
  if (spec.kind === "cover") {
    slide.background.fill = green;
    text(slide, "QALA Window", 68, 56, 500, 60, 28, lime, true);
    text(slide, spec.title, 68, 204, 860, 210, 64, paper, true);
    text(
      slide,
      "Astana, within the time you have.",
      72,
      488,
      900,
      70,
      30,
      "#DCE5CD",
    );
    for (let i = 0; i < 4; i++)
      rect(
        slide,
        1005 + i * 38,
        240 + i * 23,
        29,
        205 - i * 34,
        [lime, "#AEC877", "#76945E", paper][i],
      );
    text(
      slide,
      "Smart City · Build with AI · 2026",
      72,
      645,
      900,
      30,
      17,
      "#DCE5CD",
    );
  } else {
    text(slide, spec.title, 64, 47, 1150, 100, 43, green, true);
    text(slide, spec.subtitle, 67, 149, 1140, 50, 23, muted);
    rect(slide, 67, 214, 1145, 1, "#CCD5BF");
    if (spec.kind === "screenshot" || spec.kind === "evidence") {
      const image = await fs.readFile(spec.image);
      slide.images.add({
        blob: new Uint8Array(image),
        contentType: "image/png",
        alt: "Actual QALA Window application screenshot",
        fit: "contain",
        position: { left: 64, top: 240, width: 840, height: 420 },
      });
      text(
        slide,
        spec.kind === "screenshot"
          ? "One to three stops\n\nEvery return leg\n\nUnknowns visible"
          : "Source facts\n\nCalculated timing\n\nSuggested activity",
        938,
        281,
        270,
        300,
        25,
        green,
        true,
      );
    }
    if (spec.kind === "group") {
      const cols = [
        [
          "Group balance",
          "Max-min match first.\nIndividual profiles stay local.",
        ],
        [
          "Access evidence",
          "Entrance and route are separate.\nUnknown cannot pass strict mode.",
        ],
        [
          "EN / RU / KZ",
          "Same IDs, numbers and unknowns.\nKazakh review pending.",
        ],
      ];
      cols.forEach(([title, body], i) => {
        const x = 67 + i * 386;
        text(
          slide,
          String(i + 1).padStart(2, "0"),
          x,
          264,
          80,
          60,
          40,
          "#6B8953",
        );
        text(slide, title, x, 351, 342, 55, 29, green, true);
        text(slide, body, x, 438, 342, 150, 24, muted);
      });
    }
    if (spec.kind === "offline") {
      rect(slide, 68, 260, 600, 335, green, true);
      text(slide, "QALA Window", 105, 296, 500, 60, 36, lime, true);
      text(
        slide,
        "Local renderer\nPOIs and walking network\nSaved text and evidence",
        105,
        385,
        490,
        180,
        27,
        paper,
      );
      text(
        slide,
        "Native save / open\n\nRestart and reopen\n\nVisible last-synced date",
        730,
        290,
        450,
        280,
        28,
        green,
        true,
      );
    }
    if (spec.kind === "pipeline") {
      const steps = [
        ["Collect", "OSM records\nIDs, tags, timestamps"],
        ["Retrieve", "Multilingual search\nBounded candidates"],
        ["Check", "Full legs and hours\nHard constraints"],
        ["Explain", "Approved fact bundle\nValidated model output"],
      ];
      steps.forEach(([title, body], i) => {
        const x = 67 + i * 293;
        text(slide, String(i + 1), x, 270, 70, 65, 48, "#6B8953");
        text(slide, title, x, 371, 263, 60, 30, green, true);
        text(slide, body, x, 466, 263, 140, 23, muted);
      });
    }
    if (spec.kind === "evidence-numbers") {
      const nums = [
        ["120", "accepted POIs"],
        ["3,801", "network ways"],
        ["72", "behavior cases"],
        ["6", "live quality calls"],
      ];
      nums.forEach(([value, label], i) => {
        const x = 67 + i * 292;
        text(slide, value, x, 288, 270, 108, 66, green, true);
        text(slide, label, x, 419, 265, 60, 23, muted);
      });
      text(
        slide,
        "57 places have unknown hours. Kazakh native review and physical route checks remain open.",
        68,
        559,
        1130,
        65,
        22,
        muted,
      );
    }
    if (spec.kind === "business") {
      text(slide, "A free resident demo", 68, 270, 500, 65, 32, green, true);
      text(
        slide,
        "A potential visitor-desk pilot",
        68,
        366,
        1070,
        70,
        42,
        green,
        true,
      );
      text(
        slide,
        "Validate demand. Verify entrances and schedules. Review language and field routes.",
        68,
        491,
        1070,
        110,
        27,
        muted,
      );
    }
    if (spec.kind === "closing") {
      text(
        slide,
        "A useful hour.\nA visible reason.",
        68,
        268,
        780,
        195,
        56,
        green,
        true,
      );
      text(
        slide,
        "Next: verified entrances, better local coverage and a focused pilot.",
        72,
        520,
        990,
        86,
        27,
        muted,
      );
      rect(slide, 1050, 288, 56, 182, green);
      rect(slide, 1120, 332, 56, 138, "#AFCB71");
    }
    text(
      slide,
      `QALA Window  /  ${String(index + 1).padStart(2, "0")}`,
      68,
      676,
      800,
      25,
      13,
      muted,
    );
  }
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(
    `submission/slides/slide-${String(index + 1).padStart(2, "0")}.png`,
    new Uint8Array(await png.arrayBuffer()),
  );
}
await fs.writeFile(
  "submission/SPEAKER_NOTES.md",
  "# QALA Window · 6:30 speaker notes\n\n" +
    source.slides
      .map(
        (s, i) =>
          `## ${i + 1}. ${s.title.replaceAll("\n", " ")} (${s.seconds}s)\n\n${s.notes}`,
      )
      .join("\n\n"),
);
const candidate = path.resolve(".tmp/presentation/candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidate);
const skill =
  "C:/Users/nural/.codex/plugins/cache/openai-primary-runtime/presentations/26.1011.51657/skills/presentations";
await finalizePresentation({
  workspaceDir: path.resolve("."),
  candidatePath: candidate,
  finalPath: path.resolve("submission/presentation.pptx"),
  pythonExecutable: base + "/python/python.exe",
  integrityValidatorPath:
    skill + "/container_tools/inspect_presentation_package_integrity.py",
  layoutValidatorPath:
    skill + "/container_tools/inspect_presentation_layout_geometry.py",
  layoutArgs: [
    "--expected-slide-size-emu",
    "12192000,6858000",
    "--validate-heading-fit",
  ],
  explicitTotalSlideCount: 9,
  requiredNativeTableOwnerSlides: [],
  fontPolicy: { basis: "design", families: ["Arial"] },
  verifyArtifactToolImport: true,
  receiptPath: path.resolve(".tmp/presentation/validation.json"),
});
console.log("Editable presentation and nine previews created.");
