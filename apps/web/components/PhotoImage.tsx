"use client";
import { useEffect, useState } from 'react';
import { localPreview } from '@/lib/localMedia';
import { mediaId } from '@/lib/media';

export function PhotoImage({ src, alt }: { src: string; alt: string }) {
  const [local, setLocal] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    setLocal(undefined);
    const id = mediaId(src);
    if (id) void localPreview(id).then(blob => {
      if (blob && !cancelled) { objectUrl = URL.createObjectURL(blob); setLocal(objectUrl); }
    }).catch(() => undefined);
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  return <img src={local ?? (mediaId(src) ? `${src}?variant=thumb` : src)} alt={alt} loading="lazy" decoding="async" />;
}
