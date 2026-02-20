import{j as e}from"./query-CnDYISbB.js";import{r as s,d as Ne,c as we,L as Se}from"./router-CDeefzIX.js";import{H as ke}from"./Header-DAmE7hoq.js";import{a as U}from"./api-CyeANQFZ.js";import{l as Ce,w as _e,a as Ee,u as Le}from"./index-DvuHFj0T.js";import"./charts-NA80FkOZ.js";import"./i18n-Dj3n_vXi.js";import"./motion-mHIBlpFh.js";const Te=typeof window<"u"&&window.__WS_URL__||"";function $e(y={}){const{autoConnect:v=!0,reconnection:_=!0,reconnectionAttempts:N=5,reconnectionDelay:I=1e3}=y,m=s.useRef(null),[i,A]=s.useState(!1),[T,M]=s.useState(!1),[O,w]=s.useState(null),[g,R]=s.useState(null),[x,$]=s.useState([]),[c,b]=s.useState(null),r=s.useCallback(()=>{var u;if((u=m.current)!=null&&u.connected)return;M(!0),w(null);const o=Ce(Te+"/scans",{reconnection:_,reconnectionAttempts:N,reconnectionDelay:I,transports:["websocket","polling"],withCredentials:!0});o.on("connect",()=>{console.log("🔌 WebSocket connected:",o.id),A(!0),M(!1),w(null)}),o.on("disconnect",l=>{console.log("🔌 WebSocket disconnected:",l),A(!1),l==="io server disconnect"&&w("Server disconnected")}),o.on("connect_error",l=>{console.error("🔌 WebSocket error:",l.message),M(!1),w(l.message)}),o.on("scan_progress",l=>{console.log("📊 Scan progress:",l),R(l)}),o.on("scan_output",l=>{$(G=>[...G.slice(-500),l])}),o.on("scan_complete",l=>{console.log("✅ Scan complete:",l),b(l)}),o.on("scan_status",l=>{R(l)}),o.on("error",l=>{w(l.message)}),m.current=o},[_,N,I]),W=s.useCallback(()=>{m.current&&(m.current.disconnect(),m.current=null,A(!1))},[]),f=s.useCallback(o=>{var u;(u=m.current)!=null&&u.connected&&m.current.emit("join_scan",{scan_id:o})},[]),B=s.useCallback(o=>{var u;(u=m.current)!=null&&u.connected&&m.current.emit("leave_scan",{scan_id:o})},[]),S=s.useCallback(o=>{var u;(u=m.current)!=null&&u.connected&&m.current.emit("subscribe_user",{user_id:o})},[]),E=s.useCallback(o=>{var u;(u=m.current)!=null&&u.connected&&m.current.emit("request_status",{scan_id:o})},[]),a=s.useCallback(()=>{$([]),R(null),b(null)},[]);return s.useEffect(()=>(v&&r(),()=>{W()}),[v,r,W]),{connected:i,connecting:T,error:O,connect:r,disconnect:W,subscribeScan:f,unsubscribeScan:B,subscribeUser:S,scanProgress:g,scanOutput:x,scanComplete:c,requestStatus:E,clearOutput:a}}function Pe(y){const v=$e({autoConnect:!!y});return s.useEffect(()=>{if(y&&v.connected)return v.subscribeScan(y),v.requestStatus(y),()=>{v.unsubscribeScan(y)}},[y,v.connected]),{connected:v.connected,progress:v.scanProgress,output:v.scanOutput,complete:v.scanComplete,error:v.error}}const Y=[{key:"INITIALIZING",label:"Initializing",icon:"⚙️"},{key:"RESOLVING_TARGET",label:"Resolving Target",icon:"🌐"},{key:"PREPARING_TOOL",label:"Preparing Tool",icon:"🔧"},{key:"EXECUTING",label:"Executing Scan",icon:"🚀"},{key:"PARSING_OUTPUT",label:"Parsing Results",icon:"📊"},{key:"SAVING_RESULTS",label:"Saving Findings",icon:"💾"},{key:"COMPLETED",label:"Complete",icon:"✅"}],Me=({scanId:y,isRunning:v=!1,className:_=""})=>{const[N,I]=s.useState(null),[m,i]=s.useState(new Set),[A,T]=s.useState([]),[M,O]=s.useState(!1),w=s.useRef(null);s.useEffect(()=>{I(null),i(new Set),T([]),O(!1),w.current=null},[y]),s.useEffect(()=>{if(!y)return;const x=c=>{if((c==null?void 0:c.scan_id)!==y)return;const b=c.phase,r=c.description||"",W=c.progress||0,f={phase:b,description:r,progress:W,timestamp:Date.now()};w.current&&w.current!==b&&i(S=>{const E=new Set(S);return E.add(w.current),E});const B=Y.findIndex(S=>S.key===b);B>0&&i(S=>{const E=new Set(S);for(let a=0;a<B;a++)E.add(Y[a].key);return E}),b==="FAILED"&&O(!0),b==="COMPLETED"&&i(new Set(Y.map(S=>S.key))),I(f),T(S=>[...S,f]),w.current=b},$=_e.on("scan_phase_update",x);return()=>{$()}},[y]);const g=x=>M&&(N==null?void 0:N.phase)===x?"failed":m.has(x)?"completed":(N==null?void 0:N.phase)===x?"active":"pending";if(!y)return null;const R=(N==null?void 0:N.progress)||0;return e.jsxs("div",{className:`scan-progress-stepper ${_}`,children:[e.jsxs("div",{className:"progress-bar-container",children:[e.jsx("div",{className:"progress-bar-bg",children:e.jsx("div",{className:`progress-bar-fill ${M?"failed":""}`,style:{width:`${R}%`}})}),e.jsxs("span",{className:"progress-text",children:[R,"%"]})]}),e.jsx("div",{className:"stepper-container",children:Y.filter(x=>x.key!=="COMPLETED"||m.has("COMPLETED")).map((x,$)=>{const c=g(x.key),b=A.find(r=>r.phase===x.key);return e.jsxs("div",{className:`step step-${c}`,children:[$>0&&e.jsx("div",{className:`step-connector ${c==="completed"||c==="active"?"active":""}`}),e.jsxs("div",{className:`step-indicator ${c}`,children:[c==="completed"&&e.jsx("svg",{className:"check-icon",viewBox:"0 0 20 20",fill:"currentColor",children:e.jsx("path",{fillRule:"evenodd",d:"M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z",clipRule:"evenodd"})}),c==="active"&&e.jsx("div",{className:"pulse-dot"}),c==="failed"&&e.jsx("svg",{className:"fail-icon",viewBox:"0 0 20 20",fill:"currentColor",children:e.jsx("path",{fillRule:"evenodd",d:"M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z",clipRule:"evenodd"})}),c==="pending"&&e.jsx("span",{className:"step-number",children:$+1})]}),e.jsxs("div",{className:"step-content",children:[e.jsxs("div",{className:"step-label",children:[e.jsx("span",{className:"step-icon",children:x.icon}),e.jsx("span",{className:"step-title",children:x.label})]}),(c==="active"||c==="completed"||c==="failed")&&b&&e.jsx("div",{className:"step-description",children:b.description})]})]},x.key)})}),e.jsx("style",{children:`
        .scan-progress-stepper {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(34, 197, 94, 0.15);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }

        /* ── Progress Bar ── */
        .progress-bar-container {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .progress-bar-bg {
          flex: 1;
          height: 6px;
          background: rgba(100, 116, 139, 0.3);
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #22c55e, #10b981);
          border-radius: 3px;
          transition: width 0.5s ease;
        }
        .progress-bar-fill.failed {
          background: linear-gradient(90deg, #ef4444, #dc2626);
        }
        .progress-text {
          font-size: 12px;
          color: #22c55e;
          font-weight: 600;
          min-width: 36px;
          text-align: right;
        }

        /* ── Stepper ── */
        .stepper-container {
          display: flex;
          flex-direction: column;
          gap: 0;
          position: relative;
        }

        .step {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          position: relative;
          padding: 6px 0;
          min-height: 36px;
        }

        /* Connector line */
        .step-connector {
          position: absolute;
          left: 13px;
          top: -6px;
          width: 2px;
          height: 12px;
          background: rgba(100, 116, 139, 0.3);
        }
        .step-connector.active {
          background: #22c55e;
        }

        /* Indicator */
        .step-indicator {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.3s ease;
          position: relative;
          z-index: 1;
        }
        .step-indicator.completed {
          background: rgba(34, 197, 94, 0.2);
          border: 2px solid #22c55e;
          color: #22c55e;
        }
        .step-indicator.active {
          background: rgba(59, 130, 246, 0.2);
          border: 2px solid #3b82f6;
          color: #3b82f6;
        }
        .step-indicator.pending {
          background: rgba(100, 116, 139, 0.1);
          border: 2px solid rgba(100, 116, 139, 0.3);
          color: rgba(100, 116, 139, 0.5);
        }
        .step-indicator.failed {
          background: rgba(239, 68, 68, 0.2);
          border: 2px solid #ef4444;
          color: #ef4444;
        }

        .check-icon, .fail-icon {
          width: 14px;
          height: 14px;
        }

        .step-number {
          font-size: 11px;
          font-weight: 600;
        }

        /* Pulse animation for active step */
        .pulse-dot {
          width: 10px;
          height: 10px;
          background: #3b82f6;
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }

        /* Content */
        .step-content {
          flex: 1;
          min-width: 0;
          padding-top: 3px;
        }
        .step-label {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .step-icon {
          font-size: 14px;
          line-height: 1;
        }
        .step-title {
          font-size: 13px;
          font-weight: 500;
          color: #e2e8f0;
        }
        .step-completed .step-title {
          color: #22c55e;
        }
        .step-active .step-title {
          color: #3b82f6;
        }
        .step-pending .step-title {
          color: rgba(148, 163, 184, 0.6);
        }
        .step-failed .step-title {
          color: #ef4444;
        }
        .step-description {
          font-size: 11px;
          color: rgba(148, 163, 184, 0.7);
          margin-top: 2px;
          margin-left: 20px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `})]})},Re={network_security:{label:"Network Security",emoji:"🌐"},web_security:{label:"Web Application Security",emoji:"🔒"},vulnerability_assessment:{label:"Vulnerability Assessment",emoji:"🔍"},compliance_audit:{label:"Compliance & Audit",emoji:"📋"},threat_intelligence:{label:"Threat Intelligence",emoji:"🛡️"},forensics_monitoring:{label:"Forensics & Monitoring",emoji:"📊"}};function He(){var ue,me;const{scanId:y,toolId:v}=Ne(),[_]=we(),{target:N,addRecentTarget:I}=Ee(),{token:m}=Le(),[i,A]=s.useState(null),[T,M]=s.useState(""),[O,w]=s.useState(""),[g,R]=s.useState(null),[x,$]=s.useState(!1),[c,b]=s.useState("terminal"),[r,W]=s.useState(null),[f,B]=s.useState(_.get("target")||N||""),[S,E]=s.useState(()=>{const t=_.get("params");if(t)try{return JSON.parse(t)}catch{return{}}return{}}),[a,o]=s.useState("idle"),[u,l]=s.useState([]),[,G]=s.useState(null),[k,ne]=s.useState(y||null),[ae,xe]=s.useState(_.get("command")||""),[re,V]=s.useState(null),[le,Z]=s.useState(0),[Q,K]=s.useState(null),[ee,oe]=s.useState(0),[z,pe]=s.useState([]),[L,ge]=s.useState("auto"),[F,ie]=s.useState(null),q=s.useRef(null),C=v||_.get("tool")||"",p=Pe(a==="running"?k:null);s.useEffect(()=>{fe(),he()},[C]);const he=async()=>{if(C)try{const t=await fetch(`/api/v1/tools/${C}/execution-mode`,{headers:{Authorization:`Bearer ${m}`}});if(t.ok){const n=await t.json();R(n)}}catch{}};s.useEffect(()=>{const t=async()=>{var j;try{const d=await U.getAgents();(j=d.data)!=null&&j.agents&&pe(d.data.agents)}catch{}};t();const n=setInterval(t,15e3);return()=>clearInterval(n)},[]);const ce=s.useRef(!1);s.useEffect(()=>{if(!ce.current&&f&&C&&a==="idle"&&_.get("target")){ce.current=!0;const t=setTimeout(()=>de(),500);return()=>clearTimeout(t)}},[f,C,a]),s.useEffect(()=>{q.current&&(q.current.scrollTop=q.current.scrollHeight)},[u]),s.useEffect(()=>{p.progress&&(Z(p.progress.progress),p.progress.status&&p.progress.status!=="running"&&o(p.progress.status))},[p.progress]),s.useEffect(()=>{if(p.output.length>0){const t=p.output[p.output.length-1];l(n=>[...n,t.line])}},[p.output]),s.useEffect(()=>{p.complete&&(o(p.complete.status),Z(100),K(null),p.complete.status==="completed"&&be())},[p.complete]),s.useEffect(()=>{if(a==="running"&&Q){const t=setInterval(()=>{oe(Math.floor((Date.now()-Q)/1e3))},1e3);return()=>clearInterval(t)}else oe(0)},[a,Q]);const be=async()=>{if(k)try{const t=await fetch(`/api/v1/scans/${k}/business-report`,{headers:{Authorization:`Bearer ${m}`}});if(t.ok){const n=await t.json();W(n),b("results")}}catch{}};s.useEffect(()=>{if(k&&a==="running")return console.log("📡 Starting SSE stream for scan:",k),U.streamScanOutput(k,n=>{l(j=>[...j,n])},n=>{G(n);const j=n.status==="timeout"?"failed":n.status;o(j),Z(100),K(null)})},[k,a]);const fe=async()=>{const t=await U.getToolConfig(C);if(t.data){const n=t.data.tool;A(n);const j=n.business_name||n.name;M(j);const d=n.category||"vulnerability_assessment",h=Re[d];if(w(h?`${h.emoji} ${h.label} — This scan helps identify security issues in your systems.`:"🔍 Security Assessment — Comprehensive security testing for your infrastructure."),!_.get("params")){const D={};Object.entries(t.data.tool.parameters||{}).forEach(([X,P])=>{P.default!==void 0&&(D[X]=P.default)}),E(D)}}},de=async()=>{var h,te,D,X;if(!f){V("Target is required");return}I(f),V(null),l([]),o("running"),ie(null),K(Date.now());const t=L==="local"?"(Server)":L==="auto"?"(Auto-select agent)":`(Agent: ${((h=z.find(P=>P.id===L))==null?void 0:h.name)||L})`;l([`🚀 Starting ${(i==null?void 0:i.name)||C} scan on ${f} ${t}...`,""]);const n=L!=="auto"&&L!=="local"?L:void 0,j=L==="local"?"local":L==="auto"?"auto":"agent",d=await U.executeScan(C,f,S,n,j);if(d.error){V(d.error),o("failed"),l(P=>[...P,`❌ Error: ${d.error}`]);return}if(d.data){ne(d.data.scan_id),xe(d.data.command||"");const P=d.data.execution_mode||"local";ie({mode:P,agentName:(te=d.data.agent)==null?void 0:te.name,agentIp:(D=d.data.agent)==null?void 0:D.ip,dispatchMethod:(X=d.data.agent)==null?void 0:X.dispatch_method}),P==="agent"&&d.data.agent?l(se=>{var H;return[...se,`📡 Dispatched to agent "${d.data.agent.name}" (${d.data.agent.ip})`,`🔗 Method: ${d.data.agent.dispatch_method==="websocket"?"WebSocket (real-time)":"HTTP Polling"}`,`📝 Command: ${((H=d.data)==null?void 0:H.command)||""}`,"","--- Agent Output ---",""]}):l(se=>{var H;return[...se,`📝 Command: ${((H=d.data)==null?void 0:H.command)||""}`,"","--- Scan Output ---",""]})}},je=async()=>{k&&(await U.stopScan(k),o("cancelled"),l(t=>[...t,"","⏹️ Scan cancelled by user"]))},ye=()=>{o("idle"),l([]),G(null),ne(null),B(""),V(null)},J=(t,n)=>{E(j=>({...j,[t]:n}))},ve=(t,n)=>{var d;const j=S[t];switch(n.type){case"boolean":return e.jsxs("label",{className:"flex items-center gap-3 cursor-pointer",children:[e.jsx("input",{type:"checkbox",checked:j||!1,onChange:h=>J(t,h.target.checked),className:"w-4 h-4 rounded border-gray-600 bg-gray-800 text-kali-blue focus:ring-kali-blue"}),e.jsx("span",{className:"text-sm text-gray-300",children:n.description})]});case"select":return e.jsxs("select",{value:j||"",onChange:h=>J(t,h.target.value),className:"w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue",children:[e.jsxs("option",{value:"",children:["Select ",t]}),(d=n.options)==null?void 0:d.map(h=>e.jsx("option",{value:h,children:h},h))]});case"number":return e.jsx("input",{type:"number",value:j||"",onChange:h=>J(t,h.target.value),min:n.min,max:n.max,className:"w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue",placeholder:n.description});default:return e.jsx("input",{type:"text",value:j||"",onChange:h=>J(t,h.target.value),className:"w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue",placeholder:n.description})}};return e.jsxs("div",{className:"min-h-screen bg-gray-950",children:[e.jsx(ke,{title:`Run: ${T||(i==null?void 0:i.name)||C}`,subtitle:"Execute security assessment",breadcrumb:[{label:"Tools",href:"/dashboard/tools"},{label:T||(i==null?void 0:i.name)||C,href:`/dashboard/tools/${C}`},{label:"Run Scan"}]}),e.jsx("div",{className:"p-6",children:e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-6",children:[e.jsxs("div",{className:"lg:col-span-1 space-y-6",children:[e.jsxs("div",{className:"bg-gray-900 rounded-xl border border-gray-800 p-5",children:[e.jsxs("h3",{className:"text-white font-semibold mb-2",children:["🎯 Target ",e.jsx("span",{className:"text-red-400",children:"*"})]}),e.jsx("p",{className:"text-gray-500 text-xs mb-3",children:"Enter the IP address, domain, or URL you want to scan. You must own or have permission to test this target."}),O&&e.jsx("p",{className:"text-gray-400 text-xs mb-3 leading-relaxed",children:O}),e.jsx("input",{type:"text",value:f,onChange:t=>B(t.target.value),placeholder:"e.g. 192.168.1.0/24, example.com, https://app.example.com",disabled:a==="running",className:`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition disabled:opacity-50 ${!f&&a==="idle"?"border-yellow-600/50 focus:border-yellow-500":"border-gray-700 focus:border-kali-blue"}`}),!f&&a==="idle"&&e.jsxs("p",{className:"text-yellow-500/80 text-xs mt-2 flex items-center gap-1",children:[e.jsx("svg",{className:"w-3 h-3",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"})}),"Target is required to start a scan"]}),re&&e.jsx("p",{className:"text-red-500 text-sm mt-2",children:re})]}),g&&g.execution_mode!=="normal"&&e.jsxs("div",{className:`bg-gray-900 rounded-xl border p-5 ${g.execution_mode==="sandbox"?"border-yellow-500/30":g.execution_mode==="not_applicable"?"border-red-500/30":"border-blue-500/30"}`,children:[e.jsx("h3",{className:`font-semibold mb-2 text-sm ${g.execution_mode==="sandbox"?"text-yellow-400":g.execution_mode==="not_applicable"?"text-red-400":"text-blue-400"}`,children:g.execution_mode==="sandbox"?"⚠️ Sandboxed Execution":g.execution_mode==="rate_limited"?"⏱️ Rate-Limited Scan":g.execution_mode==="simulation"?"🧪 Simulation Mode":g.execution_mode==="headless"?"🖥️ Headless Mode":g.execution_mode==="not_applicable"?"❌ Not Available":"⚙️ Special Execution"}),e.jsx("p",{className:"text-gray-400 text-xs leading-relaxed",children:((ue=g.config)==null?void 0:ue.user_explanation)||((me=g.config)==null?void 0:me.user_display)||"This tool runs in a restricted environment for safety."}),!g.can_execute&&e.jsx("p",{className:"text-red-400 text-xs mt-2 font-medium",children:"This scan type is not available for remote execution."})]}),e.jsxs("div",{className:"bg-gray-900 rounded-xl border border-gray-800 p-5",children:[e.jsx("h3",{className:"text-white font-semibold mb-2",children:"🖥️ Execution Node"}),e.jsx("p",{className:"text-gray-500 text-xs mb-3",children:"Choose where to run the scan. Use a private agent to scan internal networks behind your firewall."}),e.jsxs("select",{value:L,onChange:t=>ge(t.target.value),disabled:a==="running",className:"w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue transition disabled:opacity-50",children:[e.jsx("option",{value:"auto",children:"🔄 Auto — Best available node"}),e.jsx("option",{value:"local",children:"☁️ Cloud Server — Public internet scan"}),z.filter(t=>t.status==="online").map(t=>e.jsxs("option",{value:t.id,children:["🟢 ",t.name," — ",t.ip_address," (Private Network) — CPU: ",t.cpu_usage,"%"]},t.id)),z.filter(t=>t.status!=="online").map(t=>e.jsxs("option",{value:t.id,disabled:!0,children:["🔴 ",t.name," — ",t.ip_address," — Offline"]},t.id))]}),e.jsxs("div",{className:"mt-2 flex items-center gap-2",children:[e.jsx("span",{className:`w-2 h-2 rounded-full ${z.filter(t=>t.status==="online").length>0?"bg-green-500":"bg-gray-500"}`}),e.jsxs("span",{className:"text-xs text-gray-400",children:[z.filter(t=>t.status==="online").length," agent",z.filter(t=>t.status==="online").length!==1?"s":""," online"]})]}),F&&e.jsx("div",{className:`mt-3 p-2 rounded-lg text-xs ${F.mode==="agent"?"bg-blue-500/10 border border-blue-500/30 text-blue-400":"bg-purple-500/10 border border-purple-500/30 text-purple-400"}`,children:F.mode==="agent"?e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"font-semibold",children:"📡 Running on Agent"}),e.jsxs("p",{children:[F.agentName," (",F.agentIp,")"]}),e.jsxs("p",{children:["Via: ",F.dispatchMethod==="websocket"?"WebSocket":"Polling"]})]}):e.jsx("p",{className:"font-semibold",children:"🖥️ Running on Server"})})]}),i&&Object.keys(i.parameters||{}).length>0&&e.jsxs("div",{className:"bg-gray-900 rounded-xl border border-gray-800 p-5",children:[e.jsx("h3",{className:"text-white font-semibold mb-4",children:"⚙️ Parameters"}),e.jsx("div",{className:"space-y-4",children:Object.entries(i.parameters||{}).map(([t,n])=>e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm text-gray-400 mb-1.5 capitalize",children:t.replace(/_/g," ")}),ve(t,n)]},t))})]}),e.jsxs("div",{className:"space-y-3",children:[a==="idle"&&e.jsxs("button",{onClick:de,disabled:!f.trim(),className:"w-full py-3 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed",children:[e.jsxs("svg",{className:"w-5 h-5",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:[e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"}),e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M21 12a9 9 0 11-18 0 9 9 0 0118 0z"})]}),"Start Scan"]}),a==="running"&&e.jsxs("button",{onClick:je,className:"w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2",children:[e.jsxs("svg",{className:"w-5 h-5",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:[e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M21 12a9 9 0 11-18 0 9 9 0 0118 0z"}),e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"})]}),"Stop Scan"]}),(a==="completed"||a==="failed"||a==="cancelled")&&e.jsxs("button",{onClick:ye,className:"w-full py-3 bg-kali-blue hover:bg-kali-blue/80 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2",children:[e.jsx("svg",{className:"w-5 h-5",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"})}),"New Scan"]})]}),e.jsxs("div",{className:"bg-gray-900 rounded-xl border border-gray-800 p-5",children:[e.jsx("h3",{className:"text-white font-semibold mb-3",children:"Status"}),e.jsxs("div",{className:"flex items-center gap-3",children:[a==="idle"&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"w-3 h-3 rounded-full bg-gray-500"}),e.jsx("span",{className:"text-gray-400",children:"Ready to scan"})]}),a==="running"&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"w-3 h-3 rounded-full bg-yellow-500 animate-pulse"}),e.jsxs("span",{className:"text-yellow-500",children:["Scanning... ",le,"%"]}),e.jsxs("span",{className:"text-gray-500 text-xs ml-auto",children:[Math.floor(ee/60),":",String(ee%60).padStart(2,"0")]})]}),a==="completed"&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"w-3 h-3 rounded-full bg-green-500"}),e.jsx("span",{className:"text-green-500",children:"Completed"})]}),a==="failed"&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"w-3 h-3 rounded-full bg-red-500"}),e.jsx("span",{className:"text-red-500",children:"Failed"})]}),a==="cancelled"&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"w-3 h-3 rounded-full bg-orange-500"}),e.jsx("span",{className:"text-orange-500",children:"Cancelled"})]})]}),a==="running"&&e.jsxs("div",{className:"mt-3",children:[e.jsx("div",{className:"w-full h-2 bg-gray-800 rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-gradient-to-r from-kali-blue to-kali-purple transition-all duration-300",style:{width:`${le}%`}})}),p.connected&&e.jsxs("p",{className:"text-xs text-green-400 mt-1 flex items-center gap-1",children:[e.jsx("span",{className:"w-2 h-2 rounded-full bg-green-500 animate-pulse"}),"Real-time updates active"]}),ee>15&&e.jsxs("p",{className:"text-xs text-blue-400 mt-2 flex items-center gap-1",children:[e.jsx("svg",{className:"w-3 h-3 flex-shrink-0",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"})}),"Scan may take several minutes depending on target and parameters. Output will appear when data is available."]})]}),ae&&e.jsxs("div",{className:"mt-3 pt-3 border-t border-gray-800",children:[e.jsxs("button",{onClick:()=>$(!x),className:"text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-1",children:[e.jsx("svg",{className:`w-3 h-3 transition-transform ${x?"rotate-90":""}`,fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 5l7 7-7 7"})}),"Technical Details"]}),x&&e.jsx("code",{className:"text-xs text-green-400 break-all mt-2 block",children:ae})]})]})]}),e.jsxs("div",{className:"lg:col-span-2",children:[a==="completed"&&e.jsxs("div",{className:"flex gap-2 mb-3",children:[e.jsx("button",{onClick:()=>b("results"),className:`px-4 py-2 rounded-lg text-sm font-medium transition ${c==="results"?"bg-blue-600 text-white":"bg-gray-800 text-gray-400 hover:text-white"}`,children:"📊 Results"}),e.jsx("button",{onClick:()=>b("terminal"),className:`px-4 py-2 rounded-lg text-sm font-medium transition ${c==="terminal"?"bg-blue-600 text-white":"bg-gray-800 text-gray-400 hover:text-white"}`,children:"🖥️ Terminal"}),e.jsx("div",{className:"flex-1"}),e.jsx(Se,{to:`/dashboard/reports?scan=${k}`,className:"px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition flex items-center gap-1.5",children:"📄 PDF Report"})]}),c==="results"&&a==="completed"?e.jsxs("div",{className:"bg-gray-900 rounded-xl border border-gray-800 overflow-auto h-[calc(100vh-240px)] p-6 space-y-6",children:[e.jsxs("div",{className:"bg-gray-800/50 rounded-xl p-5 border border-gray-700",children:[e.jsxs("h2",{className:"text-lg font-bold text-white mb-3",children:["Security Report: ",f]}),e.jsxs("p",{className:"text-gray-400 text-sm mb-4",children:[T||(i==null?void 0:i.name)," • ",new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})]}),r!=null&&r.summary?e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-4",children:[e.jsxs("div",{className:"text-center",children:[e.jsxs("p",{className:`text-3xl font-bold ${(r.summary.score||0)>=80?"text-green-400":(r.summary.score||0)>=60?"text-yellow-400":"text-red-400"}`,children:[r.summary.score||"--","/100"]}),e.jsx("p",{className:"text-gray-500 text-xs mt-1",children:"Security Score"})]}),e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-3xl font-bold text-red-400",children:r.summary.critical||0}),e.jsx("p",{className:"text-gray-500 text-xs mt-1",children:"Critical"})]}),e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-3xl font-bold text-orange-400",children:r.summary.high||0}),e.jsx("p",{className:"text-gray-500 text-xs mt-1",children:"High"})]}),e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-3xl font-bold text-yellow-400",children:(r.summary.medium||0)+(r.summary.low||0)}),e.jsx("p",{className:"text-gray-500 text-xs mt-1",children:"Medium/Low"})]})]}):e.jsxs("p",{className:"text-gray-400",children:["Scan completed. ",u.length," lines of output captured."]})]}),r!=null&&r.findings&&r.findings.length>0?e.jsxs("div",{className:"space-y-3",children:[e.jsx("h3",{className:"text-white font-semibold",children:"Findings"}),r.findings.map((t,n)=>e.jsx("div",{className:`rounded-xl p-4 border ${t.severity==="critical"?"border-red-500/30 bg-red-500/5":t.severity==="high"?"border-orange-500/30 bg-orange-500/5":t.severity==="medium"?"border-yellow-500/30 bg-yellow-500/5":"border-gray-700 bg-gray-800/50"}`,children:e.jsxs("div",{className:"flex items-start gap-3",children:[e.jsx("span",{className:`px-2 py-0.5 rounded text-xs font-bold uppercase ${t.severity==="critical"?"bg-red-500/20 text-red-400":t.severity==="high"?"bg-orange-500/20 text-orange-400":t.severity==="medium"?"bg-yellow-500/20 text-yellow-400":"bg-blue-500/20 text-blue-400"}`,children:t.severity}),e.jsxs("div",{className:"flex-1",children:[e.jsx("h4",{className:"text-white font-medium",children:t.title||t.business_title||"Finding"}),t.location&&e.jsx("p",{className:"text-gray-500 text-xs mt-0.5",children:t.location}),t.impact&&e.jsxs("p",{className:"text-gray-400 text-sm mt-2",children:[e.jsx("strong",{className:"text-gray-300",children:"Impact:"})," ",t.impact]}),t.fix&&e.jsxs("p",{className:"text-gray-400 text-sm mt-1",children:[e.jsx("strong",{className:"text-green-400",children:"Fix:"})," ",t.fix]})]})]})},n))]}):e.jsxs("div",{className:"text-center py-6",children:[e.jsx("div",{className:"w-14 h-14 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-3",children:e.jsx("svg",{className:"w-7 h-7 text-green-400",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"})})}),e.jsx("p",{className:"text-green-400 font-medium",children:"Scan completed successfully"}),e.jsx("p",{className:"text-gray-500 text-sm mt-1",children:"Review the terminal output for detailed results"}),e.jsx("button",{onClick:()=>b("terminal"),className:"mt-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition",children:"View Terminal Output"})]}),(r==null?void 0:r.compliance)&&e.jsxs("div",{children:[e.jsx("h3",{className:"text-white font-semibold mb-3",children:"Compliance Status"}),e.jsx("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-3",children:Object.entries(r.compliance).map(([t,n])=>e.jsxs("div",{className:"bg-gray-800/50 rounded-lg p-3 text-center border border-gray-700",children:[e.jsx("p",{className:"text-white font-medium text-sm uppercase",children:t}),e.jsx("p",{className:`text-lg font-bold mt-1 ${n==="pass"||typeof n=="number"&&n>=80?"text-green-400":"text-yellow-400"}`,children:typeof n=="number"?`${n}%`:n==="pass"?"✅":"⚠️"})]},t))})]}),(r==null?void 0:r.roadmap)&&r.roadmap.length>0&&e.jsxs("div",{children:[e.jsx("h3",{className:"text-white font-semibold mb-3",children:"Fix Roadmap"}),e.jsx("div",{className:"space-y-2",children:r.roadmap.map((t,n)=>e.jsxs("div",{className:"flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700",children:[e.jsx("span",{className:"text-gray-500 text-xs font-mono w-16",children:t.timeline||`Week ${n+1}`}),e.jsx("div",{className:"flex-1",children:e.jsx("p",{className:"text-white text-sm",children:t.action||t.title})}),e.jsx("span",{className:`px-2 py-0.5 rounded text-xs uppercase font-medium ${t.priority==="high"?"bg-red-500/20 text-red-400":t.priority==="medium"?"bg-yellow-500/20 text-yellow-400":"bg-blue-500/20 text-blue-400"}`,children:t.priority||"medium"}),e.jsx("span",{className:"text-gray-500 text-xs",children:t.effort||""})]},n))})]})]}):e.jsxs("div",{children:[(a==="running"||a==="completed"||a==="failed")&&k&&e.jsx(Me,{scanId:k,isRunning:a==="running"}),e.jsxs("div",{className:"bg-gray-900 rounded-xl border border-gray-800 overflow-hidden h-[calc(100vh-200px)]",children:[e.jsxs("div",{className:"flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("div",{className:"flex gap-1.5",children:[e.jsx("div",{className:"w-3 h-3 rounded-full bg-red-500"}),e.jsx("div",{className:"w-3 h-3 rounded-full bg-yellow-500"}),e.jsx("div",{className:"w-3 h-3 rounded-full bg-green-500"})]}),e.jsxs("span",{className:"text-gray-400 text-sm ml-3",children:[T||(i==null?void 0:i.name)||C," — ",f||"No target"]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("span",{className:"flex items-center gap-1 text-xs mr-2",title:p.connected?"WebSocket connected":"WebSocket disconnected",children:[e.jsx("span",{className:`w-2 h-2 rounded-full ${p.connected?"bg-green-400 animate-pulse":"bg-red-400"}`}),e.jsx("span",{className:p.connected?"text-green-500":"text-red-500",children:p.connected?"LIVE":"OFFLINE"})]}),e.jsx("button",{onClick:()=>navigator.clipboard.writeText(u.join("")),className:"p-1.5 text-gray-400 hover:text-white transition",title:"Copy output",children:e.jsx("svg",{className:"w-4 h-4",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"})})}),e.jsx("button",{onClick:()=>l([]),className:"p-1.5 text-gray-400 hover:text-white transition",title:"Clear output",children:e.jsx("svg",{className:"w-4 h-4",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"})})})]})]}),e.jsxs("div",{ref:q,className:"p-4 font-mono text-sm text-green-400 bg-gray-950 overflow-auto h-[calc(100%-52px)]",children:[u.length===0?e.jsxs("div",{className:"text-gray-500",children:[e.jsx("pre",{className:"text-kali-blue",children:`
  ██████╗██╗   ██╗██████╗ ███████╗██████╗ ███████╗███████╗ ██████╗
 ██╔════╝╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗██╔════╝██╔════╝██╔════╝
 ██║      ╚████╔╝ ██████╔╝█████╗  ██████╔╝███████╗█████╗  ██║     
 ██║       ╚██╔╝  ██╔══██╗██╔══╝  ██╔══██╗╚════██║██╔══╝  ██║     
 ╚██████╗   ██║   ██████╔╝███████╗██║  ██║███████║███████╗╚██████╗
  ╚═════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝ ╚═════╝
                                                                   
`}),e.jsx("p",{className:"mt-4",children:"Ready to execute security scan."}),e.jsx("p",{className:"mt-2",children:'Enter a target and click "Start Scan" to begin.'}),e.jsx("p",{className:"mt-4 text-yellow-500",children:"⚠️ Only scan systems you have permission to test!"})]}):u.map((t,n)=>e.jsx("div",{className:"whitespace-pre-wrap",children:t},n)),a==="running"&&e.jsx("div",{className:"inline-block w-2 h-4 bg-green-400 animate-pulse ml-1"})]})]})]})]})]})})]})}export{He as ScanExecutionPage,He as default};
//# sourceMappingURL=ScanExecutionPage-C5OIFOTw.js.map
