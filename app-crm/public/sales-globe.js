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
  const radius=side*.448,center=side/2;
  const project=projector(view.lon,view.lat);
  ctx.clearRect(0,0,side,side);
  ctx.save();
  ctx.translate(center,center);

  const glow=ctx.createRadialGradient(0,0,radius*.92,0,0,radius*1.116);
  glow.addColorStop(0,'#55aeff85');
  glow.addColorStop(.53,'#4e80ff43');
  glow.addColorStop(1,'#4e80ff00');
  ctx.fillStyle=glow;
  ctx.fillRect(-center,-center,side,side);

  ctx.save();
  ctx.beginPath();
  ctx.arc(0,0,radius,0,2*Math.PI);
  ctx.clip();
  const ocean=ctx.createRadialGradient(-radius*.38,-radius*.46,0,0,0,radius*1.27);
  ocean.addColorStop(0,'#407dd7');
  ocean.addColorStop(.50,'#1a4289');
  ocean.addColorStop(1,'#08142f');
  ctx.fillStyle=ocean;
  ctx.fillRect(-radius,-radius,radius*2,radius*2);

  for(const [code,rings] of countries){
    ctx.beginPath();
    let visible=false;
    for(const ring of rings)if(traceRing(ctx,ring,project,radius))visible=true;
    if(!visible)continue;
    ctx.fillStyle=code===selected?'#c0d0ff':markets.has(code)?'#57efc8':'#729cd0';
    ctx.fill('evenodd');
    ctx.strokeStyle='#101f47';
    ctx.lineWidth=side*.00125;
    ctx.stroke();
  }
  const shade=ctx.createLinearGradient(-radius*.67,-radius*.67,radius*.77,radius*.77);
  shade.addColorStop(0,'#c1eaff3d');
  shade.addColorStop(.44,'#070c1b00');
  shade.addColorStop(.84,'#050a24a8');
  shade.addColorStop(1,'#020714e8');
  ctx.fillStyle=shade;
  ctx.fillRect(-radius,-radius,radius*2,radius*2);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0,0,radius,0,2*Math.PI);
  const rim=ctx.createLinearGradient(-radius,-radius,radius,radius);
  rim.addColorStop(0,'#a7edff');
  rim.addColorStop(.48,'#639affb0');
  rim.addColorStop(1,'#4777df22');
  ctx.strokeStyle=rim;
  ctx.lineWidth=side*.003;
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
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const idleSpeed=6;
  let drag=null,flight=null,longitudeSpeed=0,latitudeSpeed=0;
  let idleAfter=performance.now()+650,lastFrame=0,visible=false,dragChanged=false;
  const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting});
  visibility.observe(canvas);

  function move(lon,lat) {
    if(drag)return;
    const now=performance.now();
    idleAfter=now+2000;
    longitudeSpeed=latitudeSpeed=0;
    const travel=Math.atan2(Math.sin((lon-view.lon)*radians),Math.cos((lon-view.lon)*radians))/radians;
    const endLat=latitude(lat);
    if(motion.matches){
      flight=null;
      Object.assign(view,{lon:view.lon+travel,lat:endLat});
      paintNow();
      return;
    }
    flight={start:{...view},travel,endLat,began:now,duration:Math.min(1050,510+Math.abs(travel)*3)};
  }

  function animate(time) {
    if(!canvas.isConnected){
      visibility.disconnect();
      return;
    }
    requestAnimationFrame(animate);
    // Draw at up to 60 fps and avoid a jump after returning to a background tab.
    const elapsed=time-lastFrame;
    if(elapsed<16)return;
    const dt=Math.min(elapsed,40)/1000;
    lastFrame=time;
    if(!visible)return;
    if(dragChanged){
      dragChanged=false;
      paintNow();
      return;
    }
    if(drag)return;
    if(flight){
      const progress=motion.matches?1:Math.min(1,(time-flight.began)/flight.duration);
      const eased=(1-Math.cos(Math.PI*progress))/2;
      view.lon=flight.start.lon+flight.travel*eased;
      view.lat=flight.start.lat+(flight.endLat-flight.start.lat)*eased;
      if(progress===1)flight=null;
    }else if(motion.matches){
      longitudeSpeed=latitudeSpeed=0;
      return;
    }else if(Math.abs(longitudeSpeed)+Math.abs(latitudeSpeed)>.25){
      view.lon+=longitudeSpeed*dt;
      view.lat=latitude(view.lat+latitudeSpeed*dt);
      const decay=Math.exp(-4.8*dt);
      longitudeSpeed*=decay;
      latitudeSpeed*=decay;
    }else if(time>=idleAfter&&!selected){
      const ramp=Math.min(1,(time-idleAfter)/900);
      view.lon+=idleSpeed*dt*ramp;
    }else{
      return;
    }
    paintNow();
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
    flight=null;
    longitudeSpeed=latitudeSpeed=0;
    canvas.setPointerCapture(event.pointerId);
    const scale=125/canvas.getBoundingClientRect().width;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,time:event.timeStamp,scale};
    canvas.classList.add('is-dragging');
  };
  canvas.onpointermove=event=>{
    if(event.pointerId!==drag?.id)return;
    const lon=-(event.clientX-drag.x)*drag.scale;
    const lat=event.pointerType==='touch'?0:(event.clientY-drag.y)*drag.scale;
    const seconds=Math.max(8,event.timeStamp-drag.time)/1000;
    const limit=value=>Math.max(-160,Math.min(160,value));
    longitudeSpeed=longitudeSpeed*.42+limit(lon/seconds)*.58;
    latitudeSpeed=latitudeSpeed*.42+limit(lat/seconds)*.58;
    view.lon+=lon;
    view.lat=latitude(view.lat+lat);
    Object.assign(drag,{x:event.clientX,y:event.clientY,time:event.timeStamp});
    dragChanged=true;
  };
  canvas.onlostpointercapture=event=>{
    if(event.pointerId!==drag?.id)return;
    if(event.timeStamp-drag.time>95||motion.matches)longitudeSpeed=latitudeSpeed=0;
    idleAfter=performance.now()+1800;
    drag=null;
    canvas.classList.remove('is-dragging');
  };
  canvas.onpointercancel=()=>{longitudeSpeed=latitudeSpeed=0};
  paintNow();
  requestAnimationFrame(animate);
}
