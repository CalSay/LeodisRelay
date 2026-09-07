"use client";

import { useRef, useState } from "react";
import { readPhoto, type Observation, type Photo } from "@/lib/testBackend";
import { FIXTURE_LOCATIONS, OBSERVATION_TYPES, type ObservationType } from "@/lib/fixtures";

/**
 * One observation.
 *
 * Two design rules from proposal section 5 are load-bearing here.
 *
 * Progressive detail: an ordinary progress update asks for very little. Only
 * a defect asks for a photograph and an owner, because only a defect needs
 * them. Showing every field for every observation is how capture becomes
 * slower than the paper it replaces.
 *
 * Field wording, not report wording: the prompts are "What happened" and
 * "What needs doing" rather than "Observation narrative" and "Remedial
 * action". The formal labels belong on the PDF.
 */
export function ObservationEditor({
  observation,
  index,
  onChange,
  onRemove,
}: {
  observation: Observation;
  index: number;
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
      for (const file of Array.from(files)) {
        added.push(await readPhoto(file));
      }
      onChange({ ...observation, photos: [...observation.photos, ...added] });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "That photograph could not be added.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function updateCaption(photoId: string, caption: string) {
    onChange({
      ...observation,
      photos: observation.photos.map((p) => (p.id === photoId ? { ...p, caption } : p)),
    });
  }

  function removePhoto(photoId: string) {
    onChange({ ...observation, photos: observation.photos.filter((p) => p.id !== photoId) });
  }

  const type = OBSERVATION_TYPES.find((t) => t.value === observation.type);
  const needsAction = observation.type === "defect" || observation.type === "access";

  return (
    <div className="card" style={{ cursor: "default" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span className="photo-num">Observation {index + 1}</span>
        <button className="btn-danger" onClick={onRemove} style={{ minHeight: 36, padding: "6px 12px" }}>
          Remove
        </button>
      </div>

      <div className="field">
        <label htmlFor={`type-${observation.id}`}>What kind of thing is this?</label>
        <select
          id={`type-${observation.id}`}
          value={observation.type}
          onChange={(e) => set("type", e.target.value as ObservationType)}
        >
          {OBSERVATION_TYPES.map((option) => (
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
          placeholder="Level 2 - Riser"
        />
        <datalist id={`locations-${observation.id}`}>
          {FIXTURE_LOCATIONS.map((location) => (
            <option key={location} value={location} />
          ))}
        </datalist>
      </div>

      <div className="field">
        <label htmlFor={`what-${observation.id}`}>What happened</label>
        <textarea
          id={`what-${observation.id}`}
          value={observation.whatHappened}
          onChange={(e) => set("whatHappened", e.target.value)}
          placeholder="Describe what you saw or did"
        />
      </div>

      {/* Progressive detail: only revealed where the type calls for it. */}
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
              Leave blank if you do not know. It will be flagged for the office rather than
              guessed.
            </p>
          </div>
        </>
      )}

      <label>Photographs</label>
      <label className="camera">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => addPhotos(e.target.files)}
        />
        Take or add a photograph
      </label>

      {photoError && (
        <div className="notice notice-error" style={{ marginTop: 10 }}>
          {photoError}
        </div>
      )}

      {observation.photos.length > 0 && (
        <div className="photo-grid">
          {observation.photos.map((photo, photoIndex) => (
            <div key={photo.id} className="photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.dataUrl} alt={photo.caption || `Photograph ${photoIndex + 1}`} />
              <div className="photo-body">
                <span className="photo-num">Photo {photoIndex + 1}</span>
                <input
                  type="text"
                  value={photo.caption}
                  onChange={(e) => updateCaption(photo.id, e.target.value)}
                  placeholder="What does this show?"
                  aria-label={`Caption for photograph ${photoIndex + 1}`}
                />
                <button
                  className="btn-danger"
                  onClick={() => removePhoto(photo.id)}
                  style={{ minHeight: 36, padding: "6px 12px" }}
                >
                  Remove photo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
