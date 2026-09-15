import test from 'node:test';
import assert from 'node:assert/strict';
import {Music} from '../audio.js';
class Media extends EventTarget {
  constructor(){super();this.currentTime=0;this.duration=224.3918;this.paused=true;this.calls=[];}
  setAttribute(){} removeAttribute(){} load(){} 
  play(){this.calls.push('play');this.paused=false;return this.fail?Promise.reject(new Error('NotAllowedError')):Promise.resolve();}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
}
globalThis.Audio=Media;
test('native audio requests playback before load returns, and clock follows buffering',async()=>{
 const m=new Music();const loaded=m.load('song.mp3');assert.deepEqual(m.media.calls,['play']);await loaded;m.start(3,0,224.39);
 m.media.currentTime=61.2;assert.equal(m.time(),61.2);assert.equal(m.time(),61.2);
 await m.pause();assert.equal(m.time(),61.2);await m.resume();assert.equal(m.media.paused,false);
 m.media.ended=true;assert.equal(m.time(),224.39);m.close();assert.equal(m.media.paused,true);
});
test('blocked playback rejects; closing does not trigger interruption',async()=>{
 const m=new Music();m.media.fail=true;await assert.rejects(m.load('song.mp3'));let interrupted=0;m.oninterrupt=()=>interrupted++;
 m.media.pause();assert.equal(interrupted,1);m.close();assert.equal(interrupted,1);
});
test('an audio file shorter than chart is rejected',()=>{const m=new Music();m.media.duration=30;assert.throws(()=>m.start(0,0,224.39));m.close();});
