import test from "node:test";
import assert from "node:assert/strict";
import { emptyValues, validate, buildFields, mapMissing, fillValues, tableTotals } from "./fields.js";

const note = {
  fields: [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "date", label: "Date", type: "date", required: true },
    { key: "pan", label: "PAN", type: "text", required: false, sensitive: true },
    { key: "expenses", label: "Financial proposal (expenses)", type: "table", required: true,
      columns: [{ key: "item", label: "Item", type: "text" }, { key: "amount", label: "Amount", type: "number" }],
      total: { key: "expenses_total", column: "amount" } },
  ],
};
const bill = {
  fields: [
    { key: "taxes", label: "Taxes", type: "number", required: false },
    { key: "items", label: "Items", type: "table", required: true,
      columns: [
        { key: "qty", label: "Qty", type: "number" }, { key: "unit", label: "Unit", type: "number" },
        { key: "line", label: "Line", type: "number", multiply: ["qty", "unit"] }],
      total: { key: "items_total", column: "line", also: [{ key: "total_with_taxes", add: "taxes" }] } },
  ],
};

test("empty form fails required fields and needs a table row", () => {
  const e = validate(note, emptyValues(note));
  assert.equal(e.title, "This field is required");
  assert.match(e.expenses, /at least one row/);
});

test("table row validation mirrors the backend", () => {
  const v = { ...emptyValues(note), title: "x", date: "2026-11-20", expenses: [{ item: "", amount: "abc" }] };
  const e = validate(note, v);
  assert.match(e.expenses, /Row 1 needs Item/);
  assert.match(e.expenses, /Amount must be a number/);
});

test("valid form passes; blank rows are dropped from the payload", () => {
  const v = { ...emptyValues(note), title: " Hack ", date: "2026-11-20",
    expenses: [{ item: "Food", amount: "5,000" }, { item: "", amount: "" }] };
  assert.deepEqual(validate(note, v), {});
  const f = buildFields(note, v);
  assert.equal(f.title, "Hack");
  assert.equal(f.pan, undefined);
  assert.deepEqual(f.expenses, [{ item: "Food", amount: "5,000" }]);
});

test("mapMissing separates field keys, table sentences and general messages", () => {
  const { fieldErrors, general } = mapMissing(note, ["title", "Financial proposal (expenses): row 1 needs Item", "Weird"]);
  assert.equal(fieldErrors.title, "This field is required");
  assert.equal(fieldErrors.expenses, "row 1 needs Item");
  assert.deepEqual(general, ["Weird"]);
});

test("stored sensitive values are cleared when editing a new version", () => {
  const { values, cleared } = fillValues(note, { title: "A", pan: "XXXXXX1234" }, { clearSensitive: true });
  assert.equal(values.pan, "");
  assert.equal(values.title, "A");
  assert.deepEqual(cleared, ["PAN"]);
});

test("table totals multiply columns and add taxes", () => {
  const t = tableTotals(bill.fields[0].key ? bill.fields[1] : null, [{ qty: "2", unit: "100" }, { qty: "1", unit: "50" }], { taxes: "25" });
  assert.equal(t.total, 250);
  assert.equal(t.extras[0].value, 275);
});

import { validateRows, blankPerRow, isBlankRow } from "./fields.js";
test("batch rows are validated per row", () => {
  const t = { fields: [
    { key: "name", label: "Name", type: "text", required: true, per_row: true },
    { key: "amount", label: "Amount", type: "number", required: true, per_row: true },
    { key: "event", label: "Event", type: "text", required: true } ] };
  const rows = [{ name: "A", amount: "100" }, { name: "", amount: "x" }];
  const e = validateRows(t, rows);
  assert.equal(e[0], undefined);
  assert.deepEqual(e[1], { name: "Required", amount: "Not a number" });
  assert.deepEqual(Object.keys(blankPerRow(t)), ["name", "amount"]);
  assert.ok(isBlankRow(blankPerRow(t)));
});
