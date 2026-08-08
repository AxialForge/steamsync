import React, { useEffect, useRef } from 'react'
import { useStore } from '../state/store.jsx'

export function LogPanel({ height }) {
  const { log } = useStore()
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [log])
  return (
    <div className="log" ref={ref} style={height ? { height } : undefined}>
      {log.length === 0 && <div className="muted">No activity yet.</div>}
      {log.map((e, i) => (
        <div key={i} className={'log-line ' + (e.level || '')}>
          <span className="ts">{new Date(e.t).toLocaleTimeString()}</span>{e.message}
        </div>
      ))}
    </div>
  )
}
