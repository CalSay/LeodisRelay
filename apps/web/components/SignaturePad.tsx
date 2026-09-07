"use client";

import { useEffect, useRef, useState } from "react";

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
 */
type Stroke = { x: number; y: number }[];

export function SignaturePad({
  name,
  onNameChange,
  onChange,
}: {
  name: string;
  onNameChange: (next: string) => void;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

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

    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    // Read from the theme so the ink is visible in both light and dark.
    context.strokeStyle =
      getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#000";

    for (const stroke of strokes.current) {
      if (stroke.length === 0) continue;
      context.beginPath();
      context.moveTo(stroke[0]!.x, stroke[0]!.y);
      for (const point of stroke.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }
  }

  useEffect(() => {
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
    if (!strokes.current.length) { onChange(null); return; }
    // Display follows the theme; the PDF always needs dark ink on white paper.
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width; exportCanvas.height = canvas.height;
    const context = exportCanvas.getContext('2d');
    if (!context) return;
    const box = canvas.getBoundingClientRect();
    context.scale(canvas.width/box.width,canvas.height/box.height);
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
      <label htmlFor="sign-name">Your name</label>
      <input
        id="sign-name"
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Name as it should appear on the report"
      />

      <label style={{ marginTop: 16 }}>Signature</label>
      <div className="sigwrap">
        <canvas
          ref={canvasRef}
          className="sigpad"
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
        {!hasInk && <span className="sighint">Sign here</span>}
      </div>

      <div className="btn-row" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn-quiet btn-sm"
          onClick={() => {
            strokes.current = [];
            setHasInk(false);
            paint();
            onChange(null);
          }}
        >
          Clear
        </button>
      </div>

      <p className="hint">
        Your name appears on the report whether or not you sign. The client signs the paper copy.
      </p>
    </div>
  );
}
