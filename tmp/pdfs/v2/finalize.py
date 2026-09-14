from pathlib import Path
p=Path('designs/report-template-v2/src/ReportDocument.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('import { writeFileSync } from "node:fs";\n','')
a=s.index('<Document onRender=');b=s.index(' title=',a);s=s[:a]+'<Document'+s[b:]
s=s.replace('<View wrap={false}>\n        <View style={s.h2Row}>','<View wrap={false}>\n        <View style={[s.h2Row, { marginTop: 8, marginBottom: 5 }]}>')
s=s.replace('signRow: { flexDirection: "row", marginTop: 8 }','signRow: { flexDirection: "row", marginTop: 4 }')
s=s.replace('marginBottom: 8,\n  },\n  signLabel','marginBottom: 4,\n  },\n  signLabel')
p.write_text(s,encoding='utf-8')
p=Path('designs/report-template-v2/render-examples.mjs');s=p.read_text(encoding='utf-8');s=s.replace("for (const [name,report]", "long.observations = long.observations.slice(0,5);\nfor (const [name,report]");p.write_text(s,encoding='utf-8')
