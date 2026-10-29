const { chromium } = require(process.env.SURVEY_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = process.env.SURVEY_BROWSER_ARTIFACTS;
if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
const base = process.env.SURVEY_BROWSER_BASE_URL || 'http://127.0.0.1:3000';
const blank = () => ({survey_version:2,topic_ids:[],subtopic_ids:[],major_text:null,club_category_ids:[],goal_ids:[],weekly_commitment:null});
const initial = {...blank(),topic_ids:['technology'],subtopic_ids:['technology:ai-data'],major_text:'Biology',club_category_ids:['academic','greek']};
const user = id => ({id,email:`test${id}@example.invalid`,name:`User ${id}`,picture_url:null,is_cornell:false});
const profile = answers => ({status:answers?'completed':'not_started',answers,completed_at:answers?'2026-10-28T00:00:00.000Z':null,skipped_at:null,updated_at:null});
async function fixture(browser, signedIn = true, mobile = false) {
 const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});
 const page = await context.newPage();
 const state={identity:signedIn?user(1):null,profiles:{1:profile(initial)},writes:[],failSave:false,failLoad:false,expire:false,nextId:1};
 await page.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(o){window.testGoogleCallback=o.callback},renderButton(el){el.innerHTML='';let b=document.createElement('button');b.textContent='Test Google sign-in';b.onclick=()=>window.testGoogleCallback({credential:'test'});el.appendChild(b)}}}};`}));
 await page.route('**/api/**',async r=>{
  const req=r.request(),path=new URL(req.url()).pathname;let data={},status=200;
  if(path==='/api/session') data={user:state.identity,follows:[],googleClientId:'test-client'};
  else if(path==='/api/orgs') data={orgs:[]};
  else if(path==='/api/events') data={events:['project-team','greek'].map((category,index)=>({id:index+1,title:'Test event '+category,starts_at:'2050-01-01T18:00:00Z',ends_at:null,all_day:false,time_tba:false,location:null,url:null,image_url:null,description:null,org_name:'Test '+category,org_slug:category,org_category:category}))};
  else if(path==='/api/subscriptions') data={follows:[]};
  else if(path==='/api/auth/google'){state.identity=user(state.nextId);data={user:state.identity,follows:[]};}
  else if(path==='/api/auth/logout'){state.identity=null;data={ok:true};}
  else if(path==='/api/profile/survey'){
   const id=state.identity?.id;
   if(state.expire||!id){status=401;data={error:'not signed in'};}
   else if(req.method()==='GET'){
    if(state.failLoad){status=503;data={error:'unavailable'};}else data={profile:state.profiles[id]??profile(null)};
   }else if(req.method()==='PUT'){
    state.writes.push({method:'PUT',id,answers:req.postDataJSON()});
    await new Promise(resolve=>setTimeout(resolve,120));
    if(state.failSave){status=503;data={error:'unavailable'};}else{
     const a=req.postDataJSON();a.major_text=a.major_text?.trim()||null;
     state.profiles[id]=profile(a);data={profile:state.profiles[id]};
    }
   }else{
    state.writes.push({method:'POST',id,body:req.postDataJSON()});
    state.profiles[id]??=profile(null);state.profiles[id].skipped_at='2026-10-28T01:00:00.000Z';data={profile:state.profiles[id]};
   }
  }
  await r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(base+'/onboarding');
 await page.getByRole('heading',{name:'What sparks your interest?'}).waitFor();
 if(signedIn) await page.getByLabel('2. What is your major or intended area of study?').waitFor({state:'visible'});
 return {page,state,context};
}
async function review(page){
 assert.equal(await page.getByText('Step 1 of 2',{exact:false}).count(),1);
 assert.equal(await page.getByText('3. Which kinds of clubs interest you?',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Continue',exact:false}).click();
 await page.getByRole('heading',{name:'Make room for what matters',exact:true}).waitFor();
 assert.equal(await page.getByText('Step 2 of 2',{exact:false}).count(),1);
 await page.getByRole('button',{name:'Review answers',exact:false}).click();
 assert.equal(await page.getByText('Club types',{exact:true}).count(),0);
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  {
   const {page,state,context}=await fixture(browser);
   await page.getByLabel('2. What is your major or intended area of study?').fill('Computer Science');
   await review(page);
   await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your preferences have been saved.').waitFor();
   assert.equal(state.writes.length,1);assert.equal(state.writes[0].answers.major_text,'Computer Science');
   assert.deepEqual(state.writes[0].answers.club_category_ids,['academic','greek']);
   if (artifacts) await page.screenshot({path:path.join(artifacts,'desktop-saved.png'),fullPage:true});
   await page.reload();
   await page.getByLabel('2. What is your major or intended area of study?').waitFor();
   await page.waitForFunction(()=>document.querySelector('#major')?.value==='Computer Science');
   await page.getByRole('button',{name:'Skip for now',exact:true}).click();
   await page.waitForURL('**/explore');
   assert.equal(state.writes.at(-1).method,'POST');assert.equal(state.profiles[1].answers.major_text,'Computer Science');
   await page.getByRole('link',{name:'My preferences',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#major')?.value==='Computer Science');
   console.log('PASS: saved answers load, update, survive reload; skip posts and allows returning via navigation');
   await context.close();
  }
  {
   const {page,state,context}=await fixture(browser);
   state.failSave=true;
   await page.getByLabel('2. What is your major or intended area of study?').fill('Physics');
   await review(page);await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your answers were not saved.',{exact:false}).waitFor();
   assert.equal(state.writes.length,1);assert.equal(await page.getByText('Physics',{exact:true}).count(),1);
   assert.equal(await page.getByText('Your preferences have been saved.',{exact:false}).count(),0);
   state.failSave=false;await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your preferences have been saved.',{exact:false}).waitFor();
   console.log('PASS: save failure preserves draft and retry succeeds without false success');
   await context.close();
  }
  {
   const {page,state,context}=await fixture(browser);
   state.failLoad=true;await page.reload();
   await page.getByRole('button',{name:'Retry loading'}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Continue',exact:false}).isDisabled(),true);
   state.failLoad=false;await page.getByRole('button',{name:'Retry loading'}).click();
   await page.waitForFunction(()=>document.querySelector('#major')?.value==='Biology');
   await review(page);state.expire=true;await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your session expired.',{exact:false}).waitFor();
   assert.equal(await page.getByText('Your preferences have been saved.',{exact:false}).count(),0);
   state.expire=false;await page.getByRole('button',{name:'Test Google sign-in'}).last().click();
   await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your preferences have been saved.',{exact:false}).waitFor();
   console.log('PASS: failed reads block overwrite; expired session allows reauthentication and retry');
   await context.close();
  }
  {
   const {page,state,context}=await fixture(browser,false,true);
   await page.getByLabel('2. What is your major or intended area of study?').fill('Guest draft');
   await page.getByRole('button',{name:'Test Google sign-in'}).last().click();
   await page.getByRole('button',{name:'Use answers I just entered'}).waitFor();
   await page.getByRole('button',{name:'Use answers I just entered'}).click();
   await page.waitForFunction(()=>document.querySelector('#major')?.value==='Guest draft');
   await review(page);await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your preferences have been saved.',{exact:false}).waitFor();
   assert.deepEqual(state.writes.at(-1).answers.club_category_ids,['academic','greek']);
   await page.getByRole('button',{name:'Edit answers',exact:true}).click();
   if (artifacts) await page.screenshot({path:path.join(artifacts,'mobile-draft.png'),fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.getByRole('button',{name:'Sign out',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#major')?.value==='');
   state.nextId=2;
   await page.getByRole('button',{name:'Test Google sign-in'}).last().click();
   await page.waitForFunction(()=>document.querySelector('#major')?.value==='');
   assert.equal(await page.getByText('Your account already has saved preferences, shown below.',{exact:false}).count(),0);
   await review(page);await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your preferences have been saved.',{exact:false}).waitFor();
   assert.equal(state.writes.at(-1).id,2);assert.equal(state.writes.at(-1).answers.major_text,null);
   assert.equal(state.profiles[1].answers.major_text,'Guest draft');
   console.log('PASS: 390px mobile has no horizontal overflow; guest login preserves draft, account switch clears private answers, empty submission works');
   await context.close();
  }
  {
   const {page,state,context}=await fixture(browser);
   await page.waitForFunction(()=>document.querySelector('#major')?.value==='Biology');
   await page.getByRole('checkbox',{name:'Art, music & design',exact:true}).check();
   const tech=page.getByRole('group',{name:'Technology & engineering: detailed interests',exact:true});
   const arts=page.getByRole('group',{name:'Art, music & design: detailed interests',exact:true});
   await tech.getByRole('checkbox',{name:'Software & app development',exact:true}).check();
   await tech.getByRole('checkbox',{name:'Robotics & electronics',exact:true}).check();
   assert.equal(await tech.getByRole('checkbox',{name:'Mechanical & aerospace engineering',exact:true}).isEnabled(),true);
   await tech.getByRole('checkbox',{name:'Mechanical & aerospace engineering',exact:true}).check();
   assert.equal(await arts.getByRole('checkbox',{name:'Music',exact:true}).isEnabled(),true);
   await arts.getByRole('checkbox',{name:'Visual arts & design',exact:true}).check();
   await arts.getByRole('checkbox',{name:'Music',exact:true}).check();
   await arts.getByRole('checkbox',{name:'Dance',exact:true}).check();
   assert.equal(await arts.getByRole('checkbox',{name:'Fashion',exact:true}).isEnabled(),true);
   await arts.getByRole('checkbox',{name:'Theater & comedy',exact:true}).check();
   await arts.getByRole('checkbox',{name:'Fashion',exact:true}).check();
   await tech.getByRole('checkbox',{name:'Robotics & electronics',exact:true}).uncheck();
   assert.equal(await tech.getByRole('checkbox',{name:'Mechanical & aerospace engineering',exact:true}).isEnabled(),true);
   await tech.getByRole('checkbox',{name:'Robotics & electronics',exact:true}).check();
   if (artifacts) await page.screenshot({path:path.join(artifacts,'unlimited-details.png'),fullPage:true});
   await review(page);await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your preferences have been saved.',{exact:false}).waitFor();
   assert.equal(state.writes.at(-1).answers.subtopic_ids.length,9);
   await page.reload();await page.waitForFunction(()=>document.querySelector('#major')?.value==='Biology');
   assert.equal(await page.getByRole('group',{name:'Art, music & design: detailed interests',exact:true}).getByRole('checkbox',{checked:true}).count(),5);
   await page.getByRole('checkbox',{name:'Technology & engineering',exact:true}).uncheck();
   assert.equal(await page.getByRole('group',{name:'Technology & engineering: detailed interests',exact:true}).count(),0);
   assert.equal(await page.getByRole('group',{name:'Art, music & design: detailed interests',exact:true}).getByRole('checkbox',{checked:true}).count(),5);
   await review(page);await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your preferences have been saved.',{exact:false}).waitFor();
   assert.deepEqual(state.writes.at(-1).answers.topic_ids,['arts']);
   assert.equal(state.writes.at(-1).answers.subtopic_ids.length,5);
   assert.equal(state.writes.at(-1).answers.subtopic_ids.every(id=>id.startsWith('arts:')),true);
   console.log('PASS: all four technology and five arts details can be selected, nine details save/reload, parent removal preserves other categories');
   await context.close();
  }
  {
   const {page,state,context}=await fixture(browser);
   await page.waitForFunction(()=>document.querySelector('#major')?.value==='Biology');
   await page.getByRole('checkbox',{name:'Politics & public policy',exact:true}).check();
   await page.getByRole('checkbox',{name:'Service & social impact',exact:true}).check();
   await page.getByRole('checkbox',{name:'Law & legal studies',exact:true}).check();
   await page.getByRole('checkbox',{name:'Education & mentoring',exact:true}).check();
   assert.equal(await page.getByRole('checkbox',{name:'Education & teaching',exact:true}).count(),0);
   if (artifacts) await page.screenshot({path:path.join(artifacts,'two-step-interests.png'),fullPage:true});
   await review(page);await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your preferences have been saved.',{exact:false}).waitFor();
   assert.equal(state.writes.at(-1).answers.subtopic_ids.includes('policy:law'),true);
   assert.equal(state.writes.at(-1).answers.subtopic_ids.includes('service:mentoring'),true);
   assert.deepEqual(state.writes.at(-1).answers.club_category_ids,['academic','greek']);
   await page.reload();await page.waitForFunction(()=>document.querySelector('#major')?.value==='Biology');
   assert.equal(await page.getByRole('checkbox',{name:'Law & legal studies',exact:true}).isChecked(),true);
   assert.equal(await page.getByRole('checkbox',{name:'Education & mentoring',exact:true}).isChecked(),true);
   await page.getByRole('button',{name:'Skip for now',exact:true}).click();await page.waitForURL('**/explore');
   await page.getByRole('button',{name:'Greek & Honor Societies',exact:true}).waitFor();
   assert.equal(await page.getByText('Greek & Honor Societies',{exact:true}).count()>0,true);
   assert.equal(await page.getByText('Project Teams',{exact:true}).count()>0,true);
   console.log('PASS: law saves/reloads, existing education is retained, hidden legacy categories survive, organization types remain in Explore');
   await context.close();
  }
  {
   const {page,state,context}=await fixture(browser,true,true);
   await page.waitForFunction(()=>document.querySelector('#major')?.value==='Biology');
   const priority = detail => page.getByRole('group',{name:'Priority for '+detail,exact:true});
   assert.equal(await priority('AI & data').getByRole('radio',{name:'2 · Interested',exact:true}).isChecked(),true);
   await page.getByRole('checkbox',{name:'Art, music & design',exact:true}).check();
   await page.getByRole('checkbox',{name:'Music',exact:true}).check();
   await page.getByRole('checkbox',{name:'Robotics & electronics',exact:true}).check();
   await priority('AI & data').getByRole('radio',{name:'2 · Interested',exact:true}).press('ArrowLeft');
   await priority('Music').getByText('1 · Prioritize',{exact:true}).click();
   await priority('Robotics & electronics').getByText('3 · Try sometime',{exact:true}).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if (artifacts) await page.screenshot({path:path.join(artifacts,'priority-mobile.png'),fullPage:true});
   await review(page);
   const top=page.getByRole('group',{name:'Prioritize detailed interests',exact:true});
   assert.equal(await top.getByText('Technology & engineering / AI & data',{exact:true}).count(),1);
   assert.equal(await top.getByText('Art, music & design / Music',{exact:true}).count(),1);
   assert.equal(await page.getByRole('group',{name:'Try sometime detailed interests',exact:true}).getByText('Technology & engineering / Robotics & electronics',{exact:true}).count(),1);
   await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your preferences have been saved.',{exact:false}).waitFor();
   assert.deepEqual(state.writes.at(-1).answers.subtopic_priorities,{'technology:ai-data':1,'arts:music':1,'technology:robotics':3});
   if (artifacts) await page.screenshot({path:path.join(artifacts,'priority-review.png'),fullPage:true});
   await page.reload();await page.waitForFunction(()=>document.querySelector('#major')?.value==='Biology');
   assert.equal(await priority('AI & data').getByRole('radio',{name:'1 · Prioritize',exact:true}).isChecked(),true);
   assert.equal(await priority('Robotics & electronics').getByRole('radio',{name:'3 · Try sometime',exact:true}).isChecked(),true);
   await page.getByRole('button',{name:'Sign out',exact:true}).click();
   await page.getByRole('button',{name:'Test Google sign-in'}).last().click();
   await page.waitForFunction(()=>document.querySelector('#major')?.value==='Biology');
   assert.equal(await priority('Music').getByRole('radio',{name:'1 · Prioritize',exact:true}).isChecked(),true);
   await page.getByRole('checkbox',{name:'AI & data',exact:true}).uncheck();
   await page.getByRole('checkbox',{name:'AI & data',exact:true}).check();
   assert.equal(await priority('AI & data').getByRole('radio',{name:'2 · Interested',exact:true}).isChecked(),true);
   await page.getByRole('checkbox',{name:'Technology & engineering',exact:true}).uncheck();
   await review(page);await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your preferences have been saved.',{exact:false}).waitFor();
   assert.deepEqual(state.writes.at(-1).answers.subtopic_priorities,{'arts:music':1});
   await page.getByRole('button',{name:'Edit answers',exact:true}).click();
   await page.getByRole('button',{name:'Skip / clear detailed interests',exact:true}).click();
   await review(page);await page.getByRole('button',{name:'Save preferences',exact:true}).click();
   await page.getByText('Your preferences have been saved.',{exact:false}).waitFor();
   assert.deepEqual(state.writes.at(-1).answers.subtopic_priorities,{});
   console.log('PASS: legacy default, cross-category tied priorities, grouped review, save/reload/re-login, child/parent cleanup and clear-all work on mobile');
   await context.close();
  }
  console.log('ALL 7 browser scenarios passed (mocked API and Google sign-in; not a live database test).');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
