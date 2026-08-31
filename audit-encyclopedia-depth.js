"use strict";

const fs = require("fs");
const path = require("path");

const source = path.join(__dirname, "encyclopedia_ar.json");
const output = path.join(__dirname, "encyclopedia-depth-report.json");
const data = JSON.parse(fs.readFileSync(source, "utf8"));
const genericMarker = "يدرس مدخل";
const report = {
  generatedAt: new Date().toISOString(),
  total: data.entries.length,
  byLetter: {},
  needsRewrite: []
};

for (const entry of data.entries) {
  const letter = entry.letter || "#";
  report.byLetter[letter] = report.byLetter[letter] || { total: 0, deep: 0, needsRewrite: 0 };
  report.byLetter[letter].total += 1;

  const content = String(entry.content || "");
  const references = Array.isArray(entry.references) ? entry.references : [];
  const hasGenericMarker = content.includes(genericMarker);
  const hasScripture = content.includes("الشواهد الأساسية:");
  const hasAcademicReferences = references.filter(reference => {
    const text = typeof reference === "string" ? reference : `${reference.author || ""} ${reference.title || ""}`;
    return !text.includes("الكتاب المقدس");
  }).length;
  const deepEnough = content.length >= 900 && references.length >= 3 && !hasGenericMarker && hasScripture;

  if (deepEnough) {
    report.byLetter[letter].deep += 1;
    continue;
  }

  report.byLetter[letter].needsRewrite += 1;
  report.needsRewrite.push({
    id: entry.id,
    title: entry.title,
    letter,
    contentLength: content.length,
    references: references.length,
    academicReferences: hasAcademicReferences,
    reasons: [
      content.length < 900 ? "content-under-900-characters" : null,
      references.length < 3 ? "fewer-than-three-references" : null,
      hasGenericMarker ? "generic-template-language" : null,
      !hasScripture ? "missing-scripture-marker" : null
    ].filter(Boolean)
  });
}

fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`تم إعداد تقرير العمق: ${report.needsRewrite.length} مدخلًا يحتاج إعادة كتابة من أصل ${report.total}.`);
for (const [letter, counts] of Object.entries(report.byLetter)) {
  console.log(`${letter}: عميق ${counts.deep}، يحتاج إعادة كتابة ${counts.needsRewrite}`);
}
