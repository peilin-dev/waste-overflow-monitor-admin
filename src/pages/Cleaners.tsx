import { useCallback, useEffect, useState } from 'react'
import { message } from 'antd'
import type { User, Block } from '@/types'
import { getUsers, getBlocks, getCleanerBlocks, assignBlock, removeBlock } from '@/api'

export default function Cleaners() {
  const [cleaners, setCleaners] = useState<User[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [assignments, setAssignments] = useState<Record<number, number[]>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [usersRes, blocksRes] = await Promise.all([
        getUsers({ role: 'cleaner' }),
        getBlocks(),
      ])
      setCleaners(usersRes.data)
      setBlocks(blocksRes.data)

      // load each cleaner's assigned blocks
      const map: Record<number, number[]> = {}
      await Promise.all(
        usersRes.data.map(async (c) => {
          const res = await getCleanerBlocks(c.id)
          map[c.id] = res.data.map((b: Block) => b.id)
        })
      )
      setAssignments(map)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const toggleBlock = async (cleaner: User, blockId: number) => {
    const current = assignments[cleaner.id] || []
    const assigned = current.includes(blockId)
    try {
      if (assigned) {
        await removeBlock(cleaner.id, blockId)
        message.success('Block removed')
      } else {
        await assignBlock(cleaner.id, blockId)
        message.success('Block assigned')
      }
      const res = await getCleanerBlocks(cleaner.id)
      setAssignments(prev => ({ ...prev, [cleaner.id]: res.data.map((b: Block) => b.id) }))
    } catch {
      // ignore
    }
  }

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #ededed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#5b9bd5' }}>Cleaner — Block Assignment</div>
          <div style={{ fontSize: 11.5, color: '#999' }}>Click a block chip to assign / unassign</div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Cleaner', 'Zone', 'Shift', 'Assigned Blocks'].map(h => (
                <th key={h} style={{ background: '#f7f8fa', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #ededed' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cleaners.map(cleaner => {
              const assigned = assignments[cleaner.id] || []
              return (
                <tr key={cleaner.id}>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #ededed' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', background: '#eaf2fb', color: '#3a7bc0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0
                      }}>
                        {cleaner.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <b style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>{cleaner.name}</b>
                        <span style={{ fontSize: 10, color: '#999' }}>{cleaner.username}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>
                    {cleaner.zone || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>
                    {cleaner.shift || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #ededed' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {blocks.map(block => {
                        const isOn = assigned.includes(block.id)
                        return (
                          <button
                            key={block.id}
                            onClick={() => toggleBlock(cleaner, block.id)}
                            style={{
                              fontSize: 11.5, fontWeight: 500, padding: '6px 12px', borderRadius: 5,
                              cursor: 'pointer', transition: 'all .12s',
                              background: isOn ? '#eaf2fb' : '#fff',
                              color: isOn ? '#3a7bc0' : '#666',
                              border: `1px solid ${isOn ? '#4a90d9' : '#e0e0e0'}`,
                            }}
                          >
                            {isOn && <span style={{ fontSize: 10, fontWeight: 700, marginRight: 4 }}>✓</span>}
                            {block.name}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #ededed', fontSize: 11.5, color: '#999' }}>
          {cleaners.length} cleaner{cleaners.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}