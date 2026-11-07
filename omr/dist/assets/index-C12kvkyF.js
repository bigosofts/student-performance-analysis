(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const r of i.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&o(r)}).observe(document,{childList:!0,subtree:!0});function t(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function o(n){if(n.ep)return;n.ep=!0;const i=t(n);fetch(n.href,i)}})();function Yt(){if(typeof window>"u")return!0;if(window.isSecureContext!==void 0)return window.isSecureContext;const e=window.location.protocol,s=window.location.hostname;return e==="https:"||s==="localhost"||s==="127.0.0.1"}async function xs(e,s={}){const t=Yt(),o=u=>{var b;if((b=navigator==null?void 0:navigator.mediaDevices)!=null&&b.getUserMedia)return navigator.mediaDevices.getUserMedia(u);const m=navigator.getUserMedia||navigator.webkitGetUserMedia||navigator.mozGetUserMedia||navigator.msGetUserMedia;if(m)return new Promise((x,f)=>m.call(navigator,u,x,f));if(!t){const x=`https://${window.location.hostname}:${window.location.port||"5173"}`,f=new Error(`INSECURE_CONTEXT: Chrome on mobile blocks camera over HTTP. Please visit ${x} or enable chrome://flags/#unsafely-treat-insecure-origin-as-secure`);return f.code="INSECURE_CONTEXT",f.httpsUrl=x,Promise.reject(f)}return Promise.reject(new Error("Camera API (navigator.mediaDevices.getUserMedia) is not supported in this browser."))};let n=s.facingMode||"environment",i=s.deviceId||null,r=null;async function c(u,m){if(r){for(const g of r.getTracks())g.stop();r=null}const b=[];m?(b.push({video:{deviceId:{exact:m},width:{ideal:1920},height:{ideal:1080}},audio:!1}),b.push({video:{deviceId:{exact:m}},audio:!1})):(b.push({video:{facingMode:{ideal:u||"environment"},width:{ideal:1920,min:1080},height:{ideal:1080,min:720}},audio:!1}),b.push({video:{facingMode:{ideal:u||"environment"}},audio:!1}),b.push({video:{facingMode:u||"environment"},audio:!1})),b.push({video:!0,audio:!1});let x=null,f=null;for(const g of b)try{if(x=await o(g),x)break}catch(C){if(f=C,C.code==="INSECURE_CONTEXT"||C.name==="NotAllowedError")throw C}if(!x)throw f||new Error("Failed to start camera stream.");r=x,e.srcObject=x,e.playsInline=!0,e.muted=!0,e.setAttribute("autoplay",""),e.setAttribute("muted",""),e.setAttribute("playsinline",""),e.setAttribute("webkit-playsinline","");try{await e.play()}catch(g){console.warn("Autoplay prevented or video play error:",g)}return x}return await c(n,i),{get stream(){return r},get videoElement(){return e},getVideoTrack(){var u;return((u=r==null?void 0:r.getVideoTracks())==null?void 0:u[0])||null},getCapabilities(){const u=this.getVideoTrack();return u!=null&&u.getCapabilities?u.getCapabilities():{}},hasTorch(){return!!this.getCapabilities().torch},async setTorch(u){const m=this.getVideoTrack();if(!m||!this.hasTorch())return!1;try{return await m.applyConstraints({advanced:[{torch:!!u}]}),!0}catch(b){return console.warn("Failed to set torch mode:",b),!1}},async switchCamera(u){return u==="toggle"?(n=n==="environment"?"user":"environment",i=null):typeof u=="string"&&(i=u,n=null),await c(n,i),r},isReady(){return!!(e&&e.readyState>=2&&e.videoWidth>0)},captureExactCrop(u=960,m=1280){if(!this.isReady())throw new Error("Camera is not ready yet. Please wait for video feed to load.");const b=e.videoWidth,x=e.videoHeight,f=u/m,g=b/x;let C,v,$,T;g>f?(T=x,$=Math.round(x*f),C=Math.round((b-$)/2),v=0):($=b,T=Math.round(b/f),C=0,v=Math.round((x-T)/2));const w=document.createElement("canvas");w.width=u,w.height=m;const d=w.getContext("2d",{willReadFrequently:!0});d.drawImage(e,C,v,$,T,0,0,u,m);const M=d.getImageData(0,0,u,m);return{canvas:w,ctx:d,imageData:M,rgba:M.data,width:u,height:m}},captureScreenBox(u,m,b=960,x=1280,f={}){if(!this.isReady())throw new Error("Camera is not ready yet. Please wait for video feed to load.");const g=e.videoWidth,C=e.videoHeight,v=m.getBoundingClientRect(),$=u.getBoundingClientRect(),T=v.width,w=v.height,d=Math.max(1,Number(f.zoom)||1),M=Number(f.panX)||0,G=Number(f.panY)||0,z=Math.max(T/g,w/C),K=g*z,te=C*z,Y=(T-K)/2,le=(w-te)/2,be=$.left-v.left,re=$.top-v.top,U=$.width,E=$.height,X=document.createElement("canvas");X.width=b,X.height=x;const Z=X.getContext("2d",{willReadFrequently:!0}),ve=T/2,de=w/2,Be=ve+d*(Y-ve)+M,Me=de+d*(le-de)+G,xe=b/U,Re=x/E,we=(Be-be)*xe,V=(Me-re)*Re,pe=K*d*xe,J=te*d*Re;Z.drawImage(e,0,0,g,C,we,V,pe,J);const Se=Z.getImageData(0,0,b,x);return{canvas:X,ctx:Z,imageData:Se,rgba:Se.data,width:b,height:x}},stop(){if(r){for(const u of r.getTracks())try{u.stop()}catch{}r=null}e&&(e.srcObject=null)}}}function fs(e){var o,n;const s=[],t=(i,r,c)=>s.push({field:i,en:r,bn:c});if(e.name||t("name","Template name is required","টেমপ্লেটের নাম আবশ্যক"),(!e.canonicalSize||!e.canonicalSize.w||!e.canonicalSize.h)&&t("canonicalSize","canonicalSize {w, h} is required","canonicalSize {w, h} আবশ্যক"),(typeof e.bubbleRadius!="number"||e.bubbleRadius<=0)&&t("bubbleRadius","bubbleRadius must be a positive number","bubbleRadius একটি ধনাত্মক সংখ্যা হতে হবে"),(!e.alignment||!Array.isArray(e.alignment.anchors)||e.alignment.anchors.length===0)&&t("alignment","alignment.anchors array is required","alignment.anchors অ্যারে আবশ্যক"),(!e.regions||typeof e.regions!="object"||Object.keys(e.regions).length===0)&&t("regions","At least one region is required","কমপক্ষে একটি অঞ্চল আবশ্যক"),e.alignment&&Array.isArray(e.alignment.anchors)){for(const i of e.alignment.anchors)if(i.id||t("alignment.anchors","Each anchor must have an id","প্রতিটি অ্যাঙ্করের একটি id থাকতে হবে"),(!Array.isArray(i.rect)||i.rect.length!==4)&&t("alignment.anchors",`Anchor "${i.id}" must have a rect [x1, y1, x2, y2]`,`অ্যাঙ্কর "${i.id}"-এ rect [x1, y1, x2, y2] থাকতে হবে`),e.canonicalSize&&i.rect){const[r,c,a,u]=i.rect;(a>e.canonicalSize.w||u>e.canonicalSize.h||r<0||c<0)&&t("alignment.anchors",`Anchor "${i.id}" rect is outside canvas`,`অ্যাঙ্কর "${i.id}" rect ক্যানভাসের বাইরে`)}}if(e.regions&&typeof e.regions=="object"){const i=((o=e.canonicalSize)==null?void 0:o.w)||9999,r=((n=e.canonicalSize)==null?void 0:n.h)||9999;for(const[c,a]of Object.entries(e.regions))if(a.type==="grid"){if(!Array.isArray(a.firstBubble)||a.firstBubble.length!==2){t(`regions.${c}`,"Grid region must have firstBubble [x, y]","গ্রিড অঞ্চলে firstBubble [x, y] থাকতে হবে");continue}if((typeof a.colPitch!="number"||typeof a.rowPitch!="number")&&t(`regions.${c}`,"Grid region must have colPitch and rowPitch","গ্রিড অঞ্চলে colPitch ও rowPitch থাকতে হবে"),(typeof a.rows!="number"||typeof a.cols!="number")&&t(`regions.${c}`,"Grid region must have rows and cols","গ্রিড অঞ্চলে rows ও cols থাকতে হবে"),!Array.isArray(a.labels))t(`regions.${c}`,"Grid region must have labels array","গ্রিড অঞ্চলে labels অ্যারে থাকতে হবে");else{const u=a.groupBy==="col"?a.rows:a.cols;a.labels.length!==u&&t(`regions.${c}`,`labels length (${a.labels.length}) must equal ${a.groupBy==="col"?"rows":"cols"} (${u})`,`labels দৈর্ঘ্য (${a.labels.length}) ${a.groupBy==="col"?"rows":"cols"} (${u})-এর সমান হতে হবে`)}if(a.firstBubble&&a.colPitch&&a.rowPitch&&a.rows&&a.cols){const[u,m]=a.firstBubble,b=a.radius||e.bubbleRadius||0,x=u+(a.cols-1)*a.colPitch+b,f=m+(a.rows-1)*a.rowPitch+b;(x>i||f>r||u-b<0||m-b<0)&&t(`regions.${c}`,"Grid extends outside canvas","গ্রিড ক্যানভাসের বাইরে চলে গেছে")}}else if(a.type==="choice"){if((!Array.isArray(a.bubbles)||a.bubbles.length===0)&&t(`regions.${c}`,"Choice region must have bubbles array","চয়েস অঞ্চলে bubbles অ্যারে থাকতে হবে"),(!Array.isArray(a.labels)||a.labels.length===0)&&t(`regions.${c}`,"Choice region must have labels array","চয়েস অঞ্চলে labels অ্যারে থাকতে হবে"),a.bubbles&&a.labels&&a.bubbles.length!==a.labels.length&&t(`regions.${c}`,`bubbles (${a.bubbles.length}) and labels (${a.labels.length}) must have equal length`,`bubbles (${a.bubbles.length}) ও labels (${a.labels.length}) দৈর্ঘ্য সমান হতে হবে`),a.bubbles)for(const[u,m]of a.bubbles){const b=a.radius||e.bubbleRadius||0;(u+b>i||m+b>r||u-b<0||m-b<0)&&t(`regions.${c}`,`Bubble at [${u},${m}] is outside canvas`,`[${u},${m}]-এ বুদবুদ ক্যানভাসের বাইরে`)}}else t(`regions.${c}`,`Unknown region type "${a.type}"`,`অজানা অঞ্চলের ধরন "${a.type}"`)}return{valid:s.length===0,errors:s}}function pt(e,s){const t=e.radius||s;if(e.type==="grid"){const[o,n]=e.firstBubble,i=[];if(e.groupBy==="row")for(let r=0;r<e.rows;r++){const c=[];for(let a=0;a<e.cols;a++)c.push({x:o+a*e.colPitch,y:n+r*e.rowPitch,r:t,label:e.labels[a]});i.push({groupIndex:r,questionNumber:e.startQ!==void 0?e.startQ+r:null,label:null,bubbles:c})}else for(let r=0;r<e.cols;r++){const c=[];for(let a=0;a<e.rows;a++)c.push({x:o+r*e.colPitch,y:n+a*e.rowPitch,r:t,label:e.labels[a]});i.push({groupIndex:r,label:null,bubbles:c})}return i}else if(e.type==="choice")return[{groupIndex:0,label:null,bubbles:e.bubbles.map((n,i)=>({x:n[0],y:n[1],r:t,label:e.labels[i]}))}];return[]}function Je(e){const s=fs(e);if(!s.valid)return{valid:!1,errors:s.errors,template:null,expandedRegions:null};const t={};for(const[o,n]of Object.entries(e.regions))t[o]=pt(n,e.bubbleRadius);return{valid:!0,errors:[],template:e,expandedRegions:t}}const Ue="omr_custom_template_ssc50";let tt=null,rt=null;const mt=new Set;function hs(e){return mt.add(e),()=>mt.delete(e)}function Xt(e){for(const s of mt)try{s(e)}catch(t){console.error("Error in template change listener:",t)}}function je(e){return JSON.parse(JSON.stringify(e))}async function st(){if(tt)return je(tt);const e=await fetch("/templates/ssc-50.json");if(!e.ok)throw new Error(`Failed to load default template: ${e.statusText}`);const s=await e.json();return tt=s,je(s)}async function Vt(){var t,o,n,i,r;try{const c=localStorage.getItem(Ue);if(c){const a=JSON.parse(c);if(a.name==="RCPSC-MCQ-50"&&(a.version||0)<2){const m=await st();for(const b of["roll","reg","subject","set","board"]){const x=(t=a.regions)==null?void 0:t[b],f=(o=m.regions)==null?void 0:o[b];if(!(!x||!f))if(x.type==="grid"&&f.type==="grid")for(const g of["firstBubble","colPitch","rowPitch"])x[g]=f[g];else x.type==="choice"&&f.type==="choice"&&(x.bubbles=je(f.bubbles))}a.version=m.version,localStorage.setItem(Ue,JSON.stringify(a))}if(a.name==="RCPSC-MCQ-50"&&(a.version||0)<3){const m=await st(),b=(n=a.regions)==null?void 0:n.roll;(b==null?void 0:b.type)==="grid"&&(b.firstBubble=[...m.regions.roll.firstBubble]);const x=(i=a.regions)==null?void 0:i.set;(x==null?void 0:x.type)==="choice"&&(x.bubbles=je(m.regions.set.bubbles)),a.version=m.version,localStorage.setItem(Ue,JSON.stringify(a))}if(a.name==="RCPSC-MCQ-50"&&(a.version||0)<4){const m=(r=a.regions)==null?void 0:r.board;if((m==null?void 0:m.type)==="choice"&&Array.isArray(m.bubbles)&&Array.isArray(m.labels)&&!m.labels.includes("Mymensingh")){const b=m.bubbles.at(-1),x=m.bubbles.at(-2),f=b&&x?b[1]-x[1]:34;b&&m.bubbles.push([b[0],b[1]+f]),m.labels.push("Mymensingh")}a.version=4,localStorage.setItem(Ue,JSON.stringify(a))}const u=Je(a);if(u.valid)return rt=u,u;console.warn("Stored custom template invalid, falling back to default:",u.errors)}}catch(c){console.warn("Could not read custom template from localStorage:",c)}const e=await st(),s=Je(e);return rt=s,s}function Gt(e){const s=Je(e);if(!s.valid)throw new Error(`Invalid template: ${s.errors.map(t=>t.en).join(", ")}`);try{localStorage.setItem(Ue,JSON.stringify(e))}catch(t){console.error("Failed to write to localStorage:",t)}return rt=s,Xt(s.template),s}async function vs(){try{localStorage.removeItem(Ue)}catch(t){console.error("Failed to remove custom template from localStorage:",t)}tt=null;const e=await st(),s=Je(e);return rt=s,Xt(s.template),s}function bt(e,{deltaX:s=0,deltaY:t=0,scaleX:o=1,scaleY:n=1,rotationDeg:i=0}){var f,g,C;const r=je(e),c=(((f=r.canonicalSize)==null?void 0:f.w)||960)/2,a=(((g=r.canonicalSize)==null?void 0:g.h)||1280)/2,u=i*Math.PI/180,m=Math.cos(u),b=Math.sin(u);function x(v,$){let T=v-c,w=$-a;if(T*=o,w*=n,i!==0){const d=T*m-w*b,M=T*b+w*m;T=d,w=M}return[Math.round((c+T+s)*10)/10,Math.round((a+w+t)*10)/10]}if(r.regions)for(const v of Object.values(r.regions))v.type==="grid"&&v.firstBubble?(v.firstBubble=x(v.firstBubble[0],v.firstBubble[1]),o!==1&&v.colPitch&&(v.colPitch=Math.round(v.colPitch*o*100)/100),n!==1&&v.rowPitch&&(v.rowPitch=Math.round(v.rowPitch*n*100)/100)):v.type==="choice"&&Array.isArray(v.bubbles)&&(v.bubbles=v.bubbles.map($=>x($[0],$[1])));if((C=r.alignment)!=null&&C.anchors){for(const v of r.alignment.anchors)if(Array.isArray(v.rect)&&v.rect.length===4){const[$,T]=x(v.rect[0],v.rect[1]),[w,d]=x(v.rect[2],v.rect[3]);v.rect=[Math.min($,w),Math.min(T,d),Math.max($,w),Math.max(T,d)]}}return r}function ys(e){const s=JSON.stringify(e,null,2),t=new Blob([s],{type:"application/json"}),o=URL.createObjectURL(t),n=document.createElement("a");n.href=o,n.download=`${e.name||"omr-template"}-calibrated.json`,document.body.appendChild(n),n.click(),document.body.removeChild(n),URL.revokeObjectURL(o)}function ws(e){const s=JSON.parse(e);return Gt(s)}const Ss=.65;function Cs(e,s,t,o,n,i,r=4){const c=i*.78,a=i*1.16,u=c*c,m=a*a,b=i*1.22,x=i*1.58;let f=0,g=0;for(let d=Math.max(0,Math.floor(n-x));d<=Math.min(t-1,Math.ceil(n+x));d++){const M=d-n,G=d*s*4;for(let z=Math.max(0,Math.floor(o-x));z<=Math.min(s-1,Math.ceil(o+x));z++){const K=z-o,te=K*K+M*M;if(te<b*b||te>x*x)continue;const Y=G+z*4;f+=.299*e[Y]+.587*e[Y+1]+.114*e[Y+2],g++}}const C=g?f/g:215,v=Math.max(45,Math.min(220,C-38));let $=o,T=n,w=-1;for(let d=-r;d<=r;d++){const M=n+d;if(!(M-a<0||M+a>=t))for(let G=-r;G<=r;G++){const z=o+G;if(z-a<0||z+a>=s)continue;let K=0,te=0;const Y=Math.floor(z-a),le=Math.ceil(z+a),be=Math.floor(M-a),re=Math.ceil(M+a);for(let X=be;X<=re;X++){const Z=X-M,ve=X*s*4;for(let de=Y;de<=le;de++){const Be=de-z,Me=Be*Be+Z*Z;if(Me<u||Me>m)continue;const xe=ve+de*4;.299*e[xe]+.587*e[xe+1]+.114*e[xe+2]<v&&K++,te++}}const U=te?K/te:0,E=Math.hypot(G,d)*.002;U-E>w&&(w=U-E,$=z,T=M)}}return{x:$,y:T,score:Math.max(0,w)}}const Fe=.45,et=.3;function ks(e,s,t,o,n,i){const r=i*Ss,c=r*r,a=i*1.08,u=i*1.42,m=a*a,b=u*u;let x=0,f=0;const g=Math.max(0,Math.floor(o-u)),C=Math.max(0,Math.floor(n-u)),v=Math.min(s-1,Math.ceil(o+u)),$=Math.min(t-1,Math.ceil(n+u));for(let Y=C;Y<=$;Y++){const le=Y-n,be=le*le,re=Y*s*4;for(let U=g;U<=v;U++){const E=U-o,X=E*E+be;if(X<m||X>b)continue;const Z=re+U*4;x+=.299*e[Z]+.587*e[Z+1]+.114*e[Z+2],f++}}const T=f?x/f:180,w=Math.max(60,Math.min(145,T-70)),d=Math.max(0,Math.floor(o-r)),M=Math.max(0,Math.floor(n-r)),G=Math.min(s-1,Math.ceil(o+r)),z=Math.min(t-1,Math.ceil(n+r));let K=0,te=0;for(let Y=M;Y<=z;Y++){const le=Y-n,be=le*le,re=Y*s*4;for(let U=d;U<=G;U++){const E=U-o;if(E*E+be<=c){te++;const X=re+U*4;.299*e[X]+.587*e[X+1]+.114*e[X+2]<w&&K++}}}return te>0?K/te:0}function Ls(e,s){const t=e.map((i,r)=>({ratio:i,label:s[r]})).sort((i,r)=>r.ratio-i.ratio),o=t[0],n=t.length>1?t[1]:{ratio:0};if(o.ratio<et)return{value:null,status:"BLANK",ratios:e,details:`All blank (max=${o.ratio.toFixed(3)})`};if(o.ratio>=Fe&&n.ratio<et)return{value:o.label,status:"OK",ratios:e,details:`${o.label}=${o.ratio.toFixed(3)}`};if(o.ratio>=Fe&&n.ratio>=et&&n.ratio<Fe)return{value:o.label,status:"OK",ratios:e,details:`${o.label}=${o.ratio.toFixed(3)} dominant`};if(o.ratio>=Fe&&n.ratio>=Fe){if(o.ratio>n.ratio*1.8)return{value:o.label,status:"OK",ratios:e,details:`${o.label} dominant`};const i=t.filter(r=>r.ratio>=Fe).map(r=>r.label).join(",");return{value:null,status:"MULTIPLE",ratios:e,details:`Multiple: ${i}`}}return o.ratio>=et?{value:o.label,status:"OK",ratios:e,details:`Partial ${o.label}=${o.ratio.toFixed(3)}`}:{value:null,status:"BLANK",ratios:e,details:"Uncertain/blank"}}function Ft(e,s,t,o,n,i={}){const{totalQuestions:r=50}=i,c={},a=[],u=[],m=[];for(const[b,x]of Object.entries(n)){const f=o.regions[b];if(f&&f.enabled===!1)continue;const g={groups:[]};for(const C of x){const v=[];for(const M of C.bubbles){const G=Cs(e,s,t,M.x,M.y,M.r),z=ks(e,s,t,G.x,G.y,M.r);v.push({label:M.label,nominalX:M.x,nominalY:M.y,snappedX:G.x,snappedY:G.y,snapScore:G.score,r:M.r,ratio:z}),m.push({region:b,groupIndex:C.groupIndex,questionNumber:C.questionNumber,...v[v.length-1]})}const $=v.map(M=>M.ratio),T=v.map(M=>M.label),w=Ls($,T),d=C.questionNumber!=null&&C.questionNumber>r&&(b==="answers_left"||b==="answers_right");d&&w.status!=="BLANK"&&a.push({question:C.questionNumber,value:w.value,status:w.status,ratios:w.ratios}),g.groups.push({groupIndex:C.groupIndex,questionNumber:C.questionNumber,bubbles:v,...w,isExtra:d})}c[b]=g}return a.length>0&&u.push(`Extra marks beyond Q${r}: ${a.map(b=>`Q${b.question}`).join(", ")}`),{regions:c,extraMarks:a,warnings:u,debugBubbles:m}}const Ut={en:{appTitle:"OMR Sheet Reader",appSubtitle:"Rajendrapur Cantonment Public School & College",processing:"Processing...",results:"Results",roll:"Roll Number",reg:"Registration Number",subject:"Subject Code",set:"Set Code",board:"Board",answers:"Answers",score:"Score",correct:"Correct",wrong:"Wrong",blank:"Blank",multiple:"Multiple",total:"Total",question:"Question",answer:"Answer",status:"Status",fillRatio:"Fill Ratio",alignment:"Alignment",stagesUsed:"Stages Used",residual:"Residual Error",warnings:"Warnings",quality:"Image Quality",blur:"Blur Score",brightness:"Brightness",debugOverlay:"Debug Overlay",debugTable:"Debug Table",region:"Region",bubble:"Bubble",snapped:"Snapped Center",noWarnings:"No warnings",templateError:"Template Error",alignmentFailed:"Alignment failed",poorQuality:"Poor image quality",language:"Language",examSettings:"Exam Settings",totalQuestions:"Total Questions",marksPerQuestion:"Marks per Question",negativeMarking:"Negative Marking",numberOfSets:"Number of Sets",run:"Run Pipeline",reset:"Reset",incomplete:"Incomplete",invalid:"Invalid",uncertain:"Uncertain",ok:"OK",extraMarks:"Extra marks found beyond total questions",blankSheet:"Blank sheet detected",setNotFilled:"Set code not filled — testing all sets, using highest score",rollPartial:"Partial roll number detected",rollBlank:"Roll number not filled",marksFound:"marks found",liveScan:"Live Scan",calibrationMode:"Template Calibrator",captureAndScore:"Capture & Score",scanNext:"Scan Next Sheet",ghostOpacity:"HUD Opacity",cameraSwitch:"Switch Camera",torch:"Flashlight",alignGuide:"Align sheet inside 3:4 frame & tap Capture",nudge:"Nudge",saveChanges:"Save to LocalStorage",resetDefault:"Reset to Default",exportJson:"Export JSON",importJson:"Import JSON",calibratedBadge:"Custom Calibrated",defaultBadge:"Default Template",globalControls:"Global Nudge & Scale",sectionControls:"Per-Section Fine Tuning",answersLeft:"Answers Q1-25 (Left)",answersRight:"Answers Q26-50 (Right)",rollSection:"Roll Number",regSection:"Registration Number",subjectSection:"Subject Code",setSection:"Set Code",boardSection:"Board",firstBubble:"First Bubble (X, Y)",colPitch:"Col Pitch (ΔX)",rowPitch:"Row Pitch (ΔY)",radius:"Radius",loadReferenceImage:"Load Sheet Image",cameraError:"Camera access denied or unavailable. Check permissions."},bn:{appTitle:"OMR শীট রিডার",appSubtitle:"রাজেন্দ্রপুর ক্যান্টনমেন্ট পাবলিক স্কুল ও কলেজ",processing:"প্রক্রিয়াকরণ হচ্ছে...",results:"ফলাফল",roll:"রোল নম্বর",reg:"রেজিস্ট্রেশন নম্বর",subject:"বিষয় কোড",set:"সেট কোড",board:"বোর্ড",answers:"উত্তর",score:"নম্বর",correct:"সঠিক",wrong:"ভুল",blank:"ফাঁকা",multiple:"একাধিক",total:"মোট",question:"প্রশ্ন",answer:"উত্তর",status:"অবস্থা",fillRatio:"পূরণ অনুপাত",alignment:"সারিবদ্ধকরণ",stagesUsed:"ব্যবহৃত ধাপ",residual:"অবশিষ্ট ত্রুটি",warnings:"সতর্কতা",quality:"ছবির মান",blur:"ঝাপসা স্কোর",brightness:"উজ্জ্বলতা",debugOverlay:"ডিবাগ ওভারলে",debugTable:"ডিবাগ টেবিল",region:"অঞ্চল",bubble:"বুদবুদ",snapped:"স্ন্যাপড কেন্দ্র",noWarnings:"কোনো সতর্কতা নেই",templateError:"টেমপ্লেট ত্রুটি",alignmentFailed:"সারিবদ্ধকরণ ব্যর্থ",poorQuality:"ছবির মান খারাপ",language:"ভাষা",examSettings:"পরীক্ষার সেটিংস",totalQuestions:"মোট প্রশ্ন",marksPerQuestion:"প্রশ্ন প্রতি নম্বর",negativeMarking:"নেগেটিভ মার্কিং",numberOfSets:"সেটের সংখ্যা",run:"পাইপলাইন চালান",reset:"রিসেট",incomplete:"অসম্পূর্ণ",invalid:"অবৈধ",uncertain:"অনিশ্চিত",ok:"ঠিক আছে",extraMarks:"মোট প্রশ্নের বাইরে অতিরিক্ত চিহ্ন পাওয়া গেছে",blankSheet:"ফাঁকা শীট শনাক্ত হয়েছে",setNotFilled:"সেট কোড পূরণ হয়নি — সব সেট পরীক্ষা করে সর্বোচ্চ নম্বর নেওয়া হচ্ছে",rollPartial:"আংশিক রোল নম্বর শনাক্ত হয়েছে",rollBlank:"রোল নম্বর পূরণ হয়নি",marksFound:"চিহ্ন পাওয়া গেছে",liveScan:"লাইভ স্ক্যান",calibrationMode:"টেমপ্লেট ক্যালিব্রেটর",captureAndScore:"ছবি তুলুন ও স্কোর করুন",scanNext:"পরের শীট স্ক্যান করুন",ghostOpacity:"ওভারলে অস্বচ্ছতা",cameraSwitch:"ক্যামেরা পরিবর্তন",torch:"ফ্ল্যাশলাইট",alignGuide:"৩:৪ ফ্রেমের ভেতরে শীটটি মিলিয়ে ক্যাপচার চাপুন",nudge:"স্থান পরিবর্তন",saveChanges:"লোকালস্টোরেজে সংরক্ষণ",resetDefault:"ডিফল্টে ফিরুন",exportJson:"JSON এক্সপোর্ট",importJson:"JSON ইমপোর্ট",calibratedBadge:"কাস্টম ক্যালিব্রেটেড",defaultBadge:"ডিফল্ট টেমপ্লেট",globalControls:"সার্বিক স্থান ও আকার পরিবর্তন",sectionControls:"বিভাগীয় সূক্ষ্ম সমন্বয়",answersLeft:"উত্তর ১-২৫ (বাম)",answersRight:"উত্তর ২৬-৫০ (ডান)",rollSection:"রোল নম্বর",regSection:"রেজিস্ট্রেশন নম্বর",subjectSection:"বিষয় কোড",setSection:"সেট কোড",boardSection:"বোর্ড",firstBubble:"প্রথম বুদবুদ (X, Y)",colPitch:"কলামের দূরত্ব (ΔX)",rowPitch:"সারির দূরত্ব (ΔY)",radius:"ব্যাসার্ধ",loadReferenceImage:"শীট ছবি লোড করুন",cameraError:"ক্যামেরা অ্যাক্সেস করা যায়নি। পারমিশন পরীক্ষা করুন।"}},Jt={A:"ক",B:"খ",C:"গ",D:"ঘ"};let at="en";function Bs(){return at=at==="en"?"bn":"en",at}function B(e){var s;return((s=Ut[at])==null?void 0:s[e])||Ut.en[e]||e}function gt(e){if(!e||!e.groups)return{value:"",complete:!1,warnings:["Region not found"]};const s=[],t=[];for(const i of e.groups)i.status==="BLANK"?s.push("?"):i.status==="MULTIPLE"?(s.push("!"),t.push(`Column ${i.groupIndex+1}: multiple marks / কলাম ${i.groupIndex+1}: একাধিক চিহ্ন`)):i.value!=null?s.push(i.value):s.push("?");const o=s.join(""),n=!o.includes("?")&&!o.includes("!");return{value:o,complete:n,warnings:t}}function Ms(e){const s=gt(e);if(!s.value||s.value.replace(/[?]/g,"").length===0)return{roll:null,complete:!1,partial:!1,warnings:["Roll number not filled / রোল নম্বর পূরণ হয়নি"]};const t=s.value,o=[...s.warnings];t.includes("!")&&o.push("Roll has invalid columns / রোলে অবৈধ কলাম আছে");let n=-1;for(let a=0;a<t.length;a++)if(t[a]!=="?"){n=a;break}if(n===-1)return{roll:null,complete:!1,partial:!1,warnings:o};const i=t.substring(n),r=i.includes("?")||n>0,c=i.replace(/\?/g,"");return r&&c.length>0&&o.push(`Partial roll number: ${c} / আংশিক রোল নম্বর: ${c}`),{roll:c||null,complete:s.complete,partial:r&&c.length>0,warnings:o}}function Rs(e){const s=gt(e);return{reg:s.value,complete:s.complete,warnings:s.warnings}}function Ts(e){const s=gt(e);return{subject:s.value,complete:s.complete,warnings:s.warnings}}function _t(e){if(!e||!e.groups||e.groups.length===0)return{set:null,banglaLabel:null,status:"BLANK",warnings:["Set region not found / সেট অঞ্চল পাওয়া যায়নি"]};const s=e.groups[0],t=[];if(s.status==="BLANK")return t.push("Set code not filled / সেট কোড পূরণ হয়নি"),{set:null,banglaLabel:null,status:"BLANK",warnings:t};if(s.status==="MULTIPLE")return t.push("Multiple set codes marked / একাধিক সেট কোড চিহ্নিত"),{set:null,banglaLabel:null,status:"MULTIPLE",warnings:t};const o=s.value,n=Jt[o]||null;return{set:o,banglaLabel:n,status:s.status,warnings:t}}function $s(e){if(!e||!e.groups||e.groups.length===0)return{board:null,status:"BLANK",warnings:[]};const s=e.groups[0];return s.status==="BLANK"?{board:null,status:"BLANK",warnings:[]}:s.status==="MULTIPLE"?{board:null,status:"MULTIPLE",warnings:["Multiple boards marked / একাধিক বোর্ড চিহ্নিত"]}:{board:s.value,status:s.status,warnings:[]}}function Wt(e,s,t=50){const o={},n={},i=[];if(e&&e.groups)for(const r of e.groups){if(r.questionNumber==null)continue;const c=r.questionNumber;c>t||(o[c]=r.value,n[c]=r.status)}if(s&&s.groups)for(const r of s.groups){if(r.questionNumber==null)continue;const c=r.questionNumber;c>t||(o[c]=r.value,n[c]=r.status)}for(let r=1;r<=t;r++)r in o||(o[r]=null,n[r]="BLANK");return{answers:o,statuses:n,warnings:i}}function qs(e,s=50){const{regions:t}=e,o=Ms(t.roll),n=Rs(t.reg),i=Ts(t.subject),r=_t(t.set),c=$s(t.board),{answers:a,statuses:u,warnings:m}=Wt(t.answers_left,t.answers_right,s),b=[...o.warnings,...n.warnings,...i.warnings,...r.warnings,...c.warnings,...m,...e.warnings];return{roll:o.roll,rollComplete:o.complete,rollPartial:o.partial,reg:n.reg,regComplete:n.complete,subject:i.subject,subjectComplete:i.complete,set:r.set,setBangla:r.banglaLabel,setStatus:r.status,board:c.board,boardStatus:c.status,answers:a,statuses:u,warnings:b,extraMarks:e.extraMarks}}function ot(e,s,t={},o={}){const{marksPerQ:n=1,negative:i=0,totalQuestions:r=50}=o;let c=0,a=0,u=0,m=0,b=0;const x=[];for(let g=1;g<=r;g++){const C=e[g],v=s[g],$=t[g]||"BLANK";let T;if($==="MULTIPLE"){m++,a++;const w=-Math.abs(i);b+=w,T={question:g,studentAnswer:null,correctAnswer:v,status:"MULTIPLE",marks:w,isCorrect:!1}}else if($==="BLANK"||C==null)u++,T={question:g,studentAnswer:null,correctAnswer:v,status:"BLANK",marks:0,isCorrect:!1};else{const w=String(C).toLowerCase().trim(),d=String(v).toLowerCase().trim();if(w===d)c++,b+=n,T={question:g,studentAnswer:w,correctAnswer:d,status:"CORRECT",marks:n,isCorrect:!0};else{a++;const M=-Math.abs(i);b+=M,T={question:g,studentAnswer:w,correctAnswer:d,status:"WRONG",marks:M,isCorrect:!1}}}x.push(T)}const f=r*n;return{correct:c,wrong:a,blank:u,multiple:m,score:b,total:f,perQuestion:x}}function As(e,s,t,o={}){const n={};let i=null,r=null;for(const[c,a]of Object.entries(t)){const u=ot(e,a,s,o);n[c]=u,(r===null||u.score>r.score)&&(i=c,r=u)}return{bestSet:i,bestScore:r,allScores:n}}function Es(e,s=50){const t=[],o={},n=new Set(["a","b","c","d"]);if(typeof e=="string"){const i=e.trim().toLowerCase(),r=/[,;\s]/.test(i)?i.split(/[,;\s]+/).filter(Boolean):[...i.replace(/[^a-d]/g,"")];r.length!==s&&t.push(`Expected ${s} answers, got ${r.length} / ${s}টি উত্তর প্রত্যাশিত, ${r.length}টি পাওয়া গেছে`);for(let c=0;c<r.length&&c<s;c++){const a=r[c];n.has(a)||t.push(`Q${c+1}: invalid answer "${a}" (must be a/b/c/d) / প্রশ্ন ${c+1}: অবৈধ উত্তর "${a}" (a/b/c/d হতে হবে)`),o[c+1]=a}}else if(typeof e=="object"&&e!==null){for(const[i,r]of Object.entries(e)){const c=parseInt(i,10);if(isNaN(c)||c<1||c>s){t.push(`Invalid question number: ${i} / অবৈধ প্রশ্ন নম্বর: ${i}`);continue}const a=String(r).toLowerCase().trim();n.has(a)||t.push(`Q${c}: invalid answer "${r}" (must be a/b/c/d) / প্রশ্ন ${c}: অবৈধ উত্তর "${r}" (a/b/c/d হতে হবে)`),o[c]=a}for(let i=1;i<=s;i++)i in o||t.push(`Missing answer for Q${i} / প্রশ্ন ${i}-এর উত্তর নেই`)}else t.push("Invalid answer key format / অবৈধ উত্তরমালার ফরম্যাট");return{key:o,valid:t.length===0,errors:t}}let Zt=null;function Qt(e){Zt=e||null}function zt(){return Zt}function Ht(e,s={}){let t=null,o=null,n=null,i=null,r=null,c=.55,a=!1,u=!1,m=!1,b="full",x=null,f=1,g=0,C=0;e.innerHTML=`
    <!-- FULL-SCREEN ROOT CONTAINER (covers entire screen) -->
    <div id="fullScreenScanner"
      class="fixed inset-0 w-screen h-[100dvh] z-40 bg-black overflow-hidden flex flex-col items-center justify-between select-none">

      <!-- LAYER 0: Camera-only viewport. Zoom and pan are clipped to this layer. -->
      <div id="cameraVideoViewport" class="absolute inset-0 z-0 overflow-hidden bg-black" style="isolation: isolate;">
        <video id="cameraVideo" autoplay playsinline muted
          class="absolute inset-0 w-full h-full object-cover"></video>
      </div>

      <!-- White Flash Overlay for Capture Feedback -->
      <div id="flashOverlay" class="absolute inset-0 bg-white pointer-events-none opacity-0 z-40 transition-opacity duration-150"></div>

      <!-- LAYER 1: Target Guide Frame with Darkened Surround Mask (Centers 3:4 sheet area) -->
      <div class="absolute inset-0 z-10 pointer-events-none flex items-center justify-center p-2 sm:p-3">
        <!-- 3:4 Sheet Target Box with Infinite Box-Shadow Mask -->
        <div id="scanTargetBox"
          class="relative rounded-2xl border border-cyan-400/50 flex items-center justify-center transition-all"
          style="width: min(94vw, calc((100dvh - 140px) * 0.75)); aspect-ratio: 3/4; max-height: calc(100dvh - 140px); box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.58);">

          <!-- GHOST TEMPLATE HUD CANVAS (Inside the 3:4 target area) -->
          <canvas id="ghostOverlayCanvas" width="960" height="1280"
            class="absolute inset-0 w-full h-full pointer-events-none transition-opacity"
            style="opacity: ${c};"></canvas>

          <!-- Center Crosshair Target -->
          <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div class="w-8 h-8 border-t border-b border-cyan-300/60"></div>
            <div class="w-8 h-8 border-l border-r border-cyan-300/60 absolute"></div>
          </div>
        </div>
      </div>

      <!-- LAYER 2: Floating Glassmorphic Top Controls Bar -->
      <div class="relative z-30 w-full px-2.5 pt-2.5 flex flex-col items-center gap-2 pointer-events-auto">
        <div class="w-full max-w-2xl min-w-0 p-1.5 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-slate-700/70 shadow-2xl overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-xs text-white">
          <div class="min-w-max flex items-center justify-between gap-1">

          <!-- Left: Quick Navigation Tabs (Live Scan / Calibrate) -->
          <div class="flex items-center gap-1">
            <button id="quickTabScan" class="px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-[11px] shadow-sm flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              <span>Scan</span>
            </button>
            <button id="toggleLiveReadBtn" class="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-200 text-[11px] font-semibold border border-cyan-700/60 transition-colors">
              Start Live Results
            </button>
            <button id="toggleQuickScanBtn" class="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-200 text-[11px] font-semibold border border-emerald-700/60 transition-colors">
              Quick Scan
            </button>
            <button id="toggleCameraAdjustBtn" class="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition-colors">Adjust View</button>
            <button id="quickTabCalib" class="px-2.5 py-1 rounded-xl hover:bg-slate-800 text-slate-300 text-[11px] font-medium transition-colors">
              Calibrate
            </button>
          </div>

          <!-- Right: Camera & HUD Utility Controls -->
          <div class="flex items-center gap-1">
            <!-- Torch / Flashlight -->
            <button id="torchBtn"
              class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-transform active:scale-95 disabled:opacity-40"
              title="${B("torch")}">
              <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
            </button>

            <!-- Ghost Opacity Slider Pill -->
            <div class="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900 border border-slate-700/60 text-[10px]">
              <span class="text-cyan-300 font-bold">HUD</span>
              <input type="range" id="opacitySlider" min="0.10" max="0.95" step="0.05" value="${c}"
                class="w-12 sm:w-16 accent-cyan-400 cursor-pointer">
              <span id="opacityLabel" class="font-mono text-cyan-200 w-5 text-right">${Math.round(c*100)}%</span>
            </div>

            <!-- Switch Camera -->
            <button id="switchCamBtn"
              class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-transform active:scale-95"
              title="${B("cameraSwitch")}">
              <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>

            <!-- Fullscreen Toggle -->
            <button id="toggleFullscreenBtn"
              class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-transform active:scale-95"
              title="Toggle Fullscreen">
              <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
              </svg>
            </button>

            <!-- Exam Settings Drawer Toggle -->
            <button id="toggleExamConfigBtn"
              class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-transform active:scale-95"
              title="${B("examSettings")}">
              <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </button>
          </div>
        </div>
        </div>

        <div id="cameraAdjustDrawer" class="hidden w-full max-w-2xl px-3 py-2 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-cyan-700/50 shadow-xl text-white">
          <div class="flex items-center justify-between gap-3">
            <label class="flex flex-1 min-w-0 items-center gap-2 text-[11px] text-slate-200">
              <span class="font-bold text-cyan-300">Zoom</span>
              <button id="cameraZoomOutBtn" type="button" class="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-base" aria-label="Zoom out by 0.01">−</button>
              <input id="cameraZoomSlider" type="range" min="0.5" max="3" step="0.01" value="1" class="flex-1 min-w-12 accent-cyan-400">
              <button id="cameraZoomInBtn" type="button" class="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-base" aria-label="Zoom in by 0.01">+</button>
              <input id="cameraZoomValue" type="number" min="0.5" max="3" step="0.01" value="1.00" aria-label="Camera zoom value" class="w-14 rounded bg-slate-900 border border-slate-700 px-1 py-1 text-center font-mono text-xs">
              <span class="text-[10px] text-slate-300">×</span>
            </label>
            <button id="resetCameraViewBtn" class="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[10px]">Reset</button>
          </div>
          <div class="mt-2 flex items-center justify-center gap-1.5">
            <span class="mr-1 text-[10px] text-slate-400">Move view</span>
            <button data-camera-pan="0,-1" class="camera-pan-btn w-8 h-7 rounded-lg bg-slate-800 border border-slate-700 text-cyan-200" aria-label="Move camera view up">▲</button>
            <button data-camera-pan="-1,0" class="camera-pan-btn w-8 h-7 rounded-lg bg-slate-800 border border-slate-700 text-cyan-200" aria-label="Move camera view left">◀</button>
            <button data-camera-pan="0,1" class="camera-pan-btn w-8 h-7 rounded-lg bg-slate-800 border border-slate-700 text-cyan-200" aria-label="Move camera view down">▼</button>
            <button data-camera-pan="1,0" class="camera-pan-btn w-8 h-7 rounded-lg bg-slate-800 border border-slate-700 text-cyan-200" aria-label="Move camera view right">▶</button>
            <label class="ml-1 flex items-center gap-1 text-[9px] text-slate-400">Step
              <input id="cameraPanStepInput" type="number" min="0.01" max="24" step="0.01" value="1" class="w-12 rounded bg-slate-900 border border-slate-700 px-1 py-1 text-center font-mono text-slate-200">
            </label>
            <span id="cameraPanLabel" class="ml-1 min-w-20 text-[9px] font-mono text-slate-400">X 0.00 · Y 0.00</span>
          </div>
        </div>

        <!-- Collapsible Answer Key / Exam Configuration Drawer -->
        <div id="examConfigDrawer" class="hidden w-full max-w-xl p-3.5 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-slate-700 shadow-2xl text-xs text-white">
          <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800">
            <span class="font-bold text-omr-accent">${B("examSettings")} & Answer Keys</span>
            <button id="closeConfigDrawerBtn" class="p-1 text-slate-400 hover:text-white">✕</button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-2.5">
            <div>
              <label class="text-omr-text-muted block mb-0.5">${B("totalQuestions")}</label>
              <input type="number" id="camTotalQ" value="50" min="1" max="50"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white">
            </div>
            <div>
              <label class="text-omr-text-muted block mb-0.5">${B("marksPerQuestion")}</label>
              <input type="number" id="camMarksPerQ" value="1" min="0.25" step="0.25"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white">
            </div>
            <div>
              <label class="text-omr-text-muted block mb-0.5">${B("negativeMarking")}</label>
              <input type="number" id="camNegMark" value="0.25" min="0" step="0.05"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white">
            </div>
          </div>

          <!-- All 4 Sets A, B, C, D (No optional text) -->
          <div class="space-y-1.5">
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-bold text-cyan-400 w-16">Set A (ক):</span>
              <input type="text" id="camKeyA" placeholder="a,b,c,d,a,b,c,d..." class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-mono text-white">
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-bold text-cyan-400 w-16">Set B (খ):</span>
              <input type="text" id="camKeyB" placeholder="a,b,c,d,a,b,c,d..." class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-mono text-white">
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-bold text-cyan-400 w-16">Set C (গ):</span>
              <input type="text" id="camKeyC" placeholder="a,b,c,d,a,b,c,d..." class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-mono text-white">
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-bold text-cyan-400 w-16">Set D (ঘ):</span>
              <input type="text" id="camKeyD" placeholder="a,b,c,d,a,b,c,d..." class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-mono text-white">
            </div>
          </div>
        </div>
      </div>

      <!-- Continuous live results overlay -->
      <div id="liveReadout" class="hidden absolute z-20 left-3 right-3 top-[6.8rem] max-w-2xl mx-auto p-2 rounded-xl bg-slate-950/80 border border-cyan-500/50 shadow-xl text-white pointer-events-none">
        <div class="flex items-center justify-between gap-2 mb-1">
          <span id="liveReadTitle" class="text-[10px] font-bold text-cyan-300">LIVE OMR RESULTS</span>
          <span id="liveReadStatus" class="text-[9px] text-slate-200 truncate">Align the sheet inside the guide</span>
        </div>
        <div class="grid grid-cols-4 gap-1 text-center">
          <div id="liveRollCard" class="rounded-lg bg-slate-800/80 px-1 py-1"><div class="text-[8px] text-slate-300 uppercase">Roll</div><div id="liveReadRoll" class="text-xs font-mono font-bold text-cyan-100 truncate">--</div></div>
          <div id="liveSetCard" class="rounded-lg bg-slate-800/80 px-1 py-1"><div class="text-[8px] text-slate-300 uppercase">Set</div><div id="liveReadSet" class="text-xs font-mono font-bold text-purple-100">--</div></div>
          <div class="rounded-lg bg-slate-800/80 px-1 py-1"><div class="text-[8px] text-slate-300 uppercase">Filled</div><div id="liveReadFilled" class="text-xs font-mono font-bold text-amber-100">--</div></div>
          <div class="rounded-lg bg-slate-800/80 px-1 py-1"><div class="text-[8px] text-slate-300 uppercase">Correct</div><div id="liveReadCorrect" class="text-xs font-mono font-bold text-emerald-200">--</div></div>
        </div>
      </div>

      <!-- LAYER 3: Floating Bottom Shutter Bar -->
      <div id="captureBar" class="relative z-30 w-full px-4 pb-4 flex flex-col items-center gap-1.5 pointer-events-auto">
        <!-- Target Alignment Pill -->
        <span class="px-3 py-0.5 rounded-full bg-slate-950/75 backdrop-blur-md text-[10px] sm:text-[11px] text-cyan-200 border border-cyan-500/30 shadow-lg">
          🎯 Fit the full sheet inside the blue guides; small bubble shifts auto-correct
        </span>

        <!-- Circular Tactile Camera Shutter Button (Trigger on pointerdown for 0ms anti-shake latency) -->
        <button id="captureBtn"
          class="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-1 shadow-2xl shadow-emerald-500/30 flex items-center justify-center transition-transform active:scale-90 hover:scale-105 disabled:opacity-50">
          <div class="w-full h-full rounded-full border-2 border-white/80 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
            <svg class="w-7 h-7 sm:w-9 sm:h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
        </button>
      </div>

      <!-- Camera Loading & Insecure Origin / Permission Overlay -->
      <div id="cameraLoadingOverlay" class="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-50">
        <svg class="animate-spin w-11 h-11 text-cyan-400 mb-3" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <p class="text-white text-base font-semibold">Starting Live Camera...</p>
        <p class="text-xs text-omr-text-muted mt-1">Please allow camera permissions if prompted</p>
      </div>
    </div>

    <!-- Complete Evaluation Results Modal matching Upload Tab Format -->
    <div id="resultsModal" class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md hidden flex items-center justify-center p-2 sm:p-4">
      <div class="relative w-full max-w-3xl max-h-[94vh] bg-omr-bg-card rounded-2xl md:rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col animate-fadeIn">

        <!-- Modal Top Bar: Status & Close -->
        <div class="p-3.5 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div id="modalScoreCircle" class="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
              0
            </div>
            <div>
              <div id="modalStatusBadge" class="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <span>✅ Pipeline complete in 18 ms</span>
              </div>
              <p id="modalSpeedBadge" class="text-[11px] text-omr-text-muted font-mono">Bubbles sampled: 400 • Direct pixel sampling</p>
            </div>
          </div>
          <button id="closeModalBtn" class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Modal Sub-Tabs: Score & Decoded | Bubble Overlay | Debug Table -->
        <div class="px-4 pt-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2">
          <button id="modalTabScore" class="modal-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-omr-primary text-white transition-all">
            📊 ${B("score")} & ${B("results")}
          </button>
          <button id="modalTabOverlay" class="modal-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all">
            🔍 ${B("debugOverlay")}
          </button>
          <button id="modalTabTable" class="modal-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all">
            🔬 ${B("debugTable")}
          </button>
          <button id="modalTabReport" class="modal-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all">
            📋 Session Report
          </button>
        </div>

        <!-- Modal Scrollable Content Container -->
        <div class="p-4 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1">

          <!-- SECTION 1: SCORE & DECODED (Default active) -->
          <div id="modalSecScore" class="space-y-4">
            <!-- Score Card (Matching Upload Tab) -->
            <div id="camScoreCard" class="p-4 rounded-2xl bg-slate-900/80 border border-slate-700/80 shadow-md">
              <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span class="text-sm font-bold text-white uppercase tracking-wider">${B("score")} Summary</span>
                <span id="scoreSetBadge" class="text-xs font-mono px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60">Set A</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div class="p-2 rounded-xl bg-slate-800/60">
                  <div class="text-[10px] text-omr-text-muted font-bold">${B("score")}</div>
                  <div id="camScoreNum" class="text-xl font-black text-emerald-400">--</div>
                </div>
                <div class="p-2 rounded-xl bg-slate-800/60">
                  <div class="text-[10px] text-omr-text-muted font-bold">${B("correct")}</div>
                  <div id="camScoreCorrect" class="text-xl font-bold text-emerald-400">--</div>
                </div>
                <div class="p-2 rounded-xl bg-slate-800/60">
                  <div class="text-[10px] text-omr-text-muted font-bold">${B("wrong")}</div>
                  <div id="camScoreWrong" class="text-xl font-bold text-rose-400">--</div>
                </div>
                <div class="p-2 rounded-xl bg-slate-800/60">
                  <div class="text-[10px] text-omr-text-muted font-bold">${B("blank")}</div>
                  <div id="camScoreBlank" class="text-xl font-bold text-slate-400">--</div>
                </div>
              </div>
            </div>

            <!-- Student Metadata Pills -->
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div class="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                <div class="text-[9px] uppercase font-bold text-omr-text-muted">${B("roll")}</div>
                <div id="resRoll" class="text-sm sm:text-base font-bold font-mono text-cyan-300">--</div>
              </div>
              <div class="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                <div class="text-[9px] uppercase font-bold text-omr-text-muted">${B("reg")}</div>
                <div id="resReg" class="text-sm sm:text-base font-bold font-mono text-cyan-300">--</div>
              </div>
              <div class="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                <div class="text-[9px] uppercase font-bold text-omr-text-muted">${B("subject")}</div>
                <div id="resSubject" class="text-sm sm:text-base font-bold font-mono text-cyan-300">--</div>
              </div>
              <div class="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                <div class="text-[9px] uppercase font-bold text-omr-text-muted">${B("set")}</div>
                <div id="resSet" class="text-sm sm:text-base font-bold font-mono text-purple-300">--</div>
              </div>
              <div class="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center col-span-2 sm:col-span-1">
                <div class="text-[9px] uppercase font-bold text-omr-text-muted">${B("board")}</div>
                <div id="resBoard" class="text-sm sm:text-base font-bold font-mono text-amber-300">--</div>
              </div>
            </div>

            <!-- Warnings / Extra marks notification -->
            <div id="resWarningsContainer" class="hidden p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
            </div>

            <!-- Question Answer Breakdown Grid (Q1-50) -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-bold text-white uppercase tracking-wider">${B("answers")} (Q1–50)</h4>
                <div class="flex items-center gap-2 text-[10px] text-omr-text-muted">
                  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> ${B("correct")}</span>
                  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> ${B("wrong")}</span>
                  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-slate-600 inline-block"></span> ${B("blank")}</span>
                </div>
              </div>
              <div id="questionsGrid" class="grid grid-cols-5 sm:grid-cols-10 gap-1.5 max-h-56 overflow-y-auto p-1.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <!-- Rendered dynamically -->
              </div>
            </div>
          </div>

          <!-- SECTION 2: BUBBLE OVERLAY PREVIEW (Matching Upload Tab drawOverlay) -->
          <div id="modalSecOverlay" class="hidden flex flex-col items-center space-y-2">
            <p class="text-xs text-omr-text-muted">Direct visual overlay showing every sampled bubble, fill ratios, and detection decisions.</p>
            <div class="w-full flex justify-center bg-slate-950 p-2 rounded-xl border border-slate-800 overflow-auto max-h-[65vh]">
              <canvas id="cropPreviewCanvas" class="max-h-[60vh] w-auto rounded-lg shadow-xl"></canvas>
            </div>
          </div>

          <!-- SECTION 3: DEBUG TABLE (Matching Upload Tab Debug Table) -->
          <div id="modalSecTable" class="hidden space-y-2">
            <p class="text-xs text-omr-text-muted">Detailed raw pixel sampling data per bubble:</p>
            <div class="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-xl border border-slate-800">
              <table class="w-full text-xs text-left">
                <thead class="sticky top-0 bg-slate-800 text-omr-text-muted">
                  <tr>
                    <th class="px-2 py-1.5">${B("region")}</th>
                    <th class="px-2 py-1.5">Q#</th>
                    <th class="px-2 py-1.5">${B("bubble")}</th>
                    <th class="px-2 py-1.5">${B("fillRatio")}</th>
                    <th class="px-2 py-1.5">${B("status")}</th>
                    <th class="px-2 py-1.5">${B("snapped")}</th>
                  </tr>
                </thead>
                <tbody id="camDebugTableBody" class="text-slate-300 divide-y divide-slate-800/60 font-mono">
                  <!-- Rendered dynamically -->
                </tbody>
              </table>
            </div>
          </div>

          <div id="modalSecReport" class="hidden space-y-2">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs text-omr-text-muted">Scanned sheets in this session. Copy the tab-separated report into a spreadsheet.</p>
              <div class="flex shrink-0 gap-2">
                <button id="copyReportBtn" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">Copy report</button>
                <button id="clearReportBtn" class="px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800">Clear report</button>
              </div>
            </div>
            <div class="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-xl border border-slate-800">
              <table class="w-full text-xs text-left">
                <thead class="sticky top-0 bg-slate-800 text-omr-text-muted"><tr>
                  <th class="px-2 py-1.5">#</th><th class="px-2 py-1.5">Roll</th><th class="px-2 py-1.5">Reg. No.</th>
                  <th class="px-2 py-1.5">Sub Code</th><th class="px-2 py-1.5">Board</th><th class="px-2 py-1.5">Set code</th>
                  <th class="px-2 py-1.5">Total mark</th><th class="px-2 py-1.5">Total filled</th><th class="px-2 py-1.5">Obtained mark</th>
                </tr></thead>
                <tbody id="sessionReportBody" class="text-slate-300 divide-y divide-slate-800/60 font-mono"></tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- Modal Footer Actions -->
        <div class="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <button id="copySummaryBtn" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
            </svg>
            <span>Copy Text</span>
          </button>

          <button id="scanNextSheetBtn" class="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span>${B("scanNext")}</span>
          </button>
        </div>
      </div>
    </div>
  `;const v=e.querySelector("#fullScreenScanner"),$=e.querySelector("#cameraVideo"),T=e.querySelector("#scanTargetBox"),w=e.querySelector("#ghostOverlayCanvas"),d=w.getContext("2d"),M=e.querySelector("#flashOverlay"),G=e.querySelector("#opacitySlider"),z=e.querySelector("#opacityLabel"),K=e.querySelector("#torchBtn"),te=e.querySelector("#switchCamBtn"),Y=e.querySelector("#toggleFullscreenBtn"),le=e.querySelector("#captureBtn"),be=e.querySelector("#captureBar"),re=e.querySelector("#toggleLiveReadBtn"),U=e.querySelector("#toggleQuickScanBtn"),E=e.querySelector("#liveReadout"),X=e.querySelector("#liveReadTitle"),Z=e.querySelector("#liveReadStatus"),ve=e.querySelector("#liveRollCard"),de=e.querySelector("#liveSetCard"),Be=e.querySelector("#liveReadRoll"),Me=e.querySelector("#liveReadSet"),xe=e.querySelector("#liveReadFilled"),Re=e.querySelector("#liveReadCorrect"),we=e.querySelector("#cameraLoadingOverlay"),V=e.querySelector("#toggleCameraAdjustBtn"),pe=e.querySelector("#cameraAdjustDrawer"),J=e.querySelector("#cameraZoomSlider"),Se=e.querySelector("#cameraZoomOutBtn"),_e=e.querySelector("#cameraZoomInBtn"),nt=e.querySelector("#cameraPanStepInput"),Pe=e.querySelector("#cameraZoomValue"),We=e.querySelector("#cameraPanLabel"),h=e.querySelector("#resetCameraViewBtn"),y=e.querySelector("#toggleExamConfigBtn"),q=e.querySelector("#examConfigDrawer"),I=e.querySelector("#closeConfigDrawerBtn"),F=["camTotalQ","camMarksPerQ","camNegMark","camKeyA","camKeyB","camKeyC","camKeyD"].map(l=>e.querySelector(`#${l}`)),_="omr-exam-config-v1";try{const l=JSON.parse(localStorage.getItem(_)||"null");if(l)for(const p of F)p&&Object.hasOwn(l,p.id)&&(p.value=l[p.id])}catch{}const W=()=>{try{const l=Object.fromEntries(F.filter(Boolean).map(p=>[p.id,p.value]));localStorage.setItem(_,JSON.stringify(l))}catch{}};F.forEach(l=>l==null?void 0:l.addEventListener("input",W)),e.querySelector("#quickTabCalib").addEventListener("click",()=>{s.onNavigate&&s.onNavigate("calibration")});const H=e.querySelector("#resultsModal"),ne=e.querySelector("#closeModalBtn"),ie=e.querySelector("#scanNextSheetBtn"),ce=e.querySelector("#copySummaryBtn"),fe=e.querySelector("#modalTabScore"),ee=e.querySelector("#modalTabOverlay"),Oe=e.querySelector("#modalTabTable"),De=e.querySelector("#modalTabReport"),Te=e.querySelector("#modalSecScore"),ft=e.querySelector("#modalSecOverlay"),ht=e.querySelector("#modalSecTable"),vt=e.querySelector("#modalSecReport"),yt=e.querySelector("#sessionReportBody"),lt=e.querySelector("#copyReportBtn"),ts=e.querySelector("#clearReportBtn"),ze=e.querySelector("#modalScoreCircle"),ss=e.querySelector("#modalStatusBadge"),as=e.querySelector("#modalSpeedBadge"),wt=e.querySelector("#camScoreNum"),St=e.querySelector("#camScoreCorrect"),Ct=e.querySelector("#camScoreWrong"),kt=e.querySelector("#camScoreBlank"),Lt=e.querySelector("#scoreSetBadge"),Bt=e.querySelector("#resRoll"),Mt=e.querySelector("#resReg"),Rt=e.querySelector("#resSubject"),os=e.querySelector("#resSet"),rs=e.querySelector("#resBoard"),it=e.querySelector("#resWarningsContainer"),Tt=e.querySelector("#questionsGrid"),Ze=e.querySelector("#cropPreviewCanvas"),ns=e.querySelector("#camDebugTableBody");let He=null;const ct="omr-session-report-v1";let he=[];try{he=JSON.parse(sessionStorage.getItem(ct)||"[]")}catch{he=[]}Array.isArray(he)||(he=[]),he=he.map(l=>({...l,reg:l.reg||"--",subject:l.subject||"--",board:l.board||"--",roll:l.roll||"--",set:l.set||"--"})),dt();function dt(){yt&&(yt.innerHTML=he.map((l,p)=>`<tr>
      <td class="px-2 py-1.5">${p+1}</td><td class="px-2 py-1.5">${Ke(l.roll)}</td>
      <td class="px-2 py-1.5">${Ke(l.reg)}</td><td class="px-2 py-1.5">${Ke(l.subject)}</td>
      <td class="px-2 py-1.5">${Ke(l.board)}</td><td class="px-2 py-1.5">${Ke(l.set)}</td><td class="px-2 py-1.5">${l.totalMark}</td>
      <td class="px-2 py-1.5">${l.filled}</td><td class="px-2 py-1.5">${l.obtained}</td></tr>`).join(""))}function Ke(l){return String(l??"").replace(/[&<>"']/g,p=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[p])}function $t(){var qe,Ae,O;if(!o||!n)return;const l=((qe=o.canonicalSize)==null?void 0:qe.w)||960,p=((Ae=o.canonicalSize)==null?void 0:Ae.h)||1280;w.width=l,w.height=p,d.clearRect(0,0,l,p),d.strokeStyle="rgba(255, 255, 255, 0.45)",d.lineWidth=2,d.setLineDash([16,12]);const R=22,k=22;d.strokeRect(R,k,l-R*2,p-k*2),d.setLineDash([]);const N=50;d.strokeStyle="#2563eb",d.lineWidth=6,d.lineCap="round",d.lineJoin="round";const se=R,ae=k;d.beginPath(),d.moveTo(se,ae+N),d.lineTo(se,ae),d.lineTo(se+N,ae),d.stroke();const me=l-R,Ce=k;d.beginPath(),d.moveTo(me-N,Ce),d.lineTo(me,Ce),d.lineTo(me,Ce+N),d.stroke();const $e=R,ke=p-k;d.beginPath(),d.moveTo($e,ke-N),d.lineTo($e,ke),d.lineTo($e+N,ke),d.stroke();const oe=l-R,ye=p-k;if(d.beginPath(),d.moveTo(oe-N,ye),d.lineTo(oe,ye),d.lineTo(oe,ye-N),d.stroke(),(O=o.alignment)!=null&&O.anchors){d.strokeStyle="rgba(255, 255, 255, 0.40)",d.lineWidth=1.6,d.font="bold 13px Inter, sans-serif",d.fillStyle="rgba(255, 255, 255, 0.65)";for(const S of o.alignment.anchors){if(!S.rect)continue;const[D,A,j,P]=S.rect,ue=j-D,Ee=P-A;d.strokeRect(D,A,ue,Ee);const Ie=S.id==="table_left"?"Q 1 - 25":S.id==="table_right"?"Q 26 - 50":S.id==="roll_box"?"ROLL":S.id==="reg_box"?"REG":S.id;d.fillText(Ie,D+6,A-4)}}d.lineWidth=2;for(const[S,D]of Object.entries(n)){const A=S.startsWith("answers");d.strokeStyle=A?"rgba(6, 182, 212, 0.95)":"rgba(52, 211, 153, 0.95)",d.fillStyle=A?"rgba(6, 182, 212, 0.35)":"rgba(52, 211, 153, 0.35)";for(const j of D)for(const P of j.bubbles)d.beginPath(),d.arc(P.x,P.y,P.r,0,Math.PI*2),d.stroke(),d.beginPath(),d.arc(P.x,P.y,1.4,0,Math.PI*2),d.fill()}}G.addEventListener("input",l=>{c=parseFloat(l.target.value),w.style.opacity=c,z.textContent=`${Math.round(c*100)}%`}),Y.addEventListener("click",()=>{var l,p,R;document.fullscreenElement?(R=document.exitFullscreen)==null||R.call(document).catch(()=>{}):(p=(l=document.documentElement).requestFullscreen)==null||p.call(l).catch(()=>{})}),y.addEventListener("click",()=>{q.classList.toggle("hidden")}),I==null||I.addEventListener("click",()=>{q.classList.add("hidden")});function Ye(){$.style.transformOrigin="center center",$.style.transform=`translate3d(${g}px, ${C}px, 0) scale(${f})`,Pe.value=f.toFixed(2),We.textContent=`X ${g.toFixed(2)} · Y ${C.toFixed(2)}`}V.addEventListener("click",()=>{pe.classList.toggle("hidden"),q.classList.add("hidden")}),J.addEventListener("input",()=>{f=Number(J.value),Ye()}),Pe.addEventListener("change",()=>{const l=Number(Pe.value);f=Math.max(.5,Math.min(3,Number.isFinite(l)?l:1)),f=Math.round(f*100)/100,J.value=String(f),Ye()});function qt(l){f=Math.max(.5,Math.min(3,Math.round((f+l)*100)/100)),J.value=String(f),Ye()}Se.addEventListener("click",()=>qt(-.01)),_e.addEventListener("click",()=>qt(.01)),e.querySelectorAll(".camera-pan-btn").forEach(l=>{l.addEventListener("click",()=>{const[p,R]=l.dataset.cameraPan.split(",").map(Number),k=Math.max(.01,Math.min(24,Number(nt.value)||1));g=Math.max(-500,Math.min(500,Math.round((g+p*k)*100)/100)),C=Math.max(-500,Math.min(500,Math.round((C+R*k)*100)/100)),Ye()})}),h.addEventListener("click",()=>{f=1,g=0,C=0,J.value="1",Pe.value="1.00",Ye()});async function At(){var l;try{we.classList.remove("hidden"),t=await xs($,{facingMode:"environment"}),t.hasTorch()?K.disabled=!1:(K.disabled=!0,K.classList.add("opacity-40")),we.classList.add("hidden")}catch(p){console.error("Camera startup failed:",p);const R=Yt(),k=window.location.hostname,N=window.location.port||"5173",se=`https://${k}:${N}`;!R||p.code==="INSECURE_CONTEXT"?we.innerHTML=`
          <div class="max-w-sm text-center p-4 bg-slate-900/90 rounded-3xl border border-slate-700 shadow-2xl animate-fadeIn">
            <div class="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h3 class="font-bold text-sm text-white mb-1">HTTPS Required for Mobile Camera</h3>
            <p class="text-[11px] text-slate-300 mb-3 leading-relaxed">
              Chrome on Android requires <span class="text-emerald-400 font-mono font-bold">HTTPS</span> to access the camera.
            </p>

            <div>
              <a href="${se}" class="block w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition-transform active:scale-95">
                👉 Open HTTPS (${se})
              </a>
            </div>

            <p class="text-[10px] text-slate-400 mt-3 border-t border-slate-800 pt-2">
              Tip: Tap <strong>"Advanced"</strong> → <strong>"Proceed to ${k}"</strong> once to accept the local dev certificate.
            </p>
          </div>
        `:(we.innerHTML=`
          <div class="max-w-xs text-center p-4 bg-slate-900/90 rounded-3xl border border-slate-700 text-rose-400 animate-fadeIn">
            <svg class="w-10 h-10 mx-auto mb-2 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <p class="font-bold text-sm text-white mb-1">${B("cameraError")}</p>
            <p class="text-[11px] text-slate-400 mb-3">${p.message}</p>
            <div class="flex items-center gap-2 justify-center">
              <button id="retryCamBtn" class="px-4 py-2 rounded-xl bg-omr-primary hover:bg-omr-primary-dark text-white text-xs font-semibold">
                Retry Camera
              </button>
            </div>
          </div>
        `,(l=we.querySelector("#retryCamBtn"))==null||l.addEventListener("click",()=>At()))}}te.addEventListener("click",async()=>{if(t)try{await t.switchCamera("toggle"),a=!1,K.classList.remove("bg-amber-500/30","text-amber-300")}catch(l){console.warn("Switch camera error:",l)}}),K.addEventListener("click",async()=>{if(!t||!t.hasTorch())return;a=!a,await t.setTorch(a)?a?K.classList.add("bg-amber-500/30","text-amber-300"):K.classList.remove("bg-amber-500/30","text-amber-300"):a=!1});function ls(l,p,R,k){Be.textContent=l.roll||"--",Me.textContent=l.set||"--",xe.textContent=String(Object.values(l.statuses||{}).filter(N=>N!=="BLANK").length),Re.textContent=p?String(p.correct):"--",Z.textContent=p?`${R} · ${p.score}/${p.total}`:R.includes("key")||R==="Invalid answer key"?`${R} · check answer key`:"Sheet detected · no valid answer key"}function Et(l){var k,N;const p={},R=[];for(const se of["A","B","C","D"]){const ae=(N=(k=e.querySelector(`#camKey${se}`))==null?void 0:k.value)==null?void 0:N.trim();if(!ae)continue;const me=Es(ae,l);me.valid?p[se]=me.key:R.push(`Set ${se}: ${me.errors[0]}`)}return{keysBySet:p,invalidKeys:R}}function is(l,p,R,k,N=""){X.textContent="QUICK ANSWER SCAN",E.querySelector(".grid").classList.replace("grid-cols-4","grid-cols-2"),ve.classList.add("hidden"),de.classList.add("hidden"),xe.textContent=String(Object.values(p||{}).filter(se=>se!=="BLANK").length),Re.textContent=k?String(k.correct):"--",Z.textContent=k?"Live scanning":N?"Invalid answer key":R?"Answer key unavailable":"Reading sheet…"}function Nt(l){b=l,m=!0,E.classList.remove("hidden"),be.classList.add("hidden"),E.querySelector(".grid").classList.toggle("grid-cols-4",l==="full"),E.querySelector(".grid").classList.toggle("grid-cols-2",l==="light"),ve.classList.toggle("hidden",l==="light"),de.classList.toggle("hidden",l==="light"),X.textContent=l==="light"?"QUICK ANSWER SCAN":"LIVE OMR RESULTS",re.textContent=l==="full"?"Stop Live Results":"Start Live Results",U.textContent=l==="light"?"Stop Quick Scan":"Quick Scan",re.classList.toggle("bg-cyan-900/80",l==="full"),re.classList.toggle("border-cyan-400",l==="full"),U.classList.toggle("bg-emerald-900/80",l==="light"),U.classList.toggle("border-emerald-400",l==="light"),Z.textContent=l==="light"?"Reading answers and set only…":"Reading camera frames…",Pt()}function jt(){m=!1,clearTimeout(x),E.classList.add("hidden"),be.classList.remove("hidden"),re.textContent="Start Live Results",U.textContent="Quick Scan",re.classList.remove("bg-cyan-900/80","border-cyan-400"),U.classList.remove("bg-emerald-900/80","border-emerald-400"),E.querySelector(".grid").classList.replace("grid-cols-2","grid-cols-4"),ve.classList.remove("hidden"),de.classList.remove("hidden")}async function Pt(){m&&(await ut({continuous:!0,lightweight:b==="light"}),m&&(x=setTimeout(Pt,500)))}re.addEventListener("click",()=>{m&&b==="full"?jt():Nt("full")}),U.addEventListener("click",()=>{m&&b==="light"?jt():Nt("light")});async function ut({continuous:l=!1,lightweight:p=!1}={}){var k,N,se;if(u||!t||!t.isReady())return;if(u=!0,l||(le.disabled=!0),!l&&(M.style.opacity="0.85",setTimeout(()=>{M.style.opacity="0"},100),navigator!=null&&navigator.vibrate))try{navigator.vibrate([40,25,40])}catch{}const R=performance.now();try{let{rgba:ae,canvas:me,width:Ce,height:$e}=t.captureScreenBox(T,v,960,1280,{zoom:f,panX:g,panY:C});l&&Qt(me);const ke="guide crop + bubble ring calibration",oe=parseInt((k=e.querySelector("#camTotalQ"))==null?void 0:k.value)||50,ye=parseFloat((N=e.querySelector("#camMarksPerQ"))==null?void 0:N.value)||1,qe=parseFloat((se=e.querySelector("#camNegMark"))==null?void 0:se.value)||0;if(l&&p){const Q=Ft(ae,Ce,$e,o,i,{totalQuestions:oe}),{answers:ge,statuses:Ot}=Wt(Q.regions.answers_left,Q.regions.answers_right,oe),Ge=_t(Q.regions.set),{keysBySet:us,invalidKeys:bs}=Et(oe),Dt=Ge.set?us[Ge.set]:null,ps=Dt?ot(ge,Dt,Ot,{marksPerQ:ye,negative:qe,totalQuestions:oe}):null,ms=bs.find(gs=>Ge.set&&gs.startsWith(`Set ${Ge.set}:`));is(ge,Ot,Ge.set,ps,ms);return}const Ae=Ft(ae,Ce,$e,o,n,{totalQuestions:oe}),O=qs(Ae,oe),{keysBySet:S,invalidKeys:D}=Et(oe),A=Object.keys(S);let j=null,P="N/A";const ue={marksPerQ:ye,negative:qe,totalQuestions:oe};if(A.length===1){const Q=A[0];O.set&&O.set!==Q?P=`Set ${O.set} key missing`:(j=ot(O.answers,S[Q],O.statuses,ue),P=O.set?`Set ${O.set} (Matched)`:`Set ${Q}`)}else if(A.length>1){const Q=O.set;if(Q&&S[Q])j=ot(O.answers,S[Q],O.statuses,ue),P=`Set ${Q} (Matched)`;else if(Q)P=`Set ${Q} key missing`;else{const ge=As(O.answers,O.statuses,S,ue);j=ge.bestScore,P=ge.bestSet?`Set ${ge.bestSet} (Best Fit)`:"Auto"}}if(!A.length&&D.length&&(P="Invalid answer key"),l){ls(O,j,P,oe);return}const Ee=Object.values(O.statuses||{}).filter(Q=>Q!=="BLANK").length;he.push({roll:O.roll||"--",reg:O.reg||"--",subject:O.subject||"--",board:O.board||"--",set:O.set||"--",totalMark:oe*ye,filled:Ee,obtained:j?j.score:"Ungraded"});try{sessionStorage.setItem(ct,JSON.stringify(he))}catch{}dt();const Ie=performance.now(),Ve=Math.round(Ie-R);He={decoded:O,sheetResult:Ae,scoreResult:j,usedSetLabel:P,evalMs:Ve,offscreenCanvas:me,alignmentLabel:ke,invalidKeys:D,totalQ:oe,marksPerQ:ye},cs(He)}catch(ae){console.error("Capture evaluation error:",ae),l?Z.textContent="Waiting for a clear sheet…":alert(`Capture Error: ${ae.message}`)}finally{u=!1,l||(le.disabled=!1)}}le.addEventListener("pointerdown",l=>{l.preventDefault(),ut()});function It(l){l.code==="Space"&&!m&&!l.target.matches("input, select, textarea")?(l.preventDefault(),ut()):l.code==="Escape"&&!H.classList.contains("hidden")&&H.classList.add("hidden")}window.addEventListener("keydown",It);function Xe(l){[fe,ee,Oe,De].forEach(p=>{p.className="modal-tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all"}),Te.classList.add("hidden"),ft.classList.add("hidden"),ht.classList.add("hidden"),vt.classList.add("hidden"),l==="score"?(fe.className="modal-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-omr-primary text-white transition-all",Te.classList.remove("hidden")):l==="overlay"?(ee.className="modal-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-omr-primary text-white transition-all",ft.classList.remove("hidden")):l==="table"?(Oe.className="modal-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-omr-primary text-white transition-all",ht.classList.remove("hidden")):l==="report"&&(De.className="modal-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-omr-primary text-white transition-all",vt.classList.remove("hidden"))}fe.addEventListener("click",()=>Xe("score")),ee.addEventListener("click",()=>Xe("overlay")),Oe.addEventListener("click",()=>Xe("table")),De.addEventListener("click",()=>Xe("report"));function cs(l){var Ae,O;const{decoded:p,sheetResult:R,scoreResult:k,usedSetLabel:N,evalMs:se,offscreenCanvas:ae,alignmentLabel:me}=l;Xe("score"),ss.innerHTML=`<span>✅ Pipeline complete in ${se} ms</span>`,as.textContent=`Bubbles sampled: ${R.debugBubbles.length} • ${me||"Direct pixel sampling"}`,Bt.textContent=p.roll||"—",Bt.className=`text-sm sm:text-base font-bold font-mono ${p.roll?"text-cyan-300":"text-slate-500"}`,Mt.textContent=p.reg||"—",Mt.className=`text-sm sm:text-base font-bold font-mono ${p.reg?"text-cyan-300":"text-slate-500"}`,Rt.textContent=p.subject||"—",Rt.className=`text-sm sm:text-base font-bold font-mono ${p.subject?"text-cyan-300":"text-slate-500"}`;const Ce=p.set||"A",$e=Jt[Ce]||"";if(os.textContent=p.set?`${Ce} (${$e})`:"—",rs.textContent=p.board||"—",k){Lt.textContent=N;const S=k.total??50,D=k.score??0;wt.textContent=`${D} / ${S}`,St.textContent=`${k.correct??0}`,Ct.textContent=`${k.wrong??0}`,kt.textContent=`${k.blank??0}`,ze.textContent=Math.round(D);const A=D/(S||1);A>=.75?ze.className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-lg shadow-lg":A>=.4?ze.className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-white font-black text-lg shadow-lg":ze.className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white font-black text-lg shadow-lg"}else{Lt.textContent=N==="N/A"?"No Answer Key":N;const S=Object.values(p.statuses||{}).filter(A=>A!=="BLANK").length,D=parseInt((Ae=e.querySelector("#camTotalQ"))==null?void 0:Ae.value)||50;wt.textContent=`${S} marked · ungraded`,St.textContent="—",Ct.textContent="—",kt.textContent=`${Math.max(0,D-S)}`,ze.textContent="?"}const ke=[...p.warnings||[],...He.invalidKeys||[]];k||ke.push(N==="Invalid answer key"?"No valid answer key was found. Check that the detected set has a complete key.":"This sheet was not graded because there is no valid answer key for its detected set."),ke.length>0?(it.classList.remove("hidden"),it.innerHTML=ke.map(S=>`
        <div class="flex items-start gap-1.5">
          <span class="text-amber-400 font-bold">⚠️</span>
          <span>${S}</span>
        </div>
      `).join("")):it.classList.add("hidden"),Tt.innerHTML="";const oe=parseInt((O=e.querySelector("#camTotalQ"))==null?void 0:O.value)||50,ye=(k==null?void 0:k.perQuestion)||[];for(let S=1;S<=oe;S++){const D=p.answers[S],A=ye.find(Ee=>Ee.question===S);let j="bg-slate-800 text-slate-400 border-slate-700",P="–";A?A.isCorrect?(j="bg-emerald-950/80 text-emerald-300 border-emerald-600/60 font-bold",P="✓"):(A.status==="WRONG"||A.status==="MULTIPLE")&&(j="bg-rose-950/80 text-rose-300 border-rose-600/60 font-bold",P="✗"):D&&(j="bg-cyan-950/80 text-cyan-300 border-cyan-600/50 font-bold",P=D.toUpperCase());const ue=document.createElement("div");ue.className=`p-1 sm:p-1.5 rounded-lg border text-center text-[10px] sm:text-xs flex flex-col justify-between ${j}`,ue.innerHTML=`
        <span class="text-[8px] sm:text-[9px] text-slate-400 block font-mono">Q${S}</span>
        <span class="text-xs font-bold my-0.5">${D?D.toUpperCase():"–"}</span>
        <span class="text-[8px] sm:text-[9px] opacity-75">${P}</span>
      `,Tt.appendChild(ue)}if(ae){Ze.width=ae.width,Ze.height=ae.height;const S=Ze.getContext("2d");S.drawImage(ae,0,0);for(const D of R.debugBubbles){const{snappedX:A,snappedY:j,nominalX:P,nominalY:ue,r:Ee,ratio:Ie}=D,Ve=R.regions[D.region],Q=Ve==null?void 0:Ve.groups[D.groupIndex];S.strokeStyle="rgba(0, 255, 255, 0.6)",S.lineWidth=1,S.beginPath(),S.arc(A??P,j??ue,Ee,0,Math.PI*2),S.stroke();let ge;(Q==null?void 0:Q.status)==="MULTIPLE"?ge="rgba(239, 68, 68, 0.45)":(Q==null?void 0:Q.value)===D.label&&Ie>.05?ge="rgba(34, 197, 94, 0.50)":Ie>.05?ge="rgba(251, 191, 36, 0.35)":ge="rgba(100, 100, 100, 0.12)",S.fillStyle=ge,S.beginPath(),S.arc(A??P,j??ue,Ee*.7,0,Math.PI*2),S.fill(),S.fillStyle="rgba(255, 255, 255, 0.95)",S.font="7px monospace",S.textAlign="center",S.fillText(Ie.toFixed(2),A??P,(j??ue)+3)}Qt(Ze)}let qe="";for(const[S,D]of Object.entries(R.regions))for(const A of D.groups)for(const j of A.bubbles){const P=j.ratio>.3?"text-emerald-400 font-bold":j.ratio>.1?"text-amber-400":"text-slate-500";qe+=`<tr class="hover:bg-slate-800/40">
            <td class="px-2 py-1 text-slate-400">${S}</td>
            <td class="px-2 py-1">${A.questionNumber!=null?"Q"+A.questionNumber:"G"+A.groupIndex}</td>
            <td class="px-2 py-1 font-bold">${j.label}</td>
            <td class="px-2 py-1 ${P}">${j.ratio.toFixed(4)}</td>
            <td class="px-2 py-1">${A.status}</td>
            <td class="px-2 py-1 text-cyan-400">${j.snappedX.toFixed(1)}, ${j.snappedY.toFixed(1)}</td>
          </tr>`}ns.innerHTML=qe,H.classList.remove("hidden")}ne.addEventListener("click",()=>{H.classList.add("hidden")}),ie.addEventListener("click",()=>{H.classList.add("hidden")}),ce.addEventListener("click",()=>{if(!He)return;const{decoded:l,scoreResult:p}=He,R=["OMR Sheet Result:",`Roll: ${l.roll||"N/A"}, Reg: ${l.reg||"N/A"}, Set: ${l.set||"N/A"}`,p?`Score: ${p.score} / ${p.total}`:"","Answers: "+Object.entries(l.answers).map(([k,N])=>`${k}:${N||"-"}`).join(", ")].filter(Boolean).join(`
`);navigator.clipboard.writeText(R).then(()=>{ce.innerHTML="<span>Copied!</span>",setTimeout(()=>{ce.innerHTML="<span>Copy Text</span>"},1500)})}),lt.addEventListener("click",async()=>{const l=[["#","Roll","Reg. No.","Sub Code","Board","Set code","Total mark","Total filled","Obtained mark"].join("	"),...he.map((p,R)=>[R+1,p.roll,p.reg,p.subject,p.board,p.set,p.totalMark,p.filled,p.obtained].join("	"))].join(`
`);try{await navigator.clipboard.writeText(l),lt.textContent="Copied!",setTimeout(()=>{lt.textContent="Copy report"},1500)}catch(p){alert(`Could not copy report: ${p.message}`)}}),ts.addEventListener("click",()=>{he=[];try{sessionStorage.removeItem(ct)}catch{}dt()});async function ds(){const l=await Vt();o=l.template,n=l.expandedRegions,i=Object.fromEntries(["answers_left","answers_right","set"].filter(p=>n[p]).map(p=>[p,n[p]])),$t(),r=hs(p=>{const R=Je(p);if(!R.valid){console.warn("Ignoring invalid calibrated template:",R.errors);return}o=R.template,n=R.expandedRegions,i=Object.fromEntries(["answers_left","answers_right","set"].filter(k=>n[k]).map(k=>[k,n[k]])),$t()})}return ds(),At(),{destroy(){m=!1,clearTimeout(x),window.removeEventListener("keydown",It),r&&r(),t&&(t.stop(),t=null)}}}const Ns="/api";async function Le(e,s={}){const t=await fetch(`${Ns}${e}`,{headers:{"Content-Type":"application/json"},...s,body:s.body?JSON.stringify(s.body):void 0});if(!t.ok){const o=await t.json().catch(()=>({error:t.statusText}));throw new Error(o.error||t.statusText)}return t.json()}const js={health:()=>Le("/health"),saveTemplate:e=>Le("/templates/ssc-50",{method:"POST",body:{template:e}}),getExams:()=>Le("/exams"),getExam:e=>Le(`/exams/${e}`),createExam:e=>Le("/exams",{method:"POST",body:e}),getKeys:e=>Le(`/exams/${e}/keys`),saveKey:(e,s)=>Le(`/exams/${e}/keys`,{method:"POST",body:s}),getResults:e=>Le(`/exams/${e}/results`),saveResult:(e,s)=>Le(`/exams/${e}/results`,{method:"POST",body:s})};function Ps(e,s={}){let t=null,o="global",n=new Image,i=!1,r=!1,c=1,a=0,u=0,m=!1,b=!0,x=!0;e.innerHTML=`
    <div class="max-w-7xl mx-auto px-4 py-5 animate-fadeIn">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-700/60">
        <div>
          <h2 class="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
            <svg class="w-6 h-6 text-omr-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
            ${B("calibrationMode")}
          </h2>
          <p class="text-xs md:text-sm text-omr-text-muted mt-0.5">
            Fine-tune bubble coordinates, pitch, and alignment with live visual feedback
          </p>
        </div>

        <!-- Top Actions Bar -->
        <div class="flex items-center flex-wrap gap-2">
          <!-- Load Custom Sheet Image -->
          <label class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer flex items-center gap-1.5 transition-colors">
            <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span>${B("loadReferenceImage")}</span>
            <input type="file" id="calibImageInput" accept="image/*" class="hidden">
          </label>

          <!-- Export JSON -->
          <button id="exportJsonBtn" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span>${B("exportJson")}</span>
          </button>

          <!-- Import JSON -->
          <label class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer flex items-center gap-1.5 transition-colors">
            <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            <span>${B("importJson")}</span>
            <input type="file" id="importJsonInput" accept=".json" class="hidden">
          </label>

          <!-- Reset Default -->
          <button id="resetDefaultBtn" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-xs font-medium text-rose-300 border border-slate-700 hover:border-rose-700 flex items-center gap-1.5 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span>${B("resetDefault")}</span>
          </button>

          <!-- Save to browser and built-in template file -->
          <button id="saveChangesBtn" class="px-4 py-1.5 rounded-xl bg-gradient-to-r from-omr-primary to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 flex items-center gap-1.5 transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
            </svg>
            <span>${B("saveChanges")}</span>
          </button>
        </div>
      </div>

      <!-- Main Studio Layout: Controls (Left) + Interactive Visual Canvas (Right) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        <!-- Left Controls Column (4 cols) -->
        <div class="lg:col-span-5 space-y-4">

          <!-- Section Switcher Tabs -->
          <div class="p-1 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap gap-1">
            <button data-sec="global" class="sec-tab-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all bg-omr-primary text-white">
              Global
            </button>
            <button data-sec="answers_left" class="sec-tab-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all">
              Q1-25
            </button>
            <button data-sec="answers_right" class="sec-tab-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all">
              Q26-50
            </button>
            <button data-sec="roll" class="sec-tab-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all">
              Roll
            </button>
            <button data-sec="reg" class="sec-tab-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all">
              Reg
            </button>
            <button data-sec="subject" class="sec-tab-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all">
              Subj
            </button>
            <button data-sec="set" class="sec-tab-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all">
              Set
            </button>
            <button data-sec="board" class="sec-tab-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all">
              Board
            </button>
          </div>

          <!-- Section Settings Card -->
          <div class="p-5 rounded-2xl bg-omr-bg-card border border-slate-700/60 shadow-xl space-y-4">
            <!-- Active Section Info -->
            <div class="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div>
                <h3 id="panelTitle" class="text-sm font-bold text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
                  Global Nudge & Spacing
                </h3>
                <p id="panelSubtitle" class="text-[11px] text-omr-text-muted">Adjusts entire grid coordinates simultaneously</p>
              </div>
              <span id="coordBadge" class="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                ΔX: 0 | ΔY: 0
              </span>
            </div>

            <!-- Directional Nudge Pad (Tactile Arrow Buttons) -->
            <div>
              <label class="text-xs font-semibold text-slate-300 block mb-2">Directional Nudge</label>
              <div class="flex flex-col items-center gap-1.5">
                <!-- Up -->
                <div class="flex items-center gap-1">
                  <button id="nudgeUp5" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-cyan-300" title="Move Up 5px">▲▲ 5px</button>
                  <button id="nudgeUp1" class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-white" title="Move Up 1px">▲ 1px</button>
                </div>
                <!-- Left & Right -->
                <div class="flex items-center gap-2">
                  <button id="nudgeLeft5" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-cyan-300" title="Move Left 5px">◀◀ 5px</button>
                  <button id="nudgeLeft1" class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-white" title="Move Left 1px">◀ 1px</button>
                  <div class="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] text-slate-400">
                    🎯
                  </div>
                  <button id="nudgeRight1" class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-white" title="Move Right 1px">1px ▶</button>
                  <button id="nudgeRight5" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-cyan-300" title="Move Right 5px">5px ▶▶</button>
                </div>
                <!-- Down -->
                <div class="flex items-center gap-1">
                  <button id="nudgeDown1" class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-white" title="Move Down 1px">▼ 1px</button>
                  <button id="nudgeDown5" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-cyan-300" title="Move Down 5px">▼▼ 5px</button>
                </div>
              </div>
            </div>

            <!-- Dynamic Form Fields (Global vs Section-Specific) -->
            <div id="dynamicFormFields" class="space-y-3 pt-2 border-t border-slate-700/60 text-xs">
              <!-- Rendered dynamically by updateInspectorForm() -->
            </div>
          </div>

          <!-- Shortcuts Guide -->
          <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-omr-text-muted space-y-1">
            <div class="font-semibold text-slate-300 mb-1">⚡ Keyboard Shortcuts & Tips:</div>
            <div>• <kbd class="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-cyan-400">Arrows</kbd>: Nudge active section by 1 px</div>
            <div>• <kbd class="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-cyan-400">Shift + Arrows</kbd>: Nudge active section by 5 px</div>
            <div>• Click on any bubble group in the visual canvas to select that section!</div>
          </div>
        </div>

        <!-- Right Visual Canvas Column (7 cols) -->
        <div class="lg:col-span-7 space-y-3">
          <!-- Canvas Toolbar -->
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="text-slate-400">Zoom:</span>
              <button id="zoomOutBtn" class="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center font-bold">−</button>
              <span id="zoomLabel" class="font-mono text-cyan-400 w-12 text-center">100%</span>
              <button id="zoomInBtn" class="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center font-bold">+</button>
              <button id="zoomResetBtn" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px]">Fit</button>
            </div>

            <div class="flex items-center gap-3">
              <label class="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[11px]">
                <input type="checkbox" id="toggleAnchorsCheck" checked class="rounded border-slate-700 accent-omr-primary">
                <span>Anchors</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[11px]">
                <input type="checkbox" id="toggleLabelsCheck" checked class="rounded border-slate-700 accent-omr-primary">
                <span>Labels</span>
              </label>
            </div>
          </div>

          <!-- Interactive Canvas Viewport (Scrollable / Pannable) -->
          <div id="canvasViewport"
            class="relative w-full h-[620px] rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-700/80 shadow-2xl flex items-center justify-center cursor-crosshair select-none">

            <canvas id="calibCanvas" width="960" height="1280" class="transition-transform duration-75"></canvas>

            <!-- Loading indicator -->
            <div id="calibLoading" class="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-xs text-omr-text-muted">
              Loading Reference Sheet...
            </div>
          </div>
        </div>
      </div>
    </div>
  `;const f=e.querySelector("#calibCanvas"),g=f.getContext("2d");e.querySelector("#canvasViewport");const C=e.querySelector("#calibLoading"),v=e.querySelectorAll(".sec-tab-btn"),$=e.querySelector("#panelTitle"),T=e.querySelector("#panelSubtitle"),w=e.querySelector("#coordBadge"),d=e.querySelector("#dynamicFormFields"),M=e.querySelector("#zoomInBtn"),G=e.querySelector("#zoomOutBtn"),z=e.querySelector("#zoomResetBtn"),K=e.querySelector("#zoomLabel"),te=e.querySelector("#toggleAnchorsCheck"),Y=e.querySelector("#toggleLabelsCheck"),le=e.querySelector("#calibImageInput"),be=e.querySelector("#exportJsonBtn"),re=e.querySelector("#importJsonInput"),U=e.querySelector("#resetDefaultBtn"),E=e.querySelector("#saveChangesBtn"),X=e.querySelector("#nudgeUp1"),Z=e.querySelector("#nudgeUp5"),ve=e.querySelector("#nudgeDown1"),de=e.querySelector("#nudgeDown5"),Be=e.querySelector("#nudgeLeft1"),Me=e.querySelector("#nudgeLeft5"),xe=e.querySelector("#nudgeRight1"),Re=e.querySelector("#nudgeRight5");async function we(){try{const h=await Vt();t=je(h.template),zt()&&C.classList.add("hidden"),n.onload=()=>{i=!0,C.classList.add("hidden"),V()},n.onerror=()=>{C.textContent="Reference image not found. You can upload an image above."},n.src="/templates/ssc-50-reference.jpg",pe(),V()}catch(h){console.error("Calibration init failed:",h)}}function V(){var F,_,W;if(!t)return;const h=((F=t.canonicalSize)==null?void 0:F.w)||960,y=((_=t.canonicalSize)==null?void 0:_.h)||1280;f.width=h,f.height=y,g.clearRect(0,0,h,y);const q=r?null:zt();if(q?g.drawImage(q,0,0,h,y):i?g.drawImage(n,0,0,h,y):(g.fillStyle="#1e293b",g.fillRect(0,0,h,y)),x&&((W=t.alignment)!=null&&W.anchors)){g.lineWidth=1.5;for(const L of t.alignment.anchors){if(!L.rect)continue;const[H,ne,ie,ce]=L.rect,fe=ie-H,ee=ce-ne;g.strokeStyle="rgba(245, 158, 11, 0.7)",g.strokeRect(H,ne,fe,ee),b&&(g.fillStyle="rgba(245, 158, 11, 0.9)",g.font="11px Inter, sans-serif",g.fillText(L.id,H+4,ne-4))}}const I={};for(const[L,H]of Object.entries(t.regions||{}))I[L]=pt(H,t.bubbleRadius||11);for(const[L,H]of Object.entries(I)){const ne=o===L||o==="global",ie=ne?o===L?"rgba(52, 211, 153, 0.95)":"rgba(6, 182, 212, 0.9)":"rgba(148, 163, 184, 0.4)",ce=ne?o===L?"rgba(52, 211, 153, 0.25)":"rgba(6, 182, 212, 0.15)":"rgba(148, 163, 184, 0.05)";g.lineWidth=ne&&o===L?2.2:1.5;for(const fe of H)for(const ee of fe.bubbles)g.beginPath(),g.arc(ee.x,ee.y,ee.r,0,Math.PI*2),g.strokeStyle=ie,g.fillStyle=ce,g.fill(),g.stroke(),g.beginPath(),g.arc(ee.x,ee.y,1.2,0,Math.PI*2),g.fillStyle=ie,g.fill(),b&&ee.label&&ne&&(g.fillStyle=ie,g.font="bold 8px monospace",g.textAlign="center",g.textBaseline="middle",g.fillText(ee.label.toUpperCase(),ee.x,ee.y))}f.style.transform=`scale(${c}) translate(${a}px, ${u}px)`,K.textContent=`${Math.round(c*100)}%`}function pe(){var h,y,q,I,F,_,W;if(t)if(v.forEach(L=>{L.dataset.sec===o?L.className="sec-tab-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all bg-omr-primary text-white":L.className="sec-tab-btn flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all"}),o==="global")$.innerHTML='<span class="w-2 h-2 rounded-full bg-cyan-400"></span> Global Nudge & Spacing',T.textContent="Nudges all regions and anchors simultaneously",w.textContent="Global Transform",d.innerHTML=`
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-omr-text-muted block mb-1">Scale X (Col Spacing)</label>
            <div class="flex items-center gap-1">
              <button id="scaleXDec" class="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700">-0.5%</button>
              <span id="scaleXVal" class="flex-1 text-center font-mono text-cyan-300">100%</span>
              <button id="scaleXInc" class="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700">+0.5%</button>
            </div>
          </div>
          <div>
            <label class="text-omr-text-muted block mb-1">Scale Y (Row Spacing)</label>
            <div class="flex items-center gap-1">
              <button id="scaleYDec" class="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700">-0.5%</button>
              <span id="scaleYVal" class="flex-1 text-center font-mono text-cyan-300">100%</span>
              <button id="scaleYInc" class="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700">+0.5%</button>
            </div>
          </div>
        </div>

        <div class="pt-2">
          <label class="text-omr-text-muted block mb-1">Rotation Angle</label>
          <div class="flex items-center gap-2">
            <button id="rotDec" class="px-2.5 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700">-0.2°</button>
            <span id="rotVal" class="flex-1 text-center font-mono text-purple-300">0.0°</span>
            <button id="rotInc" class="px-2.5 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700">+0.2°</button>
          </div>
        </div>
      `,(h=d.querySelector("#scaleXInc"))==null||h.addEventListener("click",()=>Se(1.005,1)),(y=d.querySelector("#scaleXDec"))==null||y.addEventListener("click",()=>Se(.995,1)),(q=d.querySelector("#scaleYInc"))==null||q.addEventListener("click",()=>Se(1,1.005)),(I=d.querySelector("#scaleYDec"))==null||I.addEventListener("click",()=>Se(1,.995)),(F=d.querySelector("#rotInc"))==null||F.addEventListener("click",()=>_e(.2)),(_=d.querySelector("#rotDec"))==null||_.addEventListener("click",()=>_e(-.2));else{const L=t.regions[o];if(!L)return;const H=o==="answers_left"?"Answers Q1-25 (Left)":o==="answers_right"?"Answers Q26-50 (Right)":o==="roll"?"Roll Number":o==="reg"?"Registration Number":o==="subject"?"Subject Code":o==="set"?"Set Code":o==="board"?"Board Selection":o;if($.innerHTML=`<span class="w-2 h-2 rounded-full bg-emerald-400"></span> ${H}`,T.textContent=`Type: ${L.type} • Edit bubble pitch & coordinates`,L.type==="grid"){const[ne,ie]=L.firstBubble;w.textContent=`Origin: [${ne}, ${ie}]`,d.innerHTML=`
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-omr-text-muted block mb-1">First Bubble X0</label>
              <input type="number" id="fieldX0" step="0.5" value="${ne}"
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 font-mono text-cyan-300">
            </div>
            <div>
              <label class="text-omr-text-muted block mb-1">First Bubble Y0</label>
              <input type="number" id="fieldY0" step="0.5" value="${ie}"
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 font-mono text-cyan-300">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-omr-text-muted block mb-1">Col Pitch (ΔX)</label>
              <input type="number" id="fieldColPitch" step="0.1" value="${L.colPitch}"
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 font-mono text-white">
            </div>
            <div>
              <label class="text-omr-text-muted block mb-1">Row Pitch (ΔY)</label>
              <input type="number" id="fieldRowPitch" step="0.1" value="${L.rowPitch}"
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 font-mono text-white">
            </div>
          </div>

          <div>
            <label class="text-omr-text-muted block mb-1">Bubble Radius (r)</label>
            <input type="number" id="fieldRadius" step="0.5" value="${L.radius||t.bubbleRadius||10}"
              class="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 font-mono text-white">
          </div>
        `;const ce=d.querySelector("#fieldX0"),fe=d.querySelector("#fieldY0"),ee=d.querySelector("#fieldColPitch"),Oe=d.querySelector("#fieldRowPitch"),De=d.querySelector("#fieldRadius"),Te=()=>{L.firstBubble=[parseFloat(ce.value)||0,parseFloat(fe.value)||0],L.colPitch=parseFloat(ee.value)||0,L.rowPitch=parseFloat(Oe.value)||0,L.radius=parseFloat(De.value)||10,w.textContent=`Origin: [${L.firstBubble[0]}, ${L.firstBubble[1]}]`,m=!0,V()};ce.addEventListener("input",Te),fe.addEventListener("input",Te),ee.addEventListener("input",Te),Oe.addEventListener("input",Te),De.addEventListener("input",Te)}else L.type==="choice"&&(w.textContent=`${((W=L.bubbles)==null?void 0:W.length)||0} bubbles`,d.innerHTML=`
          <div>
            <label class="text-omr-text-muted block mb-1">Radius</label>
            <input type="number" id="choiceRadius" step="0.5" value="${L.radius||10}"
              class="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 font-mono text-white">
          </div>
          <div class="text-[11px] text-slate-400 mt-2">
            Tip: Use Directional Nudge buttons or Arrow Keys to move this choice group.
          </div>
        `,d.querySelector("#choiceRadius").addEventListener("input",ie=>{L.radius=parseFloat(ie.target.value)||10,m=!0,V()}))}}function J(h,y){if(t){if(o==="global")t=bt(t,{deltaX:h,deltaY:y});else{const q=t.regions[o];q&&(q.type==="grid"&&q.firstBubble?(q.firstBubble[0]=Math.round((q.firstBubble[0]+h)*10)/10,q.firstBubble[1]=Math.round((q.firstBubble[1]+y)*10)/10):q.type==="choice"&&Array.isArray(q.bubbles)&&(q.bubbles=q.bubbles.map(([I,F])=>[Math.round((I+h)*10)/10,Math.round((F+y)*10)/10])))}m=!0,pe(),V()}}function Se(h,y){t&&(t=bt(t,{scaleX:h,scaleY:y}),m=!0,pe(),V())}function _e(h){t&&(t=bt(t,{rotationDeg:h}),m=!0,pe(),V())}X.addEventListener("click",()=>J(0,-1)),Z.addEventListener("click",()=>J(0,-5)),ve.addEventListener("click",()=>J(0,1)),de.addEventListener("click",()=>J(0,5)),Be.addEventListener("click",()=>J(-1,0)),Me.addEventListener("click",()=>J(-5,0)),xe.addEventListener("click",()=>J(1,0)),Re.addEventListener("click",()=>J(5,0));function nt(h){var q;if(h==="global"||!((q=t==null?void 0:t.regions)!=null&&q[h]))return{cx:480,cy:640};const y=t.regions[h];if(y.type==="grid"&&y.firstBubble){const[I,F]=y.firstBubble,_=I+((y.cols||1)-1)*(y.colPitch||0),W=F+((y.rows||1)-1)*(y.rowPitch||0);return{cx:(I+_)/2,cy:(F+W)/2}}else if(y.type==="choice"&&Array.isArray(y.bubbles)&&y.bubbles.length>0){let I=1/0,F=-1/0,_=1/0,W=-1/0;for(const[L,H]of y.bubbles)L<I&&(I=L),L>F&&(F=L),H<_&&(_=H),H>W&&(W=H);return{cx:(I+F)/2,cy:(_+W)/2}}return{cx:480,cy:640}}function Pe(h){const{cx:y,cy:q}=nt(h);a=Math.round(480-y),u=Math.round(640-q),c=h==="global"?1:1.45}v.forEach(h=>{h.addEventListener("click",()=>{o=h.dataset.sec,Pe(o),pe(),V()})});function We(h){if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(h.code)){if(h.target.matches("input, select, textarea"))return;h.preventDefault();const y=h.shiftKey?5:1;h.code==="ArrowUp"&&J(0,-y),h.code==="ArrowDown"&&J(0,y),h.code==="ArrowLeft"&&J(-y,0),h.code==="ArrowRight"&&J(y,0)}}return window.addEventListener("keydown",We),f.addEventListener("click",h=>{const y=f.getBoundingClientRect(),q=f.width/y.width,I=f.height/y.height,F=(h.clientX-y.left)*q,_=(h.clientY-y.top)*I;let W=null;for(const[L,H]of Object.entries(t.regions||{})){const ne=pt(H,t.bubbleRadius||11);for(const ie of ne){for(const ce of ie.bubbles)if(Math.hypot(ce.x-F,ce.y-_)<=ce.r+5){W=L;break}if(W)break}if(W)break}W&&(o=W,Pe(o),pe(),V())}),M.addEventListener("click",()=>{c=Math.min(3,Math.round((c+.2)*10)/10),V()}),G.addEventListener("click",()=>{c=Math.max(.4,Math.round((c-.2)*10)/10),V()}),z.addEventListener("click",()=>{c=1,a=0,u=0,V()}),te.addEventListener("change",h=>{x=h.target.checked,V()}),Y.addEventListener("change",h=>{b=h.target.checked,V()}),le.addEventListener("change",h=>{var I;const y=(I=h.target.files)==null?void 0:I[0];if(!y)return;const q=new FileReader;q.onload=F=>{n.onload=()=>{i=!0,r=!0,C.classList.add("hidden"),V()},n.src=F.target.result},q.readAsDataURL(y)}),E.addEventListener("click",async()=>{if(!t||E.disabled)return;const h=E.innerHTML;E.disabled=!0,E.innerHTML="<span>Saving template…</span>";try{Gt(t);try{await js.saveTemplate(t)}catch(y){m=!1,E.innerHTML=h,alert(`Saved in this browser, but could not update ssc-50.json on the OMR server: ${y.message}`);return}m=!1,E.innerHTML="<span>✓ Saved to ssc-50.json + browser</span>",E.classList.add("from-emerald-500","to-teal-600"),setTimeout(()=>{E.innerHTML=h,E.classList.remove("from-emerald-500","to-teal-600")},2e3)}catch(y){alert(`Save error: ${y.message}`)}finally{E.disabled=!1}}),U.addEventListener("click",async()=>{if(confirm("Reset template coordinates back to pristine default ssc-50.json?")){const h=await vs();t=je(h.template),pe(),V()}}),be.addEventListener("click",()=>{ys(t)}),re.addEventListener("change",h=>{var I;const y=(I=h.target.files)==null?void 0:I[0];if(!y)return;const q=new FileReader;q.onload=F=>{try{const _=ws(F.target.result);t=je(_.template),pe(),V(),alert("Template imported and activated successfully!")}catch(_){alert(`Import error: ${_.message}`)}},q.readAsText(y)}),we(),{destroy(){window.removeEventListener("keydown",We)}}}let Qe="live-scan",Ne=null;document.addEventListener("DOMContentLoaded",()=>{Is(),Os(),xt()});function Is(){const e=document.getElementById("langToggle");e&&(e.addEventListener("click",()=>{const s=Bs();e.textContent=s==="en"?"বাংলা":"English",Kt(),xt()}),Kt())}function Kt(){const e=document.getElementById("labelNavLive"),s=document.getElementById("labelNavCalib");e&&(e.textContent=B("liveScan")),s&&(s.textContent=B("calibrationMode"))}function Os(){document.querySelectorAll(".nav-tab").forEach(s=>{s.addEventListener("click",()=>{const t=s.dataset.mode;t&&t!==Qe&&es(t)})})}function es(e){if(e===Qe&&Ne)return;if(Ne&&typeof Ne.destroy=="function"){try{Ne.destroy()}catch(t){console.warn("Error during view unmount:",t)}Ne=null}Qe=e,document.querySelectorAll(".nav-tab").forEach(t=>{t.dataset.mode===Qe?t.className="nav-tab px-3 md:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20":t.className="nav-tab px-3 md:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 text-slate-400 hover:text-white"}),xt()}function xt(){const e=document.getElementById("content");if(!e)return;const s=document.getElementById("mainHeader");s&&(Qe==="live-scan"?s.classList.add("hidden"):s.classList.remove("hidden")),e.innerHTML="";const t=o=>{es(o)};switch(Qe){case"live-scan":Ne=Ht(e,{onNavigate:t});break;case"calibration":Ne=Ps(e,{});break;default:Ne=Ht(e,{onNavigate:t});break}}
