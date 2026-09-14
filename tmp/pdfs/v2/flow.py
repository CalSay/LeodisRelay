from pathlib import Path
p=Path('designs/report-template-v2/src/ReportDocument.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('obs: { flexDirection: "row",','obs: {')
s=s.replace('<View key={observation.id} style={s.obs} wrap={(observation.whatHappened.length + observation.actionNeeded.length) > 1800 || observation.photos.length > 2}>','<View key={observation.id} style={s.obs}>\n              <View style={{ flexDirection: "row" }} wrap={(observation.whatHappened.length + observation.actionNeeded.length) > 1800}>')
s=s.replace('                {observation.photos.length > 0 ? (','              </View>\n              </View>\n                {observation.photos.length > 0 ? (')
s=s.replace('<View style={s.figs}>','<View style={[s.figs, { marginLeft: 37 }]}>')
s=s.replace('PHOTOGRAPH {String(figureNumber).padStart(2, "0")}','UPDATE {String(index + 1).padStart(2, "0")} / PHOTOGRAPH {String(figureNumber).padStart(2, "0")}')
s=s.replace('                ) : null}\n              </View>\n            </View>','                ) : null}\n            </View>')
p.write_text(s,encoding='utf-8')
