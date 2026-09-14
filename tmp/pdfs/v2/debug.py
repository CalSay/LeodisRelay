from pathlib import Path
p=Path('designs/report-template-v2/src/ReportDocument.tsx');s=p.read_text(encoding='utf-8');s='import { writeFileSync } from "node:fs";\n'+s;s=s.replace('<Document title=','<Document onRender={(data) => writeFileSync("tmp/pdfs/v2/layout.json", JSON.stringify(data))} title=');p.write_text(s,encoding='utf-8')
