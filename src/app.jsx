import { useState, useRef, useEffect, useCallback, memo } from "react";
import { supabase } from "./supabase.js";
import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseApp = initializeApp({
  apiKey: "AIzaSyDZwdN7uqM3CVaLEVjyrSFpIfYnkQZFUwQ",
  authDomain: "reelbigfish-381c5.firebaseapp.com",
  projectId: "reelbigfish-381c5",
  storageBucket: "reelbigfish-381c5.firebasestorage.app",
  messagingSenderId: "261498577483",
  appId: "1:261498577483:web:95eccc7ab56cf6164463ce"
});

const VAPID_KEY = "BA0dAMIBeA9edA3ubTaDN_aW1mEGATRe0_vZYuw2xZgpFBn5YvgNv-JM7dab4YJjQvyC40CEV1emKHjXXLZ-ieI";

const registerPushToken=async(userId)=>{
  try{
    const messaging=getMessaging(firebaseApp);
    const swReg=await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token=await getToken(messaging,{vapidKey:VAPID_KEY,serviceWorkerRegistration:swReg});
    if(token)await supabase.from("push_tokens").upsert({user_id:userId,token});
    return token;
  }catch(e){console.log("Push:",e);return null;}
};


const sendNotification=async(userId,type,message,refId)=>{
  try{
    await supabase.from("notifications").insert({user_id:userId,type,message,ref_id:refId||null});
  }catch(e){}
};

const broadcastNotification=async(message)=>{
  try{
    const{data:users}=await supabase.from("profiles").select("id");
    if(!users?.length)return 0;
    const inserts=users.map(u=>({user_id:u.id,type:"broadcast",message:"🎣 "+message}));
    await supabase.from("notifications").insert(inserts);
    return users.length;
  }catch(e){return 0;}
};

const theme = {
  bg:"#0a0f0d",surface:"#111a14",surfaceAlt:"#162019",border:"#1e3024",
  accent:"#2dd87a",accentDim:"#1a8f4f",water:"#1a9cc7",waterDim:"#0e6a8a",
  text:"#e8f0ea",textMuted:"#7a9a82",warning:"#d4a72c",danger:"#c0392b",
  excellent:"#2dd87a",good:"#7ac943",fair:"#d4a72c",poor:"#c0392b",purple:"#a78bfa",
};

const SPECIES=["Carp","Tench","Bream","Roach","Perch","Pike","Barbel","Chub","Trout","F1 Carp","Ide","Rudd","Crucian Carp","Catfish","Zander","Dace","Bass","Mackerel"];
const BAITS=["Boilies","Sweetcorn","Pellets","Maggots","Casters","Worms","Method Feeder","Bread","Luncheon Meat","Surface Baits","Deadbait","Lures","Hemp","Paste"];
const RIGS=["Hair Rig","Method Feeder","Float Rig","Running Lead","Chod Rig","Zig Rig","Waggler","Stick Float","Drop Shot","Bolt Rig"];
const SESSION_TYPES=["Day Ticket","Overnight","Match","River","Canal","Sea","Fly Fishing","Club Water","Free Water","Other"];
const MOON_PHASES=["New Moon","Waxing Crescent","First Quarter","Waxing Gibbous","Full Moon","Waning Gibbous","Last Quarter","Waning Crescent"];
const WATER_CLARITY=["Crystal Clear","Clear","Slightly Coloured","Coloured","Very Coloured","Murky"];
const WIND_DIRS=["N","NE","E","SE","S","SW","W","NW","Calm"];

function getMoonPhase(date){
  const known=new Date("2000-01-06");
  const cycle=29.53;
  const diff=(new Date(date)-known)/(1000*60*60*24);
  const phase=((diff%cycle)+cycle)%cycle;
  return MOON_PHASES[Math.floor((phase/cycle)*8)];
}

const inp={background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:10,padding:"10px 14px",color:theme.text,fontSize:14,fontFamily:"inherit",outline:"none",width:"100%"};

function Chip({label,selected,color=theme.accent,onClick}){
  return <button onClick={onClick} style={{background:selected?color+"33":theme.surfaceAlt,color:selected?color:theme.textMuted,border:`1px solid ${selected?color:theme.border}`,borderRadius:20,padding:"5px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>{label}</button>;
}

function ForecastTab(){
  const [query,setQuery]=useState("");
  const [searchType,setSearchType]=useState("place");
  const [loading,setLoading]=useState(false);
  const [forecast,setForecast]=useState(null);
  const [locationName,setLocationName]=useState("");
  const [selected,setSelected]=useState(0);
  const [error,setError]=useState("");
  const rc=(r)=>r==="Excellent"?theme.excellent:r==="Good"?theme.good:r==="Fair"?theme.fair:theme.poor;

  const fetchWeather=async(lat,lng)=>{
    const wx=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,winddirection_10m_dominant,surface_pressure_max&timezone=Europe%2FLondon&forecast_days=7`);
    const wd=await wx.json();
    const d=wd.daily;
    const names=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    return d.time.map((dt,i)=>{
      const tempMax=Math.round(d.temperature_2m_max[i]);
      const tempMin=Math.round(d.temperature_2m_min[i]);
      const avg=Math.round((tempMax+tempMin)/2);
      const wind=Math.round(d.windspeed_10m_max[i]);
      const rain=Math.round(d.precipitation_sum[i]*10)/10;
      const pres=d.surface_pressure_max[i];
      const trend=i===0?"Stable":pres>d.surface_pressure_max[i-1]+1.5?"Rising":pres<d.surface_pressure_max[i-1]-1.5?"Falling":"Stable";
      const dirs=["N","NE","E","SE","S","SW","W","NW"];
      const wdir=dirs[Math.round(d.winddirection_10m_dominant[i]/45)%8];
      let score=5;
      if(avg>=12&&avg<=17)score+=2;else if(avg>=9)score+=1;else score-=1;
      if(wind<10)score+=1.5;else if(wind<20)score+=0.5;else score-=1.5;
      if(rain===0)score+=0.5;else if(rain<3)score+=0.2;else if(rain<8)score-=1;else score-=2.5;
      if(trend==="Rising")score+=1.2;else if(trend==="Falling")score-=1;
      score=Math.min(10,Math.max(1,Math.round(score*10)/10));
      const rating=score>=8?"Excellent":score>=6.5?"Good":score>=4.5?"Fair":"Poor";
      const date=new Date(dt);
      return{day:i===0?"Today":i===1?"Tomorrow":names[date.getDay()],date:dt,score,rating,temp:avg,tempMin,tempMax,rain,wind,windDir:wdir,pressure:Math.round(pres),trend,moon:getMoonPhase(dt)};
    });
  };

  const search=async()=>{
    const q=query.trim();
    if(!q)return;
    setLoading(true);setError("");setForecast(null);
    try{
      if(searchType==="postcode"){
        const pc=await fetch(`https://api.postcodes.io/postcodes/${q.toUpperCase().replace(/\s+/g,"")}`);
        const pd=await pc.json();
        if(pd.status!==200)throw new Error("Invalid postcode — try searching by place name instead");
        const{latitude:lat,longitude:lng,admin_county,admin_district}=pd.result;
        setLocationName(admin_county||admin_district||q);
        setForecast(await fetchWeather(lat,lng));
      }else{
        const geo=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&countryCode=GB&language=en&format=json`);
        const gd=await geo.json();
        
        const ukResult=gd.results?.find(r=>r.country_code==="GB")||gd.results?.[0];if(!ukResult)throw new Error("Location not found - try a nearby town or postcode");const{latitude:lat,longitude:lng,name,admin1}=ukResult;
        setLocationName(`${name}${admin1?`, ${admin1}`:""}`);
        setForecast(await fetchWeather(lat,lng));
      }
      setSelected(0);
    }catch(e){setError(e.message||"Could not fetch forecast.");}
    setLoading(false);
  };

  const day=forecast?.[selected];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:16,padding:20}}>
        <div style={{fontSize:14,fontWeight:700,color:theme.text,marginBottom:12}}>Live fishing forecast for your location</div>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          <button onClick={()=>setSearchType("place")} style={{flex:1,background:searchType==="place"?theme.accent+"33":"none",color:searchType==="place"?theme.accent:theme.textMuted,border:`1px solid ${searchType==="place"?theme.accent:theme.border}`,borderRadius:8,padding:"8px 6px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600}}>📍 Town / Area</button>
          <button onClick={()=>setSearchType("postcode")} style={{flex:1,background:searchType==="postcode"?theme.accent+"33":"none",color:searchType==="postcode"?theme.accent:theme.textMuted,border:`1px solid ${searchType==="postcode"?theme.accent:theme.border}`,borderRadius:8,padding:"8px 6px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600}}>📮 Postcode</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder={searchType==="place"?"e.g. Lechlade, Cotswolds, Evesham...":"e.g. GL7 1AA"} style={inp}/>
          <button onClick={search} disabled={loading||!query.trim()} style={{background:(!query.trim()||loading)?theme.border:theme.accent,color:(!query.trim()||loading)?theme.textMuted:"#000",border:"none",borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14,width:"100%"}}>{loading?"Searching...":"Check Forecast →"}</button>
        </div>
        {error&&<div style={{color:theme.danger,fontSize:13,marginTop:8}}>{error}</div>}
      </div>
      {forecast&&(<>
        <div style={{fontSize:13,color:theme.textMuted,fontWeight:600}}>7-day forecast for {locationName}</div>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
          {forecast.map((d,i)=>(<button key={i} onClick={()=>setSelected(i)} style={{background:i===selected?theme.accent+"22":theme.surfaceAlt,border:`1px solid ${i===selected?theme.accent:theme.border}`,borderRadius:12,padding:"10px 10px",cursor:"pointer",textAlign:"center",minWidth:64,flexShrink:0}}><div style={{fontSize:11,color:theme.textMuted,marginBottom:4}}>{d.day.slice(0,3)}</div><div style={{fontSize:20,fontWeight:900,color:i===selected?theme.accent:rc(d.rating)}}>{d.score}</div><div style={{fontSize:10,color:theme.textMuted,marginTop:2}}>{d.tempMin}–{d.tempMax}°</div></button>))}
        </div>
        {day&&(<div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:16,padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div><div style={{fontSize:22,fontWeight:800,color:theme.text,fontFamily:"'Playfair Display',serif"}}>{day.day}</div><div style={{color:theme.textMuted,fontSize:13}}>{day.date}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:32,fontWeight:900,color:rc(day.rating)}}>{day.score}</div><span style={{background:rc(day.rating)+"22",color:rc(day.rating),border:`1px solid ${rc(day.rating)}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600}}>{day.rating}</span></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{label:"High / Low",value:`${day.tempMax}°C / ${day.tempMin}°C`,icon:"🌡️"},{label:"Wind",value:`${day.windDir} ${day.wind}km/h`,icon:"💨"},{label:"Pressure",value:`${day.pressure}hPa`,icon:"📊"},{label:"Trend",value:day.trend,icon:day.trend==="Rising"?"↑":day.trend==="Falling"?"↓":"→"},{label:"Moon Phase",value:day.moon,icon:"🌙"},{label:"Rainfall",value:day.rain>0?`${day.rain}mm`:"None",icon:"🌧️"}].map((item,i)=>(<div key={i} style={{background:theme.surface,borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:11,color:theme.textMuted,marginBottom:4}}>{item.icon} {item.label}</div><div style={{color:theme.text,fontWeight:600,fontSize:13}}>{item.value}</div></div>))}
          </div>
        </div>)}
      </>)}
      <FishingForecastMethod/>
    </div>
  );
}
function FishingForecastMethod(){
  return(
    <div style={{marginTop:32,background:"#111a14",border:"1px solid #1e3024",borderRadius:14,padding:"20px 24px"}}>
      <div style={{fontSize:11,color:"#2dd87a",fontWeight:700,letterSpacing:2,marginBottom:10,fontFamily:"monospace",textTransform:"uppercase"}}>How Your Forecast Is Calculated</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[
          {icon:"🌡️",label:"Temperature",detail:"Optimal range 12–17°C. Fish are more active in mild temperatures. Below 6°C or above 22°C reduces feeding activity."},
          {icon:"💨",label:"Wind Speed",detail:"Light winds under 10km/h score highest. Wind pushes food and oxygen around the water, but gusts above 30km/h make fishing difficult."},
          {icon:"🌧️",label:"Rainfall",detail:"Light rain can improve fishing by oxygenating the water. Heavy rain (8mm+) causes run-off and coloured water which reduces feeding."},
          {icon:"🌡️",label:"Atmospheric Pressure",detail:"Stable or rising pressure generally improves feeding activity. Rapid drops in pressure ahead of storms can trigger feeding sprees or shut fish down completely."},
          {icon:"🌙",label:"Moon Phase",detail:"Many anglers believe a full or new moon increases feeding activity, particularly for night fishing. This is factored into the overall score."},
          {icon:"🏆",label:"Overall Score",detail:"Each factor is weighted and combined into a score out of 10. Excellent (8+), Good (6.5–8), Fair (4.5–6.5), Poor (below 4.5)."},
        ].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"10px 0",borderBottom:i<5?"1px solid #1e3024":"none"}}>
            <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{item.icon}</span>
            <div>
              <div style={{fontWeight:700,color:"#e8f0ea",fontSize:13,marginBottom:3,fontFamily:"'DM Sans',sans-serif"}}>{item.label}</div>
              <div style={{color:"#7a9a82",fontSize:12,lineHeight:1.6,fontFamily:"'DM Sans',sans-serif"}}>{item.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatTab(){
  const [messages,setMessages]=useState([{role:"assistant",content:"Hello! I'm your Reel Big Fish AI guide. Ask me anything about species ID, rigs, bait, UK regulations, venue tips, or anything else fishing related."}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  const send=async()=>{
    if(!input.trim()||loading)return;
    const{data:{user}}=await supabase.auth.getUser();
    if(user){
      const{data:prof}=await supabase.from("profiles").select("is_premium").eq("id",user.id).single();
      if(!prof?.is_premium){
        const monthKey=`ai_count_${new Date().getFullYear()}_${new Date().getMonth()}`;
        const count=parseInt(localStorage.getItem(monthKey)||"0");
        if(count>=10){
          setMessages(prev=>[...prev,{role:"assistant",content:"🔒 You've used your 10 free AI guide questions this month. Upgrade to Premium for unlimited access!"}]);
          return;
        }
        localStorage.setItem(monthKey,String(count+1));
      }
    }
    const userMsg={role:"user",content:input};
    setMessages(prev=>[...prev,userMsg]);
    setInput("");setLoading(true);
    try{
      const res=await fetch("https://iefnatpzvjoczbrqsytj.supabase.co/functions/v1/super-action",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZm5hdHB6dmpvY3picnFzeXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Mjg5NzcsImV4cCI6MjA5NDAwNDk3N30.8KrXplbByNasfkBL6ruHslOfVQJb8-wfpWxRuj8zFTw"},
        body:JSON.stringify({system:"You are an expert UK fishing guide for Reel Big Fish. Deep knowledge of UK freshwater and sea fishing. Passionate, practical, concise. Speak like an experienced angler.",messages:[...messages,userMsg].map(m=>({role:m.role,content:m.content}))})
      });
      const data=await res.json();
      const reply=data.content?.[0]?.text||"Sorry, couldn't get a response.";
      setMessages(prev=>[...prev,{role:"assistant",content:reply}]);
    }catch{setMessages(prev=>[...prev,{role:"assistant",content:"Connection error. Please try again."}]);}
    setLoading(false);
  };
  const sugg=["Best bait for carp in May?","How do I read a river for barbel?","What EA licence do I need?","Best rig for tench?"];
  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100dvh - 120px)",minHeight:400,margin:"-24px",overflow:"hidden"}}>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,padding:"16px",WebkitOverflowScrolling:"touch"}}>
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-start",gap:8}}>
            {m.role==="assistant"&&<div style={{width:32,height:32,borderRadius:"50%",background:theme.accent+"33",border:"1px solid "+theme.accent+"44",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2,fontSize:16}}>🎣</div>}
            <div style={{maxWidth:"80%",background:m.role==="user"?theme.accent:theme.surfaceAlt,color:m.role==="user"?"#000":theme.text,borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"10px 14px",fontSize:15,lineHeight:1.6,border:m.role==="assistant"?`1px solid ${theme.border}`:"none"}}>{m.content}</div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:theme.accent+"33",border:"1px solid "+theme.accent+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎣</div>
            <div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:"18px 18px 18px 4px",padding:"10px 16px"}}>
              <div style={{display:"flex",gap:4}}>{[0,1,2].map(j=><div key={j} style={{width:7,height:7,borderRadius:"50%",background:theme.accent,animation:`pulse 1s ease-in-out ${j*0.2}s infinite`}}/>)}</div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      {messages.length===1&&(
        <div style={{padding:"0 16px 8px",display:"flex",gap:8,flexWrap:"wrap"}}>
          {sugg.map((s,i)=>(
            <button key={i} onClick={()=>{setInput(s);setTimeout(()=>inputRef.current?.focus(),50);}} style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:20,padding:"8px 14px",fontSize:13,color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{s}</button>
          ))}
        </div>
      )}
      <div style={{padding:"12px 16px",borderTop:`1px solid ${theme.border}`,background:theme.surface,display:"flex",gap:8,paddingBottom:`max(12px,env(safe-area-inset-bottom))`}}>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask anything..." style={{...inp,flex:1,fontSize:16,padding:"12px 16px",borderRadius:24,background:theme.surfaceAlt}}/>
        <button onClick={send} disabled={!input.trim()||loading} style={{background:input.trim()&&!loading?theme.accent:theme.border,color:input.trim()&&!loading?"#000":theme.textMuted,border:"none",borderRadius:"50%",width:48,height:48,cursor:"pointer",fontFamily:"inherit",fontWeight:800,fontSize:20,flexShrink:0,transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button>
      </div>
    </div>
  );
}

function SessionCard({s,toggleLike,toggleComments,submitComment,userLikes,likes,comments,showComments,newComment,setNewComment,commentLoading,user,loadComments}){

    const top=s.catches?.[0];
    const uname=s.profiles?.username||"Angler";
    const avatar=s.profiles?.avatar_url;
    const sid=s.id;
    return(
      <div style={{background:theme.surface,border:"1px solid "+theme.border,borderRadius:16,overflow:"hidden",marginBottom:12}}>
        {/* Header */}
        <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
          <div onClick={()=>{window.location.hash=`#/profile/${encodeURIComponent(uname)}`;}} style={{width:40,height:40,borderRadius:"50%",overflow:"hidden",background:`linear-gradient(135deg,${theme.accent},${theme.water})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,cursor:"pointer",flexShrink:0}}>
            {avatar?<img src={avatar} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🎣"}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,color:theme.text,fontSize:14,cursor:"pointer"}} onClick={()=>{window.location.hash=`#/profile/${encodeURIComponent(uname)}`;}}>{uname}</div>
            <div style={{color:theme.textMuted,fontSize:12}}>{s.venue_name||"Unknown venue"} · {s.date}</div>
          </div>
          <div style={{textAlign:"right"}}>
            {(s.total_fish||0)===0?(
              <div style={{background:theme.danger+"22",border:`1px solid ${theme.danger}44`,borderRadius:8,padding:"4px 10px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:800,color:theme.danger,textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>Blank</div>
                <div style={{fontSize:9,color:theme.danger,opacity:0.7}}>Session</div>
              </div>
            ):(
              <>
                <div style={{fontSize:20,fontWeight:900,color:theme.accent,fontFamily:"'Playfair Display',serif"}}>{s.total_fish}</div>
                <div style={{fontSize:10,color:theme.textMuted,textTransform:"uppercase",letterSpacing:1}}>fish</div>
              </>
            )}
                  {likes[sid]>0&&<div style={{fontSize:12,color:theme.danger,fontWeight:600}}>❤️ {likes[sid]}</div>}
          </div>
        </div>
        {/* Photos */}
        {s.photos&&s.photos.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:s.photos.length===1?"1fr":"1fr 1fr",gap:2}}>
            {s.photos.slice(0,4).map((url,i)=>(
              <img key={i} src={url} onClick={()=>window.open(url,"_blank")} style={{width:"100%",aspectRatio:s.photos.length===1?"16/9":"1",objectFit:"cover",cursor:"pointer"}}/>
            ))}
          </div>
        )}
        {/* Catch info */}
        {top&&(
          <div style={{padding:"10px 16px",borderTop:`1px solid ${theme.border}`}}>
            <div style={{color:theme.accent,fontSize:14,fontWeight:600}}>{top.species}{top.weightLb?` · ${top.weightLb}lb ${top.weightOz||0}oz`:""}</div>
          </div>
        )}
        {/* Actions */}
        <div style={{padding:"10px 16px",display:"flex",gap:16,borderTop:`1px solid ${theme.border}`}}>
          <button onClick={()=>toggleLike(sid)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,color:userLikes[sid]?theme.danger:theme.textMuted,fontFamily:"inherit",fontSize:14,fontWeight:600,padding:0}}>
            <span style={{fontSize:18}}>{userLikes[sid]?"❤️":"🤍"}</span> {likes[sid]||0}
          </button>
          <button onClick={()=>toggleComments(sid)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,color:showComments[sid]?theme.accent:theme.textMuted,fontFamily:"inherit",fontSize:14,fontWeight:600,padding:0}}>
            <span style={{fontSize:18}}>💬</span> {comments[sid]?.length||0}
          </button>
        </div>
        {/* Comments */}
        {(showComments[sid]||(comments[sid]?.length>0))&&(
          <div style={{borderTop:`1px solid ${theme.border}`,padding:"12px 16px"}}>
            {(showComments[sid]?(comments[sid]||[]):(comments[sid]||[]).slice(-3)).map((c,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{width:28,height:28,borderRadius:"50%",overflow:"hidden",background:`linear-gradient(135deg,${theme.accent},${theme.water})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>
                  {c.profiles?.avatar_url?<img src={c.profiles.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🎣"}
                </div>
                <div style={{background:theme.surfaceAlt,borderRadius:"12px 12px 12px 4px",padding:"8px 12px",flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                    <div style={{fontWeight:700,color:theme.accent,fontSize:12}}>{c.profiles?.username||"Angler"}</div>
                    {(user&&(c.user_id===user.id||s.user_id===user.id))&&(
                      <button onClick={async()=>{
                        await supabase.from("comments").delete().eq("id",c.id);
                        await loadComments(sid);
                      }} style={{background:"none",border:"none",color:theme.textMuted,cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>×</button>
                    )}
                  </div>
                  <div style={{color:theme.text,fontSize:13}}>{c.content}</div>
                </div>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <input
                value={newComment[sid]||""}
                onChange={e=>setNewComment(prev=>({...prev,[sid]:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&submitComment(sid)}
                placeholder="Add a comment..."
                style={{...inp,flex:1,fontSize:16,padding:"8px 12px"}}
              />
              <button onClick={()=>submitComment(sid)} disabled={commentLoading[sid]||!newComment[sid]?.trim()} style={{background:theme.accent,color:"#000",border:"none",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14,flexShrink:0}}>{commentLoading[sid]?"...":"Post"}</button>
            </div>
          </div>
        )}
      </div>
    );
}

function StatusCard({st,user,toggleStatusLike,userStatusLikes,statusLikes,toggleStatusComments,showStatusComments,statusComments,newStatusComment,setNewStatusComment,submitStatusComment,statusCommentLoading,deleteStatus}){
  return(
    <div style={{background:theme.surface,border:"1px solid "+theme.border,borderRadius:14,padding:"14px 16px",marginBottom:8}}>
      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        <div onClick={()=>{window.location.hash="#/profile/"+encodeURIComponent(st.profiles?.username||"");}} style={{width:40,height:40,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,"+theme.accent+","+theme.water+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,cursor:"pointer",flexShrink:0}}>
          {st.profiles?.avatar_url?<img src={st.profiles.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🎣"}
        </div>
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{fontWeight:700,color:theme.text,fontSize:14,cursor:"pointer"}} onClick={()=>{window.location.hash="#/profile/"+encodeURIComponent(st.profiles?.username||"");}}>{st.profiles?.username||"Angler"} <span style={{color:theme.accent,fontSize:10,fontWeight:700}}>⭐</span></div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{color:theme.textMuted,fontSize:11}}>{new Date(st.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>
              {user&&st.user_id===user.id&&<button onClick={()=>deleteStatus(st.id)} style={{background:"none",border:"none",color:theme.textMuted,cursor:"pointer",fontSize:16,padding:"0 2px"}}>×</button>}
            </div>
          </div>
          <div style={{color:theme.text,fontSize:14,marginTop:4,lineHeight:1.5,marginBottom:10}}>{st.content}</div>
          <div style={{display:"flex",gap:16}}>
            <button onClick={()=>toggleStatusLike(st.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,color:userStatusLikes[st.id]?theme.danger:theme.textMuted,fontFamily:"inherit",fontSize:13,fontWeight:600,padding:0}}>
              <span style={{fontSize:16}}>{userStatusLikes[st.id]?"❤️":"NO❤️"}</span> {statusLikes[st.id]||0}
            </button>
            <button onClick={()=>toggleStatusComments(st.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,color:showStatusComments[st.id]?theme.accent:theme.textMuted,fontFamily:"inherit",fontSize:13,fontWeight:600,padding:0}}>
              <span style={{fontSize:16}}>💬</span> {statusComments[st.id]?.length||0}
            </button>
          </div>
        </div>
      </div>
      {showStatusComments[st.id]&&(
        <div style={{borderTop:"1px solid "+theme.border,marginTop:10,paddingTop:10}}>
          {(statusComments[st.id]||[]).map((c,j)=>(
            <div key={j} style={{display:"flex",gap:8,marginBottom:8}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,"+theme.accent+","+theme.water+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>
                {c.profiles?.avatar_url?<img src={c.profiles.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:"🎣"}
              </div>
              <div style={{background:theme.surfaceAlt,borderRadius:"12px 12px 12px 4px",padding:"8px 12px",flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                  <div style={{fontWeight:700,color:theme.accent,fontSize:12}}>{c.profiles?.username||"Angler"}</div>
                  {user&&(c.user_id===user.id||st.user_id===user.id)&&<button onClick={async()=>{await supabase.from("status_comments").delete().eq("id",c.id);await toggleStatusComments(st.id);await toggleStatusComments(st.id);}} style={{background:"none",border:"none",color:theme.textMuted,cursor:"pointer",fontSize:14,padding:"0 2px"}}>×</button>}
                </div>
                <div style={{color:theme.text,fontSize:13}}>{c.content}</div>
              </div>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <input
              value={newStatusComment[st.id]||""}
              onChange={e=>setNewStatusComment(prev=>({...prev,[st.id]:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&submitStatusComment(st.id)}
              placeholder="Add a comment..."
              style={{...inp,flex:1,fontSize:16,padding:"8px 12px"}}
            />
            <button onClick={()=>submitStatusComment(st.id)} disabled={statusCommentLoading[st.id]||!newStatusComment[st.id]?.trim()} style={{background:theme.accent,color:"#000",border:"none",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14}}>{statusCommentLoading[st.id]?"...":"Post"}</button>
          </div>
        </div>
      )}
    </div>
  );
}


function FisheriesTab(){
  const [fisheries,setFisheries]=useState([]);
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState("");
  const [selectedSpecies,setSelectedSpecies]=useState("");
  const [selectedType,setSelectedType]=useState("");
  const [view,setView]=useState("list");
  const [selected,setSelected]=useState(null);
  const [userLocation,setUserLocation]=useState(null);

  const speciesOptions=["Carp","Coarse","Tench","Bream","Roach","Perch","Pike","Trout","Bass"];
  const typeOptions=["Day Ticket","Syndicate","Club Water","Overnight","Fly Fishing"];

  useEffect(()=>{
    loadFisheries();
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        setUserLocation({lat:pos.coords.latitude,lng:pos.coords.longitude});
      });
    }
  },[]);

  const loadFisheries=async(searchTerm,species,type)=>{
    setLoading(true);
    let q=supabase.from("fisheries").select("*").order("tier",{ascending:false}).order("name").limit(50);
    if(searchTerm)q=q.or(`name.ilike.%${searchTerm}%,town.ilike.%${searchTerm}%,county.ilike.%${searchTerm}%,postcode.ilike.%${searchTerm}%`);
    if(species)q=q.contains("species",[species]);
    if(type)q=q.contains("session_type",[type]);
    const{data}=await q;
    setFisheries(data||[]);
    setLoading(false);
  };

  const handleSearch=async(val)=>{
    setSearch(val);
    await loadFisheries(val,selectedSpecies,selectedType);
  };

  const handleNearMe=async()=>{
    if(!userLocation){alert("Please allow location access");return;}
    setLoading(true);
    const{data}=await supabase.from("fisheries").select("*").not("lat","is",null).limit(200);
    if(data){
      const withDist=data.map(f=>({
        ...f,
        distance:Math.sqrt(Math.pow((f.lat-userLocation.lat)*111,2)+Math.pow((f.lng-userLocation.lng)*111,2))
      })).sort((a,b)=>a.distance-b.distance).slice(0,50);
      setFisheries(withDist);
    }
    setLoading(false);
  };

  const getDistanceText=(f)=>{
    if(!userLocation||!f.lat)return null;
    const d=Math.sqrt(Math.pow((f.lat-userLocation.lat)*111,2)+Math.pow((f.lng-userLocation.lng)*111,2));
    return d<1?`${Math.round(d*1000)}m away`:`${d.toFixed(1)} miles away`;
  };

  if(selected)return <FisheryDetail fishery={selected} onBack={()=>setSelected(null)} userLocation={userLocation}/>;

  return(
    <div style={{paddingBottom:80}}>
      <div style={{background:"linear-gradient(160deg,#0a1a0e,#0d2818)",padding:"20px 16px",marginBottom:16,borderRadius:"0 0 20px 20px"}}>
        <div style={{fontSize:22,fontWeight:900,color:theme.text,fontFamily:"'Playfair Display',serif",marginBottom:4}}>Find a Fishery</div>
        <div style={{color:theme.textMuted,fontSize:13,marginBottom:14}}>Search thousands of UK fisheries</div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <input value={search} onChange={e=>handleSearch(e.target.value)} placeholder="🔍 Search by name, town or postcode..." style={{...inp,flex:1,padding:"12px 14px",fontSize:15}}/>
          <button onClick={handleNearMe} style={{background:theme.accent,color:"#000",border:"none",borderRadius:12,padding:"12px 14px",cursor:"pointer",fontWeight:700,fontSize:13,flexShrink:0}}>📍 Near Me</button>
        </div>
        <div style={{display:"flex",gap:8,overflowX:"auto",scrollbarWidth:"none"}}>
          {speciesOptions.map(s=>(
            <button key={s} onClick={()=>{const v=selectedSpecies===s?"":s;setSelectedSpecies(v);loadFisheries(search,v,selectedType);}} style={{background:selectedSpecies===s?theme.accent+"22":"#111a14",border:"1px solid "+(selectedSpecies===s?theme.accent:theme.border),borderRadius:20,padding:"6px 14px",color:selectedSpecies===s?theme.accent:theme.textMuted,fontFamily:"inherit",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{s}</button>
          ))}
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 16px",marginBottom:12}}>
        <div style={{color:theme.textMuted,fontSize:12}}>{loading?"Searching...":fisheries.length+" fisheries found"}</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setView("list")} style={{background:view==="list"?theme.accent+"22":"none",border:"1px solid "+(view==="list"?theme.accent:theme.border),borderRadius:8,padding:"6px 12px",color:view==="list"?theme.accent:theme.textMuted,cursor:"pointer",fontSize:12,fontWeight:600}}>☰ List</button>
          <button onClick={()=>setView("map")} style={{background:view==="map"?theme.accent+"22":"none",border:"1px solid "+(view==="map"?theme.accent:theme.border),borderRadius:8,padding:"6px 12px",color:view==="map"?theme.accent:theme.textMuted,cursor:"pointer",fontSize:12,fontWeight:600}}>🗺️ Map</button>
        </div>
      </div>

      {fisheries.length===0&&!loading&&(
        <div style={{textAlign:"center",padding:"60px 24px",color:theme.textMuted}}>
          <div style={{fontSize:48,marginBottom:12}}>FISH</div>
          <div style={{fontWeight:700,color:theme.text,fontSize:16,marginBottom:8}}>No fisheries found</div>
          <div style={{fontSize:13}}>Try a different search or check back soon as we add more listings.</div>
        </div>
      )}

      {view==="map"&&fisheries.length>0&&(
        <div style={{margin:"0 16px",background:theme.surface,border:"1px solid "+theme.border,borderRadius:16,height:300,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
          <div style={{textAlign:"center",color:theme.textMuted}}>
            <div style={{fontSize:32,marginBottom:8}}>MAP</div>
            <div style={{fontSize:13}}>Map view coming soon</div>
          </div>
        </div>
      )}

      <div style={{padding:"0 16px"}}>
        {fisheries.filter(f=>f.tier==="premium").length>0&&(
          <>
            <div style={{fontSize:10,color:theme.warning,fontWeight:700,letterSpacing:2,marginBottom:8,fontFamily:"monospace",textTransform:"uppercase"}}>⭐ Premium Partners</div>
            {fisheries.filter(f=>f.tier==="premium").map((f,i)=><FisheryCard key={i} f={f} onSelect={setSelected} distText={getDistanceText(f)} tier="premium"/>)}
          </>
        )}
        {fisheries.filter(f=>f.tier==="featured").length>0&&(
          <>
            <div style={{fontSize:10,color:theme.accent,fontWeight:700,letterSpacing:2,marginBottom:8,marginTop:8,fontFamily:"monospace",textTransform:"uppercase"}}>✓ Featured Fisheries</div>
            {fisheries.filter(f=>f.tier==="featured").map((f,i)=><FisheryCard key={i} f={f} onSelect={setSelected} distText={getDistanceText(f)} tier="featured"/>)}
          </>
        )}
        {fisheries.filter(f=>f.tier==="free"||!f.tier).length>0&&(
          <>
            <div style={{fontSize:10,color:theme.textMuted,fontWeight:700,letterSpacing:2,marginBottom:8,marginTop:8,fontFamily:"monospace",textTransform:"uppercase"}}>All Fisheries</div>
            {fisheries.filter(f=>f.tier==="free"||!f.tier).map((f,i)=><FisheryCard key={i} f={f} onSelect={setSelected} distText={getDistanceText(f)} tier="free"/>)}
          </>
        )}
      </div>
    </div>
  );
}

function FisheryCard({f,onSelect,distText,tier}){
  const borderColor=tier==="premium"?theme.warning:tier==="featured"?theme.accent:theme.border;
  const bgColor=tier==="premium"?"linear-gradient(135deg,#1a1500,#0f0e00)":tier==="featured"?"linear-gradient(135deg,#0a1a0e,#0d2818)":theme.surface;
  return(
    <div onClick={()=>onSelect(f)} style={{background:bgColor,border:"1px solid "+borderColor+"44",borderRadius:14,padding:"14px 16px",marginBottom:10,cursor:"pointer",position:"relative",overflow:"hidden"}}>
      {tier!=="free"&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,"+borderColor+",transparent)"}}/>}
      <div style={{display:"flex",gap:12}}>
        {f.photos?.length>0?(
          <img src={f.photos[0]} style={{width:72,height:72,borderRadius:10,objectFit:"cover",flexShrink:0}}/>
        ):(
          <div style={{width:72,height:72,borderRadius:10,background:"#0d2818",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>FISH</div>
        )}
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{fontWeight:800,color:theme.text,fontSize:15,marginBottom:2}}>{f.name}</div>
            {tier==="premium"&&<span style={{background:theme.warning+"22",color:theme.warning,border:"1px solid "+theme.warning+"44",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,flexShrink:0}}>⭐ Partner</span>}
            {tier==="featured"&&<span style={{background:theme.accent+"22",color:theme.accent,border:"1px solid "+theme.accent+"44",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,flexShrink:0}}>✓ Featured</span>}
          </div>
          <div style={{color:theme.textMuted,fontSize:12,marginBottom:6}}>📍 {f.town||f.county||f.address||"UK"}{distText?` · ${distText}`:""}</div>
          {f.species?.length>0&&(
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {f.species.slice(0,3).map((s,i)=>(
                <span key={i} style={{background:theme.accent+"22",color:theme.accent,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:600}}>{s}</span>
              ))}
              {f.species.length>3&&<span style={{color:theme.textMuted,fontSize:10,padding:"2px 4px"}}>+{f.species.length-3}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FisheryDetail({fishery:f,onBack,userLocation}){
  const distText=userLocation&&f.lat?`${Math.sqrt(Math.pow((f.lat-userLocation.lat)*111,2)+Math.pow((f.lng-userLocation.lng)*111,2)).toFixed(1)} miles away`:null;
  return(
    <div style={{paddingBottom:80}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button onClick={onBack} style={{background:"none",border:"1px solid "+theme.border,borderRadius:8,padding:"6px 12px",color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>← Back</button>
        <div style={{fontWeight:800,color:theme.text,fontSize:16,fontFamily:"'Playfair Display',serif"}}>{f.name}</div>
      </div>

      {f.photos?.length>0&&(
        <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:16,scrollbarWidth:"none"}}>
          {f.photos.map((p,i)=><img key={i} src={p} style={{height:160,borderRadius:12,objectFit:"cover",flexShrink:0}}/>)}
        </div>
      )}

      <div style={{background:"linear-gradient(160deg,#0a1a0e,#0d2818)",border:"1px solid "+theme.border,borderRadius:16,padding:"20px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <div style={{fontSize:20,fontWeight:900,color:theme.text,fontFamily:"'Playfair Display',serif",marginBottom:4}}>{f.name}</div>
            {(f.town||f.county)&&<div style={{color:theme.textMuted,fontSize:13}}>📍 {[f.town,f.county].filter(Boolean).join(", ")}</div>}
            {distText&&<div style={{color:theme.accent,fontSize:12,marginTop:2}}>📍 {distText}</div>}
          </div>
          {f.tier==="premium"&&<span style={{background:theme.warning+"22",color:theme.warning,border:"1px solid "+theme.warning+"44",borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700}}>⭐ Premium</span>}
          {f.tier==="featured"&&<span style={{background:theme.accent+"22",color:theme.accent,border:"1px solid "+theme.accent+"44",borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700}}>✓ Featured</span>}
        </div>

        {f.description&&<div style={{color:theme.text,fontSize:14,lineHeight:1.6,marginBottom:12}}>{f.description}</div>}

        {f.species?.length>0&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Species</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {f.species.map((s,i)=><span key={i} style={{background:theme.accent+"22",color:theme.accent,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600}}>{s}</span>)}
            </div>
          </div>
        )}

        {f.session_type?.length>0&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Ticket Type</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {f.session_type.map((s,i)=><span key={i} style={{background:"#1e3a2a",color:theme.textMuted,borderRadius:20,padding:"4px 12px",fontSize:12}}>{s}</span>)}
            </div>
          </div>
        )}
      </div>

      <div style={{background:theme.surface,border:"1px solid "+theme.border,borderRadius:16,padding:"20px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:theme.text,marginBottom:12}}>Contact & Info</div>
        {f.phone&&<div style={{display:"flex",gap:10,marginBottom:8,alignItems:"center"}}><span style={{fontSize:16}}>📞</span><a href={`tel:${f.phone}`} style={{color:theme.accent,fontSize:14,textDecoration:"none"}}>{f.phone}</a></div>}
        {f.website&&<div style={{display:"flex",gap:10,marginBottom:8,alignItems:"center"}}><span style={{fontSize:16}}>🌐</span><a href={f.website} target="_blank" rel="noopener noreferrer" style={{color:theme.accent,fontSize:14,textDecoration:"none"}}>Visit website</a></div>}
        {f.address&&<div style={{display:"flex",gap:10,marginBottom:8,alignItems:"center"}}><span style={{fontSize:16}}>PIN</span><div style={{color:theme.text,fontSize:14}}>{f.address}</div></div>}
        {f.opening_times&&<div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{fontSize:16}}>⏰</span><div style={{color:theme.text,fontSize:14}}>{f.opening_times}</div></div>}
      </div>

      {!f.claimed&&(
        <div style={{background:theme.accent+"11",border:"1px solid "+theme.accent+"33",borderRadius:16,padding:"16px",textAlign:"center"}}>
          <div style={{fontWeight:700,color:theme.text,fontSize:15,marginBottom:4}}>Is this your fishery?</div>
          <div style={{color:theme.textMuted,fontSize:13,marginBottom:12}}>Claim your listing to update details, add photos and upgrade to Featured or Premium.</div>
          <a href="mailto:hello@reelbigfish.co.uk?subject=Fishery Claim" style={{background:theme.accent,color:"#000",borderRadius:10,padding:"10px 24px",fontWeight:700,fontSize:14,textDecoration:"none",display:"inline-block"}}>Claim This Listing</a>
        </div>
      )}
    </div>
  );
}


function FeedTab(){
  const scrollRef=useRef(null);
  const scrollPos=useRef(0);
  const [user,setUser]=useState(null);
  const [feed,setFeed]=useState([]);
  const [discover,setDiscover]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [searchResults,setSearchResults]=useState([]);
  const [searchLoading,setSearchLoading]=useState(false);
  const [statusText,setStatusText]=useState("");
  const [statusLoading,setStatusLoading]=useState(false);
  const [statuses,setStatuses]=useState([]);
  const [isPremium,setIsPremium]=useState(false);
  const [statusLikes,setStatusLikes]=useState({});
  const [userStatusLikes,setUserStatusLikes]=useState({});
  const [statusComments,setStatusComments]=useState({});
  const [showStatusComments,setShowStatusComments]=useState({});
  const [newStatusComment,setNewStatusComment]=useState({});
  const [statusCommentLoading,setStatusCommentLoading]=useState({});
  const [comments,setComments]=useState({});
  const [showComments,setShowComments]=useState({});
  const [newComment,setNewComment]=useState({});
  const [likes,setLikes]=useState({});
  const [userLikes,setUserLikes]=useState({});
  const [commentLoading,setCommentLoading]=useState({});

  useEffect(()=>{
    const load=async()=>{
      const{data:{user:u}}=await supabase.auth.getUser();
      setUser(u);
      if(u){
        const{data:following}=await supabase.from("followers").select("following_id").eq("follower_id",u.id);
        if(following?.length){
          const ids=following.map(f=>f.following_id);
          const{data:fs}=await supabase.from("sessions").select("*").in("user_id",ids).order("date",{ascending:false}).limit(50);
          if(fs?.length){
            const{data:profs}=await supabase.from("profiles").select("id,username,avatar_url").in("id",ids);
            const profMap={};
            (profs||[]).forEach(p=>profMap[p.id]=p);
            const withProfiles=fs.map(s=>({...s,profiles:profMap[s.user_id]||{}}));
            setFeed(withProfiles);
            // Pre-load last 3 comments for each session
            const commentMap={};
            for(const s of withProfiles.slice(0,10)){
              const{data:cms}=await supabase.from("comments").select("*").eq("session_id",s.id).order("created_at",{ascending:false}).limit(3);
              if(cms?.length){
                const uids=[...new Set(cms.map(c=>c.user_id))];
                const{data:cprofs}=await supabase.from("profiles").select("id,username,avatar_url").in("id",uids);
                const cprofMap={};
                (cprofs||[]).forEach(p=>cprofMap[p.id]=p);
                commentMap[s.id]=cms.reverse().map(c=>({...c,profiles:cprofMap[c.user_id]||{}}));
              }
            }
            setComments(commentMap);
          }
        }
        const{data:prof}=await supabase.from("profiles").select("is_premium").eq("id",u.id).single();
      setIsPremium(!!prof?.is_premium);
      const{data:ul}=await supabase.from("likes").select("session_id").eq("user_id",u.id);
        const likedSet={};
        (ul||[]).forEach(l=>likedSet[l.session_id]=true);
        setUserLikes(likedSet);
      }
      const{data:st}=await supabase.from("status_updates").select("*").order("created_at",{ascending:false}).limit(10);
      if(st?.length){
        const uids=[...new Set(st.map(s=>s.user_id))];
        const{data:sprofs}=await supabase.from("profiles").select("id,username,avatar_url").in("id",uids);
        const sprofMap={};
        (sprofs||[]).forEach(p=>sprofMap[p.id]=p);
        setStatuses(st.map(s=>({...s,profiles:sprofMap[s.user_id]||{}})));
        const sids=st.map(s=>s.id);
        const{data:slk}=await supabase.from("status_likes").select("status_id");
        const slkMap={};
        (slk||[]).forEach(l=>slkMap[l.status_id]=(slkMap[l.status_id]||0)+1);
        setStatusLikes(slkMap);
        if(u){
          const{data:uslk}=await supabase.from("status_likes").select("status_id").eq("user_id",u.id);
          const uslkMap={};
          (uslk||[]).forEach(l=>uslkMap[l.status_id]=true);
          setUserStatusLikes(uslkMap);
        }
      }
      const{data:ds}=await supabase.from("sessions").select("*").order("date",{ascending:false}).limit(20);
      if(ds?.length){
        const discoverIds=[...new Set(ds.map(s=>s.user_id))];
        const{data:dprofs}=await supabase.from("profiles").select("id,username,avatar_url").in("id",discoverIds);
        const dprofMap={};
        (dprofs||[]).forEach(p=>dprofMap[p.id]=p);
        setDiscover(ds.map(s=>({...s,profiles:dprofMap[s.user_id]||{}})));
        const{data:lc}=await supabase.from("likes").select("session_id");
        const lcMap={};
        (lc||[]).forEach(l=>lcMap[l.session_id]=(lcMap[l.session_id]||0)+1);
        setLikes(lcMap);
      }
      setLoading(false);
    };
    load();
  },[]);

  const toggleLike=async(sessionId)=>{
    if(!user){alert("Sign in to like catches!");return;}
    if(userLikes[sessionId]){
      await supabase.from("likes").delete().eq("user_id",user.id).eq("session_id",sessionId);
      setUserLikes(prev=>({...prev,[sessionId]:false}));
      setLikes(prev=>({...prev,[sessionId]:(prev[sessionId]||1)-1}));
    }else{
      await supabase.from("likes").insert({user_id:user.id,session_id:sessionId});
      setUserLikes(prev=>({...prev,[sessionId]:true}));
      setLikes(prev=>({...prev,[sessionId]:(prev[sessionId]||0)+1}));
      const{data:sess}=await supabase.from("sessions").select("user_id,venue_name").eq("id",sessionId).single();
      const{data:me}=await supabase.from("profiles").select("username").eq("id",user.id).single();
      if(sess&&sess.user_id!==user.id)sendNotification(sess.user_id,"like",`❤️ ${me?.username||"Someone"} liked your catch at ${sess.venue_name||"your session"}`,sessionId);
    }
  };

  const loadComments=async(sessionId)=>{
    const{data:cms}=await supabase.from("comments").select("*").eq("session_id",sessionId).order("created_at",{ascending:true});
    if(cms?.length){
      const uids=[...new Set(cms.map(c=>c.user_id))];
      const{data:cprofs}=await supabase.from("profiles").select("id,username,avatar_url").in("id",uids);
      const cprofMap={};
      (cprofs||[]).forEach(p=>cprofMap[p.id]=p);
      setComments(prev=>({...prev,[sessionId]:cms.map(c=>({...c,profiles:cprofMap[c.user_id]||{}}))}));
    }else{
      setComments(prev=>({...prev,[sessionId]:[]}));
    }
  };

  const toggleComments=async(sessionId)=>{
    if(!showComments[sessionId]){
      await loadComments(sessionId);
    }
    setShowComments(prev=>({...prev,[sessionId]:!prev[sessionId]}));
  };

  const submitComment=async(sessionId)=>{
    if(!user){alert("Sign in to comment!");return;}
    const text=newComment[sessionId]?.trim();
    if(!text)return;
    setCommentLoading(prev=>({...prev,[sessionId]:true}));
    await supabase.from("comments").insert({user_id:user.id,session_id:sessionId,content:text});
    setNewComment(prev=>({...prev,[sessionId]:""}));
    await loadComments(sessionId);
    const{data:sess}=await supabase.from("sessions").select("user_id,venue_name").eq("id",sessionId).single();
    const{data:me}=await supabase.from("profiles").select("username").eq("id",user.id).single();
    if(sess&&sess.user_id!==user.id)sendNotification(sess.user_id,"comment",`💬 ${me?.username||"Someone"} commented on your catch at ${sess.venue_name||"your session"}`,sessionId);
    setCommentLoading(prev=>({...prev,[sessionId]:false}));
  };

  const postStatus=async()=>{
    if(!statusText.trim()||statusLoading)return;
    setStatusLoading(true);
    const{data:{user:u}}=await supabase.auth.getUser();
    if(!u){setStatusLoading(false);return;}
    await supabase.from("status_updates").insert({user_id:u.id,content:statusText.trim()});
    setStatusText("");
    const{data:st}=await supabase.from("status_updates").select("*").order("created_at",{ascending:false}).limit(10);
    if(st?.length){
      const uids=[...new Set(st.map(s=>s.user_id))];
      const{data:sprofs}=await supabase.from("profiles").select("id,username,avatar_url").in("id",uids);
      const sprofMap={};
      (sprofs||[]).forEach(p=>sprofMap[p.id]=p);
      setStatuses(st.map(s=>({...s,profiles:sprofMap[s.user_id]||{}})));
    }else{setStatuses([]);}
    setStatusLoading(false);
  };

  const toggleStatusLike=async(statusId)=>{
    if(!user){alert("Sign in to like!");return;}
    if(userStatusLikes[statusId]){
      await supabase.from("status_likes").delete().eq("user_id",user.id).eq("status_id",statusId);
      setUserStatusLikes(prev=>({...prev,[statusId]:false}));
      setStatusLikes(prev=>({...prev,[statusId]:Math.max((prev[statusId]||1)-1,0)}));
    }else{
      await supabase.from("status_likes").insert({user_id:user.id,status_id:statusId});
      setUserStatusLikes(prev=>({...prev,[statusId]:true}));
      setStatusLikes(prev=>({...prev,[statusId]:(prev[statusId]||0)+1}));
      const st=statuses.find(s=>s.id===statusId);
      const{data:me}=await supabase.from("profiles").select("username").eq("id",user.id).single();
      if(st&&st.user_id!==user.id)sendNotification(st.user_id,"like",`❤️ ${me?.username||"Someone"} liked your status update`,statusId);
    }
  };

  const loadStatusComments=async(statusId)=>{
    const{data:cms}=await supabase.from("status_comments").select("*").eq("status_id",statusId).order("created_at",{ascending:true});
    if(cms?.length){
      const uids=[...new Set(cms.map(c=>c.user_id))];
      const{data:cprofs}=await supabase.from("profiles").select("id,username,avatar_url").in("id",uids);
      const cprofMap={};
      (cprofs||[]).forEach(p=>cprofMap[p.id]=p);
      setStatusComments(prev=>({...prev,[statusId]:cms.map(c=>({...c,profiles:cprofMap[c.user_id]||{}}))}));
    }else{
      setStatusComments(prev=>({...prev,[statusId]:[]}));
    }
  };

  const toggleStatusComments=async(statusId)=>{
    if(!showStatusComments[statusId])await loadStatusComments(statusId);
    setShowStatusComments(prev=>({...prev,[statusId]:!prev[statusId]}));
  };

  const submitStatusComment=async(statusId)=>{
    if(!newStatusComment[statusId]?.trim()||!user)return;
    setStatusCommentLoading(prev=>({...prev,[statusId]:true}));
    await supabase.from("status_comments").insert({user_id:user.id,status_id:statusId,content:newStatusComment[statusId].trim()});
    setNewStatusComment(prev=>({...prev,[statusId]:""}));
    await loadStatusComments(statusId);
    const st=statuses.find(s=>s.id===statusId);
    const{data:me}=await supabase.from("profiles").select("username").eq("id",user.id).single();
    if(st&&st.user_id!==user.id)sendNotification(st.user_id,"comment",`💬 ${me?.username||"Someone"} commented on your status update`,statusId);
    setStatusCommentLoading(prev=>({...prev,[statusId]:false}));
  };

  const deleteStatus=async(statusId)=>{
    await supabase.from("status_updates").delete().eq("id",statusId);
    setStatuses(prev=>prev.filter(s=>s.id!==statusId));
  };

  const searchAnglers=async(q)=>{
    setSearch(q);
    if(!q.trim()){setSearchResults([]);return;}
    setSearchLoading(true);
    const{data}=await supabase.from("profiles").select("*").ilike("username",`%${q}%`).eq("is_public",true).limit(10);
    setSearchResults(data||[]);
    setSearchLoading(false);
  };

;

  if(loading)return(<div style={{textAlign:"center",padding:"60px 0",color:theme.textMuted}}>Loading feed...</div>);

  return(
    <div ref={scrollRef} onScroll={e=>scrollPos.current=e.target.scrollTop}>
      {/* Search */}
      <div style={{marginBottom:20}}>
        <div style={{position:"relative"}}>
          <input value={search} onChange={e=>searchAnglers(e.target.value)} placeholder="🔍 Search anglers by username..." style={{...inp,width:"100%",padding:"12px 16px",fontSize:15}}/>
          {searchLoading&&<div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:theme.textMuted,fontSize:12}}>...</div>}
        </div>
        {searchResults.length>0&&(
          <div style={{background:theme.surface,border:"1px solid "+theme.border,borderRadius:12,marginTop:8,overflow:"hidden"}}>
            {searchResults.map((p,i)=>(
              <div key={i} onClick={()=>{window.location.hash=`#/profile/${encodeURIComponent(p.username)}`;setSearch("");setSearchResults([]);}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",borderBottom:i<searchResults.length-1?`1px solid ${theme.border}`:"none"}}>
                <div style={{width:40,height:40,borderRadius:"50%",overflow:"hidden",background:`linear-gradient(135deg,${theme.accent},${theme.water})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                  {p.avatar_url?<img src={p.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🎣"}
                </div>
                <div>
                  <div style={{fontWeight:700,color:theme.text,fontSize:14}}>{p.username}</div>
                  {p.region&&<div style={{color:theme.textMuted,fontSize:12}}>{p.region}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Status update box - premium only */}
      {user&&(
        <div style={{background:theme.surface,border:"1px solid "+theme.border,borderRadius:14,padding:"14px 16px",marginBottom:4}}>
          {isPremium?(
            <div>
              <div style={{display:"flex",gap:10}}>
                <textarea value={statusText} onChange={e=>setStatusText(e.target.value)} placeholder="Share a quick update with your followers..." rows={2} style={{...inp,flex:1,fontSize:15,padding:"10px 14px",resize:"none"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                <button onClick={postStatus} disabled={statusLoading||!statusText.trim()} style={{background:statusText.trim()?theme.accent:theme.border,color:statusText.trim()?"#000":theme.textMuted,border:"none",borderRadius:10,padding:"8px 20px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14}}>{statusLoading?"Posting...":"Post"}</button>
              </div>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{color:theme.textMuted,fontSize:13}}>Share a status update with your followers</div>
              <button onClick={()=>{}} style={{background:"none",border:`1px solid ${theme.warning}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",color:theme.warning,fontFamily:"inherit",fontSize:12,fontWeight:700,flexShrink:0}}>⭐ Premium</button>
            </div>
          )}
        </div>
      )}

      {/* Recent status updates */}
      {statuses.length>0&&(
        <div style={{marginBottom:8}}>
          {statuses.map((st,i)=>(
            <StatusCard key={st.id||i} st={st} user={user} toggleStatusLike={toggleStatusLike} userStatusLikes={userStatusLikes} statusLikes={statusLikes} toggleStatusComments={toggleStatusComments} showStatusComments={showStatusComments} statusComments={statusComments} newStatusComment={newStatusComment} setNewStatusComment={setNewStatusComment} submitStatusComment={submitStatusComment} statusCommentLoading={statusCommentLoading} deleteStatus={deleteStatus}/>
          ))}
        </div>
      )}
      {feed.length>0&&(
        <>
          <div style={{fontSize:11,color:theme.accent,fontWeight:700,letterSpacing:2,marginBottom:16,fontFamily:"monospace",textTransform:"uppercase"}}>Following</div>
          {feed.map((s,i)=><SessionCard key={s.id||i} s={s} toggleLike={toggleLike} toggleComments={toggleComments} submitComment={submitComment} userLikes={userLikes} likes={likes} comments={comments} showComments={showComments} newComment={newComment} setNewComment={setNewComment} commentLoading={commentLoading} user={user} loadComments={loadComments}/>)}
        </>
      )}
      {feed.length===0&&user&&(
        <div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:16,padding:"24px",textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:32,marginBottom:12}}>🎣</div>
          <div style={{fontWeight:700,color:theme.text,fontSize:16,marginBottom:8}}>You're not following anyone yet</div>
          <div style={{color:theme.textMuted,fontSize:13}}>Visit an angler's profile and tap Follow to see their catches here.</div>
        </div>
      )}
      <div style={{fontSize:11,color:theme.accent,fontWeight:700,letterSpacing:2,marginBottom:16,fontFamily:"monospace",textTransform:"uppercase",marginTop:feed.length>0?24:0}}>Discover Anglers</div>
      {discover.map((s,i)=><SessionCard key={s.id||i} s={s} toggleLike={toggleLike} toggleComments={toggleComments} submitComment={submitComment} userLikes={userLikes} likes={likes} comments={comments} showComments={showComments} newComment={newComment} setNewComment={setNewComment} commentLoading={commentLoading} user={user} loadComments={loadComments}/>)}
    </div>
  );
}

function CommunityTicker(){
  const catches=[
    "DaveK_Angler logged an 18lb 4oz Carp at Barford Lakes!",
    "NightSession_Si landed a 27lb 8oz Carp at Raker Lakes!",
    "BarbelMike logged a 9lb 2oz Barbel on the River Severn!",
    "TenchTerror landed a 6lb 14oz Tench at Ferry Meadows!",
    "PikePatrol_J logged a 22lb Pike at Rufford Lake!",
    "BreamDream logged 11 Bream at Llangorse Lake!",
    "TroutHunter_Pete landed a 3lb 12oz Brown Trout on the River Exe!",
    "RoachRonnie logged 14 Roach at Bewl Water!",
    "CarpKing_Rob landed a 31lb Mirror Carp at Linear Fisheries!",
    "PerchPete logged a 3lb 8oz Perch on the River Trent!",
    "SilverSam logged 20 Roach and Rudd at Thetford Lakes!",
    "NightOwl_Gary landed a 24lb Common Carp at Gigantica!",
    "RuddMaster logged 8 Rudd at Hornsea Mere!",
    "ChubbChaser logged a 5lb 2oz Chub on the River Wye!",
    "TenchTim landed a 7lb 4oz Tench at Sywell Reservoir!",
    "BarbFanatic logged a 12lb Barbel on the River Loddon!",
    "MirrorMark landed a 28lb 12oz Mirror Carp at Colne Valley!",
    "CarpNut_Steve logged a 19lb Common at Badshot Lea!",
    "EelHunter logged a 4lb 6oz Eel at the Norfolk Broads!",
    "GraylingGary landed a 2lb 8oz Grayling on the River Test!",
    "ZanderZone logged a 9lb Zander at Ferry Meadows!",
    "TenchTricker logged a 5lb 10oz Tench at Bletchingdon Park!",
    "PerchPro landed a 4lb 1oz Perch at Farmoor Reservoir!",
    "PikePaul logged a 19lb Pike at Chew Valley Lake!",
    "CarpDave logged twin twenties in a night session at Holme Fen!",
    "SilverSurfer logged 30 Bream at Grafham Water!",
    "BarbKing landed an 11lb Barbel on the River Avon!",
    "MagicMike logged a 23lb Carp at Wyreside Lakes!",
    "RoachRick logged a 2lb 4oz Specimen Roach at Wraysbury!",
    "TenchTerry landed a 6lb Tench at Marsh Farm Fishery!",
    "BigCarpJon landed a 34lb Common at Dinton Pastures!",
    "LureKing_Al logged a 7lb Perch at Bewl Water!",
    "FlyFisher_Ed landed a 4lb Rainbow Trout on the River Test!",
    "SurfaceJack logged a 22lb Carp on the top at Farlows Lake!",
    "NightCrawler88 landed a 29lb Mirror at Kingfisher Lake!",
    "BarbMaster_H logged a 10lb 8oz Barbel on the Hampshire Avon!",
    "WinterPike_T logged a 26lb Pike at Chew Valley!",
    "CarpWidow_M landed her first 20 at Yateley Car Park Lake!",
    "FloatFisher_B logged 22 Tench at Wilstone Reservoir!",
    "SpinnerKing logged a 14lb Zander on the River Severn!",
    "NightBream_C logged 18 Bream at Rutland Water!",
    "ChubbLord_W landed a 6lb 4oz Chub on the River Kennet!",
    "CarpHead_L logged a 25lb Leather Carp at Redmire Pool!",
    "TroutBum_D landed a 5lb Sea Trout on the River Dart!",
    "SilverBream_N logged a 1lb 12oz Silver Bream at Esthwaite!",
    "BottomFisher_R logged a 3lb 10oz Perch on the River Thames!",
    "CarpJunkie_A landed a 33lb Common at Frimley Pit 3!",
    "GudgeonGuru logged 40 Gudgeon on the River Kennet!",
    "BigBream_K landed a 14lb 2oz Bream at Hornsea Mere!",
    "WildCarp_S logged a 17lb Wild Carp at Redmire!",
    "DaceDave logged 25 Dace on the River Itchen!",
    "RuddRider landed a 2lb 8oz Rudd at Slapton Ley!",
    "CarpSchool_F logged a 21lb Carp at Linear St Johns!",
    "MinnowMan logged a session of 60 Minnows on the Wye!",
    "PikePete_NW landed a 31lb Pike at Loch Lomond!",
    "BarbelBoy_T logged a 13lb Barbel on the River Wye!",
    "SamsonCarp landed a 38lb Mirror at Wraysbury No1!",
    "LakeTrout_G logged a 6lb 8oz Brown Trout at Bewl Water!",
    "BreamBoy_J logged 16 Bream at Peterborough Rowing Lake!",
    "CarpAnnie landed her PB 26lb Common at Elstow Pits!",
  ];
  const [shuffled]=useState(()=>[...catches].sort(()=>Math.random()-0.5));
  const [idx,setIdx]=useState(0);
  const [visible,setVisible]=useState(true);
  useEffect(()=>{
    const interval=setInterval(()=>{
      setVisible(false);
      setTimeout(()=>{setIdx(i=>(i+1)%shuffled.length);setVisible(true);},400);
    },12000);
    return()=>clearInterval(interval);
  },[]);
  return(
    <div style={{background:theme.accent+"11",border:"1px solid "+theme.accent+"33",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10,overflow:"hidden"}}>
      <span style={{fontSize:16,flexShrink:0}}>🔴</span>
      <div style={{fontSize:13,color:theme.accent,fontWeight:600,fontFamily:"'DM Sans',sans-serif",transition:"opacity 0.4s",opacity:visible?1:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{shuffled[idx]}</div>
    </div>
  );
}

function DiaryTab(){
  const [user,setUser]=useState(null);
  const [authView,setAuthView]=useState("login");
  const [authLoading,setAuthLoading]=useState(true);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [authError,setAuthError]=useState("");
  const [authMsg,setAuthMsg]=useState("");
  const [profile,setProfile]=useState(null);
  const [sessions,setSessions]=useState([]);
  const [view,setView]=useState("home");
  const [selectedSession,setSelectedSession]=useState(null);
  const [analysisText,setAnalysisText]=useState("");
  const [analysisLoading,setAnalysisLoading]=useState(false);
  const [step,setStep]=useState(1);
  const today=new Date().toISOString().split("T")[0];
  const emptyForm={date:today,startTime:"",endTime:"",venueName:"",sessionType:"Day Ticket",targetSpecies:[],blank:false,catches:[],baitUsed:[],rigUsed:"",weatherCondition:"",windDirection:"",windSpeed:"",temperature:"",airPressure:"",pressureTrend:"",moonPhase:getMoonPhase(today),waterClarity:"",privateNotes:"",sessionRating:0,postcode:"",weatherLoading:false,photos:[]};
  const [form,setForm]=useState(emptyForm);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const toggle=(k,v)=>setForm(p=>({...p,[k]:p[k].includes(v)?p[k].filter(x=>x!==v):[...p[k],v]}));
  const [photoUploading,setPhotoUploading]=useState(false);
  const [avatarUploading,setAvatarUploading]=useState(false);
  const uploadAvatar=async(file)=>{
    if(!file||!user)return;
    setAvatarUploading(true);
    const ext=file.name.split(".").pop();
    const path=`${user.id}/avatar.${ext}`;
    await supabase.storage.from("avatars").remove([path]);
    const{error}=await supabase.storage.from("avatars").upload(path,file,{contentType:file.type,upsert:true});
    if(!error){
      const{data}=supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl=data.publicUrl+`?t=${Date.now()}`;
      await supabase.from("profiles").update({avatar_url:avatarUrl}).eq("id",user.id);
      setProfile(p=>({...p,avatar_url:avatarUrl}));
    }
    setAvatarUploading(false);
  };
  const exportDiary=()=>{
    if(!profile?.is_premium)return;
    const headers=["Date","Venue","Session Type","Start","End","Total Fish","Blank","Species","Best Weight (lb)","Best Weight (oz)","Bait Used","Rig","Weather","Wind","Temp","Pressure","Water Clarity","Rating","Notes"];
    const rows=sessions.map(s=>{
      const best=s.catches?.reduce((b,c)=>{
        const w=(parseFloat(c.weightLb)||0)+(parseFloat(c.weightOz)||0)/16;
        const bw=(parseFloat(b?.weightLb)||0)+(parseFloat(b?.weightOz)||0)/16;
        return w>bw?c:b;
      },null);
      const species=[...new Set((s.catches||[]).map(c=>c.species).filter(Boolean))].join("; ");
      return [
        s.date||"",s.venue_name||"",s.session_type||"",s.start_time||"",s.end_time||"",
        s.total_fish||0,s.blank?"Yes":"No",species,
        best?.weightLb||"",best?.weightOz||"",
        (s.bait_used||[]).join("; "),s.rig_used||"",
        s.weather_condition||"",s.wind_direction||"",s.temperature||"",s.air_pressure||"",
        s.water_clarity||"",s.session_rating||"",
        (s.private_notes||"").replace(/,/g,";")
      ].map(v=>String(v).includes(",")?'"'+ v +'"'  :v);
    });
    const csv=[headers,...rows].map(r=>r.join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=`reel-big-fish-diary-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();URL.revokeObjectURL(url);
  };
  const uploadPhotos=async(files)=>{
    if(!files.length||!user)return;
    setPhotoUploading(true);
    const urls=[];
    for(const file of Array.from(files)){
      const ext=file.name.split(".").pop();
      const path=`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const{error}=await supabase.storage.from("session-photos").upload(path,file,{contentType:file.type});
      if(!error){
        const{data}=supabase.storage.from("session-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    set("photos",[...(form.photos||[]),...urls]);
    setPhotoUploading(false);
  };
  const [pForm,setPForm]=useState({username:profile?.username||"",region:profile?.region||"",favSpecies:profile?.fav_species||[]});
  useEffect(()=>{if(profile&&view==="editprofile")setPForm({username:profile.username||"",region:profile.region||"",favSpecies:profile.fav_species||[]});},[view]);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setUser(session?.user??null);setAuthLoading(false);if(session?.user)loadUserData(session.user.id);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>{setUser(session?.user??null);if(session?.user)loadUserData(session.user.id);});
    return()=>subscription.unsubscribe();
  },[]);

  const loadUserData=async(userId)=>{
    const{data:pd}=await supabase.from("profiles").select("*").eq("id",userId).single();
    if(pd)setProfile(pd);
    const{data:sd}=await supabase.from("sessions").select("*").eq("user_id",userId).order("date",{ascending:false});
    if(sd)setSessions(sd);
  };

  const signUp=async()=>{setAuthError("");setAuthMsg("");if(!email||!password){setAuthError("Please enter email and password.");return;}const{error}=await supabase.auth.signUp({email,password});if(error)setAuthError(error.message);else setAuthMsg("Check your email to confirm your account, then log in.");};
  const signIn=async()=>{setAuthError("");setAuthMsg("");if(!email||!password){setAuthError("Please enter email and password.");return;}const{error}=await supabase.auth.signInWithPassword({email,password});if(error)setAuthError(error.message);};
  const signOut=async()=>{await supabase.auth.signOut();setUser(null);setProfile(null);setSessions([]);setView("home");};

  const saveProfile=async(p)=>{const{error}=await supabase.from("profiles").upsert({id:user.id,username:p.username,region:p.region,fav_species:p.favSpecies,is_public:true,avatar_url:profile?.avatar_url||null});if(!error){setProfile(prev=>({...prev,...p,id:user.id,fav_species:p.favSpecies}));setView("log");}};

  const autofill=async()=>{
    if(!form.postcode)return;set("weatherLoading",true);
    try{const pc=await fetch(`https://api.postcodes.io/postcodes/${form.postcode.trim().toUpperCase().replace(/\s/g,"")}`);const pd=await pc.json();if(pd.status!==200)throw new Error();const{latitude:lat,longitude:lng}=pd.result;const wx=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,windspeed_10m,winddirection_10m,surface_pressure,weathercode&timezone=Europe%2FLondon`);const wd=await wx.json();const c=wd.current;const dirs=["N","NE","E","SE","S","SW","W","NW"];const codes={0:"Clear",1:"Mainly Clear",2:"Partly Cloudy",3:"Overcast",45:"Foggy",61:"Light Rain",63:"Rain",65:"Heavy Rain",80:"Showers",95:"Thunderstorm"};setForm(p=>({...p,temperature:Math.round(c.temperature_2m).toString(),windSpeed:Math.round(c.windspeed_10m).toString(),windDirection:dirs[Math.round(c.winddirection_10m/45)%8],airPressure:Math.round(c.surface_pressure).toString(),weatherCondition:codes[c.weathercode]||"Variable",weatherLoading:false}));}catch{set("weatherLoading",false);}
  };

  const [isEditing, setIsEditing]=useState(false);

  const startEdit=(s)=>{
    setForm({
      date:s.date||today, startTime:s.start_time||"", endTime:s.end_time||"",
      venueName:s.venue_name||"", sessionType:s.session_type||"Day Ticket",
      targetSpecies:s.target_species||[], blank:s.blank||false,
      catches:s.catches||[], baitUsed:s.bait_used||[], rigUsed:s.rig_used||"",
      weatherCondition:s.weather_condition||"", windDirection:s.wind_direction||"",
      windSpeed:s.wind_speed||"", temperature:s.temperature||"",
      airPressure:s.air_pressure||"", pressureTrend:s.pressure_trend||"",
      moonPhase:s.moon_phase||getMoonPhase(s.date||today),
      waterClarity:s.water_clarity||"", privateNotes:s.private_notes||"",
      sessionRating:s.session_rating||0, postcode:"", photos:s.photos||[], weatherLoading:false,
    });
    setStep(1); setIsEditing(true); setView("log");
  };

  const updateSession=async()=>{
    const{error}=await supabase.from("sessions").update({
      date:form.date, start_time:form.startTime, end_time:form.endTime,
      venue_name:form.venueName, session_type:form.sessionType,
      target_species:form.targetSpecies, blank:form.blank,
      total_fish:form.blank?0:form.catches.length,
      bait_used:form.baitUsed, rig_used:form.rigUsed,
      weather_condition:form.weatherCondition, wind_direction:form.windDirection,
      wind_speed:form.windSpeed, temperature:form.temperature,
      air_pressure:form.airPressure, pressure_trend:form.pressureTrend,
      moon_phase:form.moonPhase, water_clarity:form.waterClarity,
      private_notes:form.privateNotes, session_rating:form.sessionRating,
      catches:form.catches,
      photos:[...(selectedSession.photos||[]).filter(p=>form.photos.includes(p)),...form.photos.filter(p=>!(selectedSession.photos||[]).includes(p))],
    }).eq("id",selectedSession.id);
    if(!error){
      setSessions(prev=>prev.map(s=>s.id===selectedSession.id?{...s,...form,venue_name:form.venueName,session_type:form.sessionType,total_fish:form.blank?0:form.catches.length,bait_used:form.baitUsed,rig_used:form.rigUsed,weather_condition:form.weatherCondition,wind_direction:form.windDirection,air_pressure:form.airPressure,pressure_trend:form.pressureTrend,moon_phase:form.moonPhase,private_notes:form.privateNotes,session_rating:form.sessionRating}:s));
      setIsEditing(false); setView("history"); setForm(emptyForm);
    }
  };
  const addCatch=()=>setForm(p=>({...p,catches:[...p.catches,{species:"",weightLb:"",weightOz:""}]}));
  const setCatch=(i,k,v)=>setForm(p=>{const c=[...p.catches];c[i]={...c[i],[k]:v};return{...p,catches:c};});
  const removeCatch=(i)=>setForm(p=>({...p,catches:p.catches.filter((_,j)=>j!==i)}));

  const saveSession=async()=>{
    const{data,error}=await supabase.from("sessions").insert({user_id:user.id,date:form.date,start_time:form.startTime,end_time:form.endTime,venue_name:form.venueName,session_type:form.sessionType,target_species:form.targetSpecies,blank:form.blank,total_fish:form.blank?0:form.catches.length,bait_used:form.baitUsed,rig_used:form.rigUsed,weather_condition:form.weatherCondition,wind_direction:form.windDirection,wind_speed:form.windSpeed,temperature:form.temperature,air_pressure:form.airPressure,pressure_trend:form.pressureTrend,moon_phase:form.moonPhase,water_clarity:form.waterClarity,private_notes:form.privateNotes,session_rating:form.sessionRating,is_public:false,catches:form.catches,photos:form.photos||[]}).select().single();
    if(!error&&data){setSessions(prev=>[data,...prev]);setView("saved");setStep(1);setForm(emptyForm);}
  };

  const runAnalysis=async()=>{
    if(sessions.length<1)return;setAnalysisLoading(true);setAnalysisText("");
    const totalFish=sessions.reduce((a,s)=>a+(s.total_fish||0),0);const blanks=sessions.filter(s=>s.blank).length;const baitCount={};sessions.forEach(s=>(s.bait_used||[]).forEach(b=>{baitCount[b]=(baitCount[b]||0)+1;}));const topBaits=Object.entries(baitCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([b,n])=>`${b}(${n})`).join(", ");
    const analysisLimit=profile?.is_premium?sessions.length:3;
    const limitedSessions=sessions.slice(0,analysisLimit);
    const prompt=`You are an expert UK fishing coach. Analyse this angler's diary.\n\nStats: ${sessions.length} sessions, ${totalFish} total fish (${(totalFish/(sessions.length||1)).toFixed(1)} avg), ${blanks} blanks. Top baits: ${topBaits||"none"}.\n\nRecent: ${JSON.stringify(limitedSessions.slice(0,8).map(s=>({date:s.date,venue:s.venue_name,fish:s.total_fish,blank:s.blank,bait:(s.bait_used||[]).join(","),rig:s.rig_used,weather:s.weather_condition,wind:s.wind_direction,temp:s.temperature,trend:s.pressure_trend,rating:s.session_rating})))}\n\nWrite 150-250 words. Cover: performance, what's working, blank patterns, one improvement. Be honest. Reference actual venues and baits. Flowing paragraphs. Tone: knowledgeable fishing mate.`;
    try{const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1000,messages:[{role:"user",content:prompt}]})});const data=await response.json();setAnalysisText(data.content?.[0]?.text||"Unable to generate analysis.");}catch{setAnalysisText("Connection error. Please try again.");}
    setAnalysisLoading(false);
  };

  const totalFish=sessions.reduce((a,s)=>a+(s.total_fish||0),0);
  const blanks=sessions.filter(s=>s.blank).length;
  const allCatches=sessions.flatMap(s=>s.catches||[]);
  const pb=allCatches.reduce((best,c)=>{const w=(parseFloat(c.weightLb)||0)+(parseFloat(c.weightOz)||0)/16;const bw=best?(parseFloat(best.weightLb)||0)+(parseFloat(best.weightOz)||0)/16:0;return w>bw?c:best;},null);
  const streak=(()=>{
    if(!sessions.length)return 0;
    const weeks=new Set(sessions.map(s=>{const d=new Date(s.date);const jan1=new Date(d.getFullYear(),0,1);return d.getFullYear()+"W"+Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);}));
    const sorted=[...weeks].sort().reverse();
    const now=new Date();const jan1=new Date(now.getFullYear(),0,1);
    const thisWeek=now.getFullYear()+"W"+Math.ceil(((now-jan1)/86400000+jan1.getDay()+1)/7);
    if(sorted[0]!==thisWeek&&sorted[0]!==sorted[1])return 1;
    let count=1;
    for(let i=1;i<sorted.length;i++){const prev=sorted[i-1].split("W");const curr=sorted[i].split("W");const diff=(parseInt(prev[0])*53+parseInt(prev[1]))-(parseInt(curr[0])*53+parseInt(curr[1]));if(diff===1)count++;else break;}
    return count;
  })();
  const pbBySpecies=(()=>{
    const map={};
    allCatches.forEach(c=>{
      if(!c.species)return;
      const w=(parseFloat(c.weightLb)||0)+(parseFloat(c.weightOz)||0)/16;
      if(!map[c.species]||w>(parseFloat(map[c.species].weightLb)||0)+(parseFloat(map[c.species].weightOz)||0)/16)map[c.species]=c;
    });
    return Object.entries(map).sort((a,b)=>((parseFloat(b[1].weightLb)||0)+(parseFloat(b[1].weightOz)||0)/16)-((parseFloat(a[1].weightLb)||0)+(parseFloat(a[1].weightOz)||0)/16));
  })();

  if(authLoading)return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:theme.textMuted}}>Loading...</div>;

  if(!user)return(
    <div style={{maxWidth:420,margin:"0 auto",padding:"40px 0"}}>
      <div style={{textAlign:"center",marginBottom:32}}><div style={{fontSize:28,fontWeight:900,color:theme.text,fontFamily:"'Playfair Display',serif",marginBottom:8}}>{authView==="login"?"Welcome back":"Create your account"}</div><div style={{color:theme.textMuted,fontSize:14}}>{authView==="login"?"Log in to access your fishing diary":"Free account — diary syncs across all your devices"}</div></div>
      <div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:16,padding:28,display:"flex",flexDirection:"column",gap:14}}>
        <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>EMAIL</div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" style={inp}/></div>
        <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>PASSWORD</div><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={inp} onKeyDown={e=>e.key==="Enter"&&(authView==="login"?signIn():signUp())}/></div>
        {authError&&<div style={{color:theme.danger,fontSize:13,background:theme.danger+"11",border:`1px solid ${theme.danger}33`,borderRadius:8,padding:"8px 12px"}}>{authError}</div>}
        {authMsg&&<div style={{color:theme.accent,fontSize:13,background:theme.accent+"11",border:"1px solid "+theme.accent+"33",borderRadius:8,padding:"8px 12px"}}>{authMsg}</div>}
        <button onClick={authView==="login"?signIn:signUp} style={{background:theme.accent,color:"#000",border:"none",borderRadius:12,padding:"14px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:15}}>{authView==="login"?"Log In →":"Create Account →"}</button>
        <div style={{textAlign:"center",fontSize:13,color:theme.textMuted}}>{authView==="login"?<span>No account? <button onClick={()=>{setAuthView("signup");setAuthError("");setAuthMsg("");}} style={{background:"none",border:"none",color:theme.accent,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>Sign up free</button></span>:<span>Have an account? <button onClick={()=>{setAuthView("login");setAuthError("");setAuthMsg("");}} style={{background:"none",border:"none",color:theme.accent,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>Log in</button></span>}</div>
      </div>
    </div>
  );

  if(!profile||view==="editprofile"){
    const regions=["East Midlands","East of England","London","North East","North West","South East","South West","West Midlands","Yorkshire","Wales","Scotland","Northern Ireland"];
    return(
      <div style={{maxWidth:500,margin:"0 auto",padding:"32px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>{view==="editprofile"&&<button onClick={()=>setView("log")} style={{background:"none",border:"1px solid "+theme.border,borderRadius:8,padding:"6px 12px",color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>← Back</button>}<div style={{fontSize:22,fontWeight:800,color:theme.text,fontFamily:"'Playfair Display',serif"}}>{view==="editprofile"?"Edit Profile":"Set up your profile"}</div></div>
        <div style={{color:theme.textMuted,fontSize:14,marginBottom:24}}>{view==="editprofile"?"Update your profile details and photo.":"Just a few details to personalise your diary."}</div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{textAlign:"center"}}>
            <label style={{cursor:"pointer",display:"inline-block"}}>
              <input type="file" accept="image/*" onChange={e=>e.target.files[0]&&uploadAvatar(e.target.files[0])} style={{display:"none"}}/>
              <div style={{width:80,height:80,borderRadius:"50%",background:profile?.avatar_url?"transparent":`linear-gradient(135deg,${theme.accent},${theme.water})`,margin:"0 auto 8px",overflow:"hidden",border:`3px solid ${theme.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>
                {profile?.avatar_url?<img src={profile.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🎣"}
              </div>
              <div style={{fontSize:12,color:theme.accent,fontWeight:600}}>{avatarUploading?"Uploading...":"Tap to add profile photo"}</div>
            </label>
          </div>
          <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>DISPLAY NAME *</div><input value={pForm.username} onChange={e=>setPForm(p=>({...p,username:e.target.value}))} placeholder="e.g. CarpKing_Dave" style={inp}/></div>
          <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>REGION</div><select value={pForm.region} onChange={e=>setPForm(p=>({...p,region:e.target.value}))} style={{...inp,cursor:"pointer"}}><option value="">Select...</option>{regions.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
          <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:10}}>FAVOURITE SPECIES</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{SPECIES.slice(0,10).map(s=><Chip key={s} label={s} selected={pForm.favSpecies.includes(s)} onClick={()=>setPForm(p=>({...p,favSpecies:p.favSpecies.includes(s)?p.favSpecies.filter(x=>x!==s):[...p.favSpecies,s]}))}/>)}</div></div>
          <button onClick={()=>saveProfile(pForm)} disabled={!pForm.username} style={{background:!pForm.username?theme.border:theme.accent,color:!pForm.username?theme.textMuted:"#000",border:"none",borderRadius:12,padding:"14px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:15,marginTop:8}}>{view==="editprofile"?"Save Changes →":"Create Profile →"}</button>
        </div>
      </div>
    );
  }

  if(view==="log"){
    const steps=["Basics","Catches","Conditions","Notes"];
    return(
      <div style={{maxWidth:600,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}><button onClick={()=>{setView(isEditing?"detail":"home");setIsEditing(false);}} style={{background:"none",border:"1px solid "+theme.border,borderRadius:8,padding:"6px 12px",color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>← Back</button><div style={{fontSize:18,fontWeight:800,color:theme.text,fontFamily:"'Playfair Display',serif"}}>{isEditing?"Edit Session":"Log a Session"}</div></div>
        <div style={{display:"flex",gap:0,marginBottom:24}}>{steps.map((s,i)=>(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{width:28,height:28,borderRadius:"50%",background:step>i+1?theme.accent:step===i+1?theme.accent+"33":theme.border,border:`2px solid ${step>=i+1?theme.accent:theme.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:step>i+1?"#000":step===i+1?theme.accent:theme.textMuted}}>{step>i+1?"✓":i+1}</div><div style={{fontSize:10,color:step===i+1?theme.accent:theme.textMuted}}>{s}</div></div>))}</div>
        {step===1&&(<div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>DATE *</div><input type="date" value={form.date} onChange={e=>{set("date",e.target.value);set("moonPhase",getMoonPhase(e.target.value));}} style={inp}/></div><div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>SESSION TYPE</div><select value={form.sessionType} onChange={e=>set("sessionType",e.target.value)} style={{...inp,cursor:"pointer"}}>{SESSION_TYPES.map(st=><option key={st} value={st}>{st}</option>)}</select></div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>START TIME</div><input type="time" value={form.startTime} onChange={e=>set("startTime",e.target.value)} style={inp}/></div><div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>END TIME</div><input type="time" value={form.endTime} onChange={e=>set("endTime",e.target.value)} style={inp}/></div></div>
          <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>VENUE NAME *</div><input value={form.venueName} onChange={e=>set("venueName",e.target.value)} placeholder="e.g. Lechlade Fishery" style={inp}/></div>
          <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:10}}>TARGET SPECIES</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{SPECIES.slice(0,10).map(s=><Chip key={s} label={s} selected={form.targetSpecies.includes(s)} onClick={()=>toggle("targetSpecies",s)}/>)}</div></div>
          <div onClick={()=>set("blank",!form.blank)} style={{display:"flex",alignItems:"center",gap:14,background:form.blank?theme.danger+"22":theme.surfaceAlt,border:`1px solid ${form.blank?theme.danger+"44":theme.border}`,borderRadius:12,padding:"14px 18px",cursor:"pointer"}}><div style={{width:22,height:22,borderRadius:"50%",background:form.blank?theme.danger:theme.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#000",flexShrink:0}}>{form.blank?"✓":""}</div><div><div style={{fontWeight:700,color:theme.text,fontSize:14}}>Blank session</div><div style={{color:theme.textMuted,fontSize:12}}>No fish — still valuable data</div></div></div>
        </div>)}
        {step===2&&(<div style={{display:"flex",flexDirection:"column",gap:16}}>
          {form.blank?(<div style={{background:theme.danger+"11",border:`1px solid ${theme.danger}33`,borderRadius:14,padding:24,textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>🎣</div><div style={{fontWeight:700,color:theme.text,fontSize:16,fontFamily:"'Playfair Display',serif"}}>Blank Session</div></div>):(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontWeight:700,color:theme.text,fontSize:16,fontFamily:"'Playfair Display',serif"}}>Fish Caught</div><div style={{fontSize:28,fontWeight:900,color:theme.accent}}>{form.catches.length}</div></div>
            {form.catches.map((c,i)=>(<div key={i} style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:14,padding:16}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><div style={{fontWeight:700,color:theme.accent,fontSize:13}}>Fish #{i+1}</div><button onClick={()=>removeCatch(i)} style={{background:"none",border:"none",color:theme.textMuted,cursor:"pointer",fontSize:18,padding:0}}>×</button></div><div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",gap:10}}><div><div style={{fontSize:10,color:theme.textMuted,marginBottom:4}}>SPECIES</div><select value={c.species} onChange={e=>setCatch(i,"species",e.target.value)} style={{...inp,padding:"8px 10px",fontSize:13,cursor:"pointer"}}><option value="">Species...</option>{SPECIES.map(s=><option key={s} value={s}>{s}</option>)}</select></div><div><div style={{fontSize:10,color:theme.textMuted,marginBottom:4}}>LB</div><input type="number" value={c.weightLb} onChange={e=>setCatch(i,"weightLb",e.target.value)} placeholder="0" style={{...inp,padding:"8px 10px",fontSize:13}}/></div><div><div style={{fontSize:10,color:theme.textMuted,marginBottom:4}}>OZ</div><input type="number" value={c.weightOz} onChange={e=>setCatch(i,"weightOz",e.target.value)} placeholder="0" style={{...inp,padding:"8px 10px",fontSize:13}}/></div></div></div>))}
            <button onClick={addCatch} style={{background:theme.surfaceAlt,border:`2px dashed ${theme.border}`,borderRadius:14,padding:16,cursor:"pointer",color:theme.textMuted,fontFamily:"inherit",fontSize:14,fontWeight:600,width:"100%"}}>+ Add a Fish</button>
          </>)}
          <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:10}}>BAIT USED</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{BAITS.map(b=><Chip key={b} label={b} selected={form.baitUsed.includes(b)} onClick={()=>toggle("baitUsed",b)} color={theme.water}/>)}</div></div>
          <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:10}}>RIG USED</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{RIGS.map(r=><Chip key={r} label={r} selected={form.rigUsed===r} onClick={()=>set("rigUsed",form.rigUsed===r?"":r)} color={theme.purple}/>)}</div></div>
        </div>)}
        {step===3&&(<div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:14,padding:16}}><div style={{fontSize:13,fontWeight:700,color:theme.text,marginBottom:10}}>Autofill weather from your location</div><div style={{display:"flex",gap:10}}><input value={form.postcode} onChange={e=>set("postcode",e.target.value)} placeholder="Enter postcode" style={{...inp,flex:1}}/><button onClick={autofill} disabled={!form.postcode||form.weatherLoading} style={{background:!form.postcode?theme.border:theme.accent,color:!form.postcode?theme.textMuted:"#000",border:"none",borderRadius:10,padding:"10px 16px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13,whiteSpace:"nowrap"}}>{form.weatherLoading?"...":"Fill →"}</button></div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>WEATHER</div><input value={form.weatherCondition} onChange={e=>set("weatherCondition",e.target.value)} placeholder="e.g. Overcast" style={inp}/></div>
            <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>TEMP °C</div><input type="number" value={form.temperature} onChange={e=>set("temperature",e.target.value)} placeholder="14" style={inp}/></div>
            <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>WIND DIRECTION</div><select value={form.windDirection} onChange={e=>set("windDirection",e.target.value)} style={{...inp,cursor:"pointer"}}><option value="">Select...</option>{WIND_DIRS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
            <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>PRESSURE hPa</div><input type="number" value={form.airPressure} onChange={e=>set("airPressure",e.target.value)} placeholder="1014" style={inp}/></div>
            <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>PRESSURE TREND</div><select value={form.pressureTrend} onChange={e=>set("pressureTrend",e.target.value)} style={{...inp,cursor:"pointer"}}><option value="">Select...</option>{["Rising","Stable","Falling"].map(p=><option key={p} value={p}>{p}</option>)}</select></div>
            <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>WATER CLARITY</div><select value={form.waterClarity} onChange={e=>set("waterClarity",e.target.value)} style={{...inp,cursor:"pointer"}}><option value="">Select...</option>{WATER_CLARITY.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between"}}><span style={{color:theme.text,fontSize:13}}>Moon Phase (auto)</span><span style={{color:theme.accent,fontWeight:700,fontSize:13}}>{form.moonPhase}</span></div>
        </div>)}
        {step===4&&(<div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:6}}>PRIVATE NOTES</div><textarea value={form.privateNotes} onChange={e=>set("privateNotes",e.target.value)} placeholder="Exact peg, tactics that worked, what to try next time..." rows={4} style={{...inp,resize:"vertical"}}/></div>
          <div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:10}}>SESSION RATING</div><div style={{display:"flex",gap:8}}>{[1,2,3,4,5].map(n=><button key={n} onClick={()=>set("sessionRating",n)} style={{flex:1,background:form.sessionRating>=n?theme.warning+"33":theme.surfaceAlt,color:form.sessionRating>=n?theme.warning:theme.textMuted,border:`1px solid ${form.sessionRating>=n?theme.warning+"66":theme.border}`,borderRadius:10,padding:"12px 6px",cursor:"pointer",fontFamily:"inherit",fontSize:20}}>★</button>)}</div></div>
          <div>
            <div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:10}}>PHOTOS</div>
            <label style={{display:"flex",alignItems:"center",gap:10,background:theme.surfaceAlt,border:`2px dashed ${theme.border}`,borderRadius:12,padding:"14px 16px",cursor:"pointer"}}>
              <input type="file" accept="image/*" multiple onChange={e=>uploadPhotos(e.target.files)} style={{display:"none"}}/>
              <span style={{fontSize:20}}>📷</span>
              <span style={{color:theme.textMuted,fontSize:13}}>{photoUploading?"Uploading...":"Add photos from your session"}</span>
            </label>
            {form.photos&&form.photos.length>0&&(
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                {form.photos.map((url,i)=>(
                  <div key={i} style={{position:"relative"}}>
                    <img src={url} style={{width:80,height:80,objectFit:"cover",borderRadius:8,border:"1px solid "+theme.border}}/>
                    <button onClick={()=>set("photos",form.photos.filter((_,j)=>j!==i))} style={{position:"absolute",top:-6,right:-6,background:theme.danger,color:"#fff",border:"none",borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>)}
        <div style={{display:"flex",gap:10,marginTop:24}}>
          {step>1&&<button onClick={()=>setStep(step-1)} style={{flex:1,background:"none",border:"1px solid "+theme.border,borderRadius:12,padding:"14px",color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:14}}>← Back</button>}
          {step<4?<button onClick={()=>setStep(step+1)} disabled={step===1&&!form.venueName} style={{flex:2,background:(step===1&&!form.venueName)?theme.border:theme.accent,color:(step===1&&!form.venueName)?theme.textMuted:"#000",border:"none",borderRadius:12,padding:"14px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14}}>Next →</button>
          :<button onClick={isEditing?updateSession:saveSession} style={{flex:2,background:theme.accent,color:"#000",border:"none",borderRadius:12,padding:"14px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14}}>{isEditing?"Save Changes ✓":"Save Session ✓"}</button>}
        </div>
      </div>
    );
  }

  if(view==="saved")return(()=>{
    const lastS=sessions[0];
    const fishCount=lastS?.total_fish||0;
    const topCatch=lastS?.catches?.[0];
    const venue=lastS?.venue_name||"the fishery";
    const shareText=topCatch
      ?`🎣 Just logged a session at ${venue} on Reel Big Fish! Caught ${fishCount} fish including a ${topCatch.weightLb||""}${topCatch.weightLb?"lb ":""}${topCatch.species}. Track your catches free → reelbigfish.co.uk`
      :`🎣 Just logged a fishing session at ${venue} on Reel Big Fish! Track your catches free → reelbigfish.co.uk`;
    const profileUrl=profile?.username?`https://reelbigfish.co.uk/#/profile/${encodeURIComponent(profile.username)}`:"https://reelbigfish.co.uk";
    const fbUrl=`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}&quote=${encodeURIComponent(shareText)}`;
    const igUrl="https://www.instagram.com/";
    const hasPhoto=lastS?.photos?.length>0;
    return(
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{fontSize:56,marginBottom:16}}>✓</div>
      <div style={{fontSize:24,fontWeight:800,color:theme.accent,fontFamily:"'Playfair Display',serif",marginBottom:8}}>Session Saved!</div>
      <div style={{color:theme.textMuted,fontSize:14,marginBottom:24}}>Saved to your account. Access it from any device.</div>
      <div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:16,padding:"20px 24px",maxWidth:400,margin:"0 auto 24px",textAlign:"left"}}>
        <div style={{fontSize:11,color:theme.accent,fontWeight:700,letterSpacing:2,marginBottom:8,fontFamily:"monospace",textTransform:"uppercase"}}>Share Your Catch</div>
        <div style={{color:theme.textMuted,fontSize:13,lineHeight:1.6,marginBottom:16}}>"{shareText}"</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={()=>window.open(fbUrl,"_blank")} style={{flex:1,background:"#1877F2",color:"#fff",border:"none",borderRadius:10,padding:"12px 16px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:18}}>f</span> Facebook
          </button>
          <button onClick={()=>window.open(igUrl,"_blank")} style={{flex:1,background:"linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",color:"#fff",border:"none",borderRadius:10,padding:"12px 16px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:18}}>📷</span> Instagram
          </button>
        </div>
        {!hasPhoto&&<div style={{color:theme.textMuted,fontSize:11,marginTop:10,textAlign:"center"}}>Tip: Add a photo to your session to make your Instagram post stand out!</div>}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
        <button onClick={()=>setView("analysis")} style={{background:theme.purple,color:"#fff",border:"none",borderRadius:12,padding:"12px 24px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14}}>View AI Analysis →</button>
        <button onClick={()=>setView("log")} style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:12,padding:"12px 24px",cursor:"pointer",color:theme.textMuted,fontFamily:"inherit",fontSize:14}}>Log Another</button>
        <button onClick={()=>setView("home")} style={{background:"none",border:"1px solid "+theme.border,borderRadius:12,padding:"12px 24px",cursor:"pointer",color:theme.textMuted,fontFamily:"inherit",fontSize:14}}>Back to Diary</button>
      </div>
    </div>
    );
  })();

  if(view==="history")return(<div><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}><button onClick={()=>setView("home")} style={{background:"none",border:"1px solid "+theme.border,borderRadius:8,padding:"6px 12px",color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>← Back</button><div style={{fontSize:18,fontWeight:800,color:theme.text,fontFamily:"'Playfair Display',serif"}}>Session History ({sessions.length})</div></div>{sessions.length===0?(<div style={{background:theme.surfaceAlt,border:`2px dashed ${theme.border}`,borderRadius:16,padding:40,textAlign:"center"}}><div style={{fontSize:36,marginBottom:12}}>📔</div><div style={{fontWeight:700,color:theme.text,fontSize:16,marginBottom:6}}>No sessions yet</div></div>):sessions.map((s,i)=>(<div key={i} onClick={()=>{setSelectedSession(s);setView("detail");}} style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:14,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,cursor:"pointer"}}><div><div style={{fontWeight:700,color:theme.text,fontSize:15}}>{s.venue_name||"Unknown venue"}</div><div style={{fontSize:12,color:theme.textMuted,marginTop:2}}>{s.date} · {s.session_type}</div></div><div style={{textAlign:"right"}}>{s.blank?<div style={{color:theme.danger,fontWeight:700,fontSize:14}}>Blank</div>:<div style={{color:theme.accent,fontWeight:900,fontSize:22}}>{s.total_fish}</div>}{s.session_rating>0&&<div style={{color:theme.warning,fontSize:11,marginTop:2}}>{"★".repeat(s.session_rating)}</div>}</div></div>))}</div>);

  if(view==="detail"&&selectedSession){const s=selectedSession;return(<div><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}><button onClick={()=>setView("history")} style={{background:"none",border:"1px solid "+theme.border,borderRadius:8,padding:"6px 12px",color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>← Back</button><div style={{fontSize:18,fontWeight:800,color:theme.text,fontFamily:"'Playfair Display',serif",flex:1}}>{s.venue_name}</div><button onClick={()=>startEdit(s)} style={{background:theme.surfaceAlt,border:`1px solid ${theme.accent}`,borderRadius:8,padding:"6px 14px",color:theme.accent,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>Edit</button></div><div style={{background:theme.surfaceAlt,border:"1px solid "+theme.accent+"44",borderRadius:16,padding:20,display:"flex",flexDirection:"column",gap:14}}><div style={{color:theme.textMuted,fontSize:13}}>{s.date} · {s.session_type}</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}><div style={{background:theme.surface,borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:s.blank?theme.danger:theme.accent}}>{s.blank?"0":s.total_fish}</div><div style={{fontSize:11,color:theme.textMuted,marginTop:2}}>{s.blank?"Blank":"Fish"}</div></div>{s.session_rating>0&&<div style={{background:theme.surface,borderRadius:10,padding:12,textAlign:"center"}}><div style={{color:theme.warning,fontSize:16}}>{"★".repeat(s.session_rating)}</div><div style={{fontSize:11,color:theme.textMuted,marginTop:4}}>Rating</div></div>}{s.moon_phase&&<div style={{background:theme.surface,borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:theme.text}}>{s.moon_phase}</div><div style={{fontSize:11,color:theme.textMuted,marginTop:2}}>Moon</div></div>}</div>{s.catches?.length>0&&<div><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:8}}>CATCHES</div>{s.catches.map((c,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",background:theme.surface,borderRadius:8,padding:"8px 12px",marginBottom:4}}><span style={{color:theme.text,fontSize:13,fontWeight:600}}>{c.species||"Unknown"}</span><span style={{color:theme.accent,fontSize:13,fontWeight:700}}>{c.weightLb||0}lb {c.weightOz||0}oz</span></div>))}</div>}{s.bait_used?.length>0&&<div style={{fontSize:13,color:theme.textMuted}}>🎣 {s.bait_used.join(", ")}</div>}{s.rig_used&&<div style={{fontSize:13,color:theme.textMuted}}>⚙️ {s.rig_used}</div>}{(s.weather_condition||s.temperature)&&<div style={{fontSize:13,color:theme.textMuted}}>🌤️ {[s.weather_condition,s.temperature&&`${s.temperature}°C`,s.pressure_trend&&`Pressure ${s.pressure_trend}`].filter(Boolean).join(" · ")}</div>}{s.private_notes&&<div style={{background:theme.danger+"11",border:`1px solid ${theme.danger}22`,borderRadius:10,padding:12,fontSize:13,color:theme.textMuted,lineHeight:1.6}}>🔒 <strong style={{color:theme.text}}>Private notes:</strong> {s.private_notes}</div>}{s.photos&&s.photos.length>0&&(<div style={{marginTop:20}}><div style={{fontSize:11,color:theme.accent,fontWeight:700,letterSpacing:2,marginBottom:12,fontFamily:"monospace",textTransform:"uppercase"}}>Photos</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>{s.photos.map((url,i)=>(<img key={i} src={url} onClick={()=>window.open(url,"_blank")} style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:10,cursor:"pointer",border:"1px solid "+theme.border}}/>))}</div></div>)}</div></div>);}

  if(view==="analysis")return(<div style={{display:"flex",flexDirection:"column",gap:20}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}><button onClick={()=>setView("home")} style={{background:"none",border:"1px solid "+theme.border,borderRadius:8,padding:"6px 12px",color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>← Back</button><div style={{fontSize:18,fontWeight:800,color:theme.text,fontFamily:"'Playfair Display',serif"}}>AI Analysis</div></div>{!profile?.is_premium&&sessions.length>3&&<div style={{background:theme.warning+"22",border:"1px solid "+theme.warning+"44",borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><div style={{color:theme.text,fontSize:13}}>⭐ Analysing your last 3 sessions only. <span style={{color:theme.warning,fontWeight:700}}>Upgrade to Premium</span> to analyse your full history.</div><button onClick={()=>setView("premium")} style={{background:theme.warning,color:"#000",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:12,flexShrink:0}}>Upgrade</button></div>}<div style={{background:`linear-gradient(135deg,${theme.purple}22,${theme.accentDim}11)`,border:`1px solid ${theme.purple}44`,borderRadius:20,padding:24}}><div style={{fontSize:14,color:theme.textMuted,lineHeight:1.6}}>{sessions.length<2?`Log at least 2 sessions to unlock your first analysis. You have ${sessions.length} so far.`:`Based on ${sessions.length} session${sessions.length!==1?"s":""}. ${sessions.length<5?"Early analysis — patterns sharpen as you log more.":"Good data set."}`}</div></div>{sessions.length>=2&&<button onClick={runAnalysis} disabled={analysisLoading} style={{background:analysisLoading?theme.border:theme.purple,color:analysisLoading?theme.textMuted:"#fff",border:"none",borderRadius:12,padding:16,cursor:analysisLoading?"not-allowed":"pointer",fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:17}}>{analysisLoading?"⏳ Analysing...":"Generate Analysis →"}</button>}{analysisText&&<div style={{background:theme.surfaceAlt,border:`1px solid ${theme.purple}44`,borderRadius:16,padding:24}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><div style={{width:32,height:32,borderRadius:"50%",background:theme.purple+"33",border:`1px solid ${theme.purple}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🤖</div><div style={{fontWeight:700,color:theme.text,fontSize:14}}>Your Fishing Analysis</div></div><div style={{color:theme.text,fontSize:14,lineHeight:1.9,whiteSpace:"pre-wrap"}}>{analysisText}</div></div>}<div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:14,padding:18}}><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{[{label:"Sessions",value:sessions.length},{label:"Total fish",value:totalFish},{label:"Blank rate",value:sessions.length>0?`${Math.round(blanks/sessions.length*100)}%`:"—"}].map((s,i)=>(<div key={i} style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:900,color:theme.accent,fontFamily:"'Playfair Display',serif"}}>{s.value}</div><div style={{fontSize:11,color:theme.textMuted,marginTop:2}}>{s.label}</div></div>))}</div></div></div>);

  if(view==="premium")return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={()=>setView("home")} style={{background:"none",border:"1px solid "+theme.border,borderRadius:8,padding:"6px 12px",color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>← Back</button>
        <div style={{fontWeight:800,color:theme.text,fontSize:18}}>Go Premium</div>
      </div>
      <PremiumTab/>
    </div>
  );

  if(view==="analytics"){if(!profile?.is_premium)return(<div style={{textAlign:"center",padding:"60px 24px"}}><div style={{fontSize:48,marginBottom:16}}>📊</div><div style={{fontWeight:700,color:theme.text,fontSize:18,marginBottom:8}}>Premium Analytics</div><div style={{color:theme.textMuted,fontSize:14,marginBottom:20}}>Upgrade to unlock deep insights from your catch data.</div><button onClick={()=>setView("premium")} style={{background:theme.accent,color:"#000",border:"none",borderRadius:12,padding:"12px 24px",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>⭐ Upgrade to Premium</button></div>);const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];const catchByMonth=Array(12).fill(0);sessions.forEach(s=>{if(s.date){const m=new Date(s.date).getMonth();catchByMonth[m]+=(s.total_fish||0);}});const maxMonth=Math.max(...catchByMonth,1);const venueMap={};sessions.forEach(s=>{if(s.venue_name)venueMap[s.venue_name]=(venueMap[s.venue_name]||0)+(s.total_fish||0);});const topVenues=Object.entries(venueMap).sort((a,b)=>b[1]-a[1]).slice(0,5);const speciesMap={};allCatches.forEach(c=>{if(c.species)speciesMap[c.species]=(speciesMap[c.species]||0)+1;});const topSpecies=Object.entries(speciesMap).sort((a,b)=>b[1]-a[1]).slice(0,6);const blanksByMonth=Array(12).fill(0);const sessionsByMonth=Array(12).fill(0);sessions.forEach(s=>{if(s.date){const m=new Date(s.date).getMonth();sessionsByMonth[m]++;if(s.blank)blanksByMonth[m]++;}});return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={()=>setView("home")} style={{background:"none",border:"1px solid "+theme.border,borderRadius:8,padding:"6px 12px",color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>← Back</button>
        <div>
          <div style={{fontWeight:800,color:theme.text,fontSize:18}}>Your Analytics</div>
          <div style={{color:theme.accent,fontSize:11,fontWeight:700}}>⭐ Premium</div>
        </div>
      </div>

      {/* Catches by month */}
      <div style={{background:theme.surface,border:"1px solid "+theme.border,borderRadius:14,padding:"20px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:theme.text,marginBottom:16}}>Catches by Month</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:4,height:80}}>
          {catchByMonth.map((v,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{width:"100%",background:theme.accent,borderRadius:"4px 4px 0 0",height:`${(v/maxMonth)*64}px`,minHeight:v>0?4:0,transition:"height 0.3s"}}/>
              <div style={{fontSize:9,color:theme.textMuted,textAlign:"center"}}>{months[i].slice(0,1)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top venues */}
      {topVenues.length>0&&(
        <div style={{background:theme.surface,border:"1px solid "+theme.border,borderRadius:14,padding:"20px",marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:theme.text,marginBottom:12}}>Top Venues</div>
          {topVenues.map(([venue,fish],i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{fontSize:14,color:theme.textMuted,width:16,textAlign:"right"}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:theme.text,fontSize:13,marginBottom:3}}>{venue}</div>
                <div style={{height:6,background:theme.border,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",background:theme.water,borderRadius:3,width:`${(fish/topVenues[0][1])*100}%`}}/>
                </div>
              </div>
              <div style={{color:theme.water,fontWeight:700,fontSize:13}}>{fish}</div>
            </div>
          ))}
        </div>
      )}

      {/* Species breakdown */}
      {topSpecies.length>0&&(
        <div style={{background:theme.surface,border:"1px solid "+theme.border,borderRadius:14,padding:"20px",marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:theme.text,marginBottom:12}}>Species Breakdown</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {topSpecies.map(([sp,count],i)=>{
              const colours=[theme.accent,theme.water,theme.purple,theme.warning,theme.danger,"#00bcd4"];
              return(<div key={i} style={{background:colours[i%6]+"22",border:`1px solid ${colours[i%6]}44`,borderRadius:20,padding:"6px 14px",display:"flex",gap:6,alignItems:"center"}}><span style={{color:colours[i%6],fontWeight:700,fontSize:13}}>{sp}</span><span style={{color:theme.textMuted,fontSize:12}}>{count}</span></div>);
            })}
          </div>
        </div>
      )}

      {/* Blank rate */}
      <div style={{background:theme.surface,border:"1px solid "+theme.border,borderRadius:14,padding:"20px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:theme.text,marginBottom:4}}>Blank Rate by Month</div>
        <div style={{color:theme.textMuted,fontSize:12,marginBottom:12}}>Months where you blank most often</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:4,height:60}}>
          {sessionsByMonth.map((total,i)=>{
            const rate=total>0?blanksByMonth[i]/total:0;
            return(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:"100%",background:rate>0.5?theme.danger:rate>0.2?theme.warning:theme.good,borderRadius:"4px 4px 0 0",height:`${rate*48}px`,minHeight:total>0?2:0}}/>
                <div style={{fontSize:9,color:theme.textMuted}}>{months[i].slice(0,1)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key insights */}
      <div style={{background:`linear-gradient(135deg,${theme.accent}22,${theme.water}11)`,border:"1px solid "+theme.accent+"44",borderRadius:14,padding:"20px"}}>
        <div style={{fontSize:13,fontWeight:700,color:theme.accent,marginBottom:12}}>💡 Key Insights</div>
        {[{
          label:"Best month",
          value:catchByMonth.every(v=>v===0)?"No data yet":months[catchByMonth.indexOf(Math.max(...catchByMonth))],
          icon:"🏆"
        },{
          label:"Favourite species",
          value:topSpecies.length>0?topSpecies[0][0]:"No data yet",
          icon:"🎣"
        },{
          label:"Best venue",
          value:topVenues.length>0?topVenues[0][0]:"No data yet",
          icon:"📍"
        },{
          label:"Sessions this year",
          value:sessions.filter(s=>s.date?.startsWith(new Date().getFullYear().toString())).length,
          icon:"📅"
        }].map((ins,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:i<3?10:0}}>
            <span style={{fontSize:18}}>{ins.icon}</span>
            <div style={{flex:1,color:theme.textMuted,fontSize:13}}>{ins.label}</div>
            <div style={{fontWeight:700,color:theme.text,fontSize:14}}>{ins.value}</div>
          </div>
        ))}
      </div>
    </div>
  );}

  if(view==="annualreport"){if(!profile?.is_premium)return(<div style={{textAlign:"center",padding:"60px 24px"}}><button onClick={()=>setView("home")} style={{background:"none",border:"1px solid "+theme.border,borderRadius:8,padding:"6px 12px",color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:13,marginBottom:20}}>← Back</button><div style={{fontSize:48,marginBottom:16}}>🏆</div><div style={{fontWeight:700,color:theme.text,fontSize:18,marginBottom:8}}>Annual Catch Report</div><button onClick={()=>setView("premium")} style={{background:theme.accent,color:"#000",border:"none",borderRadius:12,padding:"12px 24px",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>⭐ Upgrade to Premium</button></div>);
    const year=new Date().getFullYear();
    const yearSessions=sessions.filter(s=>s.date?.startsWith(String(year)));
    const yearCatches=yearSessions.flatMap(s=>s.catches||[]);
    const yearFish=yearSessions.reduce((a,s)=>a+(s.total_fish||0),0);
    const yearBlanks=yearSessions.filter(s=>s.blank).length;
    const yearPB=yearCatches.reduce((best,c)=>{const w=(parseFloat(c.weightLb)||0)+(parseFloat(c.weightOz)||0)/16;const bw=best?(parseFloat(best.weightLb)||0)+(parseFloat(best.weightOz)||0)/16:0;return w>bw?c:best;},null);
    const venueMap={};yearSessions.forEach(s=>{if(s.venue_name)venueMap[s.venue_name]=(venueMap[s.venue_name]||0)+(s.total_fish||0);});
    const bestVenue=Object.entries(venueMap).sort((a,b)=>b[1]-a[1])[0];
    const speciesMap={};yearCatches.forEach(c=>{if(c.species)speciesMap[c.species]=(speciesMap[c.species]||0)+1;});
    const topSpecies=Object.entries(speciesMap).sort((a,b)=>b[1]-a[1])[0];
    const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const catchByMonth=Array(12).fill(0);yearSessions.forEach(s=>{if(s.date){const m=new Date(s.date).getMonth();catchByMonth[m]+=(s.total_fish||0);}});
    const bestMonth=months[catchByMonth.indexOf(Math.max(...catchByMonth))];
    const maxMonth=Math.max(...catchByMonth,1);
    return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={()=>setView("home")} style={{background:"none",border:"1px solid "+theme.border,borderRadius:8,padding:"6px 12px",color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>← Back</button>
        <div style={{fontWeight:800,color:theme.text,fontSize:18}}>Your {year} Season</div>
      </div>

      {/* Shareable card */}
      <div id="annual-report-card" style={{background:`linear-gradient(160deg,#0a1a0e 0%,#0d2818 50%,#0a1a0e 100%)`,border:"1px solid "+theme.accent+"44",borderRadius:20,padding:"28px 24px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <div style={{width:36,height:36,borderRadius:8,background:theme.accent,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,color:"#000"}}>RBF</div>
          <div>
            <div style={{fontWeight:800,color:theme.text,fontSize:14}}>{profile.username}</div>
            <div style={{color:theme.accent,fontSize:11,fontWeight:700}}>{year} Fishing Season</div>
          </div>
        </div>

        {/* Big stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
          {[
            {label:"Sessions",value:yearSessions.length,color:theme.accent},
            {label:"Fish Caught",value:yearFish,color:theme.water},
            {label:"Species",value:[...new Set(yearCatches.map(c=>c.species).filter(Boolean))].length,color:theme.purple},
          ].map((s,i)=>(
            <div key={i} style={{textAlign:"center",background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"14px 8px"}}>
              <div style={{fontSize:26,fontWeight:900,color:s.color,fontFamily:"'Playfair Display',serif"}}>{s.value}</div>
              <div style={{fontSize:10,color:theme.textMuted,textTransform:"uppercase",letterSpacing:1,marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:theme.textMuted,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Catches by Month</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:3,height:60}}>
            {catchByMonth.map((v,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <div style={{width:"100%",background:v>0?theme.accent:"rgba(255,255,255,0.1)",borderRadius:"3px 3px 0 0",height:`${(v/maxMonth)*48}px`,minHeight:v>0?3:2}}/>
                <div style={{fontSize:8,color:theme.textMuted}}>{months[i].slice(0,1)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Highlights */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {yearPB&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"10px 14px"}}><div style={{color:theme.textMuted,fontSize:13}}>🏆 Personal Best</div><div style={{fontWeight:700,color:theme.warning,fontSize:13}}>{yearPB.weightLb||0}lb {yearPB.weightOz||0}oz {yearPB.species}</div></div>}
          {bestVenue&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"10px 14px"}}><div style={{color:theme.textMuted,fontSize:13}}>📍 Top Venue</div><div style={{fontWeight:700,color:theme.text,fontSize:13}}>{bestVenue[0]}</div></div>}
          {topSpecies&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"10px 14px"}}><div style={{color:theme.textMuted,fontSize:13}}>🎣 Favourite Species</div><div style={{fontWeight:700,color:theme.accent,fontSize:13}}>{topSpecies[0]}</div></div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"10px 14px"}}><div style={{color:theme.textMuted,fontSize:13}}>📅 Best Month</div><div style={{fontWeight:700,color:theme.text,fontSize:13}}>{catchByMonth.every(v=>v===0)?"No data":bestMonth}</div></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"10px 14px"}}><div style={{color:theme.textMuted,fontSize:13}}>🟢 Blank Rate</div><div style={{fontWeight:700,color:yearBlanks/Math.max(yearSessions.length,1)>0.3?theme.danger:theme.good,fontSize:13}}>{yearSessions.length>0?Math.round(yearBlanks/yearSessions.length*100):0}%</div></div>
        </div>

        <div style={{textAlign:"center",marginTop:16,color:theme.textMuted,fontSize:11}}>reelbigfish.co.uk</div>
      </div>

      {yearSessions.length===0&&<div style={{textAlign:"center",color:theme.textMuted,fontSize:14,padding:"20px 0"}}>No sessions logged in {year} yet. Start logging to see your annual report!</div>}

      <div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:12,padding:"16px",textAlign:"center"}}>
        <div style={{color:theme.text,fontWeight:700,marginBottom:6}}>📱 Share your season</div>
        <div style={{color:theme.textMuted,fontSize:13,marginBottom:12}}>Screenshot this report and share it on social media</div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button onClick={()=>{
            const txt="Check out my "+year+" fishing season on Reel Big Fish! "+yearSessions.length+" sessions, "+yearFish+" fish caught. reelbigfish.co.uk";
            const url="https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent("https://reelbigfish.co.uk")+"&quote="+encodeURIComponent(txt);
            window.open(url,"_blank");
          }} style={{background:"#1877F2",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14}}>Share on Facebook</button>
        </div>
      </div>
    </div>
  );}

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{background:`linear-gradient(135deg,${theme.accent}22,${theme.water}22)`,border:"1px solid "+theme.accent+"44",borderRadius:20,padding:"28px 24px"}}>
        <div style={{fontSize:11,color:theme.accent,fontWeight:700,letterSpacing:1.5,marginBottom:12,fontFamily:"monospace",textTransform:"uppercase"}}>Your Fishing Diary</div>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
          <label style={{cursor:"pointer",flexShrink:0}}>
            <input type="file" accept="image/*" onChange={e=>e.target.files[0]&&uploadAvatar(e.target.files[0])} style={{display:"none"}}/>
            <div style={{width:64,height:64,borderRadius:"50%",overflow:"hidden",border:`3px solid ${theme.accent}`,background:`linear-gradient(135deg,${theme.accent},${theme.water})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>
              {profile.avatar_url?<img src={profile.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🎣"}
            </div>
          </label>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              <div style={{fontSize:22,fontWeight:900,color:theme.text,fontFamily:"'Playfair Display',serif"}}>Welcome back, {profile.username}</div>
              {profile.is_premium&&<span style={{background:"linear-gradient(135deg,#FFD700,#FFA500)",color:"#000",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>⭐ Premium</span>}
            </div>
            <button onClick={()=>setView("editprofile")} style={{background:"none",border:"none",padding:0,cursor:"pointer",color:theme.accent,fontSize:13,fontWeight:600,fontFamily:"inherit"}}>Edit Profile — {profile.region||"Add region"}</button>
          </div>
        </div>
        <div style={{color:theme.textMuted,fontSize:14,marginBottom:24}}>Your diary syncs across all your devices.</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={()=>setView("log")} style={{background:theme.accent,color:"#000",border:"none",borderRadius:12,padding:"12px 24px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14}}>+ Log a Session</button>
          {profile?.username&&<button onClick={()=>{window.location.hash=`#/profile/${encodeURIComponent(profile.username)}`;}} style={{background:"none",border:`1px solid ${theme.accent}`,borderRadius:12,padding:"12px 20px",cursor:"pointer",color:theme.accent,fontFamily:"inherit",fontSize:14,fontWeight:700}}>🔗 My Profile</button>}
          <button onClick={signOut} style={{background:"none",border:"1px solid "+theme.border,borderRadius:12,padding:"12px 20px",cursor:"pointer",fontFamily:"inherit",fontSize:13,color:theme.textMuted}}>Log Out</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>{[{label:"SESSIONS",value:sessions.length,sub:"logged",color:theme.accent},{label:"TOTAL FISH",value:totalFish,sub:sessions.length>0?`${(totalFish/sessions.length).toFixed(1)} avg`:"",color:theme.water},{label:"PERSONAL BEST",value:pb?`${pb.weightLb||0}lb ${pb.weightOz||0}oz`:"—",sub:pb?pb.species:"No PBs yet",color:theme.warning},{label:"BLANK RATE",value:sessions.length>0?`${Math.round(blanks/sessions.length*100)}%`:"0%",sub:`${blanks} blank${blanks!==1?"s":""}`,color:blanks>0?theme.danger:theme.good},{label:"STREAK",value:`${streak} week${streak===1?"":"s"}`,sub:streak>0?"🔥 Keep it up!":"Log a session",color:theme.purple},{label:"SPECIES",value:[...new Set(allCatches.map(c=>c.species).filter(Boolean))].length,sub:"species caught",color:theme.water}].map((s,i)=>(<div key={i} style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:14,padding:"16px 18px"}}><div style={{fontSize:10,color:theme.textMuted,fontWeight:700,letterSpacing:1.2,marginBottom:6,fontFamily:"monospace"}}>{s.label}</div><div style={{fontSize:26,fontWeight:900,color:s.color,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{s.value}</div>{s.sub&&<div style={{fontSize:12,color:theme.textMuted,marginTop:4}}>{s.sub}</div>}</div>))}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button onClick={()=>setView("history")} style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:14,padding:18,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}><div style={{fontSize:22,marginBottom:8}}>📔</div><div style={{fontWeight:700,color:theme.text,fontSize:15,marginBottom:4}}>Session History</div><div style={{color:theme.textMuted,fontSize:12}}>{sessions.length} session{sessions.length!==1?"s":""} logged</div></button>
        <button onClick={()=>setView("analysis")} style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:14,padding:18,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}><div style={{fontSize:22,marginBottom:8}}>🤖</div><div style={{fontWeight:700,color:theme.text,fontSize:15,marginBottom:4}}>AI Analysis</div><div style={{color:theme.textMuted,fontSize:12}}>{sessions.length<2?"Log 2+ sessions to unlock":"Patterns from your diary"}</div></button>
        {profile?.is_premium?(
          <button onClick={()=>setView("analytics")} style={{background:`linear-gradient(135deg,#FFD700,#FFA500)`,border:"none",borderRadius:14,padding:18,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <div style={{fontSize:22,marginBottom:8}}>📊</div>
            <div style={{fontWeight:700,color:"#000",fontSize:15,marginBottom:4}}>Analytics</div>
            <div style={{color:"#333",fontSize:12}}>Your catch insights</div>
          </button>
        ):(
          <button onClick={()=>setView("premium")} style={{background:theme.surfaceAlt,border:`2px dashed ${theme.warning}`,borderRadius:14,padding:18,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <div style={{fontSize:22,marginBottom:8}}>📊</div>
            <div style={{fontWeight:700,color:theme.text,fontSize:15,marginBottom:4}}>Analytics</div>
            <div style={{color:theme.warning,fontSize:12}}>⭐ Premium feature</div>
          </button>
        )}
        {profile?.is_premium?(
          <button onClick={exportDiary} style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:14,padding:18,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <div style={{fontSize:22,marginBottom:8}}>📤</div>
            <div style={{fontWeight:700,color:theme.text,fontSize:15,marginBottom:4}}>Export Diary</div>
            <div style={{color:theme.textMuted,fontSize:12}}>Download as CSV</div>
          </button>
        ):(
          <button onClick={()=>setView("premium")} style={{background:theme.surfaceAlt,border:`2px dashed ${theme.warning}`,borderRadius:14,padding:18,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <div style={{fontSize:22,marginBottom:8}}>📤</div>
            <div style={{fontWeight:700,color:theme.text,fontSize:15,marginBottom:4}}>Export Diary</div>
            <div style={{color:theme.warning,fontSize:12}}>⭐ Premium feature</div>
          </button>
        )}
        {profile?.is_premium?(
          <button onClick={()=>setView("annualreport")} style={{background:`linear-gradient(135deg,${theme.accent},${theme.water})`,border:"none",borderRadius:14,padding:18,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <div style={{fontSize:22,marginBottom:8}}>🏆</div>
            <div style={{fontWeight:700,color:"#000",fontSize:15,marginBottom:4}}>Annual Report</div>
            <div style={{color:"#1a3a1a",fontSize:12}}>Your {new Date().getFullYear()} season</div>
          </button>
        ):(
          <button onClick={()=>setView("premium")} style={{background:theme.surfaceAlt,border:`2px dashed ${theme.warning}`,borderRadius:14,padding:18,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <div style={{fontSize:22,marginBottom:8}}>🏆</div>
            <div style={{fontWeight:700,color:theme.text,fontSize:15,marginBottom:4}}>Annual Report</div>
            <div style={{color:theme.warning,fontSize:12}}>⭐ Premium feature</div>
          </button>
        )}
      </div>
      {pbBySpecies.length>0&&(
        <div style={{marginTop:20}}>
          <div style={{fontSize:11,color:theme.accent,fontWeight:700,letterSpacing:2,marginBottom:12,fontFamily:"monospace",textTransform:"uppercase"}}>Personal Bests by Species</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {pbBySpecies.map(([species,c],i)=>(
              <div key={i} style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:18}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":"🐟"}</div>
                  <div style={{fontWeight:700,color:theme.text,fontSize:14}}>{species}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,color:theme.warning,fontSize:15}}>{c.weightLb||0}lb {c.weightOz||0}oz</div>
                  <div style={{fontSize:11,color:theme.textMuted}}>{c.date||""}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
<div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:12,fontFamily:"monospace",textTransform:"uppercase"}}>Recent Sessions</div>{sessions.slice(0,3).map((s,i)=>(<div key={i} onClick={()=>{setSelectedSession(s);setView("detail");}} style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,cursor:"pointer"}}><div><div style={{fontWeight:700,color:theme.text,fontSize:14}}>{s.venue_name||"Unknown venue"}</div><div style={{fontSize:12,color:theme.textMuted,marginTop:2}}>{s.date}</div></div><div style={{textAlign:"right"}}>{s.blank?<div style={{color:theme.danger,fontWeight:700}}>Blank</div>:<div style={{color:theme.accent,fontWeight:900,fontSize:20}}>{s.total_fish}</div>}</div></div>))}
    </div>
  );
}


function ReportTab(){
  const month=new Date().toLocaleString("en-GB",{month:"long",year:"numeric"});
  const sections=[{icon:"🌡️",title:"Conditions Overview",content:"Water temperatures across UK stillwaters are rising through 10–14°C — the sweet spot for carp and tench activity."},{icon:"🐟",title:"Species in Focus: Tench",content:"May is arguably the finest month for tench fishing in the UK. Target lily pad margins with sweetcorn and worms at dawn and dusk."},{icon:"🎣",title:"Technique: Margin Fishing",content:"A simple float rig with sweetcorn dropped tight against marginal reeds will outperform open water methods significantly through May."},{icon:"📋",title:"Regulation Reminder",content:"River close season: 15 March to 15 June. EA rod licence: one-rod £33/year, two-rod £47. Junior licences (under 17) are free."}];
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}><div style={{background:`linear-gradient(135deg,${theme.accent}22,${theme.waterDim}33)`,border:"1px solid "+theme.accent+"44",borderRadius:16,padding:24}}><div style={{fontSize:11,color:theme.accent,fontWeight:700,letterSpacing:2,marginBottom:8,fontFamily:"monospace",textTransform:"uppercase"}}>Monthly Report</div><div style={{fontSize:28,fontWeight:900,color:theme.text,fontFamily:"'Playfair Display',serif"}}>{month}</div></div>{sections.map((s,i)=>(<div key={i} style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:14,padding:20}}><div style={{fontSize:17,marginBottom:10}}>{s.icon} <span style={{fontWeight:700,color:theme.text,fontFamily:"'Playfair Display',serif"}}>{s.title}</span></div><div style={{color:theme.textMuted,fontSize:14,lineHeight:1.8}}>{s.content}</div></div>))}</div>);
}


function HomePage({setTab}){
    const [deferredPrompt,setDeferredPrompt]=useState(null);
  const [showInstall,setShowInstall]=useState(false);
  const [isIOS,setIsIOS]=useState(false);
  const [showIOSGuide,setShowIOSGuide]=useState(false);
  const [weather,setWeather]=useState(null);
  const [weatherLoc,setWeatherLoc]=useState("");
  const [weatherLoading,setWeatherLoading]=useState(false);
  const [feed]=useState(()=>{
    const d=(offset)=>{const dt=new Date();dt.setDate(dt.getDate()-offset);return dt.toISOString().split("T")[0];};
    return[
      {username:"DaveK_Angler",region:"East Midlands",venue_name:"Barford Lakes",date:d(0),total_fish:6,topCatch:{species:"Carp",weightLb:18,weightOz:4}},
      {username:"TroutHunter_Pete",region:"South West",venue_name:"River Exe",date:d(0),total_fish:4,topCatch:{species:"Brown Trout",weightLb:3,weightOz:12}},
      {username:"NightSession_Si",region:"Yorkshire",venue_name:"Raker Lakes",date:d(1),total_fish:3,topCatch:{species:"Carp",weightLb:27,weightOz:8}},
      {username:"BarbelMike",region:"West Midlands",venue_name:"River Severn",date:d(1),total_fish:5,topCatch:{species:"Barbel",weightLb:9,weightOz:2}},
      {username:"TenchTerror",region:"East of England",venue_name:"Ferry Meadows",date:d(2),total_fish:8,topCatch:{species:"Tench",weightLb:6,weightOz:14}},
      {username:"PikePatrol_J",region:"North West",venue_name:"Rufford Lake",date:d(2),total_fish:2,topCatch:{species:"Pike",weightLb:22,weightOz:0}},
      {username:"BreamDream",region:"Wales",venue_name:"Llangorse Lake",date:d(3),total_fish:11,topCatch:{species:"Bream",weightLb:8,weightOz:6}},
      {username:"RoachRonnie",region:"South East",venue_name:"Bewl Water",date:d(4),total_fish:14,topCatch:{species:"Roach",weightLb:1,weightOz:12}},
    ];
  });
  useEffect(()=>{
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;
    setIsIOS(ios);
    if(ios&&!window.navigator.standalone){setShowInstall(true);}
    const handler=(e)=>{e.preventDefault();setDeferredPrompt(e);setShowInstall(true);};
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);
  const handleInstall=async()=>{
    if(isIOS){setShowIOSGuide(true);return;}
    if(!deferredPrompt)return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);setShowInstall(false);
  };
  useEffect(()=>{
    if(!navigator.geolocation)return;
    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(async(pos)=>{
      try{
        const {latitude:lat,longitude:lng}=pos.coords;
        const [wx,loc]=await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,windspeed_10m,winddirection_10m,weathercode,precipitation,surface_pressure&timezone=Europe%2FLondon`).then(r=>r.json()),
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`).then(r=>r.json())
        ]);
        const c=wx.current;
        const dirs=["N","NE","E","SE","S","SW","W","NW"];
        const wdir=dirs[Math.round(c.winddirection_10m/45)%8];
        const temp=Math.round(c.temperature_2m);
        const wind=Math.round(c.windspeed_10m);
        const rain=c.precipitation;
        const pres=Math.round(c.surface_pressure);
        let score=5;
        if(temp>=12&&temp<=17)score+=2;else if(temp>=9)score+=1;else score-=1;
        if(wind<10)score+=1.5;else if(wind<20)score+=0.5;else score-=1.5;
        if(rain===0)score+=0.5;else if(rain<3)score+=0.2;else if(rain<8)score-=1;else score-=2.5;
        score=Math.min(10,Math.max(1,Math.round(score*10)/10));
        const rating=score>=8?"Excellent":score>=6.5?"Good":score>=4.5?"Fair":"Poor";
        const wcode=c.weathercode;
        const icon=wcode===0?"🌤️":wcode<=2?"🌤️":wcode<=3?"☁️":wcode<=48?"🌫":wcode<=67?"🌧️":wcode<=77?"❄️":wcode<=82?"🌧️":"⛈️";
        setWeather({temp,wind,wdir,rain,pres,rating,score,icon});
        const place=loc.address?.town||loc.address?.city||loc.address?.village||loc.address?.county||"";
        setWeatherLoc(place);
      }catch(e){}
      setWeatherLoading(false);
    },()=>setWeatherLoading(false));
  },[]);
const [postcode,setPostcode]=useState("");
  const [forecast,setForecast]=useState(null);
  const [locationName,setLocationName]=useState("");
  const [loading,setLoading]=useState(false);
  const rc=(r)=>r==="Excellent"?theme.excellent:r==="Good"?theme.good:r==="Fair"?theme.fair:theme.poor;
  const quickForecast=async()=>{const clean=postcode.trim().toUpperCase().replace(/\s+/g,"");if(!clean)return;setLoading(true);try{const pc=await fetch(`https://api.postcodes.io/postcodes/${clean}`);const pd=await pc.json();if(pd.status!==200)throw new Error();const{latitude:lat,longitude:lng,admin_county,admin_district}=pd.result;setLocationName(admin_county||admin_district||clean);const wx=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,surface_pressure_max&timezone=Europe%2FLondon&forecast_days=3`);const wd=await wx.json();const d=wd.daily;const names=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];const days=d.time.map((dt,i)=>{const avg=Math.round((d.temperature_2m_max[i]+d.temperature_2m_min[i])/2);const wind=Math.round(d.windspeed_10m_max[i]);const rain=d.precipitation_sum[i];const pres=d.surface_pressure_max[i];const trend=i===0?"Stable":pres>d.surface_pressure_max[i-1]+1.5?"Rising":pres<d.surface_pressure_max[i-1]-1.5?"Falling":"Stable";let score=5;if(avg>=12&&avg<=17)score+=2;else if(avg>=9)score+=1;else score-=1;if(wind<10)score+=1.5;else if(wind<20)score+=0.5;else score-=1.5;if(rain===0)score+=0.5;else if(rain<3)score+=0.2;else if(rain<8)score-=1;else score-=2.5;if(trend==="Rising")score+=1.2;else if(trend==="Falling")score-=1;score=Math.min(10,Math.max(1,Math.round(score*10)/10));const rating=score>=8?"Excellent":score>=6.5?"Good":score>=4.5?"Fair":"Poor";const date=new Date(dt);return{day:i===0?"Today":i===1?"Tomorrow":names[date.getDay()],score,rating,temp:avg,rain};});setForecast(days);}catch{}setLoading(false);};
  return(<div>
        {showInstall&&(
      <div style={{background:"linear-gradient(135deg,#1a3a2a,#0d2018)",padding:"20px 24px",textAlign:"center",borderBottom:"2px solid #4CAF82"}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,flexWrap:"wrap"}}>
            <div style={{width:48,height:48,borderRadius:12,background:"#4CAF82",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,color:"#fff",fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>RBF</div>
            <div style={{textAlign:"left"}}>
              <div style={{color:"#fff",fontWeight:800,fontSize:16,fontFamily:"'DM Sans',sans-serif",marginBottom:2}}>Add Reel Big Fish to your home screen</div>
              <div style={{color:"#4CAF82",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Quick access — works like an app</div>
            </div>
            <button onClick={handleInstall} style={{background:"#4CAF82",color:"#000",border:"none",borderRadius:10,padding:"12px 24px",cursor:"pointer",fontWeight:800,fontSize:14,fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap"}}>Add to Home Screen</button>
            <button onClick={()=>setShowInstall(false)} style={{background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:20,padding:"4px 8px",lineHeight:1}}>×</button>
          </div>
          {showIOSGuide&&(
            <div style={{marginTop:14,background:"rgba(76,175,130,0.15)",borderRadius:10,padding:"14px 16px",color:"#ccc",fontSize:13,fontFamily:"'DM Sans',sans-serif",lineHeight:1.7}}>
              <div style={{fontWeight:800,color:"#fff",marginBottom:8,fontSize:14}}>To install on iPhone:</div>
              <div style={{marginBottom:4}}>1️⃣ Tap the <strong style={{color:"#4CAF82"}}>▣️ Share button</strong> at the bottom of Safari</div>
              <div style={{marginBottom:4}}>2️⃣ Scroll down and tap <strong style={{color:"#4CAF82"}}>"Add to Home Screen"</strong></div>
              <div>3️⃣ Tap <strong style={{color:"#4CAF82"}}>"Add"</strong> in the top right</div>
            </div>
          )}
        </div>
      </div>
    )}
    {(weather||weatherLoading)&&(
      <div style={{background:theme.surface,borderBottom:`1px solid ${theme.border}`,padding:"16px 24px"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          {weatherLoading&&<div style={{color:theme.textMuted,fontSize:13,textAlign:"center"}}>Fetching local conditions...</div>}
          {weather&&(
            <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:36}}>{weather.icon}</span>
                <div>
                  <div style={{color:theme.text,fontWeight:700,fontSize:15}}>{weatherLoc?`${weatherLoc} conditions`:"Local conditions"}</div>
                  <div style={{color:theme.textMuted,fontSize:12,marginTop:2}}>{weather.temp}°C • Wind {weather.wind}km/h {weather.wdir} • {weather.pres}hPa</div>
                </div>
              </div>
              <div style={{display:"flex",gap:16,alignItems:"center"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:theme.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Fishing</div>
                  <div style={{fontWeight:800,fontSize:16,color:weather.rating==="Excellent"?theme.excellent:weather.rating==="Good"?theme.good:weather.rating==="Fair"?theme.warning:theme.danger}}>{weather.rating}</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:theme.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Score</div>
                  <div style={{fontWeight:800,fontSize:16,color:theme.accent}}>{weather.score}/10</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
<div style={{background:`linear-gradient(180deg,#0a1a0e 0%,${theme.bg} 100%)`,borderBottom:`1px solid ${theme.border}`,padding:"60px 24px 56px",textAlign:"center",position:"relative"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(circle at 50% 100%,${theme.accent}08 0%,transparent 60%)`,pointerEvents:"none"}}/>
      <div style={{position:"relative",maxWidth:700,margin:"0 auto"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:theme.accent+"22",border:"1px solid "+theme.accent+"44",borderRadius:20,padding:"4px 16px",fontSize:12,color:theme.accent,fontWeight:700,letterSpacing:1,marginBottom:24,fontFamily:"monospace",textTransform:"uppercase"}}>Now on Amazon</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(34px,5vw,58px)",fontWeight:900,color:theme.text,lineHeight:1.1,letterSpacing:-1,marginBottom:20}}>Your fishing diary.<br/><span style={{color:theme.accent,fontStyle:"italic"}}>Smarter online.</span></h1>
        <p style={{color:theme.textMuted,fontSize:17,lineHeight:1.7,maxWidth:500,margin:"0 auto 36px",fontWeight:300}}>Log every session. Track every catch. Let the AI reveal the patterns that help you catch more fish.</p>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={()=>setTab("diary")} style={{background:theme.accent,color:"#000",border:"none",borderRadius:12,padding:"14px 32px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:16}}>Start Your Diary →</button>
          <button onClick={()=>setTab("forecast")} style={{background:"none",border:"1px solid "+theme.border,borderRadius:12,padding:"14px 32px",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:16,color:theme.textMuted}}>Check Forecast</button>
        </div>
      </div>
    </div>
    <div style={{background:theme.surface,borderBottom:`1px solid ${theme.border}`,padding:"48px 24px"}}>
      <div style={{maxWidth:900,margin:"0 auto",display:"flex",gap:48,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:280}}>
          <div style={{fontSize:11,color:theme.accent,fontWeight:700,letterSpacing:2,marginBottom:12,fontFamily:"monospace",textTransform:"uppercase"}}>Physical Diary + Digital Platform</div>
          <div style={{fontSize:24,fontWeight:800,color:theme.text,fontFamily:"'Playfair Display',serif",lineHeight:1.2,marginBottom:16}}>Have the Reel Big Fish diary?</div>
          <p style={{color:theme.textMuted,fontSize:15,lineHeight:1.8,marginBottom:24}}>Use the physical diary on the bank, then log your sessions here for AI analysis and long-term pattern tracking.</p>
          {[["1","Buy the diary on Amazon and use it on the bank"],["2","Log your sessions here after each trip"],["3","The AI analyses your patterns over time"]].map(([n,t],i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}><div style={{width:28,height:28,borderRadius:"50%",background:theme.accent+"33",border:"1px solid "+theme.accent+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:theme.accent,flexShrink:0}}>{n}</div><div style={{color:theme.text,fontSize:14}}>{t}</div></div>))}
          <a href="https://www.amazon.co.uk/dp/B0H1LZFRGS" target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:8,background:theme.warning,color:"#000",borderRadius:12,padding:"12px 24px",textDecoration:"none",fontWeight:700,fontSize:14,fontFamily:"inherit",marginTop:8}}>Buy on Amazon →</a>
        </div>
        <div style={{flex:1,minWidth:260,textAlign:"center"}}>
          <img src="https://raw.githubusercontent.com/fourshireswindows-png/reelbigfish-landing/main/cover.jpeg" alt="Reel Big Fish Fishing Diary" style={{width:"100%",maxWidth:280,borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.5)",border:"1px solid "+theme.border}}/>
          <div style={{marginTop:16,background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:12,padding:"12px 16px",maxWidth:280,margin:"16px auto 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:13,color:theme.textMuted}}>Available now on Amazon</div><div style={{fontSize:18,fontWeight:900,color:theme.accent}}>£9.99</div></div>
        </div>
      </div>
    </div>
    <div style={{padding:"48px 24px",maxWidth:900,margin:"0 auto"}}>
      <div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:20,padding:28}}>
        <div style={{fontSize:16,fontWeight:700,color:theme.text,marginBottom:4,fontFamily:"'Playfair Display',serif"}}>Check conditions before your next session</div>
        <div style={{color:theme.textMuted,fontSize:13,marginBottom:16}}>Enter your postcode for a 3-day fishing forecast</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}><input value={postcode} onChange={e=>setPostcode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&quickForecast()} placeholder="e.g. GL7 1AA" style={{background:theme.surface,border:"1px solid "+theme.border,borderRadius:10,padding:"11px 14px",color:theme.text,fontSize:14,fontFamily:"inherit",outline:"none",width:"100%"}}/><button onClick={quickForecast} disabled={loading} style={{background:loading?theme.border:theme.accent,color:loading?theme.textMuted:"#000",border:"none",borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14,width:"100%"}}>{loading?"...":"Check Forecast →"}</button></div>
        {forecast&&(<div style={{marginTop:16}}><div style={{fontSize:11,color:theme.textMuted,fontWeight:700,letterSpacing:1,marginBottom:10,fontFamily:"monospace",textTransform:"uppercase"}}>3-Day Forecast — {locationName}</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{forecast.map((d,i)=>(<div key={i} style={{background:theme.surface,borderRadius:12,padding:"14px 10px",textAlign:"center",border:`1px solid ${rc(d.rating)}33`}}><div style={{fontSize:12,fontWeight:600,color:theme.textMuted,marginBottom:6}}>{d.day}</div><div style={{fontSize:28,fontWeight:900,color:rc(d.rating)}}>{d.score}</div><div style={{fontSize:11,color:rc(d.rating),fontWeight:700,marginTop:2}}>{d.rating}</div><div style={{fontSize:11,color:theme.textMuted,marginTop:4}}>{d.temp}°C {d.rain>0?"🌧️":"☀️"}</div></div>))}</div><button onClick={()=>setTab("forecast")} style={{width:"100%",marginTop:12,background:"none",border:"1px solid "+theme.border,borderRadius:10,padding:10,color:theme.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>View full 7-day forecast →</button></div>)}
      </div>
  </div></div>);
}

function EllieWidget(){
  const [open,setOpen]=useState(false);
  const [msgs,setMsgs]=useState([{role:"assistant",content:"Hey! I'm Ellie 👋 I'm here to help you get the most out of Reel Big Fish. What can I do for you?"}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);

  useEffect(()=>{
    if(bottomRef.current) bottomRef.current.scrollIntoView({behavior:"smooth"});
  },[msgs,open]);

  const send=async()=>{
    const text=input.trim();
    if(!text||loading) return;
    const next=[...msgs,{role:"user",content:text}];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try{
      const res=await fetch("https://iefnatpzvjoczbrqsytj.supabase.co/functions/v1/super-action",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZm5hdHB6dmpvY3picnFzeXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Mjg5NzcsImV4cCI6MjA5NDAwNDk3N30.8KrXplbByNasfkBL6ruHslOfVQJb8-wfpWxRuj8zFTw"},
        body:JSON.stringify({
          system:`You are Ellie, the friendly AI assistant for Reel Big Fish (reelbigfish.co.uk) — the UK's free fishing platform. You have the personality of a well-educated, fun, warm 25-year-old woman who genuinely loves fishing and wants to help. You're upbeat, witty, and conversational — never robotic or formal. You know the site inside out:
- Home: overview of the platform and latest activity
- My Diary: log fishing sessions with catches, weather, bait, rigs, photos
- Forecast: 7-day fishing forecast for any UK location
- AI Guide: chat with an AI fishing expert for tips and advice
- Forum: community discussions and fishing chat
- Community: connect with other anglers
- Report: report issues or suspicious activity
- FOR HOOK SAKE!: the clothing shop — hoodies, sweatshirts, tees and beanies, all printed and shipped automatically
- List Your Fishery: fishery owners can list their venue for free
Keep answers short, friendly and helpful. Use the odd fishing pun if it feels natural. Never break character.`,
          messages:next.map(m=>({role:m.role,content:m.content})),
        })
      });
      const data=await res.json();
      const reply=data.content?.[0]?.text||"Sorry, something went wrong — give me a sec and try again! 🎣";
      setMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch{
      setMsgs(p=>[...p,{role:"assistant",content:"Oops, something went wrong! Try again in a moment 🎣"}]);
    }
    setLoading(false);
  };

  return(
    <>
      {/* Chat window */}
      {open&&(
        <div style={{position:"fixed",bottom:90,right:16,width:320,maxHeight:480,background:theme.surface,border:`1px solid ${theme.accent}55`,borderRadius:20,boxShadow:"0 8px 40px rgba(0,0,0,0.5)",display:"flex",flexDirection:"column",zIndex:1000,overflow:"hidden"}}>
          {/* Header */}
          <div style={{background:`linear-gradient(135deg,${theme.accent},#1a8f4f)`,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCABQAFADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDiNFiiadZVHKYRWUdc9ePb+tav2n7VebI/ligBZMnCqPU/jmsu3ae0ZyzDdlvm4H8PXFQxXM0KvFH8zy9weg9PrWcNgRckmhmmlheU+UGLo2zOTz+WeKW3trj7WECqG3AcH175qTTNIlvnWR+UGec/L+HrW2YdF0tgbu+QP1KlyOfovNUxmQYE8yTehb5MA4PB9KRY5ZZohI3kRueJWBCDFdBFf+HpzmK4ssk9GDAk/UmrtzZ297GrksyDIBimyBn9KVyrGJaC0VwZ78eYCfkCkhgB1/GrkMkcN0pi3JbSONhcfeHOR+fFRSaJIrM1tMkpXnZLhT+DD/CmPcooeCfzYJPvpDKcAnvt7E/Q1LGjntU0qOyu50QMFLeYCc9CMj9KzrVI8udwJBAzgjt/9euo15TJbwSDOHTYx6j/AD1rm0WTzGwqhQxzgYJHrisno2jNll83BUZRVVu3Tmren2kF08lxIQlhDnknG9h1H+6O/qeKy4I7q9jay3hTIyjd3UZOT+Wad4q1VLS3XS7L5IYgFOPUd/8APfJrSnpEa1Hat4tlmZ7WxURQ/dJXg4/p9KxFV5nLMSxJyfrVOxSYsMWsjDrnGB+ddRpyRSOivbOhP96pm2dFOKMV7R8fKDx3p1vqWoaNIJYJ2T/ZY8H6iuwksI1ViFGccVgXemWwkM10+7J49B7VEZlzhob2ieNrPUyIbsC3uB91h0Y11728Gox+VcRRTK+GbIyuP7w9P6V5IPsN1L5MW0Y9BjFegaDaT2dtA73Mgtw3zq2GGPUZ6VTqJbkKk3sUdStZbezurURZtkk8y3lV9wIX5WVvfk/XFYMUwUYJ6dPeuwun/s++uYJh5ltOPMCDuM4P8wa5PWNOa3mZ4iHQ/MMf3azvzGdWFtSayvGtoJpY8M6xEKzdiTWbqGmbri2mlO5nyWJ9cU+1laZHQoU3dPfFX75t89rEvRQf8KbbWhVKKaM5tWFqpit4mkZMbtozjPAq5aajLOgLxFMsVByOuM46n1qe20O3y7GEHectzjNTy6fHbW5Mabfw60XhY6FGd7k1vd/aYnXHIHWs++sDdRYCFsDGOeDnr71oaPB/pDAnAABwfWunjsYo4SSQM8kY4+tZc3K9DXk5lqcjovha2baLpBIM7tgj2jP1rvGsVt9OChQq46Y7VBpyQicMWXHr61p3kiSRsVOcDilOTlqy401HY5eJzqGjozqQ9uxXLDqmSAa5bUstbuC+14/mRieg7jNdJBdYvZbNl2Bl2YznIx/jg1zGoEm52E4QBgx9Gx/X+lVT3OWva2hoR6dcQZeWAAgZyDnFZ7qwvEd/lMahfzrqZ4rgxMhGeOgrnbvKT+YxxtAOD3HT0pRd2YUpWRv6eqCMFjnPNLesnKJ9/HftWTptw8nlxxOpRvukmkvLv7IQbqKUbj8zAZAPofSkk72O/mXLc0LCSK1uSpUtuGSSO9dQskl2x2rF5RTkjqfYelc9Y2V/MEkg055Fk+584xz0P6V1FnpN/Hb77qaKwjUkDnc2R/k1XI2CmktznLuG4tJy8I2qOTGTjJ9qs2lxPdRJKfljfsepqW50j7ZqTXYnmeGEYhErH5m/vEdOnSq9zPHp1hIzYCwoSfw5NZSjZ2LT0uzIjaKW6klj+WRJCCCeeDWZ4gtHeaR4Yy6hiSFHU/41l6Fd/ab4kb/m3FgT0JBP86tazfiPUpGjlZNuASpwen611Rhadjgm7xNnVfE8dsDDbFXkI5YDgfSuZvbx7uyd0ck7c5HU+uK5+4umw2Wy7/eI7e1SWd85DKPvqNyjsfatFSUVoYxdi5o2tLYzi1lwsJIw3ZWr0AXMV9CPMC+YPvY/jHrXkd5GFcOv+rc7l/wP0rqfC2ov9jMZYs0LYwT27VFan9pHRRqP4Wdxp4uLKXFvK6jOQocrit23FzPOpd2OD1YliM9cZrG0y8gugNpAkHBBrp4pEhVGBB289ax52dce5M0BjiYnO1enPWuT14o+j6jkDb5Dr+ODW5f6qJ08mFht6lh3rivFuoC30SaMHmQbRWa1mrBJ2i7nH+Eg3mzyFuFRevvUerz+ZeyuPus5xS6efsuiyf37iQAnuEAqnqMhY7z1YZ/ECu9L3mzzm/dSP//Z" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",border:"2px solid rgba(255,255,255,0.3)"}}/>
              <div>
                <div style={{fontWeight:800,fontSize:14,color:"#000",fontFamily:"'Playfair Display',serif"}}>Ellie</div>
                <div style={{fontSize:10,color:"rgba(0,0,0,0.6)",fontWeight:600}}>RBF Assistant · Online</div>
              </div>
            </div>
            <button onClick={()=>setOpen(false)} style={{background:"rgba(0,0,0,0.15)",border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",color:"#000",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>×</button>
          </div>
          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"80%",background:m.role==="user"?theme.accent+"22":theme.surfaceAlt,border:`1px solid ${m.role==="user"?theme.accent+"44":theme.border}`,borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"9px 13px",fontSize:13,color:theme.text,lineHeight:1.5}}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{display:"flex",justifyContent:"flex-start"}}>
                <div style={{background:theme.surfaceAlt,border:"1px solid "+theme.border,borderRadius:"16px 16px 16px 4px",padding:"10px 14px",display:"flex",gap:4}}>
                  {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:theme.accent,animation:`pulse 1s ease-in-out ${i*0.2}s infinite`}}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          {/* Input */}
          <div style={{padding:"10px 12px",borderTop:`1px solid ${theme.border}`,display:"flex",gap:8}}>
            <input
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&send()}
              placeholder="Ask Ellie anything..."
              style={{...inp,fontSize:13,padding:"9px 12px",borderRadius:10,flex:1}}
            />
            <button onClick={send} disabled={!input.trim()||loading} style={{background:input.trim()&&!loading?theme.accent:theme.border,color:input.trim()&&!loading?"#000":theme.textMuted,border:"none",borderRadius:10,padding:"9px 14px",cursor:"pointer",fontFamily:"inherit",fontWeight:800,fontSize:13,transition:"all 0.2s"}}>→</button>
          </div>
        </div>
      )}
      {/* Bubble button */}
      <button
        onClick={()=>setOpen(p=>!p)}
        style={{position:"fixed",bottom:16,right:16,width:58,height:58,borderRadius:"50%",background:`linear-gradient(135deg,${theme.accent},#1a8f4f)`,border:"none",cursor:"pointer",boxShadow:"0 4px 20px rgba(45,216,122,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,transition:"transform 0.2s"}}
        title="Chat with Ellie"
      >
        {open?"×":<img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCABQAFADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDiNFiiadZVHKYRWUdc9ePb+tav2n7VebI/ligBZMnCqPU/jmsu3ae0ZyzDdlvm4H8PXFQxXM0KvFH8zy9weg9PrWcNgRckmhmmlheU+UGLo2zOTz+WeKW3trj7WECqG3AcH175qTTNIlvnWR+UGec/L+HrW2YdF0tgbu+QP1KlyOfovNUxmQYE8yTehb5MA4PB9KRY5ZZohI3kRueJWBCDFdBFf+HpzmK4ssk9GDAk/UmrtzZ297GrksyDIBimyBn9KVyrGJaC0VwZ78eYCfkCkhgB1/GrkMkcN0pi3JbSONhcfeHOR+fFRSaJIrM1tMkpXnZLhT+DD/CmPcooeCfzYJPvpDKcAnvt7E/Q1LGjntU0qOyu50QMFLeYCc9CMj9KzrVI8udwJBAzgjt/9euo15TJbwSDOHTYx6j/AD1rm0WTzGwqhQxzgYJHrisno2jNll83BUZRVVu3Tmren2kF08lxIQlhDnknG9h1H+6O/qeKy4I7q9jay3hTIyjd3UZOT+Wad4q1VLS3XS7L5IYgFOPUd/8APfJrSnpEa1Hat4tlmZ7WxURQ/dJXg4/p9KxFV5nLMSxJyfrVOxSYsMWsjDrnGB+ddRpyRSOivbOhP96pm2dFOKMV7R8fKDx3p1vqWoaNIJYJ2T/ZY8H6iuwksI1ViFGccVgXemWwkM10+7J49B7VEZlzhob2ieNrPUyIbsC3uB91h0Y11728Gox+VcRRTK+GbIyuP7w9P6V5IPsN1L5MW0Y9BjFegaDaT2dtA73Mgtw3zq2GGPUZ6VTqJbkKk3sUdStZbezurURZtkk8y3lV9wIX5WVvfk/XFYMUwUYJ6dPeuwun/s++uYJh5ltOPMCDuM4P8wa5PWNOa3mZ4iHQ/MMf3azvzGdWFtSayvGtoJpY8M6xEKzdiTWbqGmbri2mlO5nyWJ9cU+1laZHQoU3dPfFX75t89rEvRQf8KbbWhVKKaM5tWFqpit4mkZMbtozjPAq5aajLOgLxFMsVByOuM46n1qe20O3y7GEHectzjNTy6fHbW5Mabfw60XhY6FGd7k1vd/aYnXHIHWs++sDdRYCFsDGOeDnr71oaPB/pDAnAABwfWunjsYo4SSQM8kY4+tZc3K9DXk5lqcjovha2baLpBIM7tgj2jP1rvGsVt9OChQq46Y7VBpyQicMWXHr61p3kiSRsVOcDilOTlqy401HY5eJzqGjozqQ9uxXLDqmSAa5bUstbuC+14/mRieg7jNdJBdYvZbNl2Bl2YznIx/jg1zGoEm52E4QBgx9Gx/X+lVT3OWva2hoR6dcQZeWAAgZyDnFZ7qwvEd/lMahfzrqZ4rgxMhGeOgrnbvKT+YxxtAOD3HT0pRd2YUpWRv6eqCMFjnPNLesnKJ9/HftWTptw8nlxxOpRvukmkvLv7IQbqKUbj8zAZAPofSkk72O/mXLc0LCSK1uSpUtuGSSO9dQskl2x2rF5RTkjqfYelc9Y2V/MEkg055Fk+584xz0P6V1FnpN/Hb77qaKwjUkDnc2R/k1XI2CmktznLuG4tJy8I2qOTGTjJ9qs2lxPdRJKfljfsepqW50j7ZqTXYnmeGEYhErH5m/vEdOnSq9zPHp1hIzYCwoSfw5NZSjZ2LT0uzIjaKW6klj+WRJCCCeeDWZ4gtHeaR4Yy6hiSFHU/41l6Fd/ab4kb/m3FgT0JBP86tazfiPUpGjlZNuASpwen611Rhadjgm7xNnVfE8dsDDbFXkI5YDgfSuZvbx7uyd0ck7c5HU+uK5+4umw2Wy7/eI7e1SWd85DKPvqNyjsfatFSUVoYxdi5o2tLYzi1lwsJIw3ZWr0AXMV9CPMC+YPvY/jHrXkd5GFcOv+rc7l/wP0rqfC2ov9jMZYs0LYwT27VFan9pHRRqP4Wdxp4uLKXFvK6jOQocrit23FzPOpd2OD1YliM9cZrG0y8gugNpAkHBBrp4pEhVGBB289ax52dce5M0BjiYnO1enPWuT14o+j6jkDb5Dr+ODW5f6qJ08mFht6lh3rivFuoC30SaMHmQbRWa1mrBJ2i7nH+Eg3mzyFuFRevvUerz+ZeyuPus5xS6efsuiyf37iQAnuEAqnqMhY7z1YZ/ECu9L3mzzm/dSP//Z" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>}
      </button>
    </>
  );
}

function PublicProfile({username,onBack}){
  const [profile,setProfile]=useState(null);
  const [sessions,setSessions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [isFollowing,setIsFollowing]=useState(false);
  const [followerCount,setFollowerCount]=useState(0);
  const [followingCount,setFollowingCount]=useState(0);
  const [sessionLikes,setSessionLikes]=useState({});
  const [userLikes,setUserLikes]=useState({});
  const [comments,setComments]=useState({});
  const [showComments,setShowComments]=useState({});
  const [newComment,setNewComment]=useState({});
  const [commentLoading,setCommentLoading]=useState({});
  const [followLoading,setFollowLoading]=useState(false);
  const [currentUser,setCurrentUser]=useState(null);
  const allCatches=sessions.flatMap(s=>s.catches||[]);

  useEffect(()=>{
    const load=async()=>{
      const{data:{user}}=await supabase.auth.getUser();
      setCurrentUser(user);
      const{data:p}=await supabase.from("profiles").select("*").ilike("username",username).single();
      if(!p){setLoading(false);return;}
      setProfile(p);
      const{data:s}=await supabase.from("sessions").select("*").eq("user_id",p.id).order("date",{ascending:false}).limit(20);
      setSessions(s||[]);
      if(s?.length){
        const{data:lk}=await supabase.from("likes").select("session_id").in("session_id",s.map(x=>x.id));
        const lkMap={};
        (lk||[]).forEach(l=>lkMap[l.session_id]=(lkMap[l.session_id]||0)+1);
        setSessionLikes(lkMap);
        if(user){
          const{data:ul}=await supabase.from("likes").select("session_id").eq("user_id",user.id).in("session_id",s.map(x=>x.id));
          const ulMap={};
          (ul||[]).forEach(l=>ulMap[l.session_id]=true);
          setUserLikes(ulMap);
        }
      }
      const[{count:fc},{count:fg}]=await Promise.all([
        supabase.from("followers").select("*",{count:"exact",head:true}).eq("following_id",p.id),
        supabase.from("followers").select("*",{count:"exact",head:true}).eq("follower_id",p.id)
      ]);
      setFollowerCount(fc||0);setFollowingCount(fg||0);
      if(user){
        const{data:f}=await supabase.from("followers").select("*").eq("follower_id",user.id).eq("following_id",p.id).single();
        setIsFollowing(!!f);
      }
      setLoading(false);
    };
    load();
  },[username]);

  const toggleLike=async(sessionId)=>{
    if(!currentUser){alert("Sign in to like!");return;}
    if(userLikes[sessionId]){
      await supabase.from("likes").delete().eq("user_id",currentUser.id).eq("session_id",sessionId);
      setUserLikes(prev=>({...prev,[sessionId]:false}));
      setSessionLikes(prev=>({...prev,[sessionId]:Math.max((prev[sessionId]||1)-1,0)}));
    }else{
      await supabase.from("likes").insert({user_id:currentUser.id,session_id:sessionId});
      setUserLikes(prev=>({...prev,[sessionId]:true}));
      setSessionLikes(prev=>({...prev,[sessionId]:(prev[sessionId]||0)+1}));
      const{data:me}=await supabase.from("profiles").select("username").eq("id",currentUser.id).single();
      if(profile.id!==currentUser.id)sendNotification(profile.id,"like",`❤️ ${me?.username||"Someone"} liked your catch at ${sessions.find(s=>s.id===sessionId)?.venue_name||"your session"}`,sessionId);
    }
  };

  const loadComments=async(sessionId)=>{
    const{data:cms}=await supabase.from("comments").select("*").eq("session_id",sessionId).order("created_at",{ascending:true});
    if(cms?.length){
      const uids=[...new Set(cms.map(c=>c.user_id))];
      const{data:cprofs}=await supabase.from("profiles").select("id,username,avatar_url").in("id",uids);
      const cprofMap={};
      (cprofs||[]).forEach(p=>cprofMap[p.id]=p);
      setComments(prev=>({...prev,[sessionId]:cms.map(c=>({...c,profiles:cprofMap[c.user_id]||{}}))}));
    }else{setComments(prev=>({...prev,[sessionId]:[]}));}
  };

  const toggleComments=async(sessionId)=>{
    if(!showComments[sessionId])await loadComments(sessionId);
    setShowComments(prev=>({...prev,[sessionId]:!prev[sessionId]}));
  };

  const submitComment=async(sessionId)=>{
    if(!newComment[sessionId]?.trim()||!currentUser)return;
    setCommentLoading(prev=>({...prev,[sessionId]:true}));
    await supabase.from("comments").insert({user_id:currentUser.id,session_id:sessionId,content:newComment[sessionId].trim()});
    setNewComment(prev=>({...prev,[sessionId]:""}));
    await loadComments(sessionId);
    const{data:me}=await supabase.from("profiles").select("username").eq("id",currentUser.id).single();
    if(profile.id!==currentUser.id)sendNotification(profile.id,"comment",`💬 ${me?.username||"Someone"} commented on your catch at ${sessions.find(s=>s.id===sessionId)?.venue_name||"your session"}`,sessionId);
    setCommentLoading(prev=>({...prev,[sessionId]:false}));
  };

  const toggleFollow=async()=>{

    if(!currentUser){alert("Sign in to follow anglers!");return;}
    setFollowLoading(true);
    if(isFollowing){
      await supabase.from("followers").delete().eq("follower_id",currentUser.id).eq("following_id",profile.id);
      setIsFollowing(false);setFollowerCount(c=>c-1);
    }else{
      await supabase.from("followers").insert({follower_id:currentUser.id,following_id:profile.id});
      setIsFollowing(true);setFollowerCount(c=>c+1);
      const{data:me}=await supabase.from("profiles").select("username").eq("id",currentUser.id).single();
      sendNotification(profile.id,"follow",`🎣 ${me?.username||"Someone"} started following you`);
    }
    setFollowLoading(false);
  };

  if(loading)return(<div style={{textAlign:"center",padding:"60px 0",color:theme.textMuted}}>Loading profile...</div>);
  if(!profile)return(<div style={{textAlign:"center",padding:"60px 0",color:theme.textMuted}}>Angler not found.</div>);

  const totalFish=sessions.reduce((a,s)=>a+(s.total_fish||0),0);
  const speciesSet=new Set(allCatches.map(c=>c.species).filter(Boolean));
  const pb=allCatches.reduce((best,c)=>{const w=(parseFloat(c.weightLb)||0)+(parseFloat(c.weightOz)||0)/16;const bw=best?(parseFloat(best.weightLb)||0)+(parseFloat(best.weightOz)||0)/16:0;return w>bw?c:best;},null);

  return(
    <div>
      <div style={{background:"linear-gradient(160deg,#0a1a0e,#0d2818)",border:"1px solid "+theme.border,borderRadius:20,padding:"24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:16,marginBottom:16}}>
          <div style={{width:72,height:72,borderRadius:"50%",overflow:"hidden",background:`linear-gradient(135deg,${theme.accent},${theme.water})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,flexShrink:0}}>
            {profile.avatar_url?<img src={profile.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🎣"}
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:22,fontWeight:900,color:theme.text,fontFamily:"'Playfair Display',serif"}}>{profile.username}</div>
              {profile.is_premium&&<span style={{background:"linear-gradient(135deg,#FFD700,#FFA500)",color:"#000",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>⭐ Premium</span>}
            </div>
            {profile.region&&<div style={{color:theme.textMuted,fontSize:13,marginTop:2}}>📍 {profile.region}</div>}
            {profile.fav_species&&<div style={{color:theme.accent,fontSize:13,marginTop:2}}>🎣️ Favourite: {profile.fav_species}</div>}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:16}}>
          <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:900,color:theme.text}}>{followerCount}</div><div style={{fontSize:10,color:theme.textMuted,textTransform:"uppercase",letterSpacing:1}}>Followers</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:900,color:theme.text}}>{followingCount}</div><div style={{fontSize:10,color:theme.textMuted,textTransform:"uppercase",letterSpacing:1}}>Following</div></div>
          {profile&&<button onClick={toggleFollow} disabled={followLoading} style={{background:isFollowing?theme.surfaceAlt:theme.accent,color:isFollowing?theme.textMuted:"#000",border:`1px solid ${isFollowing?theme.border:theme.accent}`,borderRadius:20,padding:"8px 20px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14}}>{followLoading?"...":(isFollowing?"Following ✓":"+ Follow")}</button>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[{label:"Sessions",value:sessions.length,color:theme.accent},{label:"Total Fish",value:totalFish,color:theme.water},{label:"Species",value:speciesSet.size,color:theme.purple},{label:"PB",value:pb?`${pb.weightLb||0}lb ${pb.weightOz||0}oz`:"--",color:theme.warning}].map((s,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
              <div style={{fontSize:i===3?14:20,fontWeight:900,color:s.color,fontFamily:"'Playfair Display',serif"}}>{s.value}</div>
              <div style={{fontSize:9,color:theme.textMuted,textTransform:"uppercase",letterSpacing:1,marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{fontSize:11,color:theme.accent,fontWeight:700,letterSpacing:2,marginBottom:12,fontFamily:"monospace",textTransform:"uppercase"}}>Recent Sessions</div>
      {sessions.length===0&&<div style={{color:theme.textMuted,fontSize:14,textAlign:"center",padding:"20px 0"}}>No public sessions yet.</div>}
      {sessions.map((s,i)=>(
        <div key={i} style={{background:theme.surface,border:"1px solid "+theme.border,borderRadius:14,padding:"14px 16px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              {(()=>{const photos=Array.isArray(s.photos)?s.photos:(typeof s.photos==="string"?JSON.parse(s.photos||"[]"):[]);return photos.length>0&&(
                <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto"}}>
                  {photos.slice(0,3).map((p,pi)=>(
                    <img key={pi} src={p} style={{width:80,height:80,objectFit:"cover",borderRadius:10,flexShrink:0}}/>
                  ))}
                </div>
              );})()}
              <div style={{fontWeight:700,color:theme.text,fontSize:15,marginBottom:2}}>{s.venue_name||"Unknown venue"}</div>
              <div style={{color:theme.textMuted,fontSize:12,marginBottom:4}}>{s.date}</div>
              {s.catches?.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:2}}>
                  {s.catches.filter(c=>c.species).map((c,ci)=>(
                    <div key={ci} style={{background:theme.accent+"22",borderRadius:20,padding:"2px 10px",fontSize:11,color:theme.accent,fontWeight:600}}>
                      {c.species}{(c.weightLb||c.weightOz)?` · ${c.weightLb||0}lb ${c.weightOz||0}oz`:""}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
              {(s.total_fish||0)===0?(<div style={{background:theme.danger+"22",border:"1px solid "+theme.danger+"44",borderRadius:8,padding:"4px 10px"}}><div style={{fontSize:11,fontWeight:800,color:theme.danger}}>Blank</div></div>):(<><div style={{fontSize:20,fontWeight:900,color:theme.accent,fontFamily:"'Playfair Display',serif"}}>{s.total_fish||0}</div><div style={{fontSize:10,color:theme.textMuted,textTransform:"uppercase",letterSpacing:1}}>fish</div></>)}
              {sessionLikes[s.id]>0&&<div style={{fontSize:12,color:theme.danger,fontWeight:600}}>❤️ {sessionLikes[s.id]}</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:16,padding:"8px 0 0",borderTop:"1px solid "+theme.border,marginTop:8}}>
            <button onClick={()=>toggleLike(s.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,color:userLikes[s.id]?theme.danger:theme.textMuted,fontFamily:"inherit",fontSize:13,fontWeight:600,padding:0}}>
              <span style={{fontSize:16}}>{userLikes[s.id]?"❤️":"🤍"}</span> {sessionLikes[s.id]||0}
            </button>
            <button onClick={()=>toggleComments(s.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,color:showComments[s.id]?theme.accent:theme.textMuted,fontFamily:"inherit",fontSize:13,fontWeight:600,padding:0}}>
              <span style={{fontSize:16}}>💬</span> {comments[s.id]?.length||0}
            </button>
          </div>
          {showComments[s.id]&&(
            <div style={{marginTop:10}}>
              {(comments[s.id]||[]).map((c,ci)=>(
                <div key={ci} style={{display:"flex",gap:8,marginBottom:8}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,"+theme.accent+","+theme.water+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>
                    {c.profiles?.avatar_url?<img src={c.profiles.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:"🎣"}
                  </div>
                  <div style={{background:theme.surfaceAlt,borderRadius:"12px 12px 12px 4px",padding:"8px 12px",flex:1}}>
                    <div style={{fontWeight:700,color:theme.accent,fontSize:12,marginBottom:2}}>{c.profiles?.username||"Angler"}</div>
                    <div style={{color:theme.text,fontSize:13}}>{c.content}</div>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <input value={newComment[s.id]||""} onChange={e=>setNewComment(prev=>({...prev,[s.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submitComment(s.id)} placeholder="Add a comment..." style={{...inp,flex:1,fontSize:16,padding:"8px 12px"}}/>
                <button onClick={()=>submitComment(s.id)} disabled={commentLoading[s.id]||!newComment[s.id]?.trim()} style={{background:theme.accent,color:"#000",border:"none",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14}}>{commentLoading[s.id]?"...":"Post"}</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


function PremiumTab(){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [loggedIn,setLoggedIn]=useState(null);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [authLoading,setAuthLoading]=useState(false);

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>setLoggedIn(!!user));
  },[]);

  const signUpAndCheckout=async(priceId)=>{
    if(!email.trim()||!password.trim()){setError("Please enter your email and password.");return;}
    if(password.length<6){setError("Password must be at least 6 characters.");return;}
    setAuthLoading(true);setError("");
    const{data,error:e}=await supabase.auth.signUp({email:email.trim(),password});
    if(e){setError(e.message);setAuthLoading(false);return;}
    const user=data.user;
    if(user){
      await supabase.from("profiles").upsert({id:user.id,username:email.split("@")[0]});
      setLoggedIn(true);
      await checkout(priceId,user);
    }
    setAuthLoading(false);
  };

  const checkout=async(priceId,overrideUser)=>{
    setLoading(true);setError("");
    try{
      const{data:{user:authUser}}=await supabase.auth.getUser();
      const user=overrideUser||authUser;
      if(!user){setError("Please sign in first.");setLoading(false);return;}
      const res=await fetch("https://iefnatpzvjoczbrqsytj.supabase.co/functions/v1/create-checkout",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZm5hdHB6dmpvY3picnFzeXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Mjg5NzcsImV4cCI6MjA5NDAwNDk3N30.8KrXplbByNasfkBL6ruHslOfVQJb8-wfpWxRuj8zFTw"},
        body:JSON.stringify({price_id:priceId,user_id:user.id,email:user.email,success_url:window.location.href+"?premium=success",cancel_url:window.location.href})
      });
      const{url,error:e}=await res.json();
      if(e)throw new Error(e);
      window.location.href=url;
    }catch(e){setError(e.message);setLoading(false);}
  };

  const features=[
    {label:"Session diary",free:true,premium:true},
    {label:"Photos on sessions",free:true,premium:true},
    {label:"Public profile",free:true,premium:true},
    {label:"Social feed & follows",free:true,premium:true},
    {label:"Like catches",free:true,premium:true},
    {label:"Comment on catches",free:true,premium:true},
    {label:"Weather forecast",free:true,premium:true},
    {label:"AI guide",free:"10/month",premium:"Unlimited"},
    {label:"AI session analysis",free:"Last 3 sessions",premium:"Full history"},
    {label:"Advanced analytics",free:false,premium:true},
    {label:"Annual catch report",free:false,premium:true},
    {label:"Status updates",free:false,premium:true},
    {label:"Export diary to CSV",free:false,premium:true},
    {label:"Premium badge",free:false,premium:true},
  ];

  const tick = <span style={{color:theme.accent,fontWeight:700}}>&#10003;</span>;
  const cross = <span style={{color:theme.textMuted}}>&#8212;</span>;

  return(
    <div style={{maxWidth:600,margin:"0 auto",padding:"0 0 80px"}}>
      <div style={{textAlign:"center",padding:"28px 24px 20px"}}>
        <div style={{fontSize:11,color:theme.accent,fontWeight:700,letterSpacing:2,marginBottom:6,fontFamily:"monospace",textTransform:"uppercase"}}>Upgrade</div>
        <div style={{fontSize:26,fontWeight:900,color:theme.text,fontFamily:"'Playfair Display',serif",marginBottom:6}}>Reel Big Fish Premium</div>
        <div style={{color:theme.textMuted,fontSize:13}}>Unlock the full power of your fishing data</div>
      </div>

      {/* Comparison table */}
      <div style={{margin:"0 16px 20px",border:"1px solid "+theme.border,borderRadius:16,overflow:"hidden"}}>
        {/* Header */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:theme.surfaceAlt}}>
          <div style={{padding:"14px 16px",fontSize:13,fontWeight:700,color:theme.textMuted}}>Feature</div>
          <div style={{padding:"14px 8px",fontSize:13,fontWeight:700,color:theme.textMuted,textAlign:"center"}}>Free</div>
          <div style={{padding:"14px 8px",fontSize:13,fontWeight:800,color:theme.accent,textAlign:"center",background:`${theme.accent}11`}}>⭐ Premium</div>
        </div>
        {/* Rows */}
        {features.map((f,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderTop:`1px solid ${theme.border}`,background:i%2===0?"transparent":theme.surfaceAlt+"44"}}>
            <div style={{padding:"11px 16px",fontSize:13,color:theme.text}}>{f.label}</div>
            <div style={{padding:"11px 8px",textAlign:"center",fontSize:13}}>
              {f.free===true?tick:f.free===false?cross:<span style={{color:theme.textMuted,fontSize:12}}>{f.free}</span>}
            </div>
            <div style={{padding:"11px 8px",textAlign:"center",fontSize:13,background:`${theme.accent}08`}}>
              {f.premium===true?tick:f.premium===false?cross:<span style={{color:theme.accent,fontSize:12,fontWeight:600}}>{f.premium}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Sign up form for non-logged-in users */}
      {loggedIn===false&&(
        <div style={{margin:"0 16px 16px",background:theme.surface,border:"1px solid "+theme.border,borderRadius:14,padding:"20px"}}>
          <div style={{fontWeight:700,color:theme.text,fontSize:15,marginBottom:4}}>Create your free account</div>
          <div style={{color:theme.textMuted,fontSize:13,marginBottom:16}}>Sign up and go Premium in one step</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" type="email" style={{...inp,padding:"12px 14px",fontSize:15}}/>
            <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Choose a password (6+ characters)" type="password" style={{...inp,padding:"12px 14px",fontSize:15}}/>
          </div>
          {error&&<div style={{color:theme.danger,fontSize:13,marginTop:8}}>{error}</div>}
        </div>
      )}

      {/* Pricing */}
      <div style={{display:"flex",flexDirection:"column",gap:12,padding:"0 16px"}}>
        <button onClick={()=>loggedIn?checkout("price_1TYhdBR9jC1DqPOTbi4tc9lW"):signUpAndCheckout("price_1TYhdBR9jC1DqPOTbi4tc9lW")} disabled={loading||authLoading} style={{background:`linear-gradient(135deg,${theme.accent},#1a8f4f)`,color:"#000",border:"none",borderRadius:14,padding:"20px 24px",cursor:"pointer",textAlign:"left",position:"relative"}}>
          <div style={{position:"absolute",top:-10,right:16,background:theme.warning,color:"#000",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:800}}>BEST VALUE</div>
          <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>Annual Premium</div>
          <div style={{fontSize:24,fontWeight:900,marginBottom:2}}>£39.99<span style={{fontSize:14,fontWeight:600}}>/year</span></div>
          <div style={{fontSize:12,opacity:0.8}}>Just £3.33/month — save 33%</div>
        </button>
        <button onClick={()=>loggedIn?checkout("price_1TYhakR9jC1DqPOTaC0H1doD"):signUpAndCheckout("price_1TYhakR9jC1DqPOTaC0H1doD")} disabled={loading||authLoading} style={{background:theme.surfaceAlt,color:theme.text,border:"1px solid "+theme.border,borderRadius:14,padding:"18px 24px",cursor:"pointer",textAlign:"left"}}>
          <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>Monthly Premium</div>
          <div style={{fontSize:22,fontWeight:900,color:theme.accent}}>£4.99<span style={{fontSize:14,fontWeight:600,color:theme.textMuted}}>/month</span></div>
        </button>
      </div>

      {(loading||authLoading)&&<div style={{textAlign:"center",color:theme.textMuted,fontSize:14,marginTop:16}}>{authLoading?"Creating your account...":"Redirecting to checkout..."}</div>}
      {error&&loggedIn&&<div style={{textAlign:"center",color:theme.danger,fontSize:14,marginTop:12,padding:"0 16px"}}>{error}</div>}
      <div style={{textAlign:"center",marginTop:16,padding:"0 16px"}}>
        <div style={{color:theme.textMuted,fontSize:12}}>🔒 Secure payment via Stripe — Cancel anytime</div>
      </div>
    </div>
  );
}

function AdminBroadcast(){
  const [msg,setMsg]=useState("");
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(null);
  const send=async()=>{
    if(!msg.trim())return;
    setSending(true);
    const count=await broadcastNotification(msg.trim());
    setSent(count);
    setMsg("");
    setSending(false);
    setTimeout(()=>setSent(null),3000);
  };
  return(
    <div style={{padding:"12px 16px",borderBottom:`1px solid ${theme.border}`,background:theme.accentDim+"22"}}>
      <div style={{fontSize:11,color:theme.accent,fontWeight:700,letterSpacing:1,marginBottom:8,fontFamily:"monospace",textTransform:"uppercase"}}>Admin Broadcast</div>
      <div style={{display:"flex",gap:8}}>
        <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message all users..." style={{...inp,flex:1,fontSize:14,padding:"8px 12px"}}/>
        <button onClick={send} disabled={sending||!msg.trim()} style={{background:theme.accent,color:"#000",border:"none",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:13}}>{sending?"...":"Send"}</button>
      </div>
      {sent!==null&&<div style={{color:theme.accent,fontSize:12,marginTop:6}}>✓ Sent to {sent} users</div>}
    </div>
  );
}

export default function ReelBigFishApp(){
  const [tab,setTab]=useState("home");
  const [publicProfileUser,setPublicProfileUser]=useState(null);
  const [notifications,setNotifications]=useState([]);
  const [showNotifications,setShowNotifications]=useState(false);
  const [notifUser,setNotifUser]=useState(null);
  useEffect(()=>{
    const loadNotifs=async()=>{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      setNotifUser(user);
      const{data}=await supabase.from("notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
      setNotifications(data||[]);
    };
    loadNotifs();
    const interval=setInterval(loadNotifs,30000);
    return()=>clearInterval(interval);
  },[]);
  const unreadCount=notifications.filter(n=>!n.read).length;
  const markAllRead=async()=>{
    if(!notifUser)return;
    await supabase.from("notifications").update({read:true}).eq("user_id",notifUser.id).eq("read",false);
    setNotifications(prev=>prev.map(n=>({...n,read:true})));
  };
  const [diaryBannerDismissed,setDiaryBannerDismissed]=useState(()=>localStorage.getItem("rbf_diary_banner")==="dismissed");
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get("premium")==="success"){
      alert("🎉 Welcome to Reel Big Fish Premium! Your account has been upgraded.");
      window.history.replaceState({},"",window.location.pathname);
    }
  },[]);
  useEffect(()=>{
    const setupPush=async()=>{
      if(!("Notification" in window))return;
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      if(Notification.permission==="granted"){
        await registerPushToken(user.id);
      }else if(Notification.permission==="default"){
        const perm=await Notification.requestPermission();
        if(perm==="granted")await registerPushToken(user.id);
      }
    };
    setTimeout(setupPush,3000);
  },[]);
  useEffect(()=>{
    const check=()=>{
      const hash=window.location.hash;
      const match=hash.match(/^#\/profile\/(.+)$/);
      setPublicProfileUser(match?decodeURIComponent(match[1]):null);
    };
    check();
    window.addEventListener("hashchange",check);
    return()=>window.removeEventListener("hashchange",check);
  },[]);

  const tabs=[
    {id:"home",label:"Home"},
    {id:"feed",label:"Feed"},
    {id:"diary",label:"My Diary"},
    {id:"fisheries",label:"📍 Fisheries"},
    {id:"premium",label:"✨ Premium"},
    {id:"forecast",label:"Forecast"},
    {id:"chat",label:"AI Guide"},
    {id:"report",label:"Report"},
  ]
  return(
    <div style={{minHeight:"100vh",background:theme.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:theme.text}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700&family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0;}@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}@keyframes spin{to{transform:rotate(360deg)}}button:hover{filter:brightness(1.1);}.shopify-buy__product__description{display:none!important;}.shopify-buy__product-description{display:none!important;}::-webkit-scrollbar{display:none;}@media(max-width:600px){.rbf-page-content{padding:12px!important;}h1{font-size:24px!important;}}input,textarea,select{font-size:16px!important;}*{-webkit-tap-highlight-color:transparent;}body{overscroll-behavior:none;}`}</style>
      <div style={{background:theme.surface,borderBottom:`1px solid ${theme.border}`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div onClick={()=>{setTab("home");setPublicProfileUser(null);window.location.hash="";}} style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}><div style={{width:38,height:38,borderRadius:10,background:`linear-gradient(135deg,${theme.accent},${theme.water})`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontWeight:900,fontSize:13,color:"#000"}}>RBF</div><div><div style={{fontFamily:"'Playfair Display',serif",fontWeight:900,fontSize:19,color:theme.text,letterSpacing:-0.5}}>Reel Big Fish</div><div style={{fontSize:10,color:theme.textMuted,marginTop:-2}}>The UK's Free Fishing Platform</div></div></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {notifUser&&(
            <button onClick={()=>{setShowNotifications(v=>!v);if(!showNotifications)markAllRead();}} style={{background:"none",border:"1px solid "+theme.border,borderRadius:10,padding:"7px 10px",cursor:"pointer",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:18}}>✉️</span>
              {unreadCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:theme.danger,color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{unreadCount>9?"9+":unreadCount}</span>}
            </button>
          )}
          <button onClick={()=>setTab("diary")} style={{background:theme.accent,color:"#000",border:"none",borderRadius:10,padding:"8px 16px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>My Diary</button>
        </div>
      </div>
      <div style={{background:theme.surface,borderBottom:`1px solid ${theme.border}`,padding:"0 12px",display:"flex",gap:0,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",alignItems:"center"}}>{tabs.map(t=>(<button key={t.id} onClick={()=>{setTab(t.id);setPublicProfileUser(null);window.location.hash="";}} style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?theme.accent:"transparent"}`,color:tab===t.id?theme.accent:theme.textMuted,padding:"12px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600,transition:"all 0.2s",whiteSpace:"nowrap",flexShrink:0}}>{t.label}</button>))}
      </div>
      {showNotifications&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:999,background:"rgba(0,0,0,0.5)"}} onClick={()=>setShowNotifications(false)}>
          <div style={{position:"absolute",top:56,right:0,width:"min(360px,100vw)",maxHeight:"70vh",background:theme.surface,borderLeft:`1px solid ${theme.border}`,borderBottom:`1px solid ${theme.border}`,overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${theme.border}`}}>
              <div style={{fontWeight:800,color:theme.text,fontSize:16}}>Notifications</div>
              <button onClick={()=>setShowNotifications(false)} style={{background:"none",border:"none",color:theme.textMuted,cursor:"pointer",fontSize:22,padding:"0 4px",lineHeight:1}}>×</button>
            </div>
            {notifUser?.id==="0f9adeda-759d-49a5-94ce-a93e5b8e7bf3"&&(
              <AdminBroadcast/>
            )}
            {notifications.length===0&&<div style={{padding:"24px",color:theme.textMuted,fontSize:14,textAlign:"center"}}>No notifications yet</div>}
            {notifications.map((n,i)=>(
              <div key={i} style={{padding:"14px 16px",borderBottom:`1px solid ${theme.border}`,background:n.read?"transparent":theme.accent+"11",display:"flex",gap:10,alignItems:"flex-start",cursor:n.ref_id?"pointer":"default"}} onClick={()=>{
                if(n.ref_id){setShowNotifications(false);setTab("feed");}
              }}>
                <div style={{flex:1}}>
                  <div style={{color:theme.text,fontSize:14,marginBottom:2}}>{n.message}</div>
                  <div style={{color:theme.textMuted,fontSize:11}}>{new Date(n.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
                  {n.ref_id&&<div style={{color:theme.accent,fontSize:11,marginTop:2}}>Tap to view →</div>}
                </div>
                {!n.read&&<div style={{width:8,height:8,borderRadius:"50%",background:theme.accent,flexShrink:0,marginTop:4}}/>}
                <button onClick={async(e)=>{e.stopPropagation();await supabase.from("notifications").delete().eq("id",n.id);setNotifications(prev=>prev.filter(x=>x.id!==n.id));}} style={{background:"none",border:"none",color:theme.textMuted,cursor:"pointer",fontSize:16,padding:"0 2px",lineHeight:1,flexShrink:0}}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
       {tab!=="home"&&!diaryBannerDismissed&&(
        <div style={{background:"linear-gradient(135deg,#1a2a1a,#0d1f0d)",borderBottom:`1px solid ${theme.accent}44`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
            <span style={{fontSize:20}}>📖</span>
            <div>
              <div style={{color:"#fff",fontSize:13,fontWeight:700}}>Have the Reel Big Fish printed diary?</div>
              <div style={{color:theme.accent,fontSize:12}}>Log on paper too — available on Amazon</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
            <a href="https://www.amazon.co.uk/dp/B0H1LZFRGS" target="_blank" rel="noopener noreferrer" style={{background:theme.accent,color:"#000",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:800,textDecoration:"none",whiteSpace:"nowrap"}}>View on Amazon</a>
            <button onClick={()=>{setDiaryBannerDismissed(true);localStorage.setItem("rbf_diary_banner","dismissed");}} style={{background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:18,padding:"2px 6px"}}>×</button>
          </div>
        </div>
      )}
     <div className="rbf-page-content" style={{maxWidth:tab==="home"?"100%":900,margin:"0 auto",padding:tab==="home"?0:24}}>
        {publicProfileUser?(
          <PublicProfile username={publicProfileUser} onBack={()=>{window.location.hash="";setPublicProfileUser(null);}}/>
        ):(
          <>
        {tab==="home"&&<HomePage setTab={setTab}/>}
        {tab==="feed"&&<FeedTab/>}
        {tab==="fisheries"&&<FisheriesTab/>}
        {tab==="premium"&&<PremiumTab/>}
        {tab==="diary"&&<DiaryTab/>}
        {tab==="forecast"&&<ForecastTab/>}
        {tab==="chat"&&<ChatTab/>}
        {tab==="report"&&<ReportTab/>}
          </>
        )}</div>
      <EllieWidget/>
    </div>
  );
}
