// A realistic large data set for timing RELAY on busy projects: every
// reportable project with more than a year of weekday site updates from three
// trades, weekly safety and tower inspections, first fix and handover
// inspections, corrections, drafts, a few thousand issues with histories,
// variations, notes for the next visit and chase notes. Records are written
// straight into the local store, as the other browser checks do.
//
// Used by scripts/verify-busy-projects.mjs. On its own, after `npm test`:
//   RELAY_DATA_ROOT=<dir> node scripts/seed-busy-projects.mjs
// Deterministic: the same scale and day give the same records.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);

/** The people the records belong to. `engineer` and `manager` are the ones the checks sign in as. */
export const PEOPLE={
  engineer:{id:'entra:busy-engineer',oid:'busy-engineer',name:'Sam Spark',email:'sam@example.test',role:'Engineer',trade:'Electrical'},
  hvac:{id:'entra:busy-hvac',oid:'busy-hvac',name:'Hana Duct',email:'hana@example.test',role:'Engineer',trade:'HVAC'},
  plumber:{id:'entra:busy-plumber',oid:'busy-plumber',name:'Pat Pipe',email:'pat@example.test',role:'Engineer',trade:'P&H'},
  manager:{id:'entra:busy-manager',oid:'busy-manager',name:'Office Manager',email:'office@example.test',role:'Manager'},
};

const PROJECTS=[['proj-011lme','011LME'],['proj-014lme','014LME'],['proj-009lcp','009LCP']];
const LOCATIONS=['Level 1 east corridor','Level 2 west corridor','Level 3 riser 2','Plant room','Roof plant area','Basement car park','Flat 204 kitchen','Flat 311 bathroom','Stair core B','Ground floor lobby','Level 4 corridor','Bin store','Switch room','Level 5 flat 502','Podium deck'];
const OWNERS=['Sparks Ltd','Northern Ducting','AquaFlow Plumbing','Leeds Drylining','Apex Ceilings','Main contractor','Riser Fire Stopping','Kirk Joinery','Brightline Electrical','Cold Air Services'];
const PHRASES=['Containment installed and fixed at 1.2 m centres along the full run, ready for cable pull next visit','First fix complete in the two flats, boxes set to the drylining line and photographed before boarding','Ductwork hangers fitted, insulation to follow once the pressure test is signed off by the mechanical lead','Pipework lagged in the riser, the fire stopping contractor has been told it is ready for them','Ceiling grid is going up ahead of our services, raised with the site manager so the sequence is agreed','Distribution board dressed and labelled, circuit chart left in the board door for the electrician on the next visit','Access to the area was blocked by a scissor lift and stacked plasterboard, work moved to the next floor','Socket outlets second fixed and tested, two faceplates were cracked and are listed below as defects'];
const SIGNATURE='data:image/png;base64,'+'iVBORw0KGgoAAAANSUhEUgAAAZAAAACWCAYAAADwkd5l'.repeat(190);
const TYPES={'safety-inspection':'SSI','tower-inspection':'TPI','first-fix-inspection':'FFI','handover-inspection':'HDI'};

/** A small seeded random number generator, so the data is the same every run. */
function generator(seed){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
const uuid=(rand)=>{const h=()=>Math.floor(rand()*16).toString(16);const p=(n)=>Array.from({length:n},h).join('');return `${p(8)}-${p(4)}-4${p(3)}-a${p(3)}-${p(12)}`;};
const addDays=(ymd,n)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const weekday=(ymd)=>new Date(`${ymd}T12:00:00Z`).getUTCDay();

/**
 * Write the data set. `days` is how far back the records go; `scale` thins
 * or thickens the daily volume (1: three engineers a weekday on each project).
 * Returns counts of what was written.
 */
export function seedBusyProjects({storagePath,today,days=420,scale=1,seed=7}){
  const {putRecord,database}=require(storagePath);
  const {SAFETY_CHECKLIST,TOWER_CHECKLIST,FIRST_FIX_CHECKLIST,HANDOVER_CHECKLIST}=require(storagePath.replace(/storage\.js$/,'reportTypes.js'));
  const lists={'safety-inspection':SAFETY_CHECKLIST,'tower-inspection':TOWER_CHECKLIST,'first-fix-inspection':FIRST_FIX_CHECKLIST,'handover-inspection':HANDOVER_CHECKLIST};
  const rand=generator(seed),pick=(a)=>a[Math.floor(rand()*a.length)],chance=(p)=>rand()<p;
  const engineers=[PEOPLE.engineer,PEOPLE.hvac,PEOPLE.plumber];
  const counts={reports:0,inspections:0,corrections:0,drafts:0,issues:0,issueEvents:0,variations:0,photos:0,notes:0,chases:0};
  const photo=(at)=>{counts.photos++;return {id:uuid(rand),dataUrl:`/api/media/${uuid(rand)}`,caption:chance(0.5)?'Before boarding':'',capturedAt:at};};
  const db=database();
  db.exec('BEGIN');
  try{
    for(const [projectId,number] of PROJECTS){
      const seq={SPR:0,ISS:0,VO:0,SSI:0,TPI:0,FFI:0,HDI:0};
      const ref=(code)=>`${number}-${code}-${String(++seq[code]).padStart(3,'0')}`;
      const sentReports=[];
      for(let back=days;back>=0;back--){
        const day=addDays(today,-back),dow=weekday(day);
        if(dow===0||dow===6)continue;
        const at=(hour)=>`${day}T${String(hour).padStart(2,'0')}:${String(Math.floor(rand()*60)).padStart(2,'0')}:00.000Z`;
        for(const person of engineers){
          if(!chance(Math.min(1,0.9*scale)))continue;
          const sent=at(15+Math.floor(rand()*3));
          const draft=back<=2&&person===PEOPLE.engineer&&dow===2;
          const cards=Array.from({length:3+Math.floor(rand()*6)},()=>{
            const type=pick(['update','update','update','defect','defect','instruction','access']);
            return {id:uuid(rand),type,location:pick(LOCATIONS),whatHappened:pick(PHRASES),actionNeeded:type==='update'?'':pick(PHRASES).slice(0,60),owner:type==='update'?'':pick(OWNERS),
              photos:Array.from({length:Math.floor(rand()*4)},()=>photo(sent)),...(type==='defect'?{affectedTrade:person.trade}:{}),
              ...(type==='instruction'?{variationReason:pick(['Client instruction','Design change','Site condition']),workDone:chance(0.3),askedBy:'Site manager',roughSize:pick(['half-day','day','two-days'])}:{})};
          });
          const report={id:`rep-${uuid(rand)}`,projectId,reference:ref('SPR'),visitDate:day,author:person.name,authorId:person.id,authorTrade:person.trade,
            state:draft?'draft':'submitted',version:2+Math.floor(rand()*30),revision:1,review:'not_required',observations:cards,
            ...(draft?{lastSavedAt:sent}:{serverAcknowledgedAt:sent,lastSavedAt:sent,delivery:'filed',signature:chance(0.5)?{name:person.name,dataUrl:SIGNATURE,signedAt:sent}:{name:person.name,signedAt:sent},
              ...(chance(0.6)?{acknowledged:{by:PEOPLE.manager.name,byId:PEOPLE.manager.id,at:`${addDays(day,1)}T09:10:00.000Z`}}:{})})};
          putRecord('reports',report);
          if(draft){counts.drafts++;continue;}
          counts.reports++;sentReports.push(report);
          // One in fifty is corrected later the same week.
          if(chance(0.02)){
            const fixed={...structuredClone(report),id:`rep-${uuid(rand)}`,revision:2,corrects:report.id,correctionReason:'Wrong level on two cards',serverAcknowledgedAt:at(18),lastSavedAt:at(18)};
            putRecord('reports',fixed);counts.corrections++;
          }
        }
        // Inspections: safety every Monday, two towers every Wednesday, first fix and handover now and then.
        const inspections=[];
        if(dow===1)inspections.push(['safety-inspection']);
        if(dow===3)inspections.push(['tower-inspection','Tower T1, level 2 east'],['tower-inspection','Podium P3, plant room']);
        if(dow===4&&chance(0.25))inspections.push(['first-fix-inspection']);
        if(dow===5&&back<120&&chance(0.15))inspections.push(['handover-inspection']);
        for(const [type,inspected] of inspections){
          const person=pick(engineers),sent=at(11);
          const observations=lists[type].map(c=>{const answer=chance(0.1)?'action':chance(0.1)?'na':'ok';return {id:uuid(rand),type:'check',location:answer==='action'?pick(LOCATIONS):'',whatHappened:answer==='action'?pick(PHRASES):'',actionNeeded:answer==='action'?'Put right before work restarts':'',owner:answer==='action'?pick(OWNERS):'',photos:answer==='action'?[photo(sent)]:[],check:{item:c.item,question:c.question,answer}};});
          const report={id:`rep-${uuid(rand)}`,projectId,reportType:type,...(inspected?{inspected}:{}),reference:ref(TYPES[type]),visitDate:day,author:person.name,authorId:person.id,authorTrade:person.trade,
            state:'submitted',version:12,revision:1,review:'not_required',observations,serverAcknowledgedAt:sent,lastSavedAt:sent,delivery:'filed',
            signature:chance(0.7)?{name:person.name,dataUrl:SIGNATURE,signedAt:sent}:{name:person.name,typed:true,statement:'I inspected this and the answers are true.',signedInAs:person.name,signedAt:sent}};
          putRecord('reports',report);counts.inspections++;
        }
      }
      // Issues: raised from defects and access cards, most moved on and many closed.
      for(const report of sentReports){
        for(const card of report.observations){
          if(card.type!=='defect'&&card.type!=='access')continue;
          if(!chance(0.7*Math.min(1,scale)))continue;
          const raisedAt=report.serverAcknowledgedAt,age=(Date.parse(`${today}T12:00:00Z`)-Date.parse(raisedAt))/86400000;
          const by=engineers.find(p=>p.id===report.authorId);
          const ev=(kind,actor,daysOn,note='')=>({at:new Date(Date.parse(raisedAt)+daysOn*86400000).toISOString(),actor:actor.name,actorId:actor.id,kind,note,photos:chance(0.2)?[photo(raisedAt)]:[],
            source:{reportId:report.id,reference:report.reference,revision:1,observationId:card.id}});
          const events=[ev('raised',by,0)];
          let work='open',confirmation='provisional',closureBy;
          if(age>3&&chance(0.85)){confirmation='confirmed';events.push(ev('confirmation',PEOPLE.manager,1));work='assigned';events.push(ev('assigned',PEOPLE.manager,1,'Passed to the trade'));}
          if(age>10&&chance(0.8)){events.push(ev('progress',pick(engineers),5,'Started'));work='in_progress';}
          if(age>20&&chance(0.85)){closureBy=pick(engineers);events.push(ev('closure_submitted',closureBy,12,'Fixed'));work='awaiting_verification';}
          if(age>25&&work==='awaiting_verification'&&chance(0.9)){events.push(ev('verified',PEOPLE.manager,15,'Checked on site'));work='closed';}
          if(chance(0.02))confirmation='withdrawn';
          const issue={id:`iss-${uuid(rand)}`,reference:ref('ISS'),projectId,location:card.location,description:card.whatHappened,actionNeeded:card.actionNeeded,confirmation,work,owner:work==='open'?'':card.owner||pick(OWNERS),
            targetDate:work==='open'?'':addDays(report.visitDate,14),raisedByReport:report.id,raisedByObservation:card.id,raisedAt,events,source:'report',affectedTrade:card.affectedTrade??report.authorTrade,
            reportedBy:by.name,reportedById:by.id,reporterTrade:by.trade,...(closureBy?{closureSubmittedBy:closureBy.name,closureSubmittedById:closureBy.id}:{})};
          putRecord('issues',issue);counts.issues++;counts.issueEvents+=events.length;
        }
        for(const card of report.observations){
          if(card.type!=='instruction'||!chance(0.5))continue;
          const instruction=chance(0.6)?'instructed':chance(0.2)?'declined':'pending';
          const raisedAt=report.serverAcknowledgedAt;
          const events=[{at:raisedAt,actor:report.author,actorId:report.authorId,kind:'raised',note:'',photos:[]}];
          if(instruction!=='pending')events.push({at:new Date(Date.parse(raisedAt)+5*86400000).toISOString(),actor:PEOPLE.manager.name,actorId:PEOPLE.manager.id,kind:instruction,note:'',photos:[]});
          putRecord('variations',{id:`var-${uuid(rand)}`,reference:ref('VO'),projectId,description:card.whatHappened,location:card.location,trade:report.authorTrade,reason:card.variationReason,workDone:!!card.workDone,instruction,
            source:'report',raisedBy:report.author,raisedById:report.authorId,raiserTrade:report.authorTrade,raisedAt,raisedByReport:report.id,raisedByObservation:card.id,askedBy:card.askedBy,
            ...(instruction==='instructed'?{instructedValue:250+Math.floor(rand()*4000),instructedOn:report.visitDate}:{}),labourHours:4+Math.floor(rand()*20),labourRate:45,events});
          counts.variations++;
        }
      }
      for(let n=0;n<40;n++){
        const at=`${addDays(today,-Math.floor(rand()*30))}T08:00:00.000Z`,by=pick(engineers);
        putRecord('site-notes',{id:`note-${uuid(rand)}`,projectId,text:'Key for the riser cupboard is with the site manager',by:by.name,byId:by.id,byTrade:by.trade,at,...(n<30?{done:{by:by.name,byId:by.id,at}}:{})});
        counts.notes++;
      }
    }
    for(let n=0;n<300;n++){
      const owner=pick(OWNERS),at=`${addDays(today,-Math.floor(rand()*days))}T10:00:00.000Z`;
      putRecord('company-chases',{id:`chase-${uuid(rand)}`,companyKey:owner.toLowerCase(),owner,note:'Rang about the open snags',by:PEOPLE.manager.name,byId:PEOPLE.manager.id,at});
      counts.chases++;
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return counts;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(!process.env.RELAY_DATA_ROOT)throw new Error('Set RELAY_DATA_ROOT to an empty folder first.');
  const {londonDay}=require('../apps/web/.test-build/lib/weeklySummary.js');
  const counts=seedBusyProjects({storagePath:require.resolve('../apps/web/.test-build/lib/storage.js'),today:londonDay(new Date()),scale:Number(process.env.RELAY_BUSY_SCALE??1)});
  console.log(JSON.stringify(counts));
}
