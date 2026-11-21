export function mat4Perspective(fv, as, n, f) {
  const g = 1 / Math.tan(fv * 0.5), nf = 1 / (n - f);
  return new Float32Array([g / as, 0, 0, 0, 0, g, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]);
}
export function mat4Ortho(l, r, b, t, n, f) {
  const rl = 1 / (r - l), tb = 1 / (t - b), fn = 1 / (f - n);
  return new Float32Array([2 * rl, 0, 0, 0, 0, 2 * tb, 0, 0, 0, 0, -2 * fn, 0, -(r + l) * rl, -(t + b) * tb, -(f + n) * fn, 1]);
}
export function mat4LookAt(e, t, u) {
  let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2], zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl; zy /= zl; zz /= zl;
  let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx, xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
}
export function mat4Mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
const DEFAULT_SUN_DIR = (() => { const x = 0.56, y = 0.36, z = 0.74, l = Math.hypot(x, y, z); return new Float32Array([x / l, y / l, z / l]); })();
const DEFAULT_SUN_COL = new Float32Array([3.25, 2.38, 1.48]);
const ZERO_LPOS = new Float32Array(32);
const ZERO_LCOL = new Float32Array(24);

export async function createGlRenderer(canvas) {
  const gl = canvas.getContext("webgl2", { antialias: false, depth: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  if (!gl) return null;
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const isSoftware = /SwiftShader|llvmpipe|Software|Basic Render/i.test(String((dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || ""));
  const hHf = Boolean(gl.getExtension("EXT_color_buffer_half_float"));
  const anisoExt = gl.getExtension("EXT_texture_filter_anisotropic") || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  const maxAniso = anisoExt ? Math.min(8, gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1) : 1;
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
  const sSz = isSoftware ? 1024 : (maxTex >= 8192 ? 2048 : 2048);

  const compile = (t, src) => {
    const s = gl.createShader(t);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("[verdant-hd-renderer] Shader compile error:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const link = (vsSrc, fsSrc) => {
    const vs = compile(gl.VERTEX_SHADER, vsSrc), fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("[verdant-hd-renderer] Program link error:", gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  };
  const okGl = () => !ctxLost && !gl.isContextLost();
  const tClamp = (f) => {
    gl.texParameteri(T, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(T, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(T, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(T, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const uLocs = (prog, names) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, `u_${n}`)]));

  const iDcl = `layout(location=3) in vec4 i_c0;layout(location=4) in vec4 i_c1;layout(location=5) in vec4 i_c2;layout(location=6) in vec4 i_c3;uniform float u_inst;`;
  const iPos = `vec3 wp=u_inst>0.5?(i_c0.xyz*a_pos.x+i_c1.xyz*a_pos.y+i_c2.xyz*a_pos.z+i_c3.xyz):a_pos;`;
  const B = gl.ARRAY_BUFFER, E = gl.ELEMENT_ARRAY_BUFFER, T = gl.TEXTURE_2D, F = gl.FRAMEBUFFER, R = gl.RENDERBUFFER;
  let sPrg, kPrg, pPrg, oPrg, bPrg, sGpu, dGpu, iGpu, qVao, sShd, shd, hTex, hDep, hFbo, bTex, aTex, mrTex, nmTex, emTex, eTex, uSh, uSk, uPb, uPo;
  let ctxLost = false, cKey = "", hdrW = 0, hdrH = 0, lastDrawnW = 0, lastDrawnH = 0, rScale = 1, casSharp = 0.42, lSB = 0, lDB = 0, fence = null, aEp = 0, hTx = 0, hMr = 0, hNm = 0, hEm = 0, hEv = 0;

  const bPrgAll = () => {
    sPrg = link(
      `#version 300 es\nlayout(location=0) in vec3 a_pos;${iDcl}uniform mat4 u_lmvp;void main(){${iPos}gl_Position=u_lmvp*vec4(wp,1.0);}`,
      `#version 300 es\nprecision mediump float;void main(){}`,
    );

    kPrg = link(
      `#version 300 es\nlayout(location=0) in vec2 a_uv;out vec2 vn;void main(){vn=a_uv*2.0-1.0;gl_Position=vec4(vn,0.9999,1.0);}`,
      `#version 300 es
precision highp float;
in vec2 vn;
uniform vec3 u_fwd,u_right,u_up,u_sky,u_fog,u_sun,u_sunCol,u_mistRgb;
uniform float u_aspect,u_th,u_he,u_skyExp;
uniform sampler2D u_ev;
out vec4 o_hdr;
void main(){
  vec3 rd=normalize(u_fwd+vn.x*u_aspect*u_th*u_right+vn.y*u_th*u_up);
  float mu=max(dot(rd,u_sun),0.0);
  vec3 c;
  if(u_he>0.5){
    vec2 euv=vec2(atan(rd.z,rd.x)*0.159155+0.5,0.5-asin(clamp(rd.y,-1.0,1.0))*0.31831);
    c=pow(texture(u_ev,euv).rgb,vec3(2.2))*(1.08*u_skyExp);
    // Painterly golden-hour Mie sun glow & horizon mist fusion
    float horiz=smoothstep(0.28,-0.08,rd.y);
    vec3 mistLin=pow(max(u_mistRgb,vec3(0.02)),vec3(1.65))*0.92;
    c=mix(c,mistLin,horiz*0.42);
    c+=u_sunCol*pow(mu,7.0)*0.11+u_sunCol*smoothstep(0.996,0.9995,mu)*0.55;
  }else{
    float h=clamp(rd.y,-0.25,1.0);
    vec3 z=pow(max(u_sky,vec3(0.03)),vec3(1.5))*vec3(0.82,1.02,1.35)+vec3(0.015,0.04,0.09);
    vec3 hz=pow(max(u_fog,vec3(0.04)),vec3(1.5))*vec3(1.18,1.12,1.04)+vec3(0.045,0.048,0.044);
    c=mix(hz,z,pow(clamp(h,0.0,1.0),0.50))*u_skyExp;
    if(h<0.0)c=mix(hz,z*0.32,clamp(-h*3.2,0.0,1.0));
    c+=u_sunCol*pow(mu,8.0)*0.22+u_sunCol*smoothstep(0.9975,0.9996,mu)*0.85;
  }
  o_hdr=vec4(max(c,vec3(0.0)),1.0);
}`,
    );

    pPrg = link(
      `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_norm;
layout(location=2) in vec3 a_col;
layout(location=7) in vec2 a_uv;
${iDcl}
uniform mat4 u_mvp,u_lmvp;
out vec3 v_pos,v_norm,v_col;
out vec2 v_uv;
flat out float v_m;
out vec4 v_lp;
void main(){
  ${iPos}
  vec3 wn=u_inst>0.5?normalize(i_c0.xyz*a_norm.x+i_c1.xyz*a_norm.y+i_c2.xyz*a_norm.z):a_norm;
  v_m=floor(a_col.r);
  vec3 ac=vec3(a_col.r-v_m,a_col.gb);
  v_pos=wp;v_norm=wn;v_uv=a_uv;
  v_col=u_inst>0.5?ac*vec3(i_c0.w,i_c1.w,i_c2.w):ac;
  v_lp=u_lmvp*vec4(wp+wn*0.045,1.0);
  gl_Position=u_mvp*vec4(wp,1.0);
}`,
      `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 v_pos,v_norm,v_col;
in vec2 v_uv;
flat in float v_m;
in vec4 v_lp;
uniform vec3 u_eye,u_fog,u_sky,u_sun,u_sunCol,u_shTint;
uniform vec4 u_mist,u_grade;
uniform vec2 u_mistH;
uniform float u_time,u_sh,u_is,u_q,u_ht,u_hm,u_hn,u_hm2,u_he,u_wRef;
uniform int u_lcnt;
uniform vec4 u_lpos[8];
uniform vec3 u_lcol[8];
uniform sampler2DShadow u_smap;
uniform sampler2D u_at,u_mr,u_nm,u_em,u_ev;
out vec4 o_hdr;

float h3(vec3 p){p=fract(p*vec3(0.1031,0.103,0.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float tG(vec3 p){
  vec3 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  float n00=mix(h3(i),h3(i+vec3(1,0,0)),f.x);
  float n10=mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x);
  float n01=mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x);
  float n11=mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x);
  return mix(mix(n00,n10,f.y),mix(n01,n11,f.y),f.z);
}

float sS(vec4 lp,float ndl){
  if(u_sh<0.5)return 1.0;
  vec3 p=lp.xyz/max(lp.w,1e-4)*0.5+0.5;
  vec2 e=smoothstep(vec2(0.0),vec2(0.06),p.xy)*(1.0-smoothstep(vec2(0.94),vec2(1.0),p.xy));
  float m=e.x*e.y*step(0.0,p.z)*step(p.z,1.0);
  if(m<=0.001)return 1.0;
  float b=max(0.0015*(1.0-ndl),0.00042),a=0.0;
  if(u_q<1.5)return mix(1.0,texture(u_smap,vec3(p.xy,p.z-b)),m);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)a+=texture(u_smap,vec3(p.xy+vec2(float(x),float(y))*u_is,p.z-b));
  return mix(1.0,a/9.0,m);
}

vec3 pertN(vec3 N,vec3 p,vec2 uv,float relief){
  vec3 dp1=dFdx(p),dp2=dFdy(p);
  vec2 duv1=dFdx(uv),duv2=dFdy(uv);
  vec3 dp2p=cross(dp2,N),dp1p=cross(N,dp1);
  vec3 T=dp2p*duv1.x+dp1p*duv2.x,B=dp2p*duv1.y+dp1p*duv2.y;
  float im=inversesqrt(max(dot(T,T),dot(B,B))+1e-5);
  vec3 mn=texture(u_nm,uv).xyz*2.0-1.0;
  mn.xy*=relief;
  return normalize(mat3(T*im,B*im,N)*normalize(mn));
}

void main(){
  vec3 te=u_eye-v_pos;
  float d=length(te);
  vec3 n=normalize(v_norm),v=te/max(d,1e-4),l=u_sun;
  bool iW=v_m==1.0,iM=v_m==2.0,iV=v_m==3.0,iC=v_m==4.0;
  bool tx=u_ht>0.5&&v_uv.x>-0.5;
  float relief=max(u_grade.z,0.8);

  float fd=(iW||tx||iC||iV)?0.0:step(1.0,u_q)*(1.0-smoothstep(75.0,145.0,d));
  float g1=mix(0.5,tG(v_pos*1.85),fd);
  float g2=mix(0.5,tG(v_pos*5.6),fd);
  float g3=mix(0.5,tG(v_pos*15.5),fd);

  if(tx&&u_hn>0.5){
    n=pertN(n,v_pos,v_uv,relief);
  }else if(fd>0.001){
    // High-definition 3D world-space painterly leaf-cluster & craggy basalt micro-relief
    float mc=(g1-0.5)*0.15+(g2-0.5)*0.095+(g3-0.5)*0.045;
    vec3 c1=cross(dFdx(v_pos),n),c2=cross(n,dFdy(v_pos));
    float bumpAmt=iM?0.75:2.35;
    n=normalize(n+((c1/max(length(c1),1e-4))*dFdx(mc)+(c2/max(length(c2),1e-4))*dFdy(mc))*bumpAmt);
  }

  if(iW){
    float w1=sin(v_pos.x*1.65+u_time*1.9)*cos(v_pos.z*1.45-u_time*1.45);
    float w2=sin((v_pos.x*1.1+v_pos.z*0.9)*3.4-u_time*2.6)*0.52;
    float w3=cos((v_pos.x*0.7-v_pos.z*1.3)*5.2+u_time*3.2)*0.26;
    n=normalize(n+vec3((w1+w2+w3)*0.056,0.0,(w1-w2+w3)*0.056));
  }

  vec3 ab=tx?pow(max(texture(u_at,v_uv).rgb,vec3(0.015)),vec3(2.2)):pow(max(v_col,vec3(0.015)),vec3(2.05));
  if(!iW&&!iV&&!tx&&!iC){
    // Painterly dappled foliage / mineral speckle + subtle warm golden rim on sunlit crowns
    float dapple=0.72+0.36*g1+0.20*g2+0.08*g3;
    ab*=dapple;
    if(ab.g>ab.r*1.08&&ab.g>ab.b*1.1){
      // Foliage boughs: add warm golden-olive sunlit leaf highlights & deep pine crevices
      ab=mix(ab*vec3(0.76,0.88,0.74),ab*vec3(1.24,1.12,0.82),smoothstep(0.42,0.78,g1*0.65+g2*0.35));
    }
  }
  if(iC)ab*=0.93+0.14*tG(v_pos*24.0);
  if(tx){
    // Blend vertex tint softly into textured terrain/stone for rich macro moss & wet-basalt depth
    ab*=mix(vec3(1.0),pow(max(v_col,vec3(0.18)),vec3(1.25))*1.18,0.34);
  }

  float mt=iW?0.05:(iM?0.78:(iC?0.05:0.05));
  float rg=iW?0.055:(iM?0.24:(iC?0.52:clamp(0.74-0.22*g2,0.28,0.92)));
  if(tx&&u_hm>0.5){
    vec3 mrs=texture(u_mr,v_uv).rgb;
    rg=clamp(mrs.g,0.08,0.96);
    mt=clamp(mrs.b,0.0,1.0);
  }

  float ndlRaw=dot(n,l),ndl=max(ndlRaw,0.0),ndv=max(dot(n,v),1e-3);
  float diffL=iC?max((ndlRaw+0.42)/1.42,0.0):ndl;
  vec3 h=normalize(l+v);
  float ndh=max(dot(n,h),0.0),vdh=max(dot(v,h),0.0);
  float sw=sS(v_lp,ndl);
  float a=rg*rg,a2=a*a,dn=ndh*ndh*(a2-1.0)+1.0;
  float dg=a2/max(3.14159265*dn*dn,1e-4);
  float k=(rg+1.0)*(rg+1.0)*0.125;
  float gs=(ndv/(ndv*(1.0-k)+k))*(max(diffL,1e-3)/(max(diffL,1e-3)*(1.0-k)+k));
  vec3 f0=mix(vec3(0.04),ab,mt);
  vec3 fr=f0+(1.0-f0)*pow(1.0-vdh,5.0);
  vec3 sp=(dg*gs*fr)/max(4.0*ndv*max(ndl,0.08),1e-3);
  vec3 kd=(1.0-fr)*(1.0-mt);
  vec3 sr=u_sunCol*sw;
  vec3 dr=(kd*ab/3.14159265*diffL+sp*ndl)*sr;

  // Painterly crevice ambient occlusion
  float ao=u_q>=1.5?clamp(1.0-length(fwidth(n))*(iC?0.20:0.44),iC?0.72:0.48,1.0):clamp(1.0-length(fwidth(n))*0.24,0.68,1.0);
  vec3 sl=pow(max(u_sky,vec3(0.03)),vec3(1.55))*(0.96*u_grade.w)+u_shTint;
  vec3 fl=pow(max(u_fog,vec3(0.03)),vec3(1.55))*(0.92*u_grade.w)+u_shTint*0.65;
  vec3 hm=mix(u_shTint*1.28,sl,0.5+0.5*n.y);
  // Subtle warm sun bounce fill on undersides
  hm+=u_sunCol*0.032*max(-n.y*0.5+0.5,0.0);
  vec3 rD=reflect(-v,n);
  vec3 envRef=u_he>0.5
    ?pow(texture(u_ev,vec2(atan(rD.z,rD.x)*0.159155+0.5,0.5-asin(clamp(rD.y,-1.0,1.0))*0.31831)).rgb,vec3(2.2))*(1.05*u_grade.w)
    :mix(fl,sl,clamp(rD.y*0.5+0.5,0.0,1.0));
  vec3 ib=envRef*(1.0-rg*0.74);
  vec3 fE=f0+(max(vec3(1.0-rg),f0)-f0)*pow(1.0-ndv,5.0);
  vec3 lt=dr+(kd*ab*hm+ib*fE)*ao;

  // Organic character/cloth subsurface warmth & golden-hour rim light
  if(iC){
    float rim=pow(1.0-ndv,2.5)*smoothstep(-0.15,0.82,n.y);
    float sunRim=rim*(0.35+0.65*max(dot(n,l),0.0));
    lt+=ab*vec3(0.14,0.10,0.075)+u_sunCol*sunRim*0.16+sl*rim*0.22;
  }

  // Real dynamic multi-point lantern, hearth & waystone lights (up to 8)
  vec3 waterPtSpec=vec3(0.0);
  for(int i=0;i<8;i++){
    if(i>=u_lcnt)break;
    vec3 toL=u_lpos[i].xyz-v_pos;
    float dist=length(toL);
    float rad=max(u_lpos[i].w,0.5);
    if(dist<rad){
      float u=dist/rad;
      float att=(1.0-u*u);
      att=(att*att)/(1.0+0.12*dist*dist);
      vec3 lp=toL/max(dist,1e-4);
      float lndl=iC?max((dot(n,lp)+0.35)/1.35,0.0):max(dot(n,lp),0.0);
      vec3 lh=normalize(lp+v);
      float lndh=max(dot(n,lh),0.0);
      float specExp=iW?110.0:mix(72.0,14.0,rg);
      float lspec=pow(lndh,specExp)*(iW?1.35:(0.16+0.52*(1.0-rg)));
      if(iW){
        waterPtSpec+=u_lcol[i]*lspec*att*0.95;
      }else{
        lt+=(kd*ab*lndl+f0*lspec)*u_lcol[i]*att;
      }
    }
  }

  if(tx&&u_hm2>0.5)lt+=pow(texture(u_em,v_uv).rgb,vec3(2.2))*2.0;
  // Luminous emissives overdrive HDR (>1.0) so bloom creates warm halos around lanterns & windows
  if(iV)lt=ab*2.05+ab*0.35*sw;

  // Deep reflective Fresnel gorge water with golden sun sparkle & warm lantern pools
  if(iW){
    float fres=clamp(0.20+u_wRef*pow(1.0-ndv,3.4),0.0,0.96);
    vec3 deepWater=ab*(hm*0.95+u_sunCol*0.14*sw);
    vec3 sunGlint=u_sunCol*pow(ndh,140.0)*sw*1.45;
    lt=mix(deepWater,envRef*0.86+sl*0.18,fres)+sunGlint+waterPtSpec;
  }

  // Distance atmospheric perspective + altitude-modulated gorge mist + golden sun forward scatter
  float distFog=tx?clamp(1.0-exp(-max(0.0,d-34.0)*0.0085),0.0,0.58):clamp(1.0-exp(-max(0.0,d-26.0)*0.0092),0.0,0.68);
  float heightFactor=exp(-max(0.0,v_pos.y-u_mistH.x)*max(u_mistH.y,0.02));
  float gorgeMist=clamp((1.0-exp(-max(0.0,d-8.0)*0.026))*heightFactor*u_mist.a,0.0,0.62);
  float totalFog=clamp(max(distFog,gorgeMist),0.0,0.74);
  float sunScatter=pow(max(dot(-v,l),0.0),5.0);
  vec3 mistCol=pow(max(u_mist.rgb,vec3(0.02)),vec3(1.65))*0.95+u_sunCol*sunScatter*0.14;
  vec3 fogCol=mix(fl,mistCol,0.62);
  o_hdr=vec4(max(mix(lt,fogCol,totalFog),vec3(0.0)),1.0);
}`,
    );

    oPrg = link(
      `#version 300 es\nlayout(location=0) in vec2 a_uv;out vec2 v_uv;void main(){v_uv=a_uv;gl_Position=vec4(a_uv*2.0-1.0,0.0,1.0);}`,
      `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_hdr;
uniform vec2 u_ir;
uniform float u_cas;
uniform vec4 u_post;
uniform vec2 u_tone;
out vec4 o_col;
vec3 ac(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
vec3 bp(vec3 x,float thr){float l=dot(x,vec3(0.2126,0.7152,0.0722));return x*smoothstep(thr,thr+0.85,l);}
void main(){
  vec3 c=texture(u_hdr,v_uv).rgb;
  vec3 n=texture(u_hdr,v_uv+vec2(0.0,u_ir.y)).rgb;
  vec3 s=texture(u_hdr,v_uv-vec2(0.0,u_ir.y)).rgb;
  vec3 e=texture(u_hdr,v_uv+vec2(u_ir.x,0.0)).rgb;
  vec3 w=texture(u_hdr,v_uv-vec2(u_ir.x,0.0)).rgb;
  vec3 av=(n+s+e+w)*0.25;
  vec3 mn=min(c,min(min(n,s),min(e,w)));
  vec3 mx=max(c,max(max(n,s),max(e,w)));
  vec3 sharp=clamp(c+(c-av)*u_cas,mn,mx);
  vec3 res=u_cas>0.01?sharp:mix(c,(c+av)*0.5,clamp(length(c-av)*2.2,0.0,0.45));

  // Single-pass 9-tap HDR bright-pass warm bloom for lanterns, forge windows & waystones
  float bloomStr=u_post.x,thr=u_post.y,vigStr=u_post.z;
  if(bloomStr>0.01){
    vec2 d1=u_ir*2.6,d2=u_ir*5.8;
    vec3 b=bp(c,thr)*0.24+(bp(n,thr)+bp(s,thr)+bp(e,thr)+bp(w,thr))*0.09;
    b+=(bp(texture(u_hdr,v_uv+vec2(d1.x,d1.y)).rgb,thr)+bp(texture(u_hdr,v_uv+vec2(-d1.x,d1.y)).rgb,thr)+bp(texture(u_hdr,v_uv+vec2(d1.x,-d1.y)).rgb,thr)+bp(texture(u_hdr,v_uv+vec2(-d1.x,-d1.y)).rgb,thr))*0.075;
    b+=(bp(texture(u_hdr,v_uv+vec2(d2.x,0.0)).rgb,thr)+bp(texture(u_hdr,v_uv-vec2(d2.x,0.0)).rgb,thr)+bp(texture(u_hdr,v_uv+vec2(0.0,d2.y)).rgb,thr)+bp(texture(u_hdr,v_uv-vec2(0.0,d2.y)).rgb,thr))*0.045;
    res+=b*bloomStr;
  }

  // Cinematic exposure, ACES filmic tone mapping, gentle chiaroscuro contrast & vignette
  vec3 mapped=ac(res*max(u_tone.x,0.65));
  float ctr=clamp(u_tone.y,0.85,1.30);
  mapped=clamp((mapped-0.5)*ctr+0.5,0.0,1.0);
  vec2 uvC=v_uv*2.0-1.0;
  float vig=1.0-vigStr*clamp(dot(uvC,uvC)*0.48,0.0,1.0);
  mapped*=vig;
  o_col=vec4(pow(max(mapped,vec3(0.0)),vec3(1.0/2.2)),1.0);
}`,
    );

    bPrg = link(
      `#version 300 es\nlayout(location=0) in vec2 a_uv;out vec2 v_uv;void main(){v_uv=vec2(a_uv.x,1.0-a_uv.y);gl_Position=vec4(a_uv*2.0-1.0,0.0,1.0);}`,
      `#version 300 es\nprecision mediump float;in vec2 v_uv;uniform sampler2D u_tex;out vec4 o_col;void main(){o_col=texture(u_tex,v_uv);}`,
    );
    return Boolean(sPrg && kPrg && pPrg && oPrg);
  };

  const mkVao = (instanced = false) => {
    const vao = gl.createVertexArray(), pos = gl.createBuffer(), norm = gl.createBuffer(), col = gl.createBuffer(), uv = gl.createBuffer(), idx = gl.createBuffer();
    const inst = instanced ? gl.createBuffer() : null;
    gl.bindVertexArray(vao);
    [pos, norm, col].forEach((b, loc) => { gl.bindBuffer(B, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0); });
    gl.vertexAttrib2f(7, -2, -2);
    if (inst) {
      gl.bindBuffer(B, inst);
      for (let k = 0; k < 4; k++) { gl.enableVertexAttribArray(3 + k); gl.vertexAttribPointer(3 + k, 4, gl.FLOAT, false, 64, k * 16); gl.vertexAttribDivisor(3 + k, 1); }
    }
    gl.bindBuffer(E, idx); gl.bindVertexArray(null);
    return { vao, pos, norm, col, uv, idx, inst, count: 0, instCount: 0, capPos: 0, capNorm: 0, capCol: 0, capIdx: 0, epoch: 0 };
  };
  const mkShd = () => {
    const tex = gl.createTexture(), fbo = gl.createFramebuffer();
    gl.bindTexture(T, tex); gl.texImage2D(T, 0, gl.DEPTH_COMPONENT24, sSz, sSz, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    tClamp(gl.LINEAR); gl.texParameteri(T, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(T, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.bindFramebuffer(F, fbo); gl.framebufferTexture2D(F, gl.DEPTH_ATTACHMENT, T, tex, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    return { tex, fbo };
  };
  const mk1 = (c, f = gl.LINEAR) => { const t = gl.createTexture(); gl.bindTexture(T, t); tClamp(f); gl.texImage2D(T, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(c)); return t; };
  const bGpu = () => {
    gl.getExtension("EXT_color_buffer_half_float");
    if (!bPrgAll()) return false;
    sGpu = mkVao(false); dGpu = mkVao(false); iGpu = mkVao(true);
    qVao = gl.createVertexArray(); const qBuf = gl.createBuffer();
    gl.bindVertexArray(qVao); gl.bindBuffer(B, qBuf);
    gl.bufferData(B, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
    sShd = mkShd(); shd = mkShd();
    hTex = gl.createTexture(); hDep = gl.createRenderbuffer(); hFbo = gl.createFramebuffer();
    bTex = mk1([0, 0, 0, 255], gl.NEAREST);
    aTex = mk1([255, 255, 255, 255]);
    mrTex = mk1([255, 160, 0, 255]);
    nmTex = mk1([128, 128, 255, 255]);
    emTex = mk1([0, 0, 0, 255]);
    eTex = mk1([20, 24, 32, 255]);
    gl.bindFramebuffer(F, null);
    uSh = uLocs(sPrg, ["lmvp", "inst"]);
    uSk = uLocs(kPrg, ["fwd", "right", "up", "sky", "fog", "sun", "sunCol", "mistRgb", "aspect", "th", "he", "skyExp", "ev"]);
    uPb = uLocs(pPrg, [
      "mvp", "lmvp", "eye", "fog", "sky", "sun", "sunCol", "shTint", "mist", "mistH", "grade",
      "time", "sh", "is", "smap", "inst", "q", "ht", "hm", "hn", "hm2", "he", "wRef",
      "lcnt", "lpos", "lcol", "at", "mr", "nm", "em", "ev",
    ]);
    uPo = uLocs(oPrg, ["hdr", "ir", "cas", "post", "tone"]);
    hdrW = hdrH = lastDrawnW = lastDrawnH = 0; cKey = ""; fence = null; aEp = 0; hTx = hMr = hNm = hEm = hEv = 0;
    return true;
  };
  if (!bGpu()) return null;
  canvas.addEventListener?.("webglcontextlost", (e) => { e.preventDefault?.(); ctxLost = true; fence = null; });
  canvas.addEventListener?.("webglcontextrestored", () => { ctxLost = false; bGpu(); });
  const dQuad = () => { gl.bindVertexArray(qVao); gl.drawArrays(gl.TRIANGLES, 0, 6); };
  const eHdr = (w, h) => {
    if (w === hdrW && h === hdrH) return true;
    hdrW = w; hdrH = h;
    gl.bindTexture(T, hTex); gl.texImage2D(T, 0, hHf ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, hHf ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null); tClamp(gl.LINEAR);
    gl.bindRenderbuffer(R, hDep); gl.renderbufferStorage(R, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(F, hFbo); gl.framebufferTexture2D(F, gl.COLOR_ATTACHMENT0, T, hTex, 0); gl.framebufferRenderbuffer(F, gl.DEPTH_ATTACHMENT, R, hDep);
    const ok = gl.checkFramebufferStatus(F) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(F, null); return ok;
  };
  let csmFar = 36.0;
  const sUp = (t, b, v, k) => {
    gl.bindBuffer(t, b);
    if (v.byteLength > dGpu[k]) { dGpu[k] = Math.max(v.byteLength * 2, 16384); gl.bufferData(t, dGpu[k], gl.STREAM_DRAW); }
    if (v.byteLength > 0) gl.bufferSubData(t, 0, v);
  };

  const upPbrTex = (tex, s, w, h) => {
    gl.bindTexture(T, tex); gl.texImage2D(T, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, s);
    gl.texParameteri(T, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(T, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(T, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(T, gl.TEXTURE_WRAP_T, gl.REPEAT);
    if (anisoExt && !isSoftware && maxAniso > 1) gl.texParameterf(T, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    gl.generateMipmap(T);
  };
  const uBs = (arr, sum) => { for (const [t, b, d] of arr) { gl.bindBuffer(t, b); gl.bufferData(t, d, gl.STATIC_DRAW); if (sum) lSB += d.byteLength; } };
  const sunBuf = new Float32Array(3);
  const sunColBuf = new Float32Array(3);
  const shTintBuf = new Float32Array(3);
  const mistRgbBuf = new Float32Array(3);
  const lPosBuf = new Float32Array(32);
  const lColBuf = new Float32Array(24);

  return {
    backend: "webgl2", isSoftware, maxTextureSize: maxTex, maxAnisotropy: isSoftware ? 1 : maxAniso,
    setRenderScale(pm, casPm = null) {
      rScale = Math.max(0.5, Math.min(1, (pm || 1000) / 1000));
      if (typeof casPm === "number" && Number.isFinite(casPm)) {
        casSharp = Math.max(0.14, Math.min(0.75, casPm / 1000));
      }
    },
    setCsmSplits(s) { const s1 = Number(s?.[1]); if (Number.isFinite(s1) && s1 > 8) { csmFar = Math.max(22, Math.min(48, s1)); cKey = ""; } },
    getUploadTelemetry() { return { staticBytes: lSB, dynBytes: lDB, staticEpoch: sGpu.epoch, instCount: iGpu.instCount, ctxLost, maxTex, maxAniso: isSoftware ? 1 : maxAniso }; },
    setTex(k, s, w, h, ep) {
      if (!okGl()) return;
      if (k === 2) {
        if (!s) { hEv = 0; return; }
        gl.bindTexture(T, eTex); gl.texImage2D(T, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s); tClamp(gl.LINEAR); hEv = 1;
        return;
      }
      if (k === 3) {
        if (!s || w <= 0 || h <= 0) { hMr = 0; return; }
        upPbrTex(mrTex, s, w, h); hMr = 1; return;
      }
      if (k === 4) {
        if (!s || w <= 0 || h <= 0) { hNm = 0; return; }
        upPbrTex(nmTex, s, w, h); hNm = 1; return;
      }
      if (k === 5) {
        if (!s || w <= 0 || h <= 0) { hEm = 0; return; }
        upPbrTex(emTex, s, w, h); hEm = 1; return;
      }
      if (!s || w <= 0 || h <= 0) { hTx = hMr = hNm = hEm = 0; return; }
      if (ep && ep === aEp && hTx) return;
      upPbrTex(aTex, s, w, h);
      aEp = ep; hTx = 1;
    },
    uploadSplitBuffers(sv, dv, iv = null) {
      if (!okGl()) return;
      lSB = lDB = 0;
      if (sv && sv.epoch !== sGpu.epoch) {
        uBs([[B, sGpu.pos, sv.pos], [B, sGpu.norm, sv.norm], [B, sGpu.col, sv.col], [E, sGpu.idx, sv.idx]], 1);
        gl.bindVertexArray(sGpu.vao);
        if (sv.uv && sv.uv.length >= (sv.pos.length / 3) * 2) {
          gl.bindBuffer(B, sGpu.uv); gl.bufferData(B, sv.uv, gl.STATIC_DRAW); gl.enableVertexAttribArray(7); gl.vertexAttribPointer(7, 2, gl.FLOAT, false, 0, 0);
        } else { gl.disableVertexAttribArray(7); gl.vertexAttrib2f(7, -2, -2); }
        gl.bindVertexArray(null); sGpu.count = sv.idx.length; sGpu.idxCap = sv.idx.byteLength; sGpu.epoch = sv.epoch; cKey = "";
      }
      if (dv && dv.idx.length > 0) {
        sUp(B, dGpu.pos, dv.pos, "capPos"); sUp(B, dGpu.norm, dv.norm, "capNorm"); sUp(B, dGpu.col, dv.col, "capCol"); sUp(E, dGpu.idx, dv.idx, "capIdx");
        dGpu.count = dv.idx.length; lDB = dv.pos.byteLength * 3 + dv.idx.byteLength;
      } else dGpu.count = 0;
      if (iv && iv.instCount > 0) {
        if (iv.epoch !== iGpu.epoch) {
          uBs([[B, iGpu.pos, iv.pos], [B, iGpu.norm, iv.norm], [B, iGpu.col, iv.col], [E, iGpu.idx, iv.idx], [B, iGpu.inst, iv.data]]);
          iGpu.count = iv.idx.length; iGpu.instCount = iv.instCount; iGpu.epoch = iv.epoch;
        }
      } else iGpu.instCount = 0;
    },
    uploadPackedBuffers(p, n, c, ix) {
      if (!okGl()) return;
      uBs([[B, sGpu.pos, p], [B, sGpu.norm, n], [B, sGpu.col, c], [E, sGpu.idx, ix]]);
      sGpu.count = ix.length; sGpu.epoch = (sGpu.epoch + 1) >>> 0; dGpu.count = 0; cKey = "";
    },
    updateStaticIndices(ix) {
      if (!okGl() || !ix || ix.length === 0) return;
      gl.bindBuffer(E, sGpu.idx);
      if (ix.byteLength <= (sGpu.idxCap || 0)) {
        gl.bufferSubData(E, 0, ix);
      } else {
        sGpu.idxCap = Math.max(ix.byteLength, (sGpu.idxCap || 0) * 2);
        gl.bufferData(E, sGpu.idxCap, gl.DYNAMIC_DRAW);
        gl.bufferSubData(E, 0, ix);
      }
      sGpu.count = ix.length;
    },
    render(mvp, eye, lodSpec, timeSec, lTgt = [0, 1.8, 0], fovRad = Math.PI / 3.4, forceSync = false) {
      const w = canvas.width | 0, h = canvas.height | 0;
      if (ctxLost || w <= 0 || h <= 0 || gl.isContextLost()) return;
      const resized = w !== lastDrawnW || h !== lastDrawnH;
      if (fence) {
        if (!forceSync && !resized && gl.getSyncParameter(fence, gl.SYNC_STATUS) === gl.UNSIGNALED && isSoftware) return;
        gl.deleteSync(fence); fence = null;
      }
      lastDrawnW = w; lastDrawnH = h;
      const rank = lodSpec?.rank ?? 3;
      const quality = isSoftware ? Math.min(2, rank) : (rank >= 2 ? 2 : 1);
      const sky = lodSpec?.sky ?? [0.18, 0.3, 0.38], fog = lodSpec?.fog ?? [0.3, 0.4, 0.44];
      const hd = lodSpec?.hd || null;

      // Dynamic extrapolated sun direction & radiance
      const rawSun = hd?.sunDir || DEFAULT_SUN_DIR;
      const slen = Math.hypot(rawSun[0], rawSun[1], rawSun[2]) || 1;
      sunBuf[0] = rawSun[0] / slen; sunBuf[1] = rawSun[1] / slen; sunBuf[2] = rawSun[2] / slen;
      const rawSunCol = hd?.sunCol || DEFAULT_SUN_COL;
      sunColBuf[0] = rawSunCol[0]; sunColBuf[1] = rawSunCol[1]; sunColBuf[2] = rawSunCol[2];
      const rawShTint = hd?.shadowTint || [0.068, 0.095, 0.142];
      shTintBuf[0] = rawShTint[0]; shTintBuf[1] = rawShTint[1]; shTintBuf[2] = rawShTint[2];
      const rawMist = hd?.mistRgb || fog;
      mistRgbBuf[0] = rawMist[0]; mistRgbBuf[1] = rawMist[1]; mistRgbBuf[2] = rawMist[2];
      const mistDensity = hd?.mistDensity ?? 0.38;
      const mistBaseY = hd?.mistBaseY ?? -0.4;
      const mistFalloff = hd?.mistFalloff ?? 0.14;
      const exposure = hd?.exposure ?? 1.08;
      const contrast = hd?.contrast ?? 1.12;
      const normalRelief = hd?.normalRelief ?? 1.40;
      const skyExposure = hd?.skyExposure ?? 0.94;
      const bloomStrength = hd?.bloomStrength ?? 0.42;
      const bloomThreshold = hd?.bloomThreshold ?? 0.92;
      const vignetteStrength = hd?.vignetteStrength ?? 0.22;
      const waterReflectivity = hd?.waterReflectivity ?? 0.88;

      const lcnt = Math.max(0, Math.min(8, hd?.pointLightCount ?? 0));
      if (lcnt > 0 && hd?.pointLightPosRad && hd?.pointLightColor) {
        for (let i = 0; i < 32; i++) lPosBuf[i] = hd.pointLightPosRad[i] || 0;
        for (let i = 0; i < 24; i++) lColBuf[i] = hd.pointLightColor[i] || 0;
      }

      // Compute dynamic light-space basis for texel-snapped shadows
      let lRx = sunBuf[2], lRy = 0, lRz = -sunBuf[0];
      const lRl = Math.hypot(lRx, lRy, lRz) || 1;
      lRx /= lRl; lRy /= lRl; lRz /= lRl;
      const lUx = sunBuf[1] * lRz - sunBuf[2] * lRy;
      const lUy = sunBuf[2] * lRx - sunBuf[0] * lRz;
      const lUz = sunBuf[0] * lRy - sunBuf[1] * lRx;

      const tIdx = sGpu.count + dGpu.count + (iGpu.instCount > 0 ? iGpu.count : 0);
      const shOn = rank >= 1 && tIdx > 0 ? 1 : 0;
      const fx = lTgt[0] ?? 0, fy = lTgt[1] ?? 1.5, fz = lTgt[2] ?? 0;
      const texel = (2 * csmFar) / sSz;
      const tu = Math.round((fx * lRx + fy * lRy + fz * lRz) / texel);
      const tv = Math.round((fx * lUx + fy * lUy + fz * lUz) / texel);
      const tw = Math.round((fx * sunBuf[0] + fy * sunBuf[1] + fz * sunBuf[2]) * 0.5) * 2;
      const su = tu * texel, sv = tv * texel;
      const sfx = su * lRx + sv * lUx + tw * sunBuf[0];
      const sfy = su * lRy + sv * lUy + tw * sunBuf[1];
      const sfz = su * lRz + sv * lUz + tw * sunBuf[2];
      const lOrt = mat4Ortho(-csmFar, csmFar, -csmFar, csmFar, -56, 72);
      const lmvp = mat4Mul(lOrt, mat4LookAt([sfx + sunBuf[0] * 18, sfy + sunBuf[1] * 18, sfz + sunBuf[2] * 18], [sfx, sfy, sfz], [0, 1, 0]));

      const bU = (i, t, u) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(T, t); gl.uniform1i(u, i); };
      const dE = (u, g, inst = 0) => {
        if (!g.count || (inst && !g.instCount)) return;
        gl.uniform1f(u, inst); gl.bindVertexArray(g.vao);
        inst ? gl.drawElementsInstanced(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0, g.instCount) : gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0);
      };
      if (shOn) {
        const sk = `${Math.round(sunBuf[0] * 100)},${Math.round(sunBuf[1] * 100)},${Math.round(sunBuf[2] * 100)}`;
        const key = `${sGpu.epoch}:${tu},${tv},${tw}:${csmFar}:${sk}`;
        gl.colorMask(false, false, false, false); gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.8, 3);
        gl.useProgram(sPrg); gl.uniformMatrix4fv(uSh.lmvp, false, lmvp);
        if (key !== cKey) {
          gl.bindFramebuffer(F, sShd.fbo); gl.viewport(0, 0, sSz, sSz); gl.clear(gl.DEPTH_BUFFER_BIT);
          dE(uSh.inst, sGpu); cKey = key;
        }
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sShd.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, shd.fbo);
        gl.blitFramebuffer(0, 0, sSz, sSz, 0, 0, sSz, sSz, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(F, shd.fbo); gl.viewport(0, 0, sSz, sSz);
        dE(uSh.inst, dGpu); if (!isSoftware) dE(uSh.inst, iGpu, 1);
        gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true, true, true, true);
      }

      const sc = isSoftware ? Math.min(rScale, 0.92) : rScale;
      const rw = sc >= 0.999 ? w : Math.max(16, Math.round((w * sc) / 16) * 16);
      const rh = sc >= 0.999 ? h : Math.max(16, Math.round((h * sc) / 16) * 16);
      const useHdr = eHdr(rw, rh);
      gl.bindFramebuffer(F, useHdr ? hFbo : null); gl.viewport(0, 0, useHdr ? rw : w, useHdr ? rh : h);
      gl.clearColor(sky[0], sky[1], sky[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      let fdx = fx - eye[0], fdy = fy - eye[1], fdz = fz - eye[2];
      const fl = Math.hypot(fdx, fdy, fdz) || 1; fdx /= fl; fdy /= fl; fdz /= fl;
      const rl = Math.hypot(-fdz, fdx) || 1, rdx = -fdz / rl, rdz = fdx / rl;
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.useProgram(kPrg);
      gl.uniform3f(uSk.fwd, fdx, fdy, fdz); gl.uniform3f(uSk.right, rdx, 0, rdz); gl.uniform3f(uSk.up, -rdz * fdy, rdz * fdx - rdx * fdz, rdx * fdy);
      gl.uniform3fv(uSk.sky, sky); gl.uniform3fv(uSk.fog, fog); gl.uniform3fv(uSk.sun, sunBuf);
      gl.uniform3fv(uSk.sunCol, sunColBuf); gl.uniform3fv(uSk.mistRgb, mistRgbBuf);
      gl.uniform1f(uSk.aspect, w / h); gl.uniform1f(uSk.th, Math.tan(fovRad * 0.5)); gl.uniform1f(uSk.he, hEv); gl.uniform1f(uSk.skyExp, skyExposure);
      bU(2, eTex, uSk.ev); dQuad();

      gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
      if (tIdx > 0 && mvp) {
        gl.useProgram(pPrg);
        gl.uniformMatrix4fv(uPb.mvp, false, mvp); gl.uniformMatrix4fv(uPb.lmvp, false, lmvp);
        gl.uniform3fv(uPb.eye, eye); gl.uniform3fv(uPb.fog, fog); gl.uniform3fv(uPb.sky, sky);
        gl.uniform3fv(uPb.sun, sunBuf); gl.uniform3fv(uPb.sunCol, sunColBuf); gl.uniform3fv(uPb.shTint, shTintBuf);
        gl.uniform4f(uPb.mist, mistRgbBuf[0], mistRgbBuf[1], mistRgbBuf[2], mistDensity);
        gl.uniform2f(uPb.mistH, mistBaseY, mistFalloff);
        gl.uniform4f(uPb.grade, exposure, contrast, normalRelief, skyExposure);
        gl.uniform1f(uPb.time, timeSec); gl.uniform1f(uPb.sh, shOn); gl.uniform1f(uPb.is, 1 / sSz); gl.uniform1f(uPb.q, quality);
        gl.uniform1f(uPb.ht, hTx); gl.uniform1f(uPb.hm, hMr); gl.uniform1f(uPb.hn, hNm); gl.uniform1f(uPb.hm2, hEm); gl.uniform1f(uPb.he, hEv);
        gl.uniform1f(uPb.wRef, waterReflectivity);
        gl.uniform1i(uPb.lcnt, lcnt);
        gl.uniform4fv(uPb.lpos, lcnt > 0 ? lPosBuf : ZERO_LPOS);
        gl.uniform3fv(uPb.lcol, lcnt > 0 ? lColBuf : ZERO_LCOL);
        bU(0, shd.tex, uPb.smap); bU(1, aTex, uPb.at); bU(2, eTex, uPb.ev);
        bU(3, mrTex, uPb.mr); bU(4, nmTex, uPb.nm); bU(5, emTex, uPb.em);
        dE(uPb.inst, sGpu); dE(uPb.inst, dGpu); dE(uPb.inst, iGpu, 1);
      }
      if (useHdr) {
        gl.bindFramebuffer(F, null); gl.viewport(0, 0, w, h); gl.disable(gl.DEPTH_TEST); gl.useProgram(oPrg);
        bU(0, hTex, uPo.hdr); gl.uniform2f(uPo.ir, 1 / rw, 1 / rh);
        gl.uniform1f(uPo.cas, sc < 0.98 ? casSharp : 0.18);
        gl.uniform4f(uPo.post, bloomStrength, bloomThreshold, vignetteStrength, waterReflectivity);
        gl.uniform2f(uPo.tone, exposure, contrast);
        dQuad();
      }
      gl.bindVertexArray(null);
      if (typeof gl.fenceSync === "function") { fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); }
    },
    blitTensorRgba(rb, w, h) {
      if (!okGl() || !bPrg || !rb || w <= 0 || h <= 0) return;
      gl.bindFramebuffer(F, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.disable(gl.DEPTH_TEST); gl.useProgram(bPrg);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(T, bTex); gl.texImage2D(T, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, rb);
      dQuad(); gl.bindVertexArray(null);
    },
  };
}
export function createCanvas2dTensorRenderer(cv) {
  const cx = cv.getContext("2d");
  if (!cx) return null;
  const noop = () => {};
  return {
    backend: "tensor-2d", isSoftware: true, setRenderScale: noop, setCsmSplits: noop, uploadSplitBuffers: noop, uploadPackedBuffers: noop,
    getUploadTelemetry() { return { staticBytes: 0, dynBytes: 0, staticEpoch: 0, instCount: 0 }; },
    render(_m, _e, ls) {
      if (cv.width <= 0 || cv.height <= 0) return;
      const [r = 0.18, g = 0.3, b = 0.38] = ls?.sky ?? [];
      cx.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
      cx.fillRect(0, 0, cv.width, cv.height);
    },
    blitTensorRgba(rb, w, h) {
      if (rb && w > 0 && h > 0 && typeof ImageData === "function") cx.putImageData(new ImageData(new Uint8ClampedArray(rb.slice().buffer), w, h), 0, 0);
    },
  };
}
export async function createBestRenderer(cv) { return (await createGlRenderer(cv)) || createCanvas2dTensorRenderer(cv); }
