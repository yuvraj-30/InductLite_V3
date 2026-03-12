var storylane1732113157820=function(){"use strict";var ie=Object.defineProperty;var F=Object.getOwnPropertySymbols;var le=Object.prototype.hasOwnProperty,ae=Object.prototype.propertyIsEnumerable;var R=(w,m,u)=>m in w?ie(w,m,{enumerable:!0,configurable:!0,writable:!0,value:u}):w[m]=u,_=(w,m)=>{for(var u in m||(m={}))le.call(m,u)&&R(w,u,m[u]);if(F)for(var u of F(m))ae.call(m,u)&&R(w,u,m[u]);return w};const w="storylane-demo-event",m="storylane-embed-demo",u="storylane-token-submit",H="storylane-tracking",$="storylane-host-info",T="storylane-demo-host",I="hubspotutk",O="_mkto_trk",D=/visitor_id\d+/,E={CloseModal:"sl-close"},N=`.sl-close-btn {
  background: #ffffff;
  color: #1a1348;
  border: 2px solid #fffffe;
  border-radius: 20px;
  line-height: 18px;
  box-shadow: 0px 0px 5px #444;
  cursor: pointer;
  font-family: Helvetica;
  font-size: 14px;
  font-weight: bold;
  height: 24px;
  width: 24px;
  padding: 0px;
}

.sl-close-btn:hover {
  box-shadow: 0px 0px 6px rgba(255, 255, 100, 1);
}
`;class j extends HTMLElement{constructor(){super();const e=this.attachShadow({mode:"open"}),o=document.createElement("button");o.classList.add("sl-close-btn"),o.innerHTML='<svg viewBox="0 0 24 24" class="__sl-close-btn" xmlns="http://www.w3.org/2000/svg" fill="none"><path fill="#9392A3" d="m17.674 15.738-9.5-9.5A1.11 1.11 0 0 0 6.6 6.235l-.274.274a1.11 1.11 0 0 0 0 1.573l9.5 9.5a1.114 1.114 0 0 0 1.574 0l.273-.274a1.11 1.11 0 0 0 0-1.573"></path><path fill="#9392A3" d="m17.675 6.51-.275-.275a1.113 1.113 0 0 0-1.573 0l-9.5 9.5a1.113 1.113 0 0 0 0 1.573l.272.274a1.11 1.11 0 0 0 1.574 0l9.5-9.5a1.113 1.113 0 0 0 0-1.573"></path><path fill="#F3F5F7" d="M12 0a12 12 0 1 1 0 24 12 12 0 0 1 0-24"></path><path fill="#9392A3" d="M16.215 14.964 13.251 12l2.964-2.964a.883.883 0 0 0 0-1.25.884.884 0 0 0-1.25 0L12 10.748 9.036 7.785a.885.885 0 0 0-1.251 1.251L10.749 12l-2.964 2.964a.883.883 0 1 0 1.25 1.251L12 13.251l2.964 2.964a.884.884 0 0 0 1.251-1.25"></path></svg>';const n=document.createElement("style");n.textContent=N,e.appendChild(n),e.appendChild(o),this.addCloseEventListener(o)}addCloseEventListener(e){const o=()=>{this.dispatchEvent(new Event(E.CloseModal))};e.addEventListener("click",o),this.addEventListener("disconnected",()=>{e.removeEventListener("click",o)})}}customElements.define("sl-close-button",j);class U{constructor(){this.storylane_style="",this.embed_style="",this.demo_html=""}Play(e){if(typeof e!="object")return console.log("Error: Invalid params."),0;switch(this.params=e,this.params.type){case"popup":this.Player(e);break;case"preview_embed":this.PreviewEmbed(e);break}}PreviewEmbed(e){var s;if(typeof e!="object")return console.log("Error: Invalid params."),0;let o={scale:.9};this.params=_(_({},o),e);const n=this.params.demo_url;if(!n)return console.log("Error: Invalid params. Please provide valid demo_url"),0;console.log("creating storylane demo with preview");const i=this.params.element,l=i.closest(".sl-embed-container");if(!l){console.error("Unable to find .sl-embed-container");return}const d=l.querySelector(".sl-preview");if(!d){console.error("Unable to find .sl-preview");return}const a=l.querySelector("iframe.sl-demo");if(!a){console.error('Unable to find "iframe.sl-demo"');return}(s=i.parentElement)!=null&&s.classList.contains("sl-preview-heading")?i.parentElement.style.display="none":i.style.display="none",d.style.display="none",a.style.display="block",a.style.backgroundColor="#f3f5f7",a.style.borderRadius="inherit",a.src=n}Player(e){if(typeof e!="object")return console.log("Error: Invalid params."),0;let o={scale:"0.9",width:"100%",padding_bottom:"calc(56.33% + 27px)",fullscreen:!1};if(this.params=_(_({},o),e),!this.params.hasOwnProperty("demo_url"))return console.log("Error: Invalid params. Please provide valid demo_url"),0;this.storylane_style=`
          #__sl-demo-wrapper{
            position: fixed;
            top: 0px;
            left: 0px;
            width: 100%;
            height: 100%;
            z-index: 9999999;
            background: rgba(0,0,0,0.8);
          }
          .__sl-embed-container{
            z-index: 99999999;
            position: relative;
            width: 100%;
            display: flex;
            max-width: 100%;
            height: 100%;
            max-height: 100%;
            align-items: center;
            justify-content: center;
          }
          .__sl-embed{
            position:relative;
            width:100%;
            height:0;
          }
          .__sl-embed-portrait {
            padding-bottom: 0px !important;
            height: 100% !important;
          }
          .__sl-player-iframe {
            position:absolute;
            top:0;
            left:0;
            width:100%;
            height:100%;
            border:none;
          }`,this.embed_style=`
          padding-bottom: $padding_bottom;
          transform: scale($scale);
          -webkit-transform: scale($scale);
          -moz-transform: scale($scale);
          -o-transform: scale($scale);
        `,this.demo_html=`
          <div class="__sl-embed-container">
            <div style="position:absolute; top:8px; right:4px;z-index:1;">
              <sl-close-button></sl-close-button>
            </div>
            <div class="__sl-embed-wrapper" style="width: $embed_width; height: $embed_height; position: relative">
              <div class="__sl-embed">
                <iframe class='__sl-player-iframe' allowfullscreen></iframe>
              </div>
            </div>
          </div>
        `,console.log("creating storylane demo");let n=document.getElementById("__sl-demo-wrapper");if(n==null){n=document.createElement("div"),n.id="__sl-demo-wrapper",n.setAttribute("style","display: none;"),document.body.appendChild(n);let g=document.createElement("style");g.innerHTML=this.storylane_style,document.head.appendChild(g)}n.innerHTML=this.demo_html;const i=this.params.element,l=document.getElementsByClassName("__sl-player-iframe")[0],d=document.getElementsByClassName("__sl-embed-wrapper")[0],a=document.getElementsByClassName("__sl-embed")[0],s=parseFloat(this.params.scale),c=window.innerWidth<window.innerHeight;let b=window.innerHeight-50,h=window.innerWidth-50;c&&(b=window.innerHeight,h=window.innerWidth);let r=h,f="auto";if(this.params.fullscreen===!0)r="100%";else{let g=parseFloat(this.params.height),C=parseFloat(this.params.width);if(!isNaN(g)&&g!=0&&!isNaN(C)&&C!=0){let re=parseFloat((g/C).toFixed(2));r=C,g>b&&(r=parseFloat((b/re).toFixed(2))),r>h&&(r=h)}isNaN(s)||(r=(r*s).toFixed(2)),r=r+"px"}c&&(r="100%",this.params.demo_type==="html"&&a&&(f="100%",a.classList.add("__sl-embed-portrait")));let p=d.getAttribute("style")||"";p=p.replaceAll(/\$embed_width/g,r),p=p.replaceAll(/\$embed_height/g,f),d.setAttribute("style",p);let y=this.embed_style.replaceAll(/\$scale/g,"1.0");const v=this.params.padding_bottom;y=y.replaceAll(/\$padding_bottom/g,v),a==null||a.setAttribute("style",y),i&&i.onclick===null?i.addEventListener("click",g=>{l&&this.params&&n&&(l.src=this.params.demo_url,n.style.display="")}):(l&&(l.src=this.params.demo_url),n.style.display="");function S(g){(g.key==="Escape"||g.key==="Esc")&&(l&&n&&(n.style.display="none",l.src=""),document.removeEventListener("keydown",S))}document.addEventListener("keydown",S);const k=document.querySelector("sl-close-button");function x(){l&&n&&(n.style.display="none",l.src=""),k==null||k.removeEventListener(E.CloseModal,x)}k==null||k.addEventListener(E.CloseModal,x)}Embed(e){if(typeof e!="object")return console.log("Error: Invalid params."),0;let o={scale:"0.9"};if(this.params=_(_({},o),e),!this.params.hasOwnProperty("demo_url"))return console.log("Error: Invalid params. Please provide valid demo_url"),0;this.storylane_style=`
          #__sl-demo-embed-wrapper{
            width: 100%;
            height: 100%;
            z-index: 10000;
            background: rgba(0,0,0,0.6);
            background-color: #F3F5F7;
            border: 0px solid black;
          }
          .__sl-iframe{border: 0px; width: 100%; height: 100%; min-height: 100vh;}

          .__sl-demo-preview{
            width:100%; height: 100%;
            transform:scale(1.0);
            background-color: #ffffff;
            z-index: 999999999;
          }

          .__sl-play{
            z-index: 10003;
            box-sizing: border-box;
              display:block;
              width:140px;
              height:60px;
              padding-top: 14px;
              padding-left: 8px;
              line-height: 20px;
              border: 3px solid #fff;
              border-radius: 5px;
              color: #f5f5f5;
              text-align:center;
              text-decoration:none;
              background-color: #e0007a;
              font-size: 22px;
              font-weight: normal;
              transition: all 0.3s ease;
            position: relative;
            top: 45%;
            left: 45%;
            cursor: pointer;
          }

          .__sl-play:hover {
              background-color: #c1066c;
              box-shadow: 0px 0px 6px rgba(255,255,100,1);
          }
        `;let n=document.getElementById("__sl-demo-embed-wrapper");if(n==null){n=document.createElement("div"),n.id="__sl-demo-embed-wrapper",n.removeAttribute("style");const a=document.createElement("style");a.innerHTML=this.storylane_style,document.head.appendChild(a)}let i=this.params.element;const l=this.params.demo_url,d=this.params.demo_preview;if(l){console.log("creating storylane embedded demo");const a=document.createElement("iframe");a.classList.add("__sl-iframe"),a.src=l,n.appendChild(a),i.innerHTML="",i.appendChild(n)}else if(d){console.log("creating storylane embedded demo with preview");const a=i.innerHTML,s=document.createElement("div");s.classList.add("__sl-demo-preview"),s.setAttribute("style","background: linear-gradient(0deg, rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('"+d+"') no-repeat; background-size: 100% auto;");const c=document.createElement("a");c.classList.add("__sl-play"),c.text="Start Demo",c.addEventListener("click",b=>{s.remove(),n&&(n.innerHTML=a)}),s.appendChild(c),n.appendChild(s),i.innerHTML="",i.appendChild(n)}}}function q(t,e){var n,i;if(t.origin===""||t.origin==="null")return!0;let o=t.origin===e||/https:\/\/(www\.)?[0-9a-zA-Z-]+\.storylane\.(io|us)\/?$/.test(t.origin);if(!o){const l=/^(?:[a-zA-Z0-9-]+\.)*([a-zA-Z0-9-]+\.[a-zA-Z]{2,})$/,d=new URL(e),a=new URL(t.origin),s=(n=d.host.match(l))==null?void 0:n[1],c=(i=a.host.match(l))==null?void 0:i[1];o=s&&c&&s===c}return!o}function B(t){const e=t.data;if(typeof e=="object"&&e!==null&&"message"in e&&e.message===w){if(q(t,window.origin))return console.warn("sl: unable to process message"),!0;let o=t.data.payload;return o.event==="open_external_url"&&o.target.target==="_self"&&window.open(o.target.url,o.target.target),!0}return!1}function K(t,e){const o=t.split("; ");for(let n=0;n<o.length;n++){const l=o[n].split("=");if(l[0].match(e))return l[1]}return null}function W(t,e,o,n){try{return t.cookie=e+"="+(o||"")+"; max-age="+n+"; path=/; secure",!0}catch(i){return!1}}const M="slReferer";function Z(t){try{const e=P(t);!z(t)&&e&&J(t,e)}catch(e){}}function P(t){const e=t.referrer;return e?btoa(e):null}function z(t){const e=K(t.cookie,M);return e?decodeURIComponent(e):null}function J(t,e){W(t,M,encodeURIComponent(e),31536e3)}function V(t){var o,n,i,l,d;const e=t.data;if(typeof e=="object"&&e!==null&&e&&e.source===m){let s=new URL(window.location.toString()).searchParams,c=s.get("email");s.delete("email");let b=[],h={};for(const[r,f]of s.entries())if(r.match(/token/)!==null){b.push(r);let p=(o=r.match(/^token\[(.*)]$/))==null?void 0:o[1];p&&(h[p]=f)}for(const r of b)s.delete(r);return c&&((n=t.source)==null||n.postMessage({source:T,lead:{email:c}},{targetOrigin:t.origin})),Object.keys(h).length>0&&((i=t.source)==null||i.postMessage({message:u,payload:{token:h}},{targetOrigin:t.origin})),(l=t.source)==null||l.postMessage({source:$,host:{url:window.location.href},url_query:s.toString()},{targetOrigin:t.origin}),(d=t.source)==null||d.postMessage({source:H,tracking:btoa(document.cookie),ref:{original:z(document),current:P(document)}},{targetOrigin:t.origin}),!0}return!1}const L=({tracking:t,encode:e=!0})=>{try{const o="https://api.storylane.io/api/v1/shared/tracking",n=e?btoa(t):t;if("sendBeacon"in navigator){const i=new FormData;i.set("tracking",n),navigator.sendBeacon(o,i)}else fetch(o,{method:"POST",headers:{"Content-Type":"application/json"},keepalive:!0,body:JSON.stringify({tracking:n})})}catch(o){}};function A(t,e){const o=t.split("; ");for(let n=0;n<o.length;n++){const i=o[n];if(i.split("=")[0].match(e))return i}return null}function G(t){const e=t.data;if(typeof e=="object"&&e!==null&&e.type==="hsFormCallback"&&e.eventName==="onFormSubmitted"){const o=A(document.cookie,I);return o&&L({tracking:o}),!0}return!1}function Q(t){const e=t.data;if(typeof e=="object"&&e!==null&&e.message==="LD_SAVE_FORM_DATA"){const o=A(document.cookie,D);return o&&L({tracking:o}),!0}return!1}function X(t){if(typeof t.data=="string"&&t.data.startsWith('{"mktoResponse"')){const e=JSON.parse(t.data);if(typeof e=="object"&&"mktoResponse"in e&&e.mktoResponse.error===!1){const o=A(document.cookie,O);o&&L({tracking:o})}return!0}return!1}function Y(t){t.querySelectorAll("form").forEach(o=>{o.addEventListener("submit",n=>{try{L({tracking:t.cookie})}catch(i){console.error(i)}},{passive:!0,capture:!1})})}const ee=`.sl-preview-img {
  width: 100%;
  height: 100%;
  webkit-filter: blur(1px);
  filter: blur(1px);
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: inherit;
  z-index: 999991;
  object-fit: fill;
}
.sl-ripple-backdrop {
  width: 75px;
  height: 75px;
  webkit-backdrop-filter: blur(1px);
  backdrop-filter: blur(1px);
  background-color: rgba(0, 0, 0, 0);
  position: absolute;
  top: 20%;
  left: 20%;
  z-index: 999991;
}
.sl-ripple-main {
  --ripple-max-size: 75px;
  --circle-size: 22px;
  --color: #9639e7;
  --border-animation-duration: 1.5s;
  --ripple-border-width: 8px;
  --ripple-timing-func: ease-in;

  width: var(--ripple-max-size);
  height: var(--ripple-max-size);
  position: absolute;
  top: 20%;
  left: 20%;
  z-index: 999990;
}

.sl-ripple-center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--circle-size);
  height: var(--circle-size);
  transform: translate(-50%, -50%);
  background-color: var(--color);
  border-radius: 50%;
}

.sl-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: var(--ripple-border-width) solid var(--color);
  animation: enlargeSlRipple var(--border-animation-duration)
    var(--ripple-timing-func) infinite;
  animation-delay: 2s;
  transition-delay: 2s;
}

@keyframes enlargeSlRipple {
  0% {
    width: 0px;
    height: 0px;
    opacity: 1;
  }
  50% {
    opacity: 0.75;
  }
  100% {
    width: var(--ripple-max-size);
    height: var(--ripple-max-size);
    opacity: 0;
    border-width: 0;
  }
}
`;function te(t){const e=t.createElement("style");e.innerHTML=ee,t.head.appendChild(e)}function ne(){if("Storylane"in window)return;const t=new U;window.Storylane=t,oe();function e(){var a,s,c,b,h;Y(document),Z(document),te(document);const o=`
      <div class="sl-ripple-backdrop"></div>
      <div class="sl-ripple-main">
        <div class="sl-ripple-center" style="background-color: $ripple_color"></div>
        <div class="sl-ripple" style="border: 8px solid $ripple_color"></div>
      </div>
    `,n=document.querySelectorAll(".sl-preview");if(n.length>0)for(const r of n){let f="#9639e7",p=o,y=(s=(a=r.parentElement)==null?void 0:a.parentElement)==null?void 0:s.querySelector(".sl-preview-cta");y!=null&&(f=y.style.backgroundColor);let v=document.createElement("img");v.src=((c=r.style.backgroundImage.match(/(https?:\/\/[^ |'|"]*)/))==null?void 0:c[0])||"",v.classList.add("sl-preview-img"),r.appendChild(v),r.style.backgroundImage="",r.parentElement&&(r.parentElement.style.borderRadius="10px"),r.style.borderRadius="inherit",r.innerHTML+=p.replaceAll(/\$ripple_color/g,f)}const i=document.querySelectorAll(".sl-demo-btn");if(i.length>0)for(const r of i)(b=window.Storylane)==null||b.Player({element:r,demo_url:r.getAttribute("data-sl-url"),scale:r.getAttribute("data-sl-scale")});const l=document.querySelectorAll('a[href*="?sl_popup"],a[href*="&sl_popup"]');if(l.length>0)for(const r of l){let f=new URL(r.getAttribute("href")||""),p=new URLSearchParams(f.search),y=p.get("config"),v=y&&y.length?JSON.parse(atob(y)):{};p.delete("config"),p.delete("sl_popup"),f.search=p.toString();const S={element:r,demo_url:f,type:"popup"};r.onclick=function(k){var x;k.preventDefault(),(x=window.Storylane)==null||x.Play(_(_({},S),v))}}const d=document.querySelectorAll(".sl-inline-embed");if(d.length>0)for(const r of d)(h=window.Storylane)==null||h.Embed({element:r,demo_preview:r.getAttribute("data-sl-preview"),demo_url:r.getAttribute("data-sl-url"),scale:r.getAttribute("data-sl-scale")})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",e):e()}function oe(){const t=[B,G,V,Q,X];window.addEventListener("message",e=>{t.some(o=>{try{o(e)}catch(n){console.error(n)}})})}return function(){ne()}(),""}();



var custom_style="#FirstWork{display: none !important;}",sl_custom_style=document.createElement("style");sl_custom_style.innerHTML=custom_style,document.head.appendChild(sl_custom_style),document.addEventListener("DOMContentLoaded",(function(t){const s=document.createElement("script");s.src="https://js.storylane.io/js/v1/analytics.js",document.head.appendChild(s)}));