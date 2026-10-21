"use client";

import { useEffect, useRef, useState } from "react";
import { TYPED_STATEMENT } from "@/lib/signature";

/**
 * Drawn signature, captured at the point of sending.
 *
 * Pointer events rather than touch or mouse events specifically, so a finger, a
 * stylus and a mouse all work through one path — an engineer signs with a
 * finger, the office might not.
 *
 * The canvas is sized to its rendered box and scaled for the device pixel
 * ratio, or the stroke lands away from the fingertip on a phone. The strokes
 * are kept and replayed on resize, because a signature that vanishes when the
 * keyboard closes is worse than no signature field.
 *
 * A signature saved with the draft comes back as an image, not strokes. It is
 * drawn under any new strokes, recoloured to the theme's ink on screen, and
 * kept in the exported image, so reopening a draft shows what was signed.
 *
 * Where a signature is required (an inspection), someone who cannot draw one,
 * with a keyboard or a screen reader say, may sign by typing their full name
 * and ticking a statement instead (lib/signature.ts). One way at a time:
 * choosing the other way clears what was there.
 */
type Stroke = { x: number; y: number }[];

export function SignaturePad({
  name,
  initialImage,
  onNameChange,
  onChange,
  typed = false,
  onTypedChange,
  hint = "You do not have to sign a site update: your name is printed on it either way.",
}: {
  name: string;
  /** Signed by typing the name and ticking the statement. */
  typed?: boolean;
  /** Given, the pad offers to sign by typing the name instead of drawing. */
  onTypedChange?: (typed: boolean) => void;
  /** What signing means for this kind of report, under the pad. */
  hint?: string;
  /** A signature saved earlier. Read once, when the pad first appears. */
  initialImage?: string | null;
  onNameChange: (next: string) => void;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef(false);
  const saved = useRef<HTMLImageElement | null>(null);
  /** Cleared before the saved image finished loading: it must not come back. */
  const cleared = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(initialImage));
  const [mode, setMode] = useState<'draw' | 'type'>(typed && onTypedChange ? 'type' : 'draw');
  // A typed signature that arrives later (a reload, another tab's version) shows as typed.
  useEffect(() => { if (typed && onTypedChange) setMode('type'); }, [typed]);
  const typing = mode === 'type' && Boolean(onTypedChange);

  function clearDrawing() {
    strokes.current = [];
    saved.current = null;
    cleared.current = true;
    setHasInk(false);
    paint();
  }

  function choose(next: 'draw' | 'type') {
    if (next === mode) return;
    setMode(next);
    // The other way's signature goes: a drawing is not kept behind a typed name, nor a tick behind a drawing.
    if (next === 'type') { clearDrawing(); onChange(null); }
    else { onTypedChange?.(false); requestAnimationFrame(paint); }
  }

  /** Fit the saved image inside the box without stretching it. */
  function placeSaved(image: HTMLImageElement, width: number, height: number) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight) || 1;
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    return { x: (width - w) / 2, y: (height - h) / 2, w, h };
  }

  function paint() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const ratio = window.devicePixelRatio || 1;
    const box = canvas.getBoundingClientRect();
    if (canvas.width !== box.width * ratio || canvas.height !== box.height * ratio) {
      canvas.width = box.width * ratio;
      canvas.height = box.height * ratio;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, box.width, box.height);

    // Read from the theme so the ink is visible in both light and dark.
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#000";
    const image = saved.current;
    if (image && box.width && box.height) {
      // The saved image has dark ink for the PDF. Tint it on a scratch canvas
      // so it reads in dark mode too.
      const tint = document.createElement("canvas");
      tint.width = canvas.width; tint.height = canvas.height;
      const tc = tint.getContext("2d");
      if (tc) {
        const at = placeSaved(image, box.width, box.height);
        tc.setTransform(ratio, 0, 0, ratio, 0, 0);
        tc.drawImage(image, at.x, at.y, at.w, at.h);
        tc.globalCompositeOperation = "source-in";
        tc.fillStyle = ink;
        tc.fillRect(0, 0, box.width, box.height);
        context.drawImage(tint, 0, 0, box.width, box.height);
      }
    }

    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = ink;

    for (const stroke of strokes.current) {
      if (stroke.length === 0) continue;
      context.beginPath();
      context.moveTo(stroke[0]!.x, stroke[0]!.y);
      for (const point of stroke.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }
  }

  useEffect(() => {
    if (initialImage) {
      const image = new Image();
      image.onload = () => {
        if (cleared.current) return;
        saved.current = image;
        paint();
      };
      image.src = initialImage;
    }
    paint();
    const observer = new ResizeObserver(paint);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function emit() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!strokes.current.length && !saved.current) { onChange(null); return; }
    // Display follows the theme; the PDF always needs dark ink on white paper.
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width; exportCanvas.height = canvas.height;
    const context = exportCanvas.getContext('2d');
    if (!context) return;
    const box = canvas.getBoundingClientRect();
    context.scale(canvas.width/box.width,canvas.height/box.height);
    if (saved.current) {
      const at = placeSaved(saved.current, box.width, box.height);
      context.drawImage(saved.current, at.x, at.y, at.w, at.h);
    }
    context.strokeStyle='#111111'; context.lineWidth=2; context.lineCap='round'; context.lineJoin='round';
    for (const stroke of strokes.current) {
      if (!stroke.length) continue;
      context.beginPath(); context.moveTo(stroke[0]!.x,stroke[0]!.y);
      for (const point of stroke.slice(1)) context.lineTo(point.x,point.y);
      context.stroke();
    }
    onChange(exportCanvas.toDataURL('image/png'));
  }

  return (
    <div className="field">
      <label htmlFor="sign-name">{typing ? 'Your full name' : 'Your name'}</label>
      <input
        id="sign-name"
        type="text"
        autoComplete="name"
        maxLength={200}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Name as it should appear on the report"
      />

      {onTypedChange && <fieldset className="sigway">
        <legend>How will you sign?</legend>
        <div className="sigway-options">
          <label><input type="radio" name="sign-way" value="draw" checked={!typing} onChange={() => choose('draw')} /> Draw my signature</label>
          <label><input type="radio" name="sign-way" value="type" checked={typing} onChange={() => choose('type')} /> Type my name instead</label>
        </div>
      </fieldset>}

      {typing && <div className="sigtyped">
        <label className="sigconfirm">
          <input
            type="checkbox"
            checked={typed}
            onChange={(e) => onTypedChange?.(e.target.checked)}
            aria-describedby="sign-typed-note"
          />
          <span>{TYPED_STATEMENT}</span>
        </label>
        {typed && name.trim() && <p className="sigtyped-name" aria-hidden="true">{name.trim()}</p>}
        <p className="hint" id="sign-typed-note">For anyone who can’t draw a signature, with a keyboard or screen reader say. The office and the PDF show it as a typed signature, with this statement, the time it is sent and who was signed in.</p>
        <span className="eng-sr" role="status">{typed ? (name.trim() ? `Signed by typing the name ${name.trim()}.` : 'Ticked, but type your full name to sign.') : 'Not signed yet: type your full name and tick the box.'}</span>
      </div>}

      <div hidden={typing}>
      <label id="sign-pad-label" className="lbl sigpad-label">Signature</label>
      <div className="sigwrap">
        <canvas
          ref={canvasRef}
          className="sigpad"
          role="img"
          aria-labelledby="sign-pad-label"
          aria-describedby="sign-pad-state"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            strokes.current.push([pointFrom(e)]);
            setHasInk(true);
            paint();
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            strokes.current[strokes.current.length - 1]?.push(pointFrom(e));
            paint();
          }}
          onPointerUp={() => {
            drawing.current = false;
            emit();
          }}
          onPointerLeave={() => {
            if (!drawing.current) return;
            drawing.current = false;
            emit();
          }}
        />
        {!hasInk && <span className="sighint" aria-hidden="true">Sign here</span>}
        {/* The drawing said in words, for a screen reader. */}
        <span id="sign-pad-state" className="eng-sr">{hasInk ? 'Signed: a signature is drawn.' : 'Not signed yet: draw your signature in the box with a finger, pen or mouse.'}</span>
      </div>

      <div className="btn-row" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn-quiet btn-sm"
          aria-label="Clear signature"
          onClick={() => {
            clearDrawing();
            onChange(null);
          }}
        >
          Clear
        </button>
      </div>
      </div>

      <p className="hint">{hint}</p>
    </div>
  );
}
