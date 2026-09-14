from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import simpleSplit
from pathlib import Path
OUT=Path('output/pdf/leodis-site-progress-template.pdf')
W,H=595.276,841.89
c=canvas.Canvas(str(OUT),pagesize=(W,H)); c.setTitle('Leodis Site Progress Report Template'); c.setAuthor('Leodis Developments Ltd')
ink=HexColor('#172C35'); teal=HexColor('#006C70'); grey=HexColor('#63757A'); line=HexColor('#D8E1E1'); pale=HexColor('#F3F7F7')
def text(x,y,s,size=10,color=ink,font='Helvetica'):
 c.setFillColor(color);c.setFont(font,size);c.drawString(x,H-y,s)
def rule(y):
 c.setStrokeColor(line);c.setLineWidth(.6);c.line(42,H-y,W-42,H-y)
def label(x,y,s):text(x,y,s.upper(),8,grey,'Helvetica-Bold')
def field(name,x,y,w,h=25,value='',multi=False):
 c.acroForm.textfield(name=name,tooltip=name.replace('_',' '),x=x,y=H-y-h,width=w,height=h,value=value,fontName='Helvetica',fontSize=10,textColor=ink,borderWidth=.5,borderColor=line,fillColor=pale,forceBorder=True,fieldFlags='multiline' if multi else '')
def head(n,section):
 c.setFillColor(teal);c.rect(0,H-7,W,7,fill=1,stroke=0)
 text(42,42,'LEODIS',20,ink,'Helvetica-Bold');text(137,42,'DEVELOPMENTS LTD',8,grey)
 text(42,71,'SITE PROGRESS REPORT',9,teal,'Helvetica-Bold');text(405,42,'REPORT TEMPLATE',8,grey)
 rule(771);text(42,790,'LEODIS  /  SITE PROGRESS',8,grey);text(310,790,section.upper(),8,grey);text(510,790,f'{n} / 3',8,grey)
def heading(y,n,s,sub=None):
 text(42,y,n,11,teal,'Helvetica-Bold');text(69,y,s,17,ink,'Helvetica-Bold')
 if sub:text(69,y+20,sub,9,grey)
def block(name,x,y,w,h,title):label(x,y,title);field(name,x,y+9,w,h,multi=h>=39)
head(1,'Overview')
text(42,115,'Site progress',34,ink,'Helvetica-Bold')
text(42,147,'The position on site and what needs to happen next',11,grey)
block('project_site',42,185,511,30,'Project and site')
block('client',42,243,247,25,'Client');block('project_number',306,243,247,25,'Project number')
block('report_reference',42,296,247,25,'Report reference');block('visit_date',306,296,118,25,'Visit date');block('revision',437,296,116,25,'Revision')
block('prepared_by',42,349,247,25,'Prepared by and role');block('issue_status',306,349,247,25,'Issue status')
heading(420,'01','At a glance')
block('overall_position',42,450,511,53,'Overall position and change since the previous visit')
block('decision_needed',42,537,511,47,'Most important action or decision and required date')
block('next_milestone',42,618,247,43,'Next milestone and target date');block('next_visit',306,618,247,43,'Next visit and planned focus')
text(42,715,'READING THIS REPORT',8,teal,'Helvetica-Bold')
text(42,733,'02  Actions and decisions     /     03  Update record and photographic evidence',9,grey)
c.showPage()
head(2,'Actions')
text(42,115,'Actions and decisions',28,ink,'Helvetica-Bold')
text(42,142,'A named owner and a due date for every open item',11,grey)
heading(189,'02','Action register')
text(42,211,'Use the same item reference on the update record and any supporting evidence.',9,grey)
for i,y in enumerate([244,385,526],1):
 text(42,y,f'{i:02}',17,teal,'Helvetica-Bold')
 block(f'action_{i}_ref',82,y-6, eighty:=80,23,'Item ref')
 block(f'action_{i}_status',177,y-6,174,23,'Status')
 block(f'action_{i}_due',367,y-6,186,23,'Due date')
 block(f'action_{i}_description',82,y+45,269, forty:=42,'Action or decision required')
 block(f'action_{i}_owner',367,y+45,186,42,'Owner and company')
 rule(y+116)
text(42,679,'STATUS KEY',8,teal,'Helvetica-Bold')
text(42,698,'Open  /  In progress  /  Awaiting decision  /  Closed',10,ink)
text(42,725,'Record closure evidence and the closure date against the relevant update.',9,grey)
c.showPage()
head(3,'Update record')
text(42,115,'Site update record',28,ink,'Helvetica-Bold')
text(42,141,'Repeat this page for each finding or progress update',11,grey)
block('update_ref',42,178,87,24,'Item ref');block('update_location',144,178,245,24,'Location and work package');block('update_category',405,178,148,24,'Category')
block('update_title',42,229,511,27,'Update title')
block('observation',42,285,511,48,'Observation and effect on the works')
# Photo placeholder remains a simple replaceable area in this design master.
label(42,363,'Photographic evidence')
c.setFillColor(pale);c.setStrokeColor(line);c.rect(42,H-509,511,135,fill=1,stroke=1)
text(190,430,'PLACE SITE PHOTOGRAPH HERE',10,grey,'Helvetica-Bold')
text(156,452,'Use an annotated image where the location is not obvious.',9,grey)
block('photo_caption',42,533,511,25,'Photo reference and date and description')
block('update_action',42,585,511,39,'Required action and closure evidence')
block('recorded_by',42,655,247,25,'Recorded by and date');block('received_by',306,655,247,25,'Received on site by and date')
text(42,713,'Receipt records that this update has been shared; it does not imply approval.',9,grey)
text(42,737,'Report ref',8,grey);field('continued_report_reference',94,721,240,23)
c.save()
# Confirm PDF field structure and values persist.
from pypdf import PdfReader
r=PdfReader(str(OUT)); print('Pages:',len(r.pages),'Editable fields:',len(r.get_fields()))
assert len(r.pages)==3 and len(r.get_fields())==37

