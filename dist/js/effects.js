export function createEffects({getState,prefs,$,el}){
function effect(n,time,update,kind=''){const S=getState();if(S.fx.length>130){n.remove();return}S.fx.push({node:n,time,max:time,update,kind})}
function burst(x,y,color,count){const S=getState();if(!prefs.fx)return;for(let i=0;i<count;i++){let angle=Math.random()*6.28,v=12+Math.random()*32,n=el('circle',{cx:x,cy:y,r:1.4+Math.random()*1.8,fill:color},$('effects'));effect(n,.4+Math.random()*.2,(f,p)=>{n.setAttribute('cx',x+Math.cos(angle)*v*p);n.setAttribute('cy',y+Math.sin(angle)*v*p+12*p*p);n.setAttribute('opacity',1-p)})}}
function ring(x,y,r,color){const S=getState();let n=el('circle',{cx:x,cy:y,r:3,fill:color,'fill-opacity':.14,stroke:color,'stroke-width':2},$('effects'));effect(n,.32,(f,p)=>{n.setAttribute('r',3+r*p);n.setAttribute('opacity',1-p)})}
function puddle(x,y,time=4){const S=getState();let n=el('ellipse',{cx:x,cy:y,rx:26,ry:14,fill:'#ffdc66',opacity:.5},$('effects'));effect(n,time,(f,p)=>{n.setAttribute('opacity',.5*(1-p));for(let e of S.enemies)if(!e.dead&&Math.hypot(e.x-x,e.y-y)<29){e.slow=Math.max(e.slow,.3);e.slowPower=.55}},'puddle')}
function lightning(x,y,a,b,color='#b9f7f4'){const S=getState();let n=el('path',{d:`M${x} ${y} ${x+(a-x)*.35+4} ${y+(b-y)*.3-5} ${x+(a-x)*.7-4} ${y+(b-y)*.7+5} ${a} ${b}`,stroke:color,'stroke-width':2.5,fill:'none'},$('effects'));effect(n,.15,(f,p)=>n.setAttribute('opacity',1-p))}
function float(x,y,text,color){const S=getState();if(S.texts.length>=18)return;let n=el('text',{x,y,fill:color,'text-anchor':'middle',class:'floattext'},$('texts'));n.textContent=text;S.texts.push({node:n,time:.9,max:.9,y})}

return {effect,burst,ring,puddle,lightning,float};
}
