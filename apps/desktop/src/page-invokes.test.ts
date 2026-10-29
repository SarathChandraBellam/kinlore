import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {KinloreApi} from '@kinlore/ipc-contract';
import {ArchiveSession} from './archive-session.js';
import {registerIpc} from './register-ipc.js';
import './preload.js';

const wire=vi.hoisted(()=>({
  handlers:new Map<string,(event:unknown,...args:unknown[])=>unknown>(),
  api:null as KinloreApi|null,
  choices:[] as string[][],
  frame:'http://localhost:5173/',
}));
vi.mock('electron',()=>({
  contextBridge:{exposeInMainWorld:(_name:string,api:KinloreApi)=>{wire.api=api;}},
  ipcMain:{handle:(channel:string,handler:(event:unknown,...args:unknown[])=>unknown)=>{wire.handlers.set(channel,handler);}},
  ipcRenderer:{invoke:async(channel:string,...args:unknown[])=>{
    const handler=wire.handlers.get(channel);if(handler===undefined)throw new Error(`No IPC handler: ${channel}`);
    return handler({senderFrame:{url:wire.frame}},...args);
  }},
  dialog:{showOpenDialog:async()=>{const paths=wire.choices.shift()??[];return {canceled:paths.length===0,filePaths:paths};}},
}));
const cleanup:string[]=[];
const phrase='synthetic-page-passphrase';
const stamp='2026-10-29T00:00:00.000Z';
afterEach(async()=>{vi.unstubAllGlobals();wire.handlers.clear();wire.choices=[];wire.frame='http://localhost:5173/';await Promise.all(cleanup.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
async function fixture(){
  const parent=await mkdtemp(path.join(tmpdir(),'kinlore-page-invokes-'));cleanup.push(parent);
  const root=path.join(parent,'archive');const session=new ArchiveSession(path.join(parent,'private','secrets.json'));session.allowRoot(root);
  registerIpc({session,appUrl:()=> 'http://localhost:5173/',defaultArchivePath:()=>root});
  if(wire.api===null)throw new Error('Preload did not expose the API');const api=wire.api;
  const created=await api.createArchive(root,phrase);
  return {api,session,root,parent,recoveryKey:created.recoveryKey};
}
async function person(api:KinloreApi){
  await api.savePerson({id:'ada',displayName:'Synthetic Ada',createdAt:stamp,updatedAt:stamp});
  for(const scope of ['recording','export'] as const)await api.saveConsent({id:`ada-${scope}`,personId:'ada',scope,granted:true,createdAt:stamp,updatedAt:stamp});
}
async function recording(api:KinloreApi){await person(api);return api.saveCapturedAnswer({personId:'ada',language:'en',question:'Childhood food?',spokenWords:'We cooked rice with lentils.',mediaBase64:Buffer.from('synthetic voice').toString('base64'),extension:'.webm',durationMs:1200});}

describe('page actions through preload, guarded IPC, and a real encrypted session',()=>{
  it('Home opens an existing archive and returns locked status after restart',async()=>{
    const {api,root}=await fixture();expect(await api.getDefaultArchivePath()).toBe(root);expect(await api.inspectArchive(root)).toBe('existing');
    expect(await api.openArchive(root)).toMatchObject({encrypted:true,unlocked:false});
    await expect(api.createArchive(root,phrase)).rejects.toThrow(/already exists/);
    expect(await api.unlockArchive(phrase)).toMatchObject({unlocked:true});
  });
  it('Family saves a person and their consent and reloads them',async()=>{
    const {api}=await fixture();await person(api);
    expect(await api.listPeople()).toMatchObject([{id:'ada',displayName:'Synthetic Ada'}]);
    expect(await api.listConsents()).toHaveLength(2);
    expect((await api.loadLibrary()).people).toHaveLength(1);
  });
  it('Record gets local questions, saves real audio/words, and returns a playback URL',async()=>{
    const {api}=await fixture();const saved=await recording(api);
    expect((await api.nextPrompts({language:'te',personId:'ada'})).length).toBeGreaterThan(0);
    expect(await api.mediaUrl(saved.recording.mediaRelativePath)).toContain('kinlore://media/');
    expect((await api.loadLibrary()).recordings).toHaveLength(1);
    await expect(api.ask({question:'rice'})).resolves.toMatchObject({kind:'clips',clips:[{text:'We cooked rice with lentils.'}]});
  });
  it('Memories saves source-linked stories, recipes, timeline and keepsakes, then seals playback',async()=>{
    const {api}=await fixture();const saved=await recording(api);
    const base={id:'item',title:'Meal',personIds:['ada'],recordingIds:[saved.recording.id],createdAt:stamp,updatedAt:stamp};
    await api.saveStory({...base,summary:'A family meal'});await api.saveRecipe({...base,ingredients:['rice'],steps:['Cook rice.']});
    await api.saveTimelineEvent({...base,occurredOn:'2000-01-01',notes:'A remembered date'});await api.saveKeepsake({...base,notes:'A cooking pot'});
    const library=await api.loadLibrary();expect(library.stories).toHaveLength(1);expect(library.recipes).toHaveLength(1);expect(library.timeline).toHaveLength(1);expect(library.keepsakes).toHaveLength(1);
    expect((await api.askFamily('rice')).distinctVoices).toBe(1);
    await api.sealRecording({id:saved.recording.id,sealedUntil:'2099-01-01T00:00:00Z'});expect(await api.mediaUrl(saved.recording.mediaRelativePath)).toBeNull();
    await expect(api.ask({question:'rice'})).resolves.toEqual({kind:'unknown'});
  });
  it('Memories imports only a picker-approved file and Keepsakes attaches a selected photo',async()=>{
    const {api,parent}=await fixture();await person(api);
    const media=path.join(parent,'synthetic.mp3');await writeFile(media,'synthetic audio');wire.choices.push([media]);
    const paths=await api.selectImports();expect((await api.importSelected({paths,personIds:['ada']})).recordings).toHaveLength(1);
    await api.saveKeepsake({id:'pot',title:'A pot',personIds:['ada'],createdAt:stamp,updatedAt:stamp});
    const photo=path.join(parent,'synthetic.png');await writeFile(photo,'synthetic photo');wire.choices.push([photo]);
    const photos=await api.selectImports();expect((await api.attachKeepsakeMedia({keepsakeId:'pot',sourcePath:photos[0]??''})).mediaRelativePath).toContain('media/');
  });
  it('Settings locks and unlocks through passphrase and recovery',async()=>{
    const {api,recoveryKey}=await fixture();expect(await api.lockArchive()).toMatchObject({unlocked:false});
    await expect(api.unlockArchive('wrong-phrase')).rejects.toThrow(/unlock/i);
    expect(await api.unlockArchive(phrase)).toMatchObject({unlocked:true});await api.lockArchive();
    expect(await api.unlockArchiveWithRecovery(recoveryKey)).toMatchObject({unlocked:true});
  });
  it('Settings saves AI configuration, previews persona, and runs only approved mocked requests',async()=>{
    const {api}=await fixture();await person(api);const fetcher=vi.fn<typeof fetch>();vi.stubGlobal('fetch',fetcher);
    await api.saveOpenRouterConfig({model:'test/model',apiKey:'synthetic-key'});expect(fetcher).not.toHaveBeenCalled();
    expect(await api.getOpenRouterConfig()).toMatchObject({model:'test/model',keyStored:true});
    const preview=await api.prepareLlm({task:'interview',language:'en',personId:'ada',persona:'A retired teacher'});expect(preview.text).toContain('A retired teacher');expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({questions:['What made teaching memorable?']})}}]})));
    expect(await api.runLlm({token:preview.token,approved:true})).toEqual({task:'interview',questions:['What made teaching memorable?']});
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('rejects untrusted invocations before any page handler runs',async()=>{
    const {api}=await fixture();wire.frame='https://untrusted.example/';
    await expect(api.archiveStatus()).rejects.toThrow(/untrusted/);await expect(api.savePerson({id:'bad',displayName:'No',createdAt:stamp,updatedAt:stamp})).rejects.toThrow(/untrusted/);
  });
});
