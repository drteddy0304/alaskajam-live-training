import test from 'node:test';
import assert from 'node:assert/strict';
import {Music} from '../audio.js';
class Media extends EventTarget {
  constructor(){super();this.currentTime=0;this.duration=224.3918;this.paused=true;this.calls=[];}
  setAttribute(){} removeAttribute(){} load(){} 
  play(){this.calls.push('play');this.paused=false;return this.fail?Promise.reject(new Error('NotAllowedError')):Promise.resolve();}
  pause(){this.calls.push('pause');this.paused=true;this.dispatchEvent(new Event('pause'));}
}
globalThis.Audio=Media;
test('native audio requests playback before load returns, and clock follows buffering',async()=>{
 const m=new Music();const loaded=m.prime('song.mp3',0,224.39);assert.deepEqual(m.media.calls,['play']);await loaded;assert.equal(m.media.paused,true);assert.equal(m.media.muted,true);assert.equal(m.media.currentTime,0);assert.deepEqual(m.media.calls,['play','pause']);
 m.media.currentTime=4;const released=m.release(0);m.media.dispatchEvent(new Event('seeked'));await released;assert.equal(m.media.currentTime,0);assert.equal(m.media.muted,false);assert.deepEqual(m.media.calls,['play','pause','play']);
 m.media.currentTime=61.2;assert.equal(m.time(),61.2);assert.equal(m.time(),61.2);
 assert.equal(m.hasAdvancedFrom(0),true);
 m.media.currentTime=.04;assert.equal(m.hasAdvancedFrom(0),false);
 m.media.currentTime=1;m.media.paused=true;assert.equal(m.hasAdvancedFrom(0),false);
 m.media.paused=false;m.media.currentTime=61.2;
 await m.pause();assert.equal(m.time(),61.2);await m.resume();assert.equal(m.media.paused,false);
 assert.equal(m.seek(170),170);assert.equal(m.media.currentTime,170);
 assert.equal(m.seek(999),224.39);assert.equal(m.media.currentTime,224.39);
 m.media.ended=true;assert.equal(m.time(),224.39);
 m.media.currentTime=0;assert.equal(m.time(),0,'a stale mobile ended flag must not jump the scoring clock to the chart end');
 m.close();assert.equal(m.media.paused,true);
});
test('countdown priming stays silent and paused until release',async()=>{
 const m=new Music();await m.prime('song.mp3',0,224.39);
 assert.equal(m.media.muted,true);assert.equal(m.media.paused,true);assert.equal(m.media.currentTime,0);
 await m.release();assert.equal(m.media.muted,false);assert.equal(m.media.paused,false);assert.equal(m.media.currentTime,0);
});
test('release stays muted until an asynchronous mobile seek reaches song zero',async()=>{
 const m=new Music();await m.prime('song.mp3',0,224.39);m.media.currentTime=5;m.media.seeking=true;
 const releasing=m.release(0);
 assert.equal(m.media.muted,true);assert.equal(m.media.currentTime,0);
 m.media.seeking=false;m.media.dispatchEvent(new Event('seeked'));
 await releasing;
 assert.equal(m.media.muted,false);assert.equal(m.media.currentTime,0);
});
test('blocked playback rejects; closing does not trigger interruption',async()=>{
 const m=new Music();m.media.fail=true;await assert.rejects(m.load('song.mp3'));let interrupted=0;m.oninterrupt=()=>interrupted++;
 m.media.pause();assert.equal(interrupted,1);m.close();assert.equal(interrupted,1);
});
test('an audio file shorter than chart is rejected',()=>{const m=new Music();m.media.duration=30;assert.throws(()=>m.start(0,0,224.39));m.close();});
