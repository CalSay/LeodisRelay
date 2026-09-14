from pathlib import Path
p=Path('designs/report-template-v2/src/ReportDocument.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('fontSize: 10,\n    lineHeight: 1.4','fontSize: 9.5,\n    lineHeight: 1.4').replace('marginTop: 17,','marginTop: 12,').replace('paddingVertical: 4, borderBottomWidth: 0.5','paddingVertical: 3, borderBottomWidth: 0.5')
s=s.replace('<View style={s.h2Row} wrap={false} minPresenceAhead={80}>','<View wrap={false}>\n        <View style={s.h2Row}>')
s=s.replace('        {/* The footer is stamped','        </View>\n\n        {/* The footer is stamped')
s=s.replace('height: 192','height: 160').replace('height: 126','height: 115')
# Prevent a whole multi-image observation exceeding the page; allow evidence to flow.
s=s.replace('wrap={(observation.whatHappened.length + observation.actionNeeded.length) > 1800}','wrap={(observation.whatHappened.length + observation.actionNeeded.length) > 1800 || observation.photos.length > 2}')
p.write_text(s,encoding='utf-8')
