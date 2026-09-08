import type { Photo } from './types';
export const DEFECT_TRADES = ['Electrical','HVAC','P&H','Other / non-Leodis'] as const;
export interface DefectInput {
  requestId:string; projectId:string; description:string; location:string;
  affectedTrade: typeof DEFECT_TRADES[number]; photos:Photo[];
}
export const DEFECT_BODY_LIMIT = 42 * 1024 * 1024;
export function validateDefect(value:unknown): string | null {
  if(!value || typeof value !== 'object')return 'Invalid defect.';
  const d=value as DefectInput;
  if(typeof d.requestId!=='string'|| !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(d.requestId))return 'Invalid submission ID.';
  if(typeof d.projectId!=='string'||!d.projectId||d.projectId.length>100)return 'Choose a project.';
  if(typeof d.description!=='string'||!d.description.trim()||d.description.length>4000)return 'Describe the defect in 1–4,000 characters.';
  if(typeof d.location!=='string'||!d.location.trim()||d.location.length>300)return 'Add a location in 1–300 characters.';
  if(!DEFECT_TRADES.includes(d.affectedTrade))return 'Choose the trade affected.';
  if(!Array.isArray(d.photos)||d.photos.length<1||d.photos.length>8)return 'Add between 1 and 8 photographs.';
  const ids=new Set<string>();
  for(const p of d.photos){
    if(!p||typeof p.id!=='string'||!/^[a-f0-9-]{36}$/.test(p.id)||ids.has(p.id)||p.dataUrl!==`/api/media/${p.id}`||typeof p.caption!=='string'||p.caption.length>1000||typeof p.capturedAt!=='string'||!Number.isFinite(Date.parse(p.capturedAt)))return 'Invalid photograph details.';
    ids.add(p.id);
  }
  return null;
}
