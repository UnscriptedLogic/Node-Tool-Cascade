import { useEffect, useRef } from 'react';
import { useSnapshot } from 'valtio';
import { getLegacy } from '../bridge.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const call = (name, ...args) => window[name](...args);
const when = (time) => {
  const date = new Date(time);
  return isFinite(date) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
};

function NameCell({ kind, item, editing }) {
  const input = useRef(null);
  const active = editing?.kind === kind && editing.id === item.id;
  useEffect(() => {
    if (active) { input.current.focus(); input.current.select(); }
  }, [active]);
  if (active) return <Input ref={input} type="text" defaultValue={item.name} maxLength={80} aria-label="Name" className="lib-name-input"
    onKeyDown={event => {
      if (event.key === 'Enter') call('libRename', kind, item.id, event.currentTarget.value);
      else if (event.key === 'Escape') getLegacy().LIB.editing = null;
    }} onBlur={event => {
      const current = getLegacy().LIB.editing;
      if (current?.kind === kind && current.id === item.id) call('libRename', kind, item.id, event.currentTarget.value);
    }} />;
  return kind === 'cascade'
    ? <Button type="button" className="lib-open" onClick={() => call('libOpen', item.id)}>{item.name}</Button>
    : <strong>{item.name}</strong>;
}

function DeleteButton({ kind, item, armed }) {
  const key = kind + item.id;
  return <Button type="button" className={'btn small' + (armed === key ? ' danger' : '')} aria-label={'Delete ' + item.name}
    onClick={() => {
      if (armed === key) return call('libDelete', kind, item.id);
      const { LIB } = getLegacy(); LIB.armed = key;
      window.setTimeout(() => { if (LIB.armed === key) LIB.armed = null; }, 4000);
    }}>{armed === key ? 'Really delete?' : 'Delete'}</Button>;
}

function CascadeRow({ item, lib }) {
  const { LIB, DOMAINS } = getLegacy();
  return <li className={'lib-row' + (item.id === lib.currentId ? ' current' : '')} data-id={item.id}>
    <NameCell kind="cascade" item={item} editing={lib.editing} />
    <span className="lib-meta">{(DOMAINS[item.domain]?.label || '') + ' · ' + when(item.updatedAt) + (item.id === lib.currentId ? ' · open now' : '')}</span>
    <span className="lib-actions">
      <Button type="button" className="btn small" aria-label={'Rename ' + item.name} onClick={() => { LIB.editing = { kind: 'cascade', id: item.id }; }}>Rename</Button>
      <select aria-label={'Move ' + item.name + ' to a folder'} value={item.folderId || ''} onChange={event => call('libMove', item.id, event.target.value)}>
        <option value="">No folder</option>
        {lib.folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select>
      <DeleteButton kind="cascade" item={item} armed={lib.armed} />
    </span>
  </li>;
}

export default function Library() {
  const { LIB } = getLegacy();
  const lib = useSnapshot(LIB);
  const googleHost = useRef(null);
  const signed = lib.kind === 'local' || !!lib.user;
  const current = lib.cascades.some(item => item.id === lib.currentId);
  useEffect(() => {
    if (lib.kind === 'cloud' && !lib.user && googleHost.current) call('libMountGoogle');
  }, [lib.kind, lib.user, lib.googleClientId]);
  const loose = lib.cascades.filter(item => !item.folderId);
  return <>
    <div className="field" id="libAccount" hidden={lib.kind !== 'cloud'}>
      <span className="lbl">Account</span>
      <small id="libWho">{lib.user ? `Signed in as ${lib.user.name || lib.user.email} (${lib.user.email})` : 'Sign in to keep your Cascades on the web and open them anywhere.'}</small>
      <div id="libGoogle" ref={googleHost} hidden={!!lib.user} />
      <div className="frow">
        <Button className="btn" id="libSignOut" type="button" hidden={!lib.user} onClick={() => call('libSignOut')}>Sign out</Button>
        <Button className="btn small" id="libDeleteAccount" type="button" hidden={!lib.user} onClick={() => call('libDeleteAccount')}>
          {lib.armed === 'account' ? 'Really delete my account and every saved Cascade?' : 'Delete my account'}
        </Button>
      </div>
    </div>
    <div className="field" id="libTools" hidden={!signed}>
      <div className="frow">
        <Button className="btn primary" id="libNew" type="button" onClick={() => call('libNewCascade', null)}>New Cascade</Button>
        <Button className="btn" id="libFolder" type="button" onClick={() => call('libNewFolder')}>New folder</Button>
        <Button className="btn" id="libSaveCur" type="button" hidden={!signed || current} onClick={() => call('libSaveCurrent')}>Save the tree I have open</Button>
      </div>
      <small id="libStatus" aria-live="polite">{lib.status}</small>
    </div>
    <div id="libList">
      {signed && !lib.folders.length && !lib.cascades.length && <p className="small">Nothing saved yet. Start a new Cascade, or save the one you have open.</p>}
      {signed && lib.folders.map(folder => {
        const inside = lib.cascades.filter(item => item.folderId === folder.id);
        return <section className="lib-folder" data-folder={folder.id} key={folder.id}>
          <header className="lib-fhead">
            <NameCell kind="folder" item={folder} editing={lib.editing} />
            <span className="lib-meta">{inside.length + (inside.length === 1 ? ' Cascade' : ' Cascades')}</span>
            <span className="lib-actions">
              <Button type="button" className="btn small" onClick={() => call('libNewCascade', folder.id)}>New Cascade here</Button>
              <Button type="button" className="btn small" aria-label={'Rename folder ' + folder.name} onClick={() => { LIB.editing = { kind: 'folder', id: folder.id }; }}>Rename</Button>
              <DeleteButton kind="folder" item={folder} armed={lib.armed} />
            </span>
          </header>
          <ul className="lib-list">{inside.map(item => <CascadeRow key={item.id} item={item} lib={lib} />)}</ul>
        </section>;
      })}
      {signed && !!loose.length && <section className="lib-folder">
        {!!lib.folders.length && <header className="lib-fhead"><strong>Not in a folder</strong></header>}
        <ul className="lib-list">{loose.map(item => <CascadeRow key={item.id} item={item} lib={lib} />)}</ul>
      </section>}
    </div>
  </>;
}
