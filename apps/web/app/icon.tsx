import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#23262A",
        color: "#F2F3F1",
        border: "28px solid #9A7B2F",
        fontSize: 220,
        fontWeight: 700,
        fontFamily: "Arial, sans-serif",
      }}
    >
      LR
    </div>,
    size,
  );
}
