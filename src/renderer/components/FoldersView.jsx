import React, { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { Icon } from './Icons.jsx'

export function FoldersView() {
  const { settings, actions } = useStore()
  const pairs = settings.folderPairs || []
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ label: '', source: '', dest: '' })

  const pick = async (field) => {
    const p = await actions.chooseFolder(field === 'dest' ? 'nas' : 'source')
    if (p) setDraft((d) => ({ ...d, [field]: p }))
  }

  const add = () => {
    if (!draft.source || !draft.dest) return
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now())
    actions.updateSettings({ folderPairs: [...pairs, { id, label: draft.label || null, source: draft.source, dest: draft.dest }] })
    setDraft({ label: '', source: '', dest: '' })
    setAdding(false)
  }

  const remove = (id) => actions.updateSettings({ folderPairs: pairs.filter((p) => p.id !== id) })

  return (
    <div>
      <div className="page-head">
        <div className="grow">
          <h1>Folders</h1>
          <div className="sub">Back up any folder to the NAS with the same rules: one-way, master-is-local, never deletes on the NAS.</div>
        </div>
        {!adding && <button className="btn primary" onClick={() => setAdding(true)}><Icon.folder size={16} /> Add folder pair</button>}
      </div>

      {adding && (
        <div className="card">
          <h2>New folder pair</h2>
          <div className="field">
            <label>Label (optional)</label>
            <input className="input" placeholder="e.g. Documents, Photos…" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </div>
          <div className="field">
            <label>Source (on this PC — the master)</label>
            <div className="inline"><input className="input path" placeholder="C:\…" value={draft.source} readOnly /><button className="btn" onClick={() => pick('source')}>Browse</button></div>
          </div>
          <div className="field">
            <label>Destination (on the NAS)</label>
            <div className="inline"><input className="input path" placeholder="\\NAS\…" value={draft.dest} readOnly /><button className="btn" onClick={() => pick('dest')}>Browse</button></div>
          </div>
          <div className="row">
            <button className="btn primary" onClick={add} disabled={!draft.source || !draft.dest}><Icon.check size={15} /> Add</button>
            <button className="btn ghost" onClick={() => { setAdding(false); setDraft({ label: '', source: '', dest: '' }) }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Folder pairs ({pairs.length})</h2>
        {pairs.length === 0
          ? <div className="muted" style={{ fontSize: 13 }}>No custom folders yet. These are optional — Steam libraries are handled automatically.</div>
          : <div className="list">
            {pairs.map((p) => (
              <div className="list-row" key={p.id}>
                <Icon.folder size={18} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="title">{p.label || p.source.split(/[\\/]/).pop()}</div>
                  <div className="path mono">{p.source} &nbsp;→&nbsp; {p.dest}</div>
                </div>
                <button className="btn ghost" onClick={() => actions.reveal(p.source)}><Icon.folderOpen size={15} /></button>
                <button className="btn danger ghost" onClick={() => remove(p.id)}><Icon.x size={15} /></button>
              </div>
            ))}
          </div>}
      </div>
    </div>
  )
}
