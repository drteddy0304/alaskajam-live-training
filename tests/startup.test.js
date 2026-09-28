import test from 'node:test';
import assert from 'node:assert/strict';
import {StartCountdown, primeMedia, startMediaTogether} from '../startup.js';

function timers() {
  const pending=[];
  return {pending,setTimeout(fn){pending.push(fn);return fn;},clearTimeout(fn){const i=pending.indexOf(fn);if(i>=0)pending.splice(i,1);},tick(){pending.shift()?.();}};
}
test('five-second countdown is deterministic and cancellation prevents delayed start',()=>{
  const time=timers(), ticks=[];let starts=0;
  const countdown=new StartCountdown({timers:time,onTick:n=>ticks.push(n),onComplete:()=>starts++});
  countdown.start(); for(let i=0;i<5;i++) time.tick();
  assert.deepEqual(ticks,[5,4,3,2,1]);assert.equal(starts,1);
  const cancelled=new StartCountdown({timers:time,onComplete:()=>starts++});
  cancelled.start();assert.equal(cancelled.cancel(),true);time.tick();assert.equal(starts,1);
});
test('audio and guide are requested synchronously before audio readiness settles, then reset',async()=>{
  const calls=[];let settle;
  const audio={prime(){calls.push('audio-play');return new Promise(r=>settle=r);},reset(){calls.push('audio-reset');}};
  const guide={prime(){calls.push('guide-play');},reset(){calls.push('guide-reset');}};
  const ready=primeMedia(audio,guide,{src:'x',offset:0,duration:10});
  assert.deepEqual(calls,['audio-play','guide-play']);settle();await ready;
  assert.deepEqual(calls,['audio-play','guide-play','audio-reset','guide-reset']);
});
test('countdown completion starts both media in one task; video OFF/failure is non-blocking',async()=>{
  const calls=[];let settle;
  const audio={resume(){calls.push('audio-resume');return new Promise(r=>settle=r);}};
  const guide={resume(){calls.push('guide-resume');return false;}};
  const started=startMediaTogether(audio,guide);
  assert.deepEqual(calls,['audio-resume','guide-resume']);settle();await started;
  await assert.doesNotReject(startMediaTogether(null,{resume(){calls.push('guide-off');return false;}}));
  await assert.doesNotReject(startMediaTogether(null,null));
});
