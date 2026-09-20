// 정보 글 본문(JSON)을 섹션 단위로 그린다. 새 글은 서버의 guide-articles.json에 같은 구조로 추가하면 된다:
//   { lead, tools[], materials[], sections: [{ title, body, items[], steps[], table{headers,rows}, note, tone }] }
function Section({ section }) {
  const warn = section.tone === 'warn'
  return (
    <section
      className={`rounded-xl border p-5 ${
        warn ? 'border-yellow-800/70 bg-yellow-950/40' : 'border-ridefit-border bg-ridefit-card'
      }`}
    >
      {section.title && (
        <h2 className={`mb-3 text-lg font-bold ${warn ? 'text-yellow-300' : 'text-ridefit-text'}`}>
          {warn && <span aria-hidden="true">⚠️ </span>}
          {section.title}
        </h2>
      )}

      {section.body && <p className="whitespace-pre-line text-ridefit-text-secondary">{section.body}</p>}

      {section.items && (
        <ul className={`flex flex-col gap-2 text-ridefit-text-secondary ${section.body ? 'mt-3' : ''}`}>
          {section.items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className={warn ? 'text-yellow-400' : 'text-ridefit-primary'} aria-hidden="true">
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {section.steps && (
        <ol className="flex flex-col gap-3 text-ridefit-text-secondary">
          {section.steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ridefit-primary/15 font-mono text-xs font-bold text-ridefit-primary">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {section.table && (
        <div className={`overflow-x-auto ${section.body || section.items ? 'mt-3' : ''}`}>
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr>
                {section.table.headers.map((header) => (
                  <th key={header} className="border-b border-ridefit-border px-3 py-2 font-semibold text-ridefit-text">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      className={`border-b border-ridefit-border/60 px-3 py-2 align-top ${
                        index === 0 ? 'font-medium text-ridefit-text' : 'text-ridefit-text-secondary'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section.note && <p className="mt-3 text-xs text-ridefit-text-secondary">{section.note}</p>}
    </section>
  )
}

function GuideBody({ body }) {
  if (!body) return null
  return (
    <div className="flex flex-col gap-5">
      {body.lead && <p className="text-lg text-ridefit-text">{body.lead}</p>}

      {(body.tools?.length > 0 || body.materials?.length > 0) && (
        <div className="grid gap-5 md:grid-cols-2">
          {body.tools?.length > 0 && (
            <div className="rounded-xl border border-ridefit-border bg-ridefit-card p-5">
              <h2 className="mb-3 text-lg font-bold text-ridefit-text">🧰 필요한 공구</h2>
              <ul className="flex flex-col gap-1.5 text-sm text-ridefit-text-secondary">
                {body.tools.map((t) => (
                  <li key={t}>· {t}</li>
                ))}
              </ul>
            </div>
          )}
          {body.materials?.length > 0 && (
            <div className="rounded-xl border border-ridefit-border bg-ridefit-card p-5">
              <h2 className="mb-3 text-lg font-bold text-ridefit-text">📦 준비물</h2>
              <ul className="flex flex-col gap-1.5 text-sm text-ridefit-text-secondary">
                {body.materials.map((m) => (
                  <li key={m}>· {m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {body.sections?.map((section, index) => (
        <Section key={section.title ?? index} section={section} />
      ))}
    </div>
  )
}

export default GuideBody
