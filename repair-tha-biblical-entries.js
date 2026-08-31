"use strict";

const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "encyclopedia_ar.json");
const bible = require("./bible.json");
const normalize = value => String(value).normalize("NFKC").replace(/[\u064B-\u065F\u0670ـ]/g, "").replace(/\s+/g, "");
const bibleText = bible.map(verse => normalize(verse.text)).join(" ");
const before = JSON.parse(fs.readFileSync(file, "utf8"));
const thaEntries = before.entries.filter(entry => entry.letter === "ث");
const kept = thaEntries.filter(entry => bibleText.includes(normalize(entry.title)));
const removed = thaEntries.filter(entry => !bibleText.includes(normalize(entry.title)));
before.entries = before.entries.filter(entry => entry.letter !== "ث" || bibleText.includes(normalize(entry.title)));
const temporary = `${file}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(before, null, 2)}\n`, "utf8");
JSON.parse(fs.readFileSync(temporary, "utf8"));
fs.renameSync(temporary, file);
console.log(JSON.stringify({ kept: kept.map(entry => entry.title), removed: removed.map(entry => entry.title) }, null, 2));
