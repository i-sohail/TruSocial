import { useState, useEffect, useCallback } from "react";
import { api, SENTINEL } from "./api.js";

const S = {
  bg:"#07090F", surface:"#0E1320", surface2:"#141B2D", surface3:"#1A2238",
  border:"#1C2B42", primary:"#6C63FF", primaryDim:"rgba(108,99,255,0.14)",
  teal:"#00D1B2", coral:"#FF6B6B", amber:"#F5A623", purple:"#9B59B6",
  tg:"#229ED9",
  textPrimary:"#EEF2FF", textSecondary:"#8892B0", textMuted:"#3A4A63",
};

const DEF_BEDROCK = { bearerToken:"", region:"us-east-1", modelId:"amazon.nova-canvas-v1:0", enabled:false };
const DEF_COMPANY = {
  name:"",industry:"",description:"",website:"",products:"",services:"",
  targetAudience:"",brandVoice:"professional",brandColors:["#6C63FF","#00D1B2"],
  companySize:"",competitors:"",keywords:"",tone:"authoritative",
  approvalMode:"selective",brandGuidelines:"",
  platforms:{linkedin:true,instagram:true,facebook:false,x:false},
  schedule:{monday:true,tuesday:true,wednesday:true,thursday:true,friday:true,saturday:false,sunday:false}
};
const DEF_TELEGRAM = { botToken:"", chatId:"", enabled:false, hoursBefore:5, lastPolled:null };
const DEF_SOCIAL = {
  facebook:{connected:false,accessToken:"",pageId:"",pageName:"",appId:"",appSecret:""},
  instagram:{connected:false,accessToken:"",accountId:"",username:"",appId:"",appSecret:""},
  x:{connected:false,apiKey:"",apiSecret:"",accessToken:"",accessSecret:"",bearerToken:""},
  linkedin:{connected:false,accessToken:"",organizationId:"",profileName:"",clientId:"",clientSecret:""}
};

const SOCIALS = {
  facebook:{ label:"Facebook", color:"#1877F2", icon:"facebook",
    fields:[
      {key:"accessToken",label:"Page Access Token",hint:"Long-lived token from Graph API Explorer",secret:true},
      {key:"pageId",label:"Page ID",hint:"Page Settings → About section"},
      {key:"pageName",label:"Page Name",hint:"Display name of your Facebook Page"},
      {key:"appId",label:"App ID",hint:"developers.facebook.com → App Settings"},
      {key:"appSecret",label:"App Secret",hint:"developers.facebook.com → App Settings",secret:true},
    ],
    guide:[
      "Go to developers.facebook.com → Create App (Business type)",
      "Add Pages API product",
      "Use Graph API Explorer to generate a long-lived Page Access Token with pages_manage_posts scope",
      "Your Page ID is in Page Settings → About",
    ],
    docsUrl:"https://developers.facebook.com/docs/pages/publishing",
  },
  instagram:{ label:"Instagram", color:"#E1306C", icon:"instagram",
    fields:[
      {key:"accessToken",label:"Access Token",hint:"Long-lived token with instagram_content_publish scope",secret:true},
      {key:"accountId",label:"Instagram Account ID",hint:"Your Business/Creator account ID"},
      {key:"username",label:"Username",hint:"Your @username (display only)"},
      {key:"appId",label:"App ID",hint:"developers.facebook.com → Instagram app"},
      {key:"appSecret",label:"App Secret",hint:"developers.facebook.com → Instagram app",secret:true},
    ],
    guide:[
      "Account must be Business or Creator, linked to a Facebook Page",
      "Create a Facebook App with Instagram Graph API product enabled",
      "Get a long-lived token with instagram_content_publish scope",
      "Find your Account ID via the Graph API: /me?fields=instagram_business_account",
    ],
    docsUrl:"https://developers.facebook.com/docs/instagram-api/guides/content-publishing",
  },
  x:{ label:"X (Twitter)", color:"#1DA1F2", icon:"twitter",
    fields:[
      {key:"apiKey",label:"API Key (Consumer Key)",hint:"developer.twitter.com → Keys and Tokens",secret:true},
      {key:"apiSecret",label:"API Secret",hint:"developer.twitter.com → Keys and Tokens",secret:true},
      {key:"accessToken",label:"Access Token",hint:"Read and Write access required",secret:true},
      {key:"accessSecret",label:"Access Token Secret",hint:"developer.twitter.com → Keys and Tokens",secret:true},
    ],
    guide:[
      "Go to developer.twitter.com → Apply for Elevated access",
      "Create a Project and App",
      "Set App permissions to Read and Write",
      "Generate Access Token & Secret in Keys and Tokens tab",
    ],
    docsUrl:"https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets",
  },
  linkedin:{ label:"LinkedIn", color:"#0A66C2", icon:"linkedin",
    fields:[
      {key:"accessToken",label:"Access Token",hint:"OAuth 2.0 token with w_member_social scope",secret:true},
      {key:"organizationId",label:"Organization ID (optional)",hint:"Company Page ID — blank for personal profile"},
      {key:"profileName",label:"Profile/Company Name",hint:"Display name"},
      {key:"clientId",label:"Client ID",hint:"linkedin.com/developers → Auth"},
      {key:"clientSecret",label:"Client Secret",hint:"linkedin.com/developers → Auth",secret:true},
    ],
    guide:[
      "Go to linkedin.com/developers → Create App",
      "Add Share on LinkedIn + Marketing Developer Platform products",
      "Use OAuth 2.0 Authorization Code flow to get an access token",
      "Required scopes: w_member_social (personal) or rw_organization_admin (company page)",
    ],
    docsUrl:"https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api",
  },
};
const PL = { linkedin:{label:"LinkedIn",color:"#0A66C2",icon:"linkedin"}, instagram:{label:"Instagram",color:"#E1306C",icon:"instagram"}, facebook:{label:"Facebook",color:"#1877F2",icon:"facebook"}, x:{label:"X",color:"#1DA1F2",icon:"twitter"} };
const FORMATS = { text:{id:"text",label:"Text Post",emoji:"📝",color:S.textSecondary,desc:"AI writes one post published to all platforms"}, photo:{id:"photo",label:"Photo + Post",emoji:"🖼️",color:"#E1306C",desc:"AI writes post AND generates a real image/poster"} };
const IMG_STYLES=[{value:"professional poster",label:"Professional Poster"},{value:"bold typographic",label:"Bold Typography"},{value:"minimalist clean",label:"Minimalist Clean"},{value:"vibrant colorful",label:"Vibrant & Colorful"},{value:"infographic",label:"Infographic Style"},{value:"photorealistic",label:"Photorealistic"},{value:"flat illustration",label:"Flat Illustration"},{value:"dark premium",label:"Dark Premium"}];
const CONTENT_TYPES=["Educational","Thought Leadership","Promotional","Engagement","Industry Insight","Behind the Scenes","Customer Story","Product Launch","How-to Guide"];

const Icon = ({path,size=18,color="currentColor"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>
);
const IC = {
  dashboard:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  setup:"M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z",
  content:"M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8",
  approve:"M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  analytics:"M18 20V10 M12 20V4 M6 20v-6",
  zap:"M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  sparkle:"M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z",
  check:"M20 6L9 17l-5-5",
  xmark:"M18 6L6 18 M6 6l12 12",
  copy:"M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-2 M8 4a2 2 0 012-2h4a2 2 0 012 2v0a2 2 0 01-2 2h-4a2 2 0 01-2-2z",
  trash:"M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
  edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  clock:"M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2",
  down:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  eye:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z",
  send:"M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  social:"M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  telegram:"M21.5 2.5l-19 7.5 6 2 2 6 3.5-4 5.5 4z M8.5 12l9.5-7",
  link:"M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  info:"M12 22a10 10 0 100-20 10 10 0 000 20z M12 8h.01 M12 12v4",
  refresh:"M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  linkedin:"M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z M2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z",
  instagram:"M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z M17.5 6.5h.01 M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5z",
  twitter:"M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z",
  facebook:"M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z",
};

function Toast({message,type,onClose}){
  useEffect(()=>{const t=setTimeout(onClose,4500);return()=>clearTimeout(t);},[onClose]);
  const c={success:S.teal,error:S.coral,info:S.primary,telegram:S.tg}[type]||S.primary;
  return(<div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:S.surface2,border:`1px solid ${c}50`,borderLeft:`4px solid ${c}`,borderRadius:10,padding:"12px 18px",color:S.textPrimary,fontSize:14,fontWeight:500,maxWidth:400,boxShadow:"0 8px 40px rgba(0,0,0,0.7)",display:"flex",alignItems:"center",gap:10,animation:"slideIn 0.2s ease"}}>
    <span style={{color:c,fontSize:16}}>{type==="success"?"✓":type==="error"?"✕":"●"}</span>{message}
  </div>);
}

function Btn({children,onClick,variant="primary",disabled,loading,size="md",icon,full,style:sx={}}){
  const sz={sm:{padding:"6px 14px",fontSize:12},md:{padding:"9px 20px",fontSize:14},lg:{padding:"13px 28px",fontSize:15}}[size];
  const v={primary:{background:S.primary,color:"#fff",border:"none"},secondary:{background:S.surface2,color:S.textPrimary,border:`1px solid ${S.border}`},ghost:{background:"transparent",color:S.textSecondary,border:"none"},danger:{background:`${S.coral}18`,color:S.coral,border:`1px solid ${S.coral}40`},success:{background:`${S.teal}18`,color:S.teal,border:`1px solid ${S.teal}40`},outline:{background:"transparent",color:S.primary,border:`1px solid ${S.primary}60`},tg:{background:`${S.tg}15`,color:S.tg,border:`1px solid ${S.tg}40`}}[variant]||{};
  return(<button onClick={onClick} disabled={disabled||loading} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,borderRadius:8,cursor:disabled||loading?"not-allowed":"pointer",fontWeight:600,fontFamily:"inherit",opacity:disabled||loading?0.5:1,transition:"all 0.15s",width:full?"100%":undefined,...sz,...v,...sx}}>
    {loading?<span style={{width:13,height:13,border:"2px solid currentColor",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin 0.6s linear infinite"}}/>:icon}{children}
  </button>);
}

function Input({label,value,onChange,placeholder,type="text",multiline,rows=3,required,hint,style:sx={}}){
  const base={width:"100%",background:S.surface,border:`1px solid ${S.border}`,borderRadius:8,padding:"10px 14px",color:S.textPrimary,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",resize:multiline?"vertical":"none",...sx};
  return(<div style={{marginBottom:16}}>
    {label&&<label style={{display:"block",color:S.textSecondary,fontSize:11,fontWeight:700,marginBottom:6,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}{required&&<span style={{color:S.coral}}> *</span>}</label>}
    {multiline?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={base}/>:<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base}/>}
    {hint&&<p style={{margin:"5px 0 0",fontSize:11,color:S.textMuted}}>{hint}</p>}
  </div>);
}

function Select({label,value,onChange,options,hint}){
  return(<div style={{marginBottom:16}}>
    {label&&<label style={{display:"block",color:S.textSecondary,fontSize:11,fontWeight:700,marginBottom:6,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:S.surface,border:`1px solid ${S.border}`,borderRadius:8,padding:"10px 14px",color:S.textPrimary,fontSize:14,fontFamily:"inherit",outline:"none"}}>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
    {hint&&<p style={{margin:"5px 0 0",fontSize:11,color:S.textMuted}}>{hint}</p>}
  </div>);
}

function Card({children,style:sx={},glow,accent}){
  return(<div style={{background:S.surface,border:`1px solid ${accent?accent+"45":S.border}`,borderRadius:14,padding:22,boxShadow:glow?`0 0 40px rgba(108,99,255,0.2)`:"none",...sx}}>{children}</div>);
}

function Badge({children,color=S.primary}){
  return(<span style={{display:"inline-flex",alignItems:"center",padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:800,background:`${color}22`,color,letterSpacing:"0.05em",textTransform:"uppercase"}}>{children}</span>);
}

function ScoreBar({score,label}){
  const c=score>=85?S.teal:score>=70?S.amber:S.coral;
  return(<div style={{marginBottom:8}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:S.textSecondary}}>{label}</span><span style={{fontSize:11,fontWeight:800,color:c}}>{score}/100</span></div>
    <div style={{height:4,background:S.border,borderRadius:2}}><div style={{width:`${score}%`,height:"100%",background:c,borderRadius:2,transition:"width 0.7s ease"}}/></div>
  </div>);
}

function AgentRow({name,status,index}){
  const c={idle:S.textMuted,running:S.primary,done:S.teal,error:S.coral}[status];
  return(<div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${S.border}20`}}>
    <div style={{width:22,height:22,borderRadius:"50%",background:`${c}20`,border:`2px solid ${status==="running"?c:"transparent"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:c,animation:status==="running"?"pulse 1.2s infinite":"none",flexShrink:0}}>{status==="done"?"✓":status==="error"?"✕":index+1}</div>
    <span style={{fontSize:12,color:status==="idle"?S.textMuted:S.textPrimary,fontWeight:status==="running"?700:400,flex:1}}>{name}</span>
    {status==="running"&&<div style={{width:10,height:10,border:`2px solid ${c}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/>}
  </div>);
}

const statusColor = (s) => ({pending:S.amber,approved:S.teal,rejected:S.coral,scheduled:S.primary,published:S.purple,awaiting_feedback:S.tg,"publish_error":S.coral}[s]||S.textMuted);

// ─── TELEGRAM VIEW ────────────────────────────────────────────────────────────
function TelegramView({data,onSave,onToast}){
  const tg = data.telegram||DEF_TELEGRAM;
  const [form,setForm]=useState({botToken:tg.botToken||"",chatId:tg.chatId||"",enabled:tg.enabled||false,hoursBefore:tg.hoursBefore||5});
  const [testing,setTesting]=useState(false);
  const [saving,setSaving]=useState(false);
  const [fetchedId,setFetchedId]=useState("");
  const set = k => v => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    try {
      await api.updateTelegram({botToken:form.botToken,chatId:form.chatId,enabled:form.enabled,hoursBefore:form.hoursBefore});
      onSave({telegram:{...tg,...form}});
      onToast("Telegram settings saved","success");
    } catch(e){ onToast("Save failed: "+e.message,"error"); }
    setSaving(false);
  };

  const testBot = async () => {
    setTesting(true);
    try {
      const d = await api.testBot(form.botToken);
      onToast(`✓ Bot connected: @${d.username}`,"success");
    } catch(e){ onToast("Bot test failed: "+e.message,"error"); }
    setTesting(false);
  };

  const fetchChatId = async () => {
    setTesting(true);
    try {
      const d = await api.fetchChatId(form.botToken);
      setFetchedId(d.chatId);
      setForm(f=>({...f,chatId:d.chatId}));
      onToast("Chat ID found: "+d.chatId,"success");
    } catch(e){ onToast("Failed: "+e.message,"error"); }
    setTesting(false);
  };

  const sendTestMsg = async () => {
    if(!form.botToken&&!tg.botToken){onToast("Set token and save first","error");return;}
    setTesting(true);
    try {
      await api.sendTestMessage({botToken:form.botToken,chatId:form.chatId,hoursBefore:form.hoursBefore});
      onToast("Test message sent to Telegram!","success");
    } catch(e){ onToast("Failed to send: "+e.message,"error"); }
    setTesting(false);
  };

  const sendMockCard = async () => {
    setTesting(true);
    try {
      await api.sendMockCard({botToken:form.botToken,chatId:form.chatId,hoursBefore:form.hoursBefore});
      onToast("Mock approval card sent! Check Telegram.","success");
    } catch(e){ onToast("Failed: "+e.message,"error"); }
    setTesting(false);
  };

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:24,fontWeight:800,color:S.textPrimary,margin:0}}>Telegram Approvals</h1>
        <p style={{color:S.textSecondary,marginTop:6,fontSize:14}}>Receive posts on Telegram before they publish. Tap ✅ to post or ❌ to reject — rejection triggers instant AI regeneration with your feedback.</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:24}}>
        {[
          {n:"1",icon:"📅",t:"Schedule post",d:"Generate → Approve → set date & time"},
          {n:"2",icon:"📱",t:`Alert ${form.hoursBefore}h before`,d:"Bot sends full post with image"},
          {n:"3",icon:"✅",t:"Tap Post or Reject",d:"Post → publishes everywhere instantly"},
          {n:"4",icon:"🔄",t:"Reject → regen",d:"Type feedback → new post in ~15s → approve again"},
        ].map(s=>(
          <div key={s.n} style={{padding:16,background:S.surface2,borderRadius:12,border:`1px solid ${S.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:S.primaryDim,color:S.primary,fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{s.n}</div>
              <span style={{fontSize:18}}>{s.icon}</span>
            </div>
            <p style={{color:S.textPrimary,fontWeight:700,fontSize:13,margin:"0 0 4px"}}>{s.t}</p>
            <p style={{color:S.textMuted,fontSize:11,margin:0,lineHeight:1.5}}>{s.d}</p>
          </div>
        ))}
      </div>
      <Card style={{marginBottom:14}}>
        <p style={{color:S.tg,fontWeight:800,fontSize:12,margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Step 1 — Create a Bot via @BotFather</p>
        <ol style={{color:S.textSecondary,fontSize:13,lineHeight:2.2,margin:0,paddingLeft:20}}>
          <li>Open Telegram → search <strong style={{color:S.tg}}>@BotFather</strong> → tap Start</li>
          <li>Send <code style={{background:S.surface3,padding:"2px 8px",borderRadius:5,color:S.teal}}>/newbot</code> and follow the prompts</li>
          <li>Pick any name and username (must end in <code style={{background:S.surface3,padding:"2px 8px",borderRadius:5,color:S.teal}}>_bot</code>)</li>
          <li>BotFather replies with a <strong style={{color:S.textPrimary}}>token</strong> — copy it below</li>
        </ol>
      </Card>
      <Card style={{marginBottom:14}}>
        <p style={{color:S.tg,fontWeight:800,fontSize:12,margin:"0 0 16px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Step 2 — Configure Your Bot</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"end"}}>
          <Input label="Bot Token (from BotFather)" value={form.botToken} onChange={set("botToken")} type="password" placeholder="123456789:ABCdef..." hint="Keep this secret — it controls your bot"/>
          <Btn variant="secondary" onClick={testBot} loading={testing} size="sm" style={{marginBottom:16}}>Test Bot</Btn>
        </div>
        <div style={{background:S.surface2,borderRadius:10,padding:14,marginBottom:14,border:`1px solid ${S.border}`}}>
          <p style={{color:S.amber,fontWeight:700,fontSize:12,margin:"0 0 8px"}}>Get Your Chat ID automatically</p>
          <p style={{color:S.textSecondary,fontSize:12,margin:"0 0 12px",lineHeight:1.7}}>
            1. Go to Telegram, find your new bot by its username, and send it any message (e.g. "hello")<br/>
            2. Click the button below — it reads your Chat ID automatically from the bot's incoming messages
          </p>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <Btn size="sm" variant="outline" onClick={fetchChatId} loading={testing} icon={<Icon path={IC.refresh} size={12}/>}>Auto-fetch Chat ID</Btn>
            {fetchedId && <span style={{color:S.teal,fontSize:13,fontWeight:700}}>✓ Found: {fetchedId}</span>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Input label="Chat ID" value={form.chatId} onChange={set("chatId")} placeholder="-100123456789 or 123456789" hint="Your personal or group/channel chat ID"/>
          <Select label="Send approval X hours before publish time" value={String(form.hoursBefore)}
            onChange={v=>setForm(f=>({...f,hoursBefore:Number(v)}))}
            options={[{value:"1",label:"1 hour before"},{value:"2",label:"2 hours before"},{value:"3",label:"3 hours before"},{value:"5",label:"5 hours before (recommended)"},{value:"12",label:"12 hours before"},{value:"24",label:"24 hours before"}]}
            hint="How far in advance to send the approval request"/>
        </div>
        <div onClick={()=>setForm(f=>({...f,enabled:!f.enabled}))} style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px",background:form.enabled?`${S.teal}12`:S.surface2,borderRadius:10,border:`1.5px solid ${form.enabled?S.teal+"40":S.border}`,cursor:"pointer",userSelect:"none",marginBottom:4}}>
          <div style={{width:46,height:26,borderRadius:13,background:form.enabled?S.teal:S.border,position:"relative",flexShrink:0,transition:"background 0.2s"}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:form.enabled?23:3,transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
          </div>
          <div>
            <p style={{color:form.enabled?S.teal:S.textSecondary,fontWeight:700,fontSize:13,margin:0}}>{form.enabled?"✅ Telegram approvals ENABLED":"Telegram approvals disabled"}</p>
            <p style={{color:S.textMuted,fontSize:11,margin:"3px 0 0"}}>{form.enabled?`You'll receive an approval card ${form.hoursBefore}h before each scheduled post`:"Toggle on to activate Telegram approval workflow"}</p>
          </div>
        </div>
      </Card>
      {form.botToken && form.chatId && (
        <Card style={{marginBottom:14}}>
          <p style={{color:S.tg,fontWeight:800,fontSize:12,margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Step 3 — Test It</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <Btn onClick={sendTestMsg} loading={testing} variant="secondary" icon={<span>📨</span>}>Send Test Message</Btn>
            <Btn onClick={sendMockCard} loading={testing} variant="tg" icon={<Icon path={IC.telegram} size={13}/>}>Send Mock Approval Card</Btn>
          </div>
          <p style={{color:S.textMuted,fontSize:11,marginTop:10,lineHeight:1.6}}>The mock card sends the exact approval experience — with real ✅ Post and ❌ Reject buttons. Tapping ❌ on the mock will trigger the feedback flow so you can test the full loop.</p>
        </Card>
      )}
      {tg.enabled && (
        <div style={{padding:"10px 16px",background:`${S.tg}10`,border:`1px solid ${S.tg}30`,borderRadius:10,marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:S.tg,display:"inline-block",animation:"pulse 2s infinite"}}/>
          <span style={{color:S.tg,fontSize:12,fontWeight:600}}>Active — polling every 3 seconds (server-side)</span>
          {tg.lastPolled && <span style={{color:S.textMuted,fontSize:11,marginLeft:"auto"}}>Last update: {new Date(tg.lastPolled).toLocaleTimeString()}</span>}
        </div>
      )}
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <Btn onClick={save} loading={saving} icon={<Icon path={IC.check} size={14} color="#fff"/>}>Save Telegram Settings</Btn>
      </div>
    </div>
  );
}

// ─── SOCIAL ACCOUNTS VIEW ─────────────────────────────────────────────────────
function SocialAccountsView({data,onSave,onToast}){
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState({});
  const accounts = data.socialAccounts||DEF_SOCIAL;

  const startEdit = p => { setEditing(p); setForm({...(accounts[p]||{})}); };
  const saveAccount = async (p) => {
    try {
      const r = await api.updateSocialAccount(p, form);
      const connected = r.connected;
      onSave({socialAccounts:{...accounts,[p]:{...form,connected}}});
      setEditing(null);
      onToast(`${SOCIALS[p].label} ${connected?"connected":"saved"}`, connected?"success":"info");
    } catch(e){ onToast("Save failed: "+e.message,"error"); }
  };
  const disconnect = async (p) => {
    try {
      await api.disconnectSocialAccount(p);
      onSave({socialAccounts:{...accounts,[p]:{...DEF_SOCIAL[p]}}});
      onToast(`${SOCIALS[p].label} disconnected`,"info");
    } catch(e){ onToast("Disconnect failed: "+e.message,"error"); }
  };

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:24,fontWeight:800,color:S.textPrimary,margin:0}}>Social Accounts</h1>
        <p style={{color:S.textSecondary,marginTop:6,fontSize:14}}>Connect accounts so the system can auto-publish when you approve posts via Telegram</p>
      </div>
      <div style={{background:S.primaryDim,border:`1px solid ${S.primary}30`,borderRadius:12,padding:16,marginBottom:20}}>
        <p style={{color:S.primary,fontWeight:700,fontSize:13,margin:"0 0 4px"}}>How auto-publishing works</p>
        <p style={{color:S.textSecondary,fontSize:13,margin:0}}>When you tap <strong>✅ Post it</strong> in Telegram, the system immediately publishes to all connected accounts below. Make sure accounts are connected before scheduling posts.</p>
      </div>
      {Object.entries(SOCIALS).map(([p,cfg])=>{
        const acc = accounts[p]||{};
        const ok = acc.connected;
        return(
          <Card key={p} style={{marginBottom:16}} accent={ok?cfg.color:null}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:editing===p?20:0}}>
              <div style={{width:44,height:44,borderRadius:12,background:`${cfg.color}18`,border:`1.5px solid ${cfg.color}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Icon path={IC[cfg.icon]} size={22} color={cfg.color}/>
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontWeight:800,color:S.textPrimary,fontSize:15}}>{cfg.label}</span>
                  {ok
                    ? <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,background:`${S.teal}18`,color:S.teal,fontSize:11,fontWeight:700}}><span style={{width:6,height:6,borderRadius:"50%",background:S.teal,display:"inline-block"}}/>Connected</span>
                    : <span style={{padding:"3px 10px",borderRadius:20,background:`${S.textMuted}18`,color:S.textMuted,fontSize:11,fontWeight:700}}>Not connected</span>
                  }
                </div>
                {ok && <div style={{fontSize:12,color:S.textSecondary,marginTop:3}}>{acc.pageName||acc.username||acc.profileName||"Connected"}</div>}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn size="sm" variant={editing===p?"secondary":"outline"} onClick={()=>editing===p?setEditing(null):startEdit(p)}>{editing===p?"Cancel":ok?"Edit":"Connect"}</Btn>
                {ok && <Btn size="sm" variant="danger" onClick={()=>disconnect(p)}>Disconnect</Btn>}
              </div>
            </div>
            {editing===p && (
              <div style={{borderTop:`1px solid ${S.border}`,paddingTop:20,marginTop:4}}>
                <div style={{background:S.surface2,borderRadius:10,padding:14,marginBottom:16,border:`1px solid ${S.border}`}}>
                  <p style={{color:S.amber,fontWeight:700,fontSize:12,margin:"0 0 8px"}}>📋 Setup Guide — {cfg.label}</p>
                  <ol style={{color:S.textSecondary,fontSize:12,lineHeight:1.9,margin:"0 0 8px",paddingLeft:18}}>
                    {cfg.guide.map((step,i)=><li key={i}>{step}</li>)}
                  </ol>
                  <a href={cfg.docsUrl} target="_blank" rel="noreferrer" style={{color:S.primary,fontSize:11,fontWeight:600}}>Full API documentation →</a>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                  {cfg.fields.map(f=>(
                    <Input key={f.key} label={f.label} value={form[f.key]||""} onChange={v=>setForm(x=>({...x,[f.key]:v}))} type={f.secret?"password":"text"} placeholder={f.secret?"Paste token/key here...":"Enter ID..."} hint={f.hint}/>
                  ))}
                </div>
                <div style={{display:"flex",gap:10,marginTop:8}}>
                  <Btn onClick={()=>saveAccount(p)} icon={<Icon path={IC.check} size={14} color="#fff"/>}>Save & Connect {cfg.label}</Btn>
                  <Btn variant="secondary" onClick={()=>setEditing(null)}>Cancel</Btn>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      <Card style={{background:S.surface2}}>
        <p style={{color:S.textPrimary,fontWeight:700,fontSize:13,margin:"0 0 14px"}}>Connection Status</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {Object.entries(SOCIALS).map(([p,c])=>{
            const ok = accounts[p]?.connected;
            return(<div key={p} style={{textAlign:"center",padding:"14px 8px",borderRadius:10,background:ok?`${c.color}12`:S.surface3,border:`1px solid ${ok?c.color+"40":S.border}`}}>
              <Icon path={IC[c.icon]} size={22} color={ok?c.color:S.textMuted}/>
              <p style={{fontSize:12,fontWeight:700,color:ok?c.color:S.textMuted,margin:"8px 0 3px"}}>{c.label}</p>
              <p style={{fontSize:10,color:ok?S.teal:S.coral,margin:0,fontWeight:600}}>{ok?"● Ready":"○ Not set"}</p>
            </div>);
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── SCHEDULE VIEW ────────────────────────────────────────────────────────────
function ScheduleView({data,onSave,onToast}){
  const [publishingId,setPublishingId]=useState(null);
  const posts    = data.posts||[];
  const tg       = data.telegram||DEF_TELEGRAM;
  const minDt    = new Date(Date.now()+5*60000).toISOString().slice(0,16);

  const setSchedule = async (postId, datetime) => {
    try {
      await api.schedulePost(postId, datetime);
      onSave({posts:posts.map(p=>p.id===postId?{...p,scheduledFor:datetime,status:"scheduled",tgNotified:false}:p)});
      onToast(tg.enabled?`Scheduled — Telegram alert sent ${tg.hoursBefore}h before publish`:"Scheduled — will auto-publish at that time","success");
    } catch(e){ onToast(e.message,"error"); }
  };

  const publishNow = async (post) => {
    setPublishingId(post.id);
    try {
      const result = await api.publishPost(post.id);
      onSave({posts:posts.map(p=>p.id===post.id?{...p,...result}:p)});
      onToast("Published ✓","success");
    } catch(e){ onToast(e.message,"error"); }
    setPublishingId(null);
  };

  const sendToTg = async (post) => {
    try {
      await api.sendToTelegram(post.id);
      onSave({posts:posts.map(p=>p.id===post.id?{...p,tgNotified:true}:p)});
      onToast("Approval card sent to Telegram","success");
    } catch(e){ onToast("Telegram send failed: "+e.message,"error"); }
  };

  const PostRow = ({post,showScheduleInput}) => {
    const platResults = post.publishResults||{};
    return(
      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
          <div style={{fontSize:22,flexShrink:0,marginTop:2}}>{FORMATS[post.format]?.emoji||"📝"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
              <Badge color={statusColor(post.status)}>{post.status.replace(/_/g," ")}</Badge>
              {post.tgNotified && <Badge color={S.tg}>📱 Telegram sent</Badge>}
              {post.rejectedWith && <Badge color={S.amber}>🔄 Regenerated</Badge>}
            </div>
            {post.imageUrl && <img src={post.imageUrl} alt="" style={{width:72,height:72,objectFit:"cover",borderRadius:8,border:`1px solid ${S.border}`,float:"right",marginLeft:12}}/>}
            <p style={{fontSize:13,color:S.textPrimary,margin:"0 0 8px",lineHeight:1.65,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{post.body}</p>
            {post.rejectedWith && <p style={{fontSize:11,color:S.amber,margin:"0 0 8px",fontStyle:"italic"}}>Feedback used: "{post.rejectedWith}"</p>}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {Object.entries(post.platforms||{}).filter(([,v])=>v).map(([p])=>{
                const pl=SOCIALS[p];const res=platResults[p];
                return(<div key={p} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:20,background:res?.success?`${S.teal}15`:res?.error?`${S.coral}15`:`${pl.color}15`}}>
                  <Icon path={IC[pl.icon]} size={11} color={res?.success?S.teal:res?.error?S.coral:pl.color}/>
                  <span style={{fontSize:10,fontWeight:700,color:res?.success?S.teal:res?.error?S.coral:pl.color}}>{pl.label}{res?.success?" ✓":res?.error?" ✕":""}</span>
                </div>);
              })}
            </div>
            {showScheduleInput && (
              <div style={{display:"flex",gap:14,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div>
                  <label style={{display:"block",fontSize:11,color:S.textSecondary,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:5}}>Schedule date & time</label>
                  <input type="datetime-local" min={minDt}
                    onChange={e=>e.target.value&&setSchedule(post.id,new Date(e.target.value).toISOString())}
                    style={{background:S.surface2,border:`1px solid ${S.border}`,borderRadius:8,padding:"8px 12px",color:S.textPrimary,fontSize:13,fontFamily:"inherit",outline:"none",colorScheme:"dark"}}/>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span style={{color:S.textMuted,fontSize:13,display:"flex",alignItems:"center"}}>or</span>
                  <Btn size="sm" variant="success" onClick={()=>publishNow(post)} loading={publishingId===post.id} icon={<Icon path={IC.send} size={12}/>}>Publish Now</Btn>
                  {tg.enabled && <Btn size="sm" variant="tg" onClick={()=>sendToTg(post)} icon={<Icon path={IC.telegram} size={12}/>}>Send to Telegram</Btn>}
                </div>
              </div>
            )}
            {post.status==="scheduled"&&post.scheduledFor&&(
              <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{padding:"8px 14px",background:`${S.primary}15`,borderRadius:8,border:`1px solid ${S.primary}40`,display:"flex",alignItems:"center",gap:8}}>
                  <Icon path={IC.clock} size={14} color={S.primary}/>
                  <span style={{fontSize:13,color:S.textPrimary,fontWeight:600}}>{new Date(post.scheduledFor).toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                  {tg.enabled&&!post.tgNotified&&<span style={{fontSize:11,color:S.textMuted}}>· TG alert {tg.hoursBefore}h before</span>}
                  {tg.enabled&&post.tgNotified&&<span style={{fontSize:11,color:S.tg,fontWeight:600}}>· 📱 Approval sent</span>}
                </div>
                <Btn size="sm" variant="success" onClick={()=>publishNow(post)} loading={publishingId===post.id} icon={<Icon path={IC.send} size={12}/>}>Publish Now</Btn>
                {tg.enabled&&!post.tgNotified&&<Btn size="sm" variant="tg" onClick={()=>sendToTg(post)} icon={<Icon path={IC.telegram} size={12}/>}>Send to Telegram Now</Btn>}
              </div>
            )}
            {post.status==="published"&&(
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:`${S.teal}12`,borderRadius:8,border:`1px solid ${S.teal}40`}}>
                <Icon path={IC.check} size={14} color={S.teal}/>
                <span style={{fontSize:12,color:S.teal,fontWeight:700}}>Published {new Date(post.publishedAt||post.createdAt).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
              </div>
            )}
            {post.status==="awaiting_feedback"&&(
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:`${S.tg}12`,borderRadius:8,border:`1px solid ${S.tg}40`}}>
                <Icon path={IC.telegram} size={14} color={S.tg}/>
                <span style={{fontSize:12,color:S.tg,fontWeight:600}}>Waiting for your Telegram feedback — reply to the bot with your rejection reason</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const sections = [
    {label:"Approved — Ready to Schedule",posts:posts.filter(p=>p.status==="approved"),showInput:true,color:S.teal,empty:"No approved posts. Generate → approve first."},
    {label:`Scheduled (${posts.filter(p=>p.status==="scheduled").length})`,posts:posts.filter(p=>p.status==="scheduled"&&p.scheduledFor),showInput:false,color:S.primary,empty:"No scheduled posts."},
    {label:`Published (${posts.filter(p=>p.status==="published").length})`,posts:posts.filter(p=>p.status==="published"),showInput:false,color:S.purple,empty:"No published posts yet."},
  ];

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:24,fontWeight:800,color:S.textPrimary,margin:0}}>Schedule & Publish</h1>
        <p style={{color:S.textSecondary,marginTop:6,fontSize:14}}>{tg.enabled?`Telegram active — approval sent ${tg.hoursBefore}h before each scheduled post`:"Schedule posts — auto-publishes at the exact time set"}</p>
      </div>
      {tg.enabled && (
        <div style={{background:`${S.tg}12`,border:`1px solid ${S.tg}35`,borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
          <Icon path={IC.telegram} size={20} color={S.tg}/>
          <div>
            <p style={{color:S.tg,fontWeight:700,fontSize:13,margin:"0 0 2px"}}>Telegram approval mode active</p>
            <p style={{color:S.textSecondary,fontSize:12,margin:0}}>{tg.hoursBefore}h before each post: you get a Telegram card → tap ✅ to publish everywhere, ❌ to reject and regenerate with your feedback.</p>
          </div>
        </div>
      )}
      {posts.some(p=>p.status==="awaiting_feedback") && (
        <div style={{background:`${S.tg}12`,border:`1px solid ${S.tg}35`,borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
          <Icon path={IC.telegram} size={20} color={S.tg}/>
          <div>
            <p style={{color:S.tg,fontWeight:700,fontSize:13,margin:"0 0 2px"}}>⏳ Waiting for your Telegram rejection feedback</p>
            <p style={{color:S.textSecondary,fontSize:12,margin:0}}>Reply to the bot in Telegram with your reason — the AI will regenerate and re-send the approval card instantly.</p>
          </div>
        </div>
      )}
      {sections.map(section=>(
        <div key={section.label} style={{marginBottom:28}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{width:3,height:20,borderRadius:2,background:section.color}}/>
            <h2 style={{fontSize:15,fontWeight:700,color:S.textPrimary,margin:0}}>{section.label}</h2>
          </div>
          {section.posts.length===0
            ? <div style={{padding:24,textAlign:"center",background:S.surface2,borderRadius:12,border:`1px dashed ${S.border}`,color:S.textMuted,fontSize:13}}>{section.empty}</div>
            : section.posts.map(post=><PostRow key={post.id} post={post} showScheduleInput={section.showInput}/>)
          }
        </div>
      ))}
    </div>
  );
}

// ─── GENERATE VIEW ────────────────────────────────────────────────────────────
function GenerateView({data,onSave,onToast}){
  const [format,setFormat]=useState("text");
  const [contentType,setContentType]=useState("Educational");
  const [topic,setTopic]=useState("");
  const [imageStyle,setImageStyle]=useState("professional poster");
  const [generating,setGenerating]=useState(false);
  const [agents,setAgents]=useState([]);
  const [result,setResult]=useState(null);
  const [error,setError]=useState("");

  const enabled = Object.entries(data.company?.platforms||{}).filter(([,v])=>v).map(([k])=>k);
  const agentNames = ["Brand Knowledge","Industry Research","Content Strategy","Universal Copy Agent",...(format==="photo"?["Image Prompt Agent","Bedrock Image (AWS)"]:[]),"Quality Assurance","Brand Compliance"];

  const run = async () => {
    if (!enabled.length){onToast("Enable platforms in Setup → Platforms","error");return;}
    if (format==="photo"&&!data.bedrock?.enabled){onToast("Enable AWS Bedrock image generation in Setup → API Keys","error");return;}

    setGenerating(true);setError("");setResult(null);
    setAgents(agentNames.map((n,i)=>({name:n,status:i===0?"running":"idle"})));

    let step = 0;
    const animTimer = setInterval(()=>{
      step++;
      if(step < agentNames.length){
        setAgents(prev=>prev.map((a,i)=>i<step?{...a,status:"done"}:i===step?{...a,status:"running"}:a));
      }
    }, 1400);

    try {
      const newPost = await api.generateContent({format,contentType,topic,imageStyle});
      clearInterval(animTimer);
      setAgents(prev=>prev.map(a=>({...a,status:"done"})));
      setResult(newPost);
      onSave({posts:[...(data.posts||[]),newPost]});
      onToast(
        format==="photo"&&newPost.imageUrl?"Post + Bedrock image generated ✓":
        format==="photo"&&newPost.imageError?"Post generated (image failed — check Bedrock config)":
        "Post generated ✓","success"
      );
    } catch(e){
      clearInterval(animTimer);
      setError(e.message);
      onToast("Failed: "+e.message,"error");
      setAgents(prev=>prev.map(a=>a.status==="running"?{...a,status:"error"}:a));
    }
    setGenerating(false);
  };

  const approve = async (id) => {
    try {
      await api.approvePost(id);
      onSave({posts:data.posts.map(p=>p.id===id?{...p,status:"approved"}:p)});
      if(result?.id===id) setResult(r=>({...r,status:"approved"}));
      onToast("Approved — go to Schedule & Publish to set a time","success");
    } catch(e){ onToast(e.message,"error"); }
  };
  const reject = async (id) => {
    try {
      await api.rejectPost(id);
      onSave({posts:data.posts.map(p=>p.id===id?{...p,status:"rejected"}:p)});
      if(result?.id===id) setResult(r=>({...r,status:"rejected"}));
      onToast("Rejected","info");
    } catch(e){ onToast(e.message,"error"); }
  };

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:24,fontWeight:800,color:S.textPrimary,margin:0}}>Generate Content</h1>
        <p style={{color:S.textSecondary,marginTop:5,fontSize:14}}>One post + optional image — published via Telegram approval to all connected platforms</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:22}}>
        <div>
          <Card>
            <p style={{fontWeight:800,color:S.textPrimary,fontSize:11,margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Format</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18}}>
              {Object.values(FORMATS).map(fmt=>{const a=format===fmt.id;return(
                <button key={fmt.id} onClick={()=>setFormat(fmt.id)} style={{padding:"14px 10px",borderRadius:10,border:`2px solid ${a?fmt.color+"80":S.border}`,background:a?`${fmt.color}12`:S.surface2,cursor:"pointer",textAlign:"center",fontFamily:"inherit",transition:"all 0.15s"}}>
                  <div style={{fontSize:24,marginBottom:6}}>{fmt.emoji}</div>
                  <div style={{fontSize:12,fontWeight:700,color:a?fmt.color:S.textPrimary,marginBottom:3}}>{fmt.label}</div>
                  <div style={{fontSize:10,color:S.textMuted,lineHeight:1.4}}>{fmt.desc}</div>
                </button>
              );})}
            </div>
            {format==="photo"&&<Select label="Image Style" value={imageStyle} onChange={setImageStyle} options={IMG_STYLES}/>}
            {format==="photo"&&!data.bedrock?.enabled&&<div style={{padding:10,background:`${S.amber}12`,border:`1px solid ${S.amber}35`,borderRadius:8,marginBottom:14,fontSize:11,color:S.amber}}>⚠ Enable AWS Bedrock image generation in Setup → API Keys</div>}
            {format==="photo"&&data.bedrock?.enabled&&<div style={{padding:10,background:`${S.teal}10`,border:`1px solid ${S.teal}30`,borderRadius:8,marginBottom:14}}>
              <p style={{fontSize:11,color:S.teal,margin:0,fontWeight:600}}>🎨 {data.bedrock?.modelId?.includes("nova")?"Nova Canvas":"Titan Image Generator"}</p>
              <p style={{fontSize:10,color:S.textMuted,margin:"2px 0 0"}}>1024×1024 PNG · {data.bedrock?.region||"us-east-1"}</p>
            </div>}
            <div style={{padding:"12px 14px",background:S.surface2,borderRadius:10,border:`1px solid ${S.border}`,marginBottom:14}}>
              <p style={{fontSize:11,fontWeight:700,color:S.textSecondary,textTransform:"uppercase",margin:"0 0 8px"}}>Publishing to</p>
              {enabled.length===0?<p style={{color:S.coral,fontSize:12,margin:0}}>No platforms enabled. Go to Setup.</p>:
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{enabled.map(p=>{const pl=PL[p];return(<div key={p} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:20,background:`${pl.color}18`}}><Icon path={IC[pl.icon]} size={11} color={pl.color}/><span style={{fontSize:11,fontWeight:700,color:pl.color}}>{pl.label}</span></div>);})}</div>}
            </div>
            <Select label="Content Type" value={contentType} onChange={setContentType} options={CONTENT_TYPES.map(t=>({value:t,label:t}))}/>
            <Input label="Topic (optional)" value={topic} onChange={setTopic} placeholder="Leave blank = AI picks from your industry"/>
            <Btn full onClick={run} disabled={generating||!enabled.length} loading={generating} icon={<Icon path={IC.zap} size={14} color="#fff"/>}>
              {generating?"Generating...":"Generate Post"}
            </Btn>
          </Card>
          {agents.length>0&&(
            <Card style={{marginTop:14}}>
              <p style={{fontWeight:800,color:S.textPrimary,fontSize:11,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Pipeline</p>
              {agents.map((a,i)=><AgentRow key={i} name={a.name} status={a.status} index={i}/>)}
            </Card>
          )}
        </div>
        <div>
          {!result&&!generating&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:440,background:S.surface,borderRadius:14,border:`1px dashed ${S.border}`}}>
              <div style={{fontSize:56,marginBottom:14}}>{FORMATS[format].emoji}</div>
              <p style={{color:S.textPrimary,fontWeight:700,fontSize:16,margin:0}}>{FORMATS[format].label}</p>
              <p style={{color:S.textMuted,fontSize:13,marginTop:8,textAlign:"center",maxWidth:340,lineHeight:1.6}}>
                {format==="photo"?"Writes a post + generates a real AI image. Approve → schedule → Telegram sends approval card automatically.":"Writes one post for all your enabled platforms. Approve → schedule → publishes automatically or via Telegram."}
              </p>
            </div>
          )}
          {result&&(
            <Card accent={FORMATS[result.format]?.color}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                <div style={{fontSize:26}}>{FORMATS[result.format]?.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <span style={{fontWeight:800,color:S.textPrimary,fontSize:14}}>{FORMATS[result.format]?.label}</span>
                    <Badge color={statusColor(result.status)}>{result.status}</Badge>
                    {result.imageUrl&&<Badge color={S.teal}>🎨 AWS Bedrock</Badge>}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {Object.entries(result.platforms||{}).filter(([,v])=>v).map(([p])=>{const pl=PL[p];return(<div key={p} style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:10,background:`${pl.color}18`}}><Icon path={IC[pl.icon]} size={10} color={pl.color}/><span style={{fontSize:10,fontWeight:700,color:pl.color}}>{pl.label}</span></div>);})}
                  </div>
                </div>
              </div>
              {result.format==="photo"&&(
                <div style={{marginBottom:14,borderRadius:10,overflow:"hidden",border:`1px solid ${S.border}`}}>
                  {result.imageUrl
                    ?<><img src={result.imageUrl} alt="Generated" style={{width:"100%",maxHeight:360,objectFit:"contain",background:"#000",display:"block"}}/><div style={{padding:"10px 14px",background:S.surface2,display:"flex",gap:10}}><Btn size="sm" variant="ghost" onClick={()=>window.open(result.imageUrl,"_blank")} icon={<Icon path={IC.eye} size={11}/>}>View</Btn><Btn size="sm" variant="ghost" onClick={()=>window.open(result.imageUrl,"_blank")} icon={<Icon path={IC.down} size={11}/>}>Download</Btn></div></>
                    :result.imageError?<div style={{padding:16,background:`${S.coral}08`,color:S.coral,fontSize:13}}>Image error: {result.imageError}</div>
                    :<div style={{padding:24,textAlign:"center",color:S.textMuted,fontSize:13}}>No image — enable AWS Bedrock in Setup</div>
                  }
                </div>
              )}
              <div style={{background:S.surface2,borderRadius:10,padding:14,marginBottom:14,fontSize:13,color:S.textPrimary,lineHeight:1.8,whiteSpace:"pre-wrap",maxHeight:260,overflowY:"auto",border:`1px solid ${S.border}`}}>{result.body}</div>
              <div style={{marginBottom:14,padding:14,background:S.surface2,borderRadius:10,border:`1px solid ${S.border}`}}>
                <ScoreBar score={result.qaScore||88} label="Quality"/><ScoreBar score={result.brandScore||90} label="Brand Compliance"/><ScoreBar score={result.factScore||91} label="Fact Confidence"/>
              </div>
              {result.status==="pending"&&(
                <div style={{display:"flex",gap:10}}>
                  <Btn variant="success" onClick={()=>approve(result.id)} icon={<Icon path={IC.check} size={14}/>}>Approve Post</Btn>
                  <Btn variant="danger" onClick={()=>reject(result.id)} icon={<Icon path={IC.xmark} size={14}/>}>Reject</Btn>
                </div>
              )}
              {result.status==="approved"&&(
                <div style={{padding:"12px 16px",background:`${S.teal}12`,borderRadius:10,border:`1px solid ${S.teal}40`}}>
                  <p style={{color:S.teal,fontWeight:700,fontSize:13,margin:"0 0 4px"}}>✓ Approved</p>
                  <p style={{color:S.textSecondary,fontSize:12,margin:0}}>Go to <strong>Schedule & Publish</strong> to set a date & time. If Telegram is enabled, you'll get an approval card {data.telegram?.hoursBefore||5}h before it publishes.</p>
                </div>
              )}
            </Card>
          )}
          {error&&<Card style={{borderColor:S.coral+"40",background:`${S.coral}08`,marginTop:14}}><p style={{color:S.coral,margin:0,fontSize:13}}>{error}</p></Card>}
        </div>
      </div>
    </div>
  );
}

// ─── SETUP VIEW ───────────────────────────────────────────────────────────────
function SetupView({data,onSave,onToast}){
  const [form,setForm]=useState({...DEF_COMPANY,...data.company});
  const [apiKey,setApiKey]=useState(data.apiKey||"");
  const [bedrockKeys,setBedrockKeys]=useState({accessKey:data.bedrock?.accessKey||"",secretKey:data.bedrock?.secretKey||""});
  const [bedrockDetected,setBedrockDetected]=useState(
    data.bedrock?.enabled ? {region:data.bedrock.region, modelId:data.bedrock.modelId} : null
  );
  const [bedrockDetecting,setBedrockDetecting]=useState(false);
  const [bedrockError,setBedrockError]=useState("");
  const [saving,setSaving]=useState(false);
  const [tab,setTab]=useState("company");
  const tabs=[{id:"company",label:"Company"},{id:"brand",label:"Brand"},{id:"platforms",label:"Platforms"},{id:"api",label:"API Keys"}];
  const set=f=>v=>setForm(p=>({...p,[f]:v}));
  const togglePlat=p=>setForm(f=>({...f,platforms:{...f.platforms,[p]:!f.platforms[p]}}));
  const VOICES=["professional","conversational","authoritative","friendly","inspirational","bold"];
  const TONES=["authoritative","empathetic","witty","data-driven","storytelling","direct"];

  const runBedrockDetect = async () => {
    const {accessKey, secretKey} = bedrockKeys;
    if (!accessKey || !secretKey) return;
    setBedrockDetecting(true); setBedrockError(""); setBedrockDetected(null);
    try {
      const r = await api.testBedrock(accessKey, secretKey);
      setBedrockDetected({region: r.region, modelId: r.modelId});
    } catch(e){ setBedrockError(e.message); }
    setBedrockDetecting(false);
  };

  const setBedrockKey = k => v => {
    setBedrockKeys(prev=>({...prev,[k]:v}));
    setBedrockDetected(null);
    setBedrockError("");
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.updateSettings({
          apiKey,
          bedrock:{
            accessKey: bedrockKeys.accessKey,
            secretKey: bedrockKeys.secretKey,
            region: bedrockDetected?.region || data.bedrock?.region || "us-east-1",
            modelId: bedrockDetected?.modelId || data.bedrock?.modelId || "amazon.nova-canvas-v1:0",
            enabled: !!bedrockDetected || !!data.bedrock?.enabled,
          },
          setupComplete:!!(form.name&&form.industry),
        }),
        api.updateCompany(form)
      ]);
      onSave({apiKey, bedrock:{...bedrockKeys,...(bedrockDetected||{}),enabled:!!bedrockDetected||!!data.bedrock?.enabled}, company:form, setupComplete:!!(form.name&&form.industry)});
      onToast("Settings saved","success");
    } catch(e){ onToast("Save failed: "+e.message,"error"); }
    setSaving(false);
  };

  return(
    <div>
      <div style={{marginBottom:24}}><h1 style={{fontSize:24,fontWeight:800,color:S.textPrimary,margin:0}}>Setup</h1><p style={{color:S.textSecondary,marginTop:5,fontSize:14}}>All settings here are used by the AI agents — update any time</p></div>
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${S.border}`,marginBottom:22}}>{tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 18px",border:"none",background:"transparent",color:tab===t.id?S.primary:S.textSecondary,fontSize:13,fontWeight:tab===t.id?700:500,cursor:"pointer",borderBottom:`2px solid ${tab===t.id?S.primary:"transparent"}`,marginBottom:-1,fontFamily:"inherit"}}>{t.label}</button>)}</div>

      {tab==="company"&&<Card><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}><Input label="Company Name" value={form.name} onChange={set("name")} placeholder="Acme Corp" required/><Input label="Industry" value={form.industry} onChange={set("industry")} placeholder="SaaS, Healthcare, E-commerce..." required/><Input label="Website" value={form.website} onChange={set("website")} placeholder="https://..."/><Input label="Company Size" value={form.companySize} onChange={set("companySize")} placeholder="1-10, 50-200..."/></div><Input label="Description" value={form.description} onChange={set("description")} multiline rows={3} placeholder="What do you do? Problem solved? What makes you different?" required/><Input label="Products & Services" value={form.products} onChange={set("products")} multiline rows={2} placeholder="List your main offerings..."/><Input label="Target Audience" value={form.targetAudience} onChange={set("targetAudience")} multiline rows={2} placeholder="Role, pain points, goals of your ideal customer..."/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}><Input label="Competitor URLs" value={form.competitors} onChange={set("competitors")} placeholder="competitor.com, ..."/><Input label="Keywords & Topics" value={form.keywords} onChange={set("keywords")} placeholder="AI, productivity, B2B..."/></div></Card>}

      {tab==="brand"&&<Card><Select label="Brand Voice" value={form.brandVoice} onChange={set("brandVoice")} options={VOICES.map(v=>({value:v,label:v[0].toUpperCase()+v.slice(1)}))}/><Select label="Content Tone" value={form.tone} onChange={set("tone")} options={TONES.map(v=>({value:v,label:v[0].toUpperCase()+v.slice(1)}))}/><Input label="Brand Guidelines & Rules" value={form.brandGuidelines||""} onChange={set("brandGuidelines")} multiline rows={4} placeholder="Phrases to avoid, required disclaimers, off-brand topics..."/><Select label="Approval Mode" value={form.approvalMode} onChange={set("approvalMode")} options={[{value:"auto",label:"Auto-approve all"},{value:"selective",label:"Manual review"},{value:"always",label:"Always require approval"}]}/></Card>}

      {tab==="platforms"&&<Card><p style={{color:S.textSecondary,fontSize:13,marginBottom:18}}>Enable the platforms you want to post on. Connect credentials in Social Accounts.</p>{Object.entries(PL).map(([key,pl])=>(<div key={key} onClick={()=>togglePlat(key)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px",borderRadius:12,marginBottom:10,background:form.platforms[key]?`${pl.color}12`:S.surface2,border:`1.5px solid ${form.platforms[key]?pl.color+"50":S.border}`,cursor:"pointer",transition:"all 0.15s"}}><div style={{display:"flex",alignItems:"center",gap:14}}><Icon path={IC[pl.icon]} color={form.platforms[key]?pl.color:S.textMuted} size={22}/><div><div style={{fontWeight:700,color:S.textPrimary,fontSize:14}}>{pl.label}</div><div style={{fontSize:12,color:S.textMuted,marginTop:2}}>One universal post published here</div></div></div><div style={{width:24,height:24,borderRadius:"50%",background:form.platforms[key]?pl.color:"transparent",border:`2px solid ${form.platforms[key]?pl.color:S.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{form.platforms[key]&&<Icon path={IC.check} size={13} color="#fff"/>}</div></div>))}</Card>}

      {tab==="api"&&<Card>
        <div style={{background:S.primaryDim,border:`1px solid ${S.primary}30`,borderRadius:10,padding:16,marginBottom:22}}>
          <p style={{color:S.primary,fontWeight:700,margin:"0 0 5px",fontSize:13}}>API Keys — stored encrypted in local database</p>
          <p style={{color:S.textSecondary,fontSize:13,margin:0}}>Keys are encrypted with AES-256 (Fernet) and stored in the local SQLite database. Never sent to any third-party server.</p>
        </div>
        <div style={{marginBottom:22,paddingBottom:22,borderBottom:`1px solid ${S.border}`}}>
          <p style={{fontSize:13,fontWeight:700,color:S.textPrimary,margin:"0 0 12px"}}>Claude (Anthropic) — writes all post copy</p>
          <Input label="Anthropic API Key" value={apiKey} onChange={setApiKey} type="password" placeholder="sk-ant-api03-..." hint="Required. Get at console.anthropic.com"/>
          {apiKey&&<div style={{display:"flex",alignItems:"center",gap:7,marginTop:-8}}><div style={{width:7,height:7,borderRadius:"50%",background:S.teal}}/><span style={{fontSize:12,color:S.teal,fontWeight:600}}>{apiKey===SENTINEL?"Previously saved ✓":"Set ✓"}</span></div>}
        </div>
        <div style={{marginBottom:22,paddingBottom:22,borderBottom:`1px solid ${S.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{width:32,height:32,borderRadius:8,background:`${S.teal}20`,border:`1px solid ${S.teal}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🎨</div>
            <div>
              <p style={{fontSize:13,fontWeight:700,color:S.textPrimary,margin:0}}>AWS Bedrock — Image Generation</p>
              <p style={{fontSize:11,color:S.textSecondary,margin:"2px 0 0"}}>Enter your IAM credentials — region and model auto-detected</p>
            </div>
          </div>

          <div style={{background:`${S.amber}10`,border:`1px solid ${S.amber}30`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:S.textSecondary,lineHeight:1.7}}>
            <strong style={{color:S.amber}}>Setup:</strong> AWS Console → IAM → Users → Create user → attach <code style={{background:S.surface3,padding:"1px 5px",borderRadius:3}}>AmazonBedrockFullAccess</code> → Security credentials → Create access key → copy both values below.
            Also enable <strong style={{color:S.textPrimary}}>Amazon Nova Canvas</strong> under Bedrock → Model access.
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Input label="Access Key ID" value={bedrockKeys.accessKey} onChange={setBedrockKey("accessKey")} type="password"
              placeholder="AKIA…" hint="Starts with AKIA"/>
            <Input label="Secret Access Key" value={bedrockKeys.secretKey} onChange={setBedrockKey("secretKey")} type="password"
              placeholder="40-character secret…" hint="Generated alongside the access key"/>
          </div>

          <Btn
            variant="secondary"
            size="sm"
            onClick={runBedrockDetect}
            loading={bedrockDetecting}
            disabled={!bedrockKeys.accessKey || !bedrockKeys.secretKey || bedrockKeys.accessKey.includes("•")}
            icon={<Icon path={IC.refresh} size={12}/>}
          >
            Test Connection
          </Btn>

          {bedrockDetecting && (
            <div style={{marginTop:12,padding:"12px 16px",background:`${S.primary}10`,border:`1px solid ${S.primary}30`,borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:14,height:14,border:`2px solid ${S.primary}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.6s linear infinite",flexShrink:0}}/>
              <div>
                <p style={{color:S.primary,fontWeight:700,fontSize:13,margin:"0 0 2px"}}>Scanning AWS regions…</p>
                <p style={{color:S.textMuted,fontSize:11,margin:0}}>Trying us-east-1, us-west-2 and more — ~10 seconds</p>
              </div>
            </div>
          )}

          {bedrockDetected && !bedrockDetecting && (
            <div style={{marginTop:12,padding:"14px 16px",background:`${S.teal}10`,border:`1px solid ${S.teal}35`,borderRadius:10}}>
              <p style={{color:S.teal,fontWeight:800,fontSize:13,margin:"0 0 8px"}}>✓ Connected — ready to generate images</p>
              <div style={{display:"flex",gap:24}}>
                <div><p style={{color:S.textMuted,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 2px"}}>Region</p><p style={{color:S.textPrimary,fontSize:13,fontWeight:700,margin:0}}>{bedrockDetected.region}</p></div>
                <div><p style={{color:S.textMuted,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 2px"}}>Model</p><p style={{color:S.textPrimary,fontSize:13,fontWeight:700,margin:0}}>{bedrockDetected.modelId?.includes("nova-canvas")?"Nova Canvas":"Titan Image Generator"}</p></div>
              </div>
            </div>
          )}

          {bedrockError && !bedrockDetecting && (
            <div style={{marginTop:12,padding:"12px 16px",background:`${S.coral}10`,border:`1px solid ${S.coral}35`,borderRadius:10}}>
              <p style={{color:S.coral,fontWeight:700,fontSize:13,margin:"0 0 4px"}}>✕ Could not connect</p>
              <p style={{color:S.textSecondary,fontSize:12,margin:"0 0 10px"}}>{bedrockError}</p>
              <Btn size="sm" variant="secondary" onClick={runBedrockDetect} icon={<Icon path={IC.refresh} size={11}/>}>Retry</Btn>
            </div>
          )}
        </div>
        <div style={{padding:"12px 14px",background:`${S.amber}10`,border:`1px solid ${S.amber}30`,borderRadius:10}}>
          <p style={{color:S.amber,fontWeight:700,fontSize:12,margin:"0 0 4px"}}>Social & Telegram credentials</p>
          <p style={{color:S.textSecondary,fontSize:12,margin:0}}>Social account tokens → Social Accounts page. Telegram bot token → Telegram page.</p>
        </div>
      </Card>}

      <div style={{marginTop:20,display:"flex",justifyContent:"flex-end"}}><Btn onClick={save} loading={saving} icon={<Icon path={IC.check} size={14} color="#fff"/>}>Save Settings</Btn></div>
    </div>
  );
}

// ─── CONTENT LIBRARY ─────────────────────────────────────────────────────────
function ContentView({data,onSave,onToast}){
  const [filter,setFilter]=useState("all");
  const [editing,setEditing]=useState(null);
  const [editBody,setEditBody]=useState("");
  const posts=data.posts||[];
  const filtered=posts.filter(p=>filter==="all"||p.status===filter).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  const approve = async (id) => {
    try { await api.approvePost(id); onSave({posts:posts.map(p=>p.id===id?{...p,status:"approved"}:p)}); onToast("Approved","success"); }
    catch(e){ onToast(e.message,"error"); }
  };
  const reject = async (id) => {
    try { await api.rejectPost(id); onSave({posts:posts.map(p=>p.id===id?{...p,status:"rejected"}:p)}); onToast("Rejected","info"); }
    catch(e){ onToast(e.message,"error"); }
  };
  const del = async (id) => {
    try { await api.deletePost(id); onSave({posts:posts.filter(p=>p.id!==id)}); onToast("Deleted","info"); }
    catch(e){ onToast(e.message,"error"); }
  };
  const saveEdit = async (id) => {
    try { await api.updatePost(id,{body:editBody}); onSave({posts:posts.map(p=>p.id===id?{...p,body:editBody}:p)}); setEditing(null); onToast("Updated","success"); }
    catch(e){ onToast(e.message,"error"); }
  };

  return(
    <div>
      <div style={{marginBottom:22}}><h1 style={{fontSize:24,fontWeight:800,color:S.textPrimary,margin:0}}>Content Library</h1><p style={{color:S.textSecondary,marginTop:5,fontSize:14}}>{posts.length} total posts</p></div>
      <div style={{display:"flex",gap:2,background:S.surface,borderRadius:8,padding:3,border:`1px solid ${S.border}`,marginBottom:18,width:"fit-content"}}>
        {["all","pending","approved","scheduled","published","rejected"].map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"5px 12px",borderRadius:6,border:"none",background:filter===f?S.primary:"transparent",color:filter===f?"#fff":S.textSecondary,fontSize:12,fontWeight:600,cursor:"pointer",textTransform:"capitalize",fontFamily:"inherit"}}>{f}</button>)}
      </div>
      {filtered.length===0&&<div style={{textAlign:"center",padding:60,color:S.textMuted,fontSize:14}}>No posts. Generate content first.</div>}
      {filtered.map(post=>(
        <div key={post.id} style={{position:"relative"}}>
          {editing===post.id
            ?<Card style={{marginBottom:14}}><textarea value={editBody} onChange={e=>setEditBody(e.target.value)} rows={7} style={{width:"100%",background:S.surface2,border:`1px solid ${S.primary}40`,borderRadius:8,padding:12,color:S.textPrimary,fontSize:13,fontFamily:"inherit",lineHeight:1.7,resize:"vertical",boxSizing:"border-box"}}/><div style={{display:"flex",gap:8,marginTop:10}}><Btn size="sm" onClick={()=>saveEdit(post.id)} icon={<Icon path={IC.check} size={12}/>}>Save</Btn><Btn size="sm" variant="secondary" onClick={()=>setEditing(null)}>Cancel</Btn></div></Card>
            :<Card style={{marginBottom:14}} accent={FORMATS[post.format]?.color}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{fontSize:20,marginTop:2,flexShrink:0}}>{FORMATS[post.format]?.emoji}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:6}}>
                    <Badge color={statusColor(post.status)}>{post.status.replace(/_/g," ")}</Badge>
                    {post.tgNotified&&<Badge color={S.tg}>📱 TG sent</Badge>}
                    {post.rejectedWith&&<Badge color={S.amber}>🔄 Regen</Badge>}
                    <span style={{fontSize:11,color:S.textMuted}}>{post.createdAt&&new Date(post.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                  {post.imageUrl&&<img src={post.imageUrl} alt="Post" style={{width:70,height:70,objectFit:"cover",borderRadius:8,border:`1px solid ${S.border}`,float:"right",marginLeft:12}}/>}
                  <p style={{fontSize:13,color:S.textPrimary,margin:"0 0 10px",lineHeight:1.6,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{post.body}</p>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                    {post.status==="pending"&&<><Btn size="sm" variant="success" onClick={()=>approve(post.id)} icon={<Icon path={IC.check} size={11}/>}>Approve</Btn><Btn size="sm" variant="danger" onClick={()=>reject(post.id)} icon={<Icon path={IC.xmark} size={11}/>}>Reject</Btn></>}
                    <Btn size="sm" variant="ghost" onClick={()=>{setEditing(post.id);setEditBody(post.body);}} icon={<Icon path={IC.edit} size={11}/>}>Edit</Btn>
                    <Btn size="sm" variant="ghost" onClick={()=>del(post.id)} icon={<Icon path={IC.trash} size={11}/>} style={{color:S.coral}}>Delete</Btn>
                    <Btn size="sm" variant="ghost" onClick={()=>navigator.clipboard.writeText(post.body)} icon={<Icon path={IC.copy} size={11}/>}>Copy</Btn>
                  </div>
                </div>
              </div>
            </Card>
          }
        </div>
      ))}
    </div>
  );
}

// ─── APPROVALS VIEW ───────────────────────────────────────────────────────────
function ApprovalsView({data,onSave,onToast}){
  const posts=(data.posts||[]).filter(p=>p.status==="pending");

  const approve = async (id) => {
    try { await api.approvePost(id); onSave({posts:data.posts.map(p=>p.id===id?{...p,status:"approved"}:p)}); onToast("Approved — schedule it in Schedule & Publish","success"); }
    catch(e){ onToast(e.message,"error"); }
  };
  const reject = async (id) => {
    try { await api.rejectPost(id); onSave({posts:data.posts.map(p=>p.id===id?{...p,status:"rejected"}:p)}); onToast("Rejected","info"); }
    catch(e){ onToast(e.message,"error"); }
  };
  const approveAll = async () => {
    try {
      await Promise.all(posts.map(p=>api.approvePost(p.id)));
      onSave({posts:data.posts.map(p=>p.status==="pending"?{...p,status:"approved"}:p)});
      onToast("All approved","success");
    } catch(e){ onToast(e.message,"error"); }
  };

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <div><h1 style={{fontSize:24,fontWeight:800,color:S.textPrimary,margin:0}}>Approvals</h1><p style={{color:S.textSecondary,marginTop:5,fontSize:14}}>{posts.length} post{posts.length!==1?"s":""} waiting for review</p></div>
        {posts.length>1&&<Btn onClick={approveAll} variant="success" icon={<Icon path={IC.check} size={14}/>}>Approve All</Btn>}
      </div>
      {posts.length===0?<div style={{textAlign:"center",padding:80}}><div style={{width:60,height:60,borderRadius:"50%",background:`${S.teal}15`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}><Icon path={IC.check} size={26} color={S.teal}/></div><p style={{color:S.textPrimary,fontWeight:700,fontSize:15}}>All clear</p><p style={{color:S.textMuted,fontSize:13}}>Generate posts to see them here.</p></div>:
      posts.map(p=>(
        <Card key={p.id} style={{marginBottom:14}} accent={FORMATS[p.format]?.color}>
          <div style={{display:"flex",gap:12}}>
            <div style={{fontSize:22,flexShrink:0}}>{FORMATS[p.format]?.emoji}</div>
            <div style={{flex:1}}>
              {p.imageUrl&&<img src={p.imageUrl} alt="Post" style={{width:90,height:90,objectFit:"cover",borderRadius:8,border:`1px solid ${S.border}`,float:"right",marginLeft:12}}/>}
              <p style={{fontSize:13,color:S.textPrimary,margin:"0 0 12px",lineHeight:1.75,whiteSpace:"pre-wrap"}}>{p.body}</p>
              <div style={{display:"flex",gap:8}}><Btn size="sm" variant="success" onClick={()=>approve(p.id)} icon={<Icon path={IC.check} size={12}/>}>Approve</Btn><Btn size="sm" variant="danger" onClick={()=>reject(p.id)} icon={<Icon path={IC.xmark} size={12}/>}>Reject</Btn></div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardView({data,onNavigate}){
  const posts    = data.posts||[];
  const co       = data.company||DEF_COMPANY;
  const tg       = data.telegram||DEF_TELEGRAM;
  const accounts = data.socialAccounts||DEF_SOCIAL;
  const connected= Object.values(accounts).filter(a=>a.connected).length;
  const pending  = posts.filter(p=>p.status==="pending").length;
  const scheduled= posts.filter(p=>p.status==="scheduled").length;
  const published= posts.filter(p=>p.status==="published").length;
  const awaitingFb=posts.filter(p=>p.status==="awaiting_feedback").length;
  const recent   = [...posts].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,3);
  const next     = posts.filter(p=>p.status==="scheduled"&&p.scheduledFor).sort((a,b)=>new Date(a.scheduledFor)-new Date(b.scheduledFor))[0];

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:24,fontWeight:800,color:S.textPrimary,margin:0}}>{co.name||"AI Social Autopilot"}</h1>
        <p style={{color:S.textSecondary,fontSize:14,marginTop:5}}>{data.setupComplete?`${co.industry} · ${connected} accounts · Bedrock ${data.bedrock?.enabled?"on":"off"} · Telegram ${tg.enabled?"active":"off"}`:"Complete setup to start generating content"}</p>
      </div>
      {!data.setupComplete&&<div style={{background:`${S.amber}10`,border:`1px solid ${S.amber}30`,borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}><Icon path={IC.info} size={18} color={S.amber}/><span style={{color:S.amber,fontSize:13,fontWeight:600}}>Complete setup to start generating</span><Btn size="sm" variant="secondary" style={{marginLeft:"auto"}} onClick={()=>onNavigate("setup")}>Go to Setup →</Btn></div>}
      {tg.enabled&&awaitingFb>0&&<div style={{background:`${S.tg}12`,border:`1px solid ${S.tg}35`,borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}><Icon path={IC.telegram} size={20} color={S.tg}/><span style={{color:S.tg,fontSize:13,fontWeight:700}}>{awaitingFb} post{awaitingFb>1?"s":""} waiting for your Telegram rejection feedback — reply to the bot</span></div>}
      {connected===0&&data.setupComplete&&<div style={{background:`${S.primary}10`,border:`1px solid ${S.primary}30`,borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}><Icon path={IC.social} size={18} color={S.primary}/><span style={{color:S.primary,fontSize:13,fontWeight:600}}>Connect social accounts to enable auto-publishing</span><Btn size="sm" variant="outline" style={{marginLeft:"auto"}} onClick={()=>onNavigate("social")}>Connect Accounts →</Btn></div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
        {[{l:"Total Posts",v:posts.length,c:S.primary,icon:IC.content},{l:"Pending",v:pending,c:S.amber,icon:IC.approve,click:()=>pending>0&&onNavigate("approvals")},{l:"Scheduled",v:scheduled,c:S.primary,icon:IC.clock,click:()=>onNavigate("schedule")},{l:"Published",v:published,c:S.teal,icon:IC.check}].map(s=>(
          <Card key={s.l} style={{cursor:s.click?"pointer":"default"}} onClick={s.click}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
              <div><div style={{fontSize:32,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div><div style={{fontSize:11,color:S.textSecondary,marginTop:6}}>{s.l}</div></div>
              <div style={{width:34,height:34,borderRadius:8,background:`${s.c}15`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon path={s.icon} size={16} color={s.c}/></div>
            </div>
            {s.click&&s.v>0&&<div style={{fontSize:11,color:s.c,marginTop:8,fontWeight:600}}>View →</div>}
          </Card>
        ))}
      </div>
      {next&&<div style={{background:`${S.primary}12`,border:`1px solid ${S.primary}35`,borderRadius:12,padding:"14px 18px",marginBottom:18,display:"flex",alignItems:"center",gap:14}}>
        <Icon path={IC.clock} size={20} color={S.primary}/>
        <div>
          <p style={{color:S.primary,fontWeight:700,fontSize:13,margin:"0 0 2px"}}>Next post scheduled</p>
          <p style={{color:S.textSecondary,fontSize:12,margin:0}}>{new Date(next.scheduledFor).toLocaleString("en-US",{weekday:"long",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}{tg.enabled&&!next.tgNotified&&` · Telegram alert ${tg.hoursBefore}h before`}{tg.enabled&&next.tgNotified&&" · 📱 Telegram approval sent"}</p>
        </div>
        <Btn size="sm" variant="outline" style={{marginLeft:"auto"}} onClick={()=>onNavigate("schedule")}>View →</Btn>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><h2 style={{fontSize:14,fontWeight:700,color:S.textPrimary,margin:0}}>Recent Posts</h2><button onClick={()=>onNavigate("content")} style={{background:"none",border:"none",color:S.primary,fontSize:12,fontWeight:700,cursor:"pointer"}}>All →</button></div>
          {recent.length===0?<Card style={{textAlign:"center",padding:36}}><div style={{fontSize:38,marginBottom:10}}>✨</div><p style={{color:S.textMuted,fontSize:13,margin:"0 0 14px"}}>No posts yet</p><Btn size="sm" onClick={()=>onNavigate("generate")}>Generate First Post</Btn></Card>:
          recent.map(p=><Card key={p.id} style={{marginBottom:10}}><div style={{display:"flex",gap:10}}><div style={{fontSize:18,flexShrink:0}}>{FORMATS[p.format]?.emoji}</div><div style={{flex:1,minWidth:0}}><div style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}><Badge color={statusColor(p.status)}>{p.status.replace(/_/g," ")}</Badge>{p.tgNotified&&<Badge color={S.tg}>📱</Badge>}</div><p style={{fontSize:12,color:S.textPrimary,margin:0,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{p.body}</p></div>{p.imageUrl&&<img src={p.imageUrl} alt="" style={{width:48,height:48,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}</div></Card>)}
        </div>
        <div>
          <h2 style={{fontSize:14,fontWeight:700,color:S.textPrimary,margin:"0 0 12px"}}>System Status</h2>
          <Card>
            <div style={{marginBottom:16}}>
              <p style={{fontSize:11,fontWeight:700,color:S.textSecondary,textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 10px"}}>Social Accounts</p>
              {Object.entries(SOCIALS).map(([p,c])=>{const ok=accounts[p]?.connected;return(<div key={p} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${S.border}20`}}><Icon path={IC[c.icon]} size={16} color={ok?c.color:S.textMuted}/><span style={{fontSize:12,color:ok?S.textPrimary:S.textMuted,flex:1}}>{c.label}</span>{ok?<span style={{fontSize:11,color:S.teal,fontWeight:700}}>● Connected</span>:<button onClick={()=>onNavigate("social")} style={{fontSize:11,color:S.primary,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Connect →</button>}</div>);})}
            </div>
            <div style={{paddingTop:14,borderTop:`1px solid ${S.border}`}}>
              <p style={{fontSize:11,fontWeight:700,color:S.textSecondary,textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 10px"}}>Telegram Approvals</p>
              <div style={{padding:"10px 12px",borderRadius:8,background:tg.enabled?`${S.tg}10`:`${S.textMuted}10`,border:`1px solid ${tg.enabled?S.tg+"30":S.border}`,display:"flex",alignItems:"center",gap:10}}>
                <Icon path={IC.telegram} size={16} color={tg.enabled?S.tg:S.textMuted}/>
                <span style={{fontSize:12,color:tg.enabled?S.tg:S.textMuted,fontWeight:700}}>{tg.enabled?`Active — ${tg.hoursBefore}h before each post`:"Not configured"}</span>
                {!tg.enabled&&<button onClick={()=>onNavigate("telegram")} style={{marginLeft:"auto",fontSize:11,color:S.primary,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Setup →</button>}
              </div>
            </div>
          </Card>
          <Btn full onClick={()=>onNavigate("generate")} icon={<Icon path={IC.zap} size={13} color="#fff"/>} style={{marginTop:12}}>Generate New Post</Btn>
          <Btn full variant="secondary" onClick={()=>onNavigate("schedule")} icon={<Icon path={IC.clock} size={13}/>} style={{marginTop:8}}>Schedule & Publish</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function AnalyticsView({data,onToast}){
  const [insight,setInsight]=useState("");
  const [loading,setLoading]=useState(false);
  const posts=data.posts||[];
  const tg=data.telegram||DEF_TELEGRAM;
  const byFmt={text:posts.filter(p=>p.format==="text").length,photo:posts.filter(p=>p.format==="photo").length};
  const byStatus={pending:0,approved:0,scheduled:0,published:0,rejected:0};
  posts.forEach(p=>{if(byStatus[p.status]!==undefined)byStatus[p.status]++;});
  const tgPublished=posts.filter(p=>p.status==="published"&&p.tgNotified).length;
  const regen=posts.filter(p=>p.rejectedWith).length;

  const getInsight = async () => {
    setLoading(true);
    try {
      const r = await api.getInsights();
      setInsight(r.insight);
      onToast("Done","success");
    } catch(e){ onToast(e.message,"error"); }
    setLoading(false);
  };

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}><h1 style={{fontSize:24,fontWeight:800,color:S.textPrimary,margin:0}}>Analytics</h1><Btn onClick={getInsight} loading={loading} variant="secondary" icon={<Icon path={IC.sparkle} size={14}/>}>AI Insights</Btn></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        {[{l:"Total",v:posts.length,c:S.primary},{l:"📝 Text",v:byFmt.text,c:S.textSecondary},{l:"🖼️ Photo",v:byFmt.photo,c:"#E1306C"},{l:"Published",v:byStatus.published,c:S.teal}].map(s=><Card key={s.l} style={{textAlign:"center"}}><div style={{fontSize:32,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:12,color:S.textSecondary,marginTop:4}}>{s.l}</div></Card>)}
      </div>
      {tg.enabled&&<Card style={{marginBottom:20,background:`${S.tg}10`,borderColor:`${S.tg}35`}}><p style={{color:S.tg,fontWeight:700,fontSize:13,margin:"0 0 12px"}}>📱 Telegram Approval Stats</p><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>{[{l:"Approval cards sent",v:posts.filter(p=>p.tgNotified).length},{l:"Published via Telegram",v:tgPublished},{l:"Regenerated from feedback",v:regen}].map(s=><div key={s.l} style={{textAlign:"center",padding:12,background:S.surface2,borderRadius:8}}><div style={{fontSize:24,fontWeight:800,color:S.tg}}>{s.v}</div><div style={{fontSize:11,color:S.textSecondary,marginTop:4}}>{s.l}</div></div>)}</div></Card>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <Card><p style={{color:S.textPrimary,fontWeight:700,fontSize:13,margin:"0 0 14px"}}>Post Status</p>{Object.entries(byStatus).map(([st,cnt])=>{const c={pending:S.amber,approved:S.teal,rejected:S.coral,scheduled:S.primary,published:S.purple}[st];return(<div key={st} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,color:S.textSecondary,textTransform:"capitalize"}}>{st}</span><span style={{fontSize:22,fontWeight:800,color:c}}>{cnt}</span></div>);})}</Card>
        <Card><p style={{color:S.textPrimary,fontWeight:700,fontSize:13,margin:"0 0 14px"}}>Connected Accounts</p>{Object.entries(SOCIALS).map(([p,c])=>{const ok=data.socialAccounts?.[p]?.connected;return(<div key={p} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><Icon path={IC[c.icon]} size={16} color={ok?c.color:S.textMuted}/><span style={{fontSize:13,color:ok?S.textPrimary:S.textMuted,flex:1}}>{c.label}</span><span style={{fontSize:11,fontWeight:700,color:ok?S.teal:S.coral}}>{ok?"● Connected":"○ Not set"}</span></div>);})}</Card>
      </div>
      {insight&&<Card glow><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><Icon path={IC.sparkle} size={16} color={S.primary}/><span style={{color:S.primary,fontWeight:700,fontSize:13}}>AI Recommendations</span></div><p style={{color:S.textPrimary,fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",margin:0}}>{insight}</p></Card>}
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({currentView,onNavigate,data}){
  const pending   = (data.posts||[]).filter(p=>p.status==="pending").length;
  const accounts  = data.socialAccounts||DEF_SOCIAL;
  const connected = Object.values(accounts).filter(a=>a.connected).length;
  const tg        = data.telegram||DEF_TELEGRAM;

  const nav = [
    {id:"dashboard",label:"Dashboard",icon:IC.dashboard},
    {id:"setup",label:"Setup",icon:IC.setup},
    {id:"social",label:"Social Accounts",icon:IC.social,badge:connected===0?"!":null,badgeColor:S.amber},
    {id:"telegram",label:"Telegram",icon:IC.telegram,badge:!tg.enabled?"!":null,badgeColor:S.tg},
    {id:"generate",label:"Generate",icon:IC.zap},
    {id:"approvals",label:"Approvals",icon:IC.approve,badge:pending>0?pending:null,badgeColor:S.coral},
    {id:"schedule",label:"Schedule & Publish",icon:IC.clock},
    {id:"content",label:"Content Library",icon:IC.content},
    {id:"analytics",label:"Analytics",icon:IC.analytics},
  ];

  return(
    <div style={{width:218,background:S.surface,borderRight:`1px solid ${S.border}`,display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0,flexShrink:0}}>
      <div style={{padding:"18px 16px 14px",borderBottom:`1px solid ${S.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:30,height:30,borderRadius:7,background:`linear-gradient(135deg,#6C63FF,#00D1B2)`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon path={IC.sparkle} size={15} color="#fff"/></div>
          <div><div style={{fontSize:12,fontWeight:800,color:S.textPrimary,lineHeight:1}}>AI Autopilot</div><div style={{fontSize:10,color:S.textMuted,marginTop:2}}>Social Media</div></div>
        </div>
      </div>
      {data.company?.name&&<div style={{padding:"10px 16px",borderBottom:`1px solid ${S.border}`}}><div style={{fontSize:10,color:S.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Company</div><div style={{fontSize:12,fontWeight:700,color:S.textPrimary,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{data.company.name}</div></div>}
      <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
        {nav.map(item=>{const active=currentView===item.id;return(
          <button key={item.id} onClick={()=>onNavigate(item.id)} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 10px",borderRadius:8,border:"none",background:active?S.primaryDim:"transparent",color:active?S.primary:S.textSecondary,fontSize:13,fontWeight:active?700:500,cursor:"pointer",fontFamily:"inherit",marginBottom:2,textAlign:"left"}}>
            <Icon path={item.icon} size={15} color={active?S.primary:S.textSecondary}/>
            <span style={{flex:1}}>{item.label}</span>
            {item.badge&&<span style={{background:item.badgeColor||S.coral,color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:800}}>{item.badge}</span>}
          </button>
        );})}
      </nav>
      <div style={{padding:14,borderTop:`1px solid ${S.border}`}}>
        {[{l:`Claude: ${data.apiKey?"active":"not set"}`,ok:!!data.apiKey},{l:`Bedrock: ${data.bedrock?.enabled?"active":"off"}`,ok:!!data.bedrock?.enabled},{l:`${connected}/4 social connected`,ok:connected>0},{l:`Telegram: ${tg.enabled?"active":"off"}`,ok:tg.enabled}].map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:s.ok?S.teal:i<2?S.coral:S.textMuted}}/>
            <span style={{fontSize:10,color:S.textSecondary}}>{s.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [data,setData] = useState({
    apiKey:"", bedrock:DEF_BEDROCK,
    telegram:DEF_TELEGRAM, socialAccounts:DEF_SOCIAL, company:DEF_COMPANY,
    posts:[], setupComplete:false, currentView:"dashboard"
  });
  const [view,setView]   = useState("dashboard");
  const [toast,setToast] = useState(null);

  useEffect(()=>{
    Promise.all([api.getSettings(),api.getCompany(),api.getSocialAccounts(),api.getPosts(),api.getTelegram()])
      .then(([settings,company,socialAccounts,posts,telegram])=>{
        setData(prev=>({...prev,apiKey:settings.apiKey,bedrock:settings.bedrock,setupComplete:settings.setupComplete,company,socialAccounts,posts,telegram}));
        setView(settings.currentView||"dashboard");
      })
      .catch(e=>console.error("Load failed:",e));
  },[]);

  useEffect(()=>{
    const iv=setInterval(async()=>{
      try {
        const [posts,telegram]=await Promise.all([api.getPosts(),api.getTelegram()]);
        setData(prev=>({...prev,posts,telegram}));
      } catch{}
    },5000);
    return()=>clearInterval(iv);
  },[]);

  const onSave = useCallback((updates)=>{
    setData(prev=>({...prev,...updates}));
  },[]);

  const onToast = useCallback((message,type="info")=>{
    setToast({message,type,key:Date.now()});
  },[]);

  const navigate = useCallback((v)=>{
    setView(v);
    api.updateSettings({currentView:v}).catch(()=>{});
  },[]);

  const VIEWS = {
    dashboard:DashboardView, setup:SetupView, social:SocialAccountsView,
    telegram:TelegramView,   generate:GenerateView,  approvals:ApprovalsView,
    schedule:ScheduleView,   content:ContentView,    analytics:AnalyticsView,
  };
  const View = VIEWS[view]||DashboardView;

  return(
    <div style={{display:"flex",background:S.bg,minHeight:"100vh",fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif",color:S.textPrimary}}>
      <style>{`
        @keyframes spin  { to { transform:rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes slideIn { from{transform:translateX(16px);opacity:0} to{transform:translateX(0);opacity:1} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#1C2B42;border-radius:3px}
        input:focus,textarea:focus,select:focus{border-color:#6C63FF!important;outline:none}
        input[type="datetime-local"]::-webkit-calendar-picker-indicator{filter:invert(1)opacity(0.5)}
        button:focus-visible{outline:2px solid #6C63FF;outline-offset:2px}
      `}</style>
      <Sidebar currentView={view} onNavigate={navigate} data={data}/>
      <main style={{flex:1,overflowY:"auto",padding:"30px 34px"}}>
        <View data={data} onSave={onSave} onToast={onToast} onNavigate={navigate}/>
      </main>
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
