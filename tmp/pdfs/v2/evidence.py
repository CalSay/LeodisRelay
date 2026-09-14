from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
f='C:/Windows/Fonts/arial.ttf'
for i in range(1,4):
 im=Image.new('RGB',(1200,680),'#f2f1ec');d=ImageDraw.Draw(im)
 d.rectangle((28,28,1172,652),outline='#d0cec4',width=2)
 d.line((55,600,1145,80),fill='#e2e0d7',width=2);d.line((55,80,1145,600),fill='#e2e0d7',width=2)
 d.rectangle((330,265,870,410),fill='#f2f1ec')
 d.text((600,310),f'PHOTOGRAPH {i:02}',font=ImageFont.truetype(f,32),fill='#8a6d1f',anchor='mm')
 d.text((600,365),'Illustrative image slot',font=ImageFont.truetype(f,24),fill='#66665f',anchor='mm')
 im.save(f'designs/report-template-v2/rendered/evidence-{i}.png')
