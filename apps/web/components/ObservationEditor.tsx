"use client";

import { useRef, useState } from "react";
import { PhotoImage } from './PhotoImage';
import { readPhoto, type Observation, type Photo } from "@/lib/api";
import type { Issue } from "@/lib/types";
import { FIXTURE_LOCATIONS, OBSERVATION_TYPES, type ObservationType } from "@/lib/fixtures";

/**
 * One observation.
 *
 * Two rules from proposal section 5 shape this. Progressive detail: an ordinary
 * progress update asks for very little, and only a defect or an access
 * restriction reveals what needs doing and who must respond — showing every
 * field for every observation is how capture becomes slower than the paper it
 * replaces. And field wording rather than report wording: "What happened", not
 * "Observation narrative". The formal labels belong on the document.
 */
export function ObservationEditor({
  observation,
  index,
  openIssues,
  onChange,
  onRemove,
}: {
  observation: Observation;
  index: number;
  openIssues: Issue[];
  onChange: (next: Observation) => void;
  onRemove: () => void;
}) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Observation>(key: K, value: Observation[K]) =>
    onChange({ ...observation, [key]: value });

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotoError(null);
    try {
      const added: Photo[] = [];
      for (const file of Array.from(files)) added.push(await readPhoto(file));
      onChange({ ...observation, photos: [...observation.photos, ...added] });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "That photograph could not be added.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const type = OBSERVATION_TYPES.find((t) => t.value === observation.type);
  const tone = `tone-${type?.tone ?? "neutral"}`;
  const needsAction = observation.type === "defect" || observation.type === "access";

  return (
    <section className={`panel panel-toned ${tone}`}>
      <div className="panel-head">
        <span className="lbl">Update {String(index + 1).padStart(2, "0")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {type && <span className={`kind ${tone}`}>{type.label}</span>}
          <button className="btn-quiet btn-sm" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>

      <div className="panel-body">
        <div className="field">
          <label htmlFor={`type-${observation.id}`}>Kind of update</label>
          <select
            id={`type-${observation.id}`}
            value={observation.type}
            onChange={(e) => set("type", e.target.value as ObservationType)}
          >
            {observation.type === 'defect' && <option value="defect" disabled>Defect (existing section)</option>}
            {OBSERVATION_TYPES.filter(option => option.value !== 'defect').map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {type && <p className="hint">{type.hint}</p>}
        </div>

        <div className="field">
          <label htmlFor={`loc-${observation.id}`}>Where</label>
          <input
            id={`loc-${observation.id}`}
            type="text"
            list={`locations-${observation.id}`}
            value={observation.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Level 2 — Riser"
          />
          <datalist id={`locations-${observation.id}`}>
            {FIXTURE_LOCATIONS.map((location) => (
              <option key={location} value={location} />
            ))}
          </datalist>
        </div>

        {/*
          The same real defect seen again is one issue with a history, not a
          second issue saying the same thing. Existing issues are offered before
          the description is written, because that is the moment someone would
          otherwise retype what is already recorded.
        */}
        {needsAction && openIssues.length > 0 && (
          <div className="field">
            <label htmlFor={`link-${observation.id}`}>Is this something already raised?</label>
            <select
              id={`link-${observation.id}`}
              value={observation.linkedIssueId ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "") {
                  const { linkedIssueId: _drop, ...rest } = observation;
                  onChange(rest as Observation);
                } else {
                  onChange({ ...observation, linkedIssueId: value });
                }
              }}
            >
              <option value="">No — this is new</option>
              {openIssues.map((issue) => (
                <option key={issue.id} value={issue.id}>
                  {issue.reference} · {issue.location || "no location"}
                </option>
              ))}
            </select>
            <p className="hint">
              {observation.linkedIssueId
                ? "This will be added to that issue's history rather than raising a new one."
                : "Linking avoids raising a second issue for the same defect."}
            </p>
          </div>
        )}

        <div className="field">
          <label htmlFor={`what-${observation.id}`}>What happened</label>
          <textarea
            id={`what-${observation.id}`}
            value={observation.whatHappened}
            onChange={(e) => set("whatHappened", e.target.value)}
            placeholder="Describe what you saw or did"
          />
        </div>

        {/* Revealed only where the type calls for it. */}
        {needsAction && (
          <>
            <div className="field">
              <label htmlFor={`action-${observation.id}`}>What needs doing</label>
              <textarea
                id={`action-${observation.id}`}
                value={observation.actionNeeded}
                onChange={(e) => set("actionNeeded", e.target.value)}
                placeholder="What has to happen to put this right"
              />
            </div>

            <div className="field">
              <label htmlFor={`owner-${observation.id}`}>Who needs to respond</label>
              <input
                id={`owner-${observation.id}`}
                type="text"
                value={observation.owner}
                onChange={(e) => set("owner", e.target.value)}
                placeholder="Name or company"
              />
              <p className="hint">
                Leave blank if you do not know — it is flagged for the office rather than guessed.
              </p>
            </div>
          </>
        )}

        <div className="field">
          <label>
            Photographs
            {observation.photos.length > 0 ? ` · ${observation.photos.length}` : ""}
          </label>
          <label className="camera">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              multiple
              onChange={(e) => addPhotos(e.target.files)}
            />
            Take photograph
          </label>

          {photoError && (
            <div className="note note-bad" style={{ marginTop: 12 }}>
              {photoError}
            </div>
          )}

          {observation.photos.length > 0 && (
            <div className="shots">
              {observation.photos.map((photo, i) => (
                <figure key={photo.id} className="shot" style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <PhotoImage src={photo.dataUrl} alt={photo.caption || `Photograph ${i + 1}`} />
                  <div className="shot-body">
                    <span className="shot-no">Photo {String(i + 1).padStart(2, "0")}</span>
                    <input
                      type="text"
                      value={photo.caption}
                      onChange={(e) =>
                        onChange({
                          ...observation,
                          photos: observation.photos.map((p) =>
                            p.id === photo.id ? { ...p, caption: e.target.value } : p,
                          ),
                        })
                      }
                      placeholder="What does this show?"
                      aria-label={`Caption for photograph ${i + 1}`}
                    />
                    <button
                      className="btn-quiet btn-sm"
                      onClick={() =>
                        onChange({
                          ...observation,
                          photos: observation.photos.filter((p) => p.id !== photo.id),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
