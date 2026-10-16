import { useRef, useState } from "react";
import { normalizeTag } from "../lib/format";
import { ExportError, parseExport } from "../lib/parseExport";

interface Props {
  /** The village being updated, if any; its tag is pre-filled. */
  currentTag?: string | null;
  onSave: (tag: string, exportText: string) => void;
  onCancel?: () => void;
}

export function ImportPanel({ currentTag, onSave, onCancel }: Props) {
  const [tag, setTag] = useState(currentTag ?? "");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(rawText = text, rawTag = tag) {
    setError(null);
    try {
      const village = parseExport(rawText);
      const typed = normalizeTag(rawTag);
      const fromExport = village.tag ? normalizeTag(village.tag) : "";
      if (typed && fromExport && typed !== fromExport) {
        setError(`This export belongs to ${fromExport}, not ${typed}.`);
        return;
      }
      const finalTag = typed || fromExport;
      if (!finalTag) {
        setError("This export has no player tag — enter yours (Profile → under your name, e.g. #2PP).");
        return;
      }
      onSave(finalTag, rawText);
    } catch (e) {
      setError(e instanceof ExportError ? e.message : String(e));
    }
  }

  async function onFile(file: File) {
    const content = await file.text();
    setText(content);
    submit(content);
  }

  async function loadSample() {
    const res = await fetch(`${import.meta.env.BASE_URL}sample-export.json`);
    submit(await res.text(), "");
  }

  return (
    <section className={`card import ${onCancel ? "" : "import-hero"}`}>
      <div className="import-head">
        <div>
          <h2>{currentTag ? `Update ${currentTag}` : onCancel ? "Add a village" : "Plan your Town Hall upgrades"}</h2>
          {!onCancel && (
            <p className="lead">
              See how long every building and hero needs to max, and which upgrades to start next so your builders all
              finish together.
            </p>
          )}
        </div>
        {onCancel && (
          <button className="ghost icon-btn" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        )}
      </div>

      <ol className="howto">
        <li>
          <span className="num-dot">1</span>
          <div>
            In Clash of Clans open <b>Settings → More Settings</b> and tap <b>Data Export</b> → <b>Copy</b>.
          </div>
        </li>
        <li>
          <span className="num-dot">2</span>
          <div>Paste it below, or drop / upload a saved .json file.</div>
        </li>
      </ol>

      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder='Paste your village export here…   {"tag":"#…","buildings":[…]}'
          aria-label="Village export JSON"
        />
        <div className="dropzone-foot">
          <span className="muted">or</span>
          <button className="ghost" onClick={() => fileRef.current?.click()}>
            📁 Upload .json
          </button>
          <span className="muted drop-hint">or drop a file here</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,application/json"
          hidden
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>

      <div className="import-foot">
        <label className="field tag-field">
          <span>Player tag <i className="muted">(optional — read from the export)</i></span>
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="#2PP0JCLR" />
        </label>
        <div className="import-actions">
          {!currentTag && (
            <button className="ghost" onClick={loadSample}>
              Try a sample village
            </button>
          )}
          <button className="primary" disabled={!text.trim()} onClick={() => submit()}>
            {currentTag ? "Update plan" : "Build my plan →"}
          </button>
        </div>
      </div>
      {error && <p className="error-msg">⚠️ {error}</p>}
    </section>
  );
}
