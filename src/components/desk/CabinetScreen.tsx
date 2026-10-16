/* @mandate/components/desk/CabinetScreen — the cabinet.
 *
 * What the paper remembers. Every file that was stamped, signed or annotated
 * comes back here in the order the desk worked it, with the state it left in;
 * below them stands the reference shelf, which is never worked and always
 * readable. The drawer (settings, text size, the transfer slip) opens from here,
 * because this is the folder you visit when you are thinking about the save
 * rather than about the week.
 */

export interface CabinetRow {
  id: string
  title: string
  recordId: string
  /** STAMPED APPROVED · DECIDED · ANNOTATED … */
  state: string
  tone?: 'good' | 'bad' | 'plain'
  /** the week the state was left, when the save knows */
  when?: string
}

export interface CabinetScreenProps {
  rows: CabinetRow[]
  /** standing documents that were never worked — the reference shelf */
  reference: { id: string; title: string; authority: string }[]
  onOpen: (id: string) => void
  onOpenDrawer: () => void
}

export function CabinetScreen({ rows, reference, onOpen, onOpenDrawer }: CabinetScreenProps) {
  const stamped = rows.filter(r => r.state.startsWith('STAMPED')).length

  return (
    <div className="dv2-screen">
      <section className="dv2-panel" aria-label="The cabinet">
        <div className="dv2-panel-head">
          <span className="dv2-panel-title">WHAT THE PAPER REMEMBERS</span>
          <span className="dv2-panel-hint">{rows.length} filed · {reference.length} readable</span>
        </div>
        <div className="dv2-stats">
          <div className="dv2-stat">
            <span className="dv2-stat-k">FILES WORKED</span>
            <span className="dv2-stat-v">{rows.length}</span>
          </div>
          <div className="dv2-stat">
            <span className="dv2-stat-k">STAMPED</span>
            <span className="dv2-stat-v" data-tone={stamped > 0 ? 'good' : undefined}>{stamped}</span>
          </div>
          <div className="dv2-stat">
            <span className="dv2-stat-k">ON THE SHELF</span>
            <span className="dv2-stat-v">{reference.length}</span>
          </div>
        </div>
        <p className="dv2-panel-line">
          A file leaves the tray and lands here for good. The audit trail on each one is written by the desk,
          not by the simulation — which is why a stamp is evidence and a rumour is not.
        </p>
        <div className="dv2-act-block">
          <button type="button" className="dv2-act primary" onClick={onOpenDrawer}>
            OPEN THE DRAWER — SETTINGS &amp; ACCESSIBILITY
          </button>
        </div>
      </section>

      <div className="dv2-screen-head">
        <span className="dv2-panel-title">FILED</span>
        <span className="dv2-screen-count">newest first · tap to reopen</span>
      </div>

      {rows.length === 0 ? (
        <div className="dv2-empty">
          <b>The cabinet is empty</b>
          Nothing has been stamped, signed, annotated or decided yet. Work a file and it is filed here.
        </div>
      ) : (
        <div className="dv2-rows">
          {rows.map(row => (
            <button
              key={row.id}
              type="button"
              className="dv2-row"
              data-tone={row.tone === 'good' ? 'done' : row.tone === 'bad' ? 'urgent' : 'none'}
              onClick={() => onOpen(row.id)}
            >
              <span className="dv2-row-main">
                <span className="dv2-row-title">{row.title}</span>
                <span className="dv2-row-line">{row.recordId}{row.when ? ` · ${row.when}` : ''}</span>
              </span>
              <span className="dv2-row-facts">
                <span className="dv2-row-state" data-tone={row.tone === 'good' ? 'good' : row.tone === 'bad' ? 'bad' : undefined}>
                  {row.state}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="dv2-screen-head">
        <span className="dv2-panel-title">THE REFERENCE SHELF</span>
        <span className="dv2-screen-count">never worked · always readable</span>
      </div>

      <div className="dv2-rows">
        {reference.map(ref => (
          <button key={ref.id} type="button" className="dv2-row" onClick={() => onOpen(ref.id)}>
            <span className="dv2-row-main">
              <span className="dv2-row-title">{ref.title}</span>
              <span className="dv2-row-line">{ref.authority}</span>
            </span>
            <span className="dv2-row-facts">
              <span className="dv2-row-state">REFERENCE</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default CabinetScreen
