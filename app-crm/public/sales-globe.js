import { mapPaths } from './sales-map.js?v=20261123';

const radians=Math.PI/180;
const home={lon:-83,lat:12};
const positions={
  ECU:[-78.5,-1.5],PAN:[-80,8.5],BOL:[-64,-17],PRY:[-58.5,-23],URY:[-56,-33],
  CRI:[-84,10],GTM:[-90.3,15.5],SLV:[-89,14],HND:[-86.5,14.8],NIC:[-85,13],
  PER:[-75,-9],MEX:[-102,23],ARG:[-65,-35],BRA:[-53,-11],CHL:[-71,-33],
  COL:[-74,4],VEN:[-66,8],ESP:[-4,40],FRA:[2,46],ITA:[12,43],PRT:[-8,39.5],
};

function vector(lon,lat) {
  const horizontal=Math.cos(lat*radians);
  const longitude=lon*radians;
  return [horizontal*Math.cos(longitude),horizontal*Math.sin(longitude),Math.sin(lat*radians)];
}

// Convert the bundled Natural Earth paths to unit vectors once. Longitudes and
// latitudes were stored in the original map as x=(lon+180)*2, y=(85-lat)*2.
const countries=Object.entries(mapPaths).map(([code,path])=>[
  code,path.split('M').slice(1).map(ring=>ring.slice(0,-1).split('L').map(pair=>{
    const [x,y]=pair.split(',').map(Number);
    return vector(x/2-180,85-y/2);
  })),
]);
const places=Object.fromEntries(Object.entries(positions).map(([code,point])=>[code,vector(...point)]));

function projector(lon,lat) {
  const sinLon=Math.sin(lon*radians),cosLon=Math.cos(lon*radians);
  const sinLat=Math.sin(lat*radians),cosLat=Math.cos(lat*radians);
  return ([x,y,z])=>{
    const tangent=cosLon*x+sinLon*y;
    return {x:-sinLon*x+cosLon*y,y:sinLat*tangent-cosLat*z,z:cosLat*tangent+sinLat*z};
  };
}

function horizon(a,b) {
  const t=a.z/(a.z-b.z);
  const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
  const length=Math.hypot(x,y)||1;
  return {x:x/length,y:y/length};
}

function traceRing(ctx,ring,project,radius) {
  const points=ring.map(project);
  const start=points.findIndex(point=>point.z>=0);
  if(start<0)return false;
  let a=points[start],exit=null;
  ctx.moveTo(a.x*radius,a.y*radius);
  for(let i=1;i<=points.length;i++){
    const b=points[(start+i)%points.length];
    if(a.z>=0&&b.z>=0){
      ctx.lineTo(b.x*radius,b.y*radius);
    }else if(a.z>=0){
      exit=horizon(a,b);
      ctx.lineTo(exit.x*radius,exit.y*radius);
    }else if(b.z>=0&&exit){
      const entry=horizon(a,b);
      const from=Math.atan2(exit.y,exit.x),to=Math.atan2(entry.y,entry.x);
      const delta=Math.atan2(Math.sin(to-from),Math.cos(to-from));
      ctx.arc(0,0,radius,from,from+delta,delta<0);
      ctx.lineTo(b.x*radius,b.y*radius);
      exit=null;
    }
    a=b;
  }
  ctx.closePath();
  return true;
}

function paint(ctx,side,view,markets,selected) {
  const radius=side*.43,center=side/2;
  const project=projector(view.lon,view.lat);
  ctx.clearRect(0,0,side,side);
  ctx.save();
  ctx.translate(center,center);

  const glow=ctx.createRadialGradient(0,4,radius*.87,0,4,radius*1.15);
  glow.addColorStop(0,'#426fff80');
  glow.addColorStop(1,'#426fff00');
  ctx.fillStyle=glow;
  ctx.fillRect(-center,-center,side,side);

  ctx.save();
  ctx.beginPath();
  ctx.arc(0,0,radius,0,2*Math.PI);
  ctx.clip();
  const ocean=ctx.createRadialGradient(-radius*.38,-radius*.46,0,0,0,radius*1.27);
  ocean.addColorStop(0,'#366cd0');
  ocean.addColorStop(.52,'#152e65');
  ocean.addColorStop(1,'#07152f');
  ctx.fillStyle=ocean;
  ctx.fillRect(-radius,-radius,radius*2,radius*2);

  for(const [code,rings] of countries){
    ctx.beginPath();
    let visible=false;
    for(const ring of rings)if(traceRing(ctx,ring,project,radius))visible=true;
    if(!visible)continue;
    ctx.fillStyle=code===selected?'#c0d0ff':markets.has(code)?'#57efc8':'#577bb4';
    ctx.fill('evenodd');
    ctx.strokeStyle='#101f47';
    ctx.lineWidth=side*.00125;
    ctx.stroke();
  }
  const shade=ctx.createLinearGradient(-radius,-radius,radius,radius);
  shade.addColorStop(0,'#abc9ff2b');
  shade.addColorStop(.52,'#070c1b00');
  shade.addColorStop(1,'#050a24a8');
  ctx.fillStyle=shade;
  ctx.fillRect(-radius,-radius,radius*2,radius*2);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0,0,radius,0,2*Math.PI);
  ctx.strokeStyle='#91baff85';
  ctx.lineWidth=side*.0035;
  ctx.stroke();

  for(const code of markets){
    if(!places[code])continue;
    const point=project(places[code]);
    if(point.z<.09)continue;
    const x=point.x*radius,y=point.y*radius;
    ctx.beginPath();
    ctx.arc(x,y,side*.0105,0,2*Math.PI);
    ctx.fillStyle=code===selected?'#d2dcff':'#7affdc';
    ctx.fill();
    ctx.strokeStyle='#132754';
    ctx.lineWidth=side*.0023;
    ctx.stroke();
  }
  ctx.restore();
}

export function mountSalesGlobe(element,rows,selected) {
  const canvas=element.querySelector('canvas');
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const markets=new Set(rows.map(row=>row.country));
  const place=positions[selected];
  const view=place?{lon:place[0],lat:place[1]}:{...home};
  const paintNow=()=>paint(ctx,canvas.width,view,markets,selected);
  const latitude=value=>Math.max(-75,Math.min(75,value));
  let frame=0,drag=null;
  function move(lon,lat) {
    cancelAnimationFrame(frame);
    const start={...view},began=performance.now(),endLat=latitude(lat);
    const travel=Math.atan2(Math.sin((lon-start.lon)*radians),Math.cos((lon-start.lon)*radians))/radians;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){
      Object.assign(view,{lon,lat:endLat});
      paintNow();
      return;
    }
    const animate=time=>{
      if(!canvas.isConnected)return;
      const progress=Math.min(1,(time-began)/260);
      const eased=1-(1-progress)**3;
      view.lon=start.lon+travel*eased;
      view.lat=start.lat+(endLat-start.lat)*eased;
      paintNow();
      if(progress<1)frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
  }

  element.querySelector('[data-globe-left]').onclick=()=>move(view.lon-35,view.lat);
  element.querySelector('[data-globe-right]').onclick=()=>move(view.lon+35,view.lat);
  element.querySelector('[data-globe-home]').onclick=()=>move(home.lon,home.lat);
  canvas.onkeydown=event=>{
    const step={ArrowLeft:[-25,0],ArrowRight:[25,0],ArrowUp:[0,20],ArrowDown:[0,-20]}[event.key];
    if(!step)return;
    event.preventDefault();
    move(view.lon+step[0],view.lat+step[1]);
  };
  canvas.onpointerdown=event=>{
    if(drag||event.button!==0)return;
    cancelAnimationFrame(frame);
    canvas.setPointerCapture(event.pointerId);
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,lon:view.lon,lat:view.lat};
    canvas.classList.add('is-dragging');
  };
  canvas.onpointermove=event=>{
    if(event.pointerId!==drag?.id)return;
    view.lon=drag.lon-(event.clientX-drag.x)*.5;
    if(event.pointerType!=='touch')view.lat=latitude(drag.lat+(event.clientY-drag.y)*.5);
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(paintNow);
  };
  canvas.onlostpointercapture=()=>{
    drag=null;
    canvas.classList.remove('is-dragging');
  };
  paintNow();
}
