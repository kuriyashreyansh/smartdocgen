// Integration tests: the real React app rendered in jsdom, talking to the real FastAPI backend (see vitest.config.js).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { DocTypesProvider } from "./context/DocTypesContext";
import { ToastProvider } from "./context/ToastContext";

const renderApp = (path = "/") =>
  render(<MemoryRouter initialEntries={[path]}><ToastProvider><DocTypesProvider><App /></DocTypesProvider></ToastProvider></MemoryRouter>);
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("dashboard", () => {
  it("lists every document type from GET /doc-types", async () => {
    renderApp("/");
    expect((await screen.findAllByText("Prize Money Receipt")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bill Certificate (Form BC-R)").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/fields$/).length).toBe(7);
  });
  it("shows an error state with retry when the backend is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    renderApp("/");
    expect(await screen.findAllByText(/Cannot reach the server/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /try again/i }).length).toBeGreaterThan(0);
  });
});

describe("create document", () => {
  it("blocks an empty submit with field errors and no request", async () => {
    renderApp("/create/permission_letter");
    await screen.findByRole("button", { name: /generate document/i });
    const spy = vi.spyOn(globalThis, "fetch");
    await userEvent.click(screen.getByRole("button", { name: /generate document/i }));
    expect((await screen.findAllByText("This field is required")).length).toBeGreaterThan(5);
    expect(spy).not.toHaveBeenCalled();
  });

  it("validates table rows like the server does", async () => {
    renderApp("/create/submitted_note");
    await screen.findByLabelText(/Title of the event/);
    fireEvent.change(screen.getByLabelText("Approximate amount (Rs.), row 1"), { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText("Item, row 1"), { target: { value: "Food" } });
    await userEvent.click(screen.getByRole("button", { name: /generate document/i }));
    expect(await screen.findByText(/must be a number/)).toBeTruthy();
  }, 60000);

  it("generates a real document end to end and shows reference, PDF preview and downloads", async () => {
    renderApp("/create/submitted_note");
    await screen.findByLabelText(/Title of the event/);
    type(/Event code/, "UI1");
    type(/Title of the event/, "UI integration test event");
    type(/Schedule of event/, "2027-01-15");
    type(/Event venue/, "Main Auditorium");
    type(/Category of the event/, "Workshop");
    type(/^Brief description/, "A one day workshop for students.");
    type(/^Objectives/, "Teach the basics.");
    type(/Target audience/, "All years");
    type(/Expected number of participants/, "120");
    type("Item, row 1", "Snacks");
    type("Approximate amount (Rs.), row 1", "2500");
    await userEvent.click(screen.getByRole("button", { name: "Add row" }));
    type("Item, row 2", "Banner");
    type("Approximate amount (Rs.), row 2", "1,250");
    expect(screen.getAllByText("3,750").length).toBeGreaterThan(0); // live total preview
    await userEvent.click(screen.getByRole("button", { name: /generate document/i }));
    expect(await screen.findByText("Document generated", {}, { timeout: 60000 })).toBeTruthy();
    expect(screen.getAllByText(/ACM\/\d{4}-\d{2}\/UI1\/\d{3}/).length).toBeGreaterThan(0);
    expect(screen.getByTitle("PDF preview").getAttribute("src")).toMatch(/\.pdf$/);
    expect(screen.getByRole("button", { name: /generate new version/i })).toBeTruthy(); // versioning is now active
  }, 90000);

  it("maps a server 422 {missing:[...]} onto the right fields", async () => {
    renderApp("/create/invitation_notice");
    await screen.findByLabelText(/Club name/);
    type(/Club name/, "ACM"); type(/Event name/, "Meet"); type(/Event date/, "2027-02-01"); type(/^Venue/, "Hall");
    const real = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation((url, init) =>
      String(url).endsWith("/generate") ? Promise.resolve(new Response(JSON.stringify({ detail: { missing: ["venue"] } }), { status: 422 })) : real(url, init));
    await userEvent.click(screen.getByRole("button", { name: /generate document/i }));
    expect(await screen.findByText("This field is required")).toBeTruthy();
  });

  it("explains a missing template file (real backend: invitation_notice has no .docx)", async () => {
    renderApp("/create/invitation_notice");
    await screen.findByLabelText(/Club name/);
    type(/Club name/, "ACM"); type(/Event name/, "Meet"); type(/Event date/, "2027-02-01"); type(/^Venue/, "Hall");
    await userEvent.click(screen.getByRole("button", { name: /generate document/i }));
    expect(await screen.findByText(/template file for this document type is missing/i)).toBeTruthy();
  });

  it("batch mode: one receipt per row, returns a zip", async () => {
    renderApp("/create/prize_money_receipt");
    await screen.findByLabelText(/Event \/ competition name/);
    await userEvent.click(screen.getByRole("button", { name: "Batch" }));
    type(/Event \/ competition name/, "Batch test cup"); type(/Event date/, "2026-10-01"); type(/^Venue/, "Ground");
    const fill = (row, v) => {
      const set = (n, x) => type(`${n}, row ${row}`, x);
      set("Winner's name", v.name); set("Roll no.", "U24AI001"); set("Course & semester", "B.Tech Sem 5"); set("Mobile no.", "9999999999");
      set("Position", v.pos); set("Prize amount (Rs.)", v.amt); set("Name as per bank account", v.name);
      set("Bank name", "SBI"); set("Branch", "Surat"); set("Account no.", "123456789012"); set("IFSC code", "SBIN0000001");
    };
    fill(1, { name: "Asha", pos: "1st", amt: "5000" });
    await userEvent.click(screen.getByRole("button", { name: "Add row" }));
    fill(2, { name: "Ravi", pos: "2nd", amt: "3000" });
    await userEvent.click(screen.getByRole("button", { name: /generate 2 documents/i }));
    expect(await screen.findByText(/2 documents generated/, {}, { timeout: 90000 })).toBeTruthy();
    expect(screen.getByRole("link", { name: /download all \(zip\)/i }).getAttribute("href")).toMatch(/\.zip$/);
  }, 120000);
});

describe("history and versions", () => {
  it("lists documents, filters them, and opens a version editor with sensitive data cleared", async () => {
    renderApp("/documents");
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(2);
    await userEvent.type(screen.getByLabelText("Search documents"), "zzz-no-match");
    expect(await screen.findByText("No matches")).toBeTruthy();
    cleanup();

    // find a prize receipt (has masked account number) and open its "new version" form
    const docs = await (await fetch("http://127.0.0.1:8000/documents")).json();
    const receipt = docs.find((d) => d.type === "Prize Money Receipt");
    expect(receipt).toBeTruthy();
    renderApp(`/documents/${receipt.document_id}`);
    await screen.findByText(receipt.ref_no);
    const link = await screen.findByRole("link", { name: /create new version/i });
    cleanup();
    renderApp(link.getAttribute("href"));
    expect(await screen.findByText(/Re-enter sensitive details/)).toBeTruthy();
    expect(screen.getByLabelText(/Account no\./).value).toBe("");
    expect(screen.getByLabelText(/Winner's name/).value).not.toBe("");
    expect(screen.getByRole("button", { name: /generate new version/i })).toBeTruthy();
  }, 60000);

  it("shows a not-found state for an unknown document", async () => {
    renderApp("/documents/999999");
    expect(await screen.findByText("Document not found")).toBeTruthy();
  });
});

describe("smart compose + templates", () => {
  it("shows a readable error when the AI service fails", async () => {
    renderApp("/smart");
    await userEvent.type(screen.getByLabelText("Your request"), "hackathon on 20 Nov");
    await userEvent.click(screen.getByRole("button", { name: /analyse request/i }));
    expect(await screen.findByText(/Could not analyse the request/, {}, { timeout: 45000 })).toBeTruthy();
  }, 60000);
  it("renders a parse result and carries values into the form", async () => {
    renderApp("/smart");
    const real = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => String(url).endsWith("/parse")
      ? Promise.resolve(new Response(JSON.stringify({ doc_type: "permission_letter", confidence: 0.93, fields: { event_name: "Hackathon", venue: "Seminar Hall 402", event_date: "2026-12-12" },
          missing: [{ key: "start_time", label: "Start time", question: "What time does the event start?" }], is_complete: false, removed_by_grounding: [], confirm_dates: ["event_date"], needs_doc_type: false }), { status: 200 }))
      : real(url, init));
    await userEvent.type(screen.getByLabelText("Your request"), "hall for hackathon");
    await userEvent.click(screen.getByRole("button", { name: /analyse request/i }));
    expect(await screen.findByText("93% sure")).toBeTruthy();
    expect(screen.getByText("What time does the event start?")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /continue to form/i }));
    expect((await screen.findByLabelText(/Event name/)).value).toBe("Hackathon");
    expect(screen.getByText(/worked out from words like/)).toBeTruthy(); // relative-date confirmation
  });
  it("rejects a non-docx upload on the templates page", async () => {
    renderApp("/templates");
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });
    expect(await screen.findByText(/choose a \.docx file/i)).toBeTruthy();
  });
});

const mockRoutes = (routes) => {
  const real = globalThis.fetch;
  return vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
    const hit = Object.entries(routes).find(([suffix]) => String(url).includes(suffix));
    return hit ? Promise.resolve(new Response(JSON.stringify(hit[1].body), { status: hit[1].status || 200 })) : real(url, init);
  });
};

describe("AI drafting", () => {
  it("fills the field from POST /ai/section, sends facts without the AI sections, and can undo", async () => {
    const spy = mockRoutes({ "/ai/section": { body: { text: "A hands-on hackathon for students.", ai_generated: true, message: "" } } });
    renderApp("/create/permission_letter");
    await screen.findByLabelText(/Event name/);
    type(/Event name/, "Hackathon"); type(/^Venue/, "Hall 402");
    await userEvent.click(screen.getAllByRole("button", { name: /draft with ai/i })[0]);
    await waitFor(() => expect(screen.getByLabelText(/^Brief description/).value).toBe("A hands-on hackathon for students."));
    const call = spy.mock.calls.find(([u]) => String(u).includes("/ai/section"));
    const body = JSON.parse(call[1].body);
    expect(body.section).toBe("Brief description");
    expect(body.facts).toMatchObject({ event_name: "Hackathon", venue: "Hall 402" });
    expect(body.facts.brief_description).toBeUndefined();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByLabelText(/^Brief description/).value).toBe("");
  });
  it("shows the backend's message and leaves the field empty when the AI declines", async () => {
    mockRoutes({ "/ai/section": { body: { text: "", ai_generated: false, message: "Add more notes, or write it yourself." } } });
    renderApp("/create/permission_letter");
    await screen.findByLabelText(/Event name/);
    await userEvent.click(screen.getAllByRole("button", { name: /draft with ai/i })[0]);
    expect(await screen.findByText(/Add more notes/)).toBeTruthy();
    expect(screen.getByLabelText(/^Brief description/).value).toBe("");
  });
  it("survives a non-JSON 500 from the AI endpoint and tells the user they can write it themselves", async () => {
    const real = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => String(url).includes("/ai/section")
      ? Promise.resolve(new Response("Internal Server Error", { status: 500 })) : real(url, init));
    renderApp("/create/permission_letter");
    await screen.findByLabelText(/Event name/);
    await userEvent.click(screen.getAllByRole("button", { name: /draft with ai/i })[0]);
    expect(await screen.findByText(/AI drafting is unavailable right now/)).toBeTruthy();
    expect(screen.getByLabelText(/^Brief description/).value).toBe("");
  });
});

describe("template admin flow", () => {
  it("inspects a .docx, lets the admin label fields, and saves", async () => {
    const spy = mockRoutes({
      "/templates/inspect": { body: { token: "abc.docx", user_fields: ["guest_name", "talk_date"], auto_fields: ["ref_no"], ai_fields: [] } },
      "/templates": { body: { saved: true, type_id: "guest_letter", template_file: "guest_letter.docx" } },
    });
    renderApp("/templates");
    const file = new File(["x"], "Guest Letter.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });
    expect(await screen.findByText("guest_name")).toBeTruthy();
    expect(screen.getByDisplayValue("guest_letter")).toBeTruthy(); // slug from the file name
    fireEvent.change(screen.getByDisplayValue("Guest letter"), { target: { value: "Guest Letter" } });
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "Letter to a guest speaker" } });
    fireEvent.change(screen.getByLabelText("Type for talk_date"), { target: { value: "date" } });
    await userEvent.click(screen.getByRole("button", { name: /save template/i }));
    expect(await screen.findByText("Template saved", { selector: "strong" })).toBeTruthy();
    const save = spy.mock.calls.find(([u, i]) => String(u).endsWith("/templates") && i?.method === "POST");
    const sent = JSON.parse(save[1].body);
    expect(sent).toMatchObject({ token: "abc.docx", type_id: "guest_letter", ref_code: "DOC" });
    expect(sent.fields.find((f) => f.key === "talk_date").type).toBe("date");
  });
  it("shows the field list when the backend rejects the mapping (422)", async () => {
    mockRoutes({
      "/templates/inspect": { body: { token: "t.docx", user_fields: ["a_field"], auto_fields: [], ai_fields: [] } },
      "/templates": { status: 422, body: { detail: { error: "Template placeholders without a field definition", fields: ["a_field"] } } },
    });
    renderApp("/templates");
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(["x"], "abc_doc.docx")] } });
    await screen.findByText("a_field");
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "d" } });
    await userEvent.click(screen.getByRole("button", { name: /save template/i }));
    expect(await screen.findByText(/without a field definition/)).toBeTruthy();
  });
});
