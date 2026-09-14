from pypdf import PdfReader
from pathlib import Path
import json,re
norm=lambda s:re.sub(r'\s+','',s)
for name,expected in [('short',1),('extended',3)]:
 r=PdfReader(f'output/pdf/leodis-report-v2-{name}.pdf'); data=json.loads(Path(f'designs/report-template-v2/rendered/{name}.json').read_text())
 content=norm(''.join(p.extract_text() for p in r.pages))
 assert len(r.pages)==expected
 for o in data['observations']:
  for key in ['location','whatHappened','actionNeeded']:
   assert norm(o[key]) in content,(name,o['id'],key)
 assert content.count('SIGNOFF')==1
 for i,p in enumerate(r.pages):assert f'Page{i+1}of{expected}' in norm(p.extract_text())
 print(name+': page count, all update text, all actions, sign-off and page numbering verified')
