import { useState } from "react";
import { api } from "../../api/endpoints";
import { Button } from "../ui";

const LEVELS = [["short", "Short"], ["standard", "Standard"], ["detailed", "Detailed"]];

/**
 * "Draft with AI" for a longtext field listed in the doc type's ai_sections.
 * Calls POST /ai/section. The backend never invents facts: it may answer with empty text
 * when the details are not enough, and we show its message instead of filling anything.
 */
export default function AiDraft({ field, getFacts, value, onApply }) {
  const [level, setLevel] = useState("standard");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { kind, text }
  const [previous, setPrevious] = useState(null);

  async function draft() {
    setBusy(true); setNote(null);
    try {
      const res = await api.aiSection({ facts: getFacts(), section: field.label, detail_level: level });
      if (res.ai_generated && res.text) {
        setPrevious(value || ""); onApply(res.text);
        setNote({ kind: "ok", text: "AI draft added. Please review and edit it before generating the document." });
      } else {
        setNote({ kind: "warn", text: res.message || "The AI could not write this section from the details given." });
      }
    } catch (e) {
      setNote({ kind: "err", text: `AI drafting is unavailable right now (${e.message}) You can write this section yourself.` });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="ai-bar">
        <Button size="sm" className="btn-sm" icon="wand" loading={busy} type="button" onClick={draft}>Draft with AI</Button>
        <select className="input" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Draft length" disabled={busy}>
          {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {previous !== null && !busy && (
          <Button size="sm" className="btn-sm" variant="ghost" type="button" onClick={() => { onApply(previous); setPrevious(null); setNote(null); }}>Undo</Button>
        )}
      </div>
      {note && <div className={note.kind === "ok" ? "help" : note.kind === "warn" ? "hint-warn" : "err"}>{note.text}</div>}
    </div>
  );
}
