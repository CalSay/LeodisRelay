import { ImageResponse } from 'next/og';
export const size={width:180,height:180};
export const contentType='image/png';
export default function AppleIcon() {
  return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',alignItems:'center',justifyContent:'center',background:'#23262A',color:'#F2F3F1',border:'10px solid #9A7B2F',fontSize:76,fontWeight:700}}>LR</div>,size);
}
