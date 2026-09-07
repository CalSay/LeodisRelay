import { ImageResponse } from 'next/og';
export const dynamic='force-static';
export function GET() {
  return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',alignItems:'center',justifyContent:'center',background:'#23262A',color:'#F2F3F1',border:'10px solid #9A7B2F',fontSize:82,fontWeight:700}}>LR</div>,{width:192,height:192});
}
