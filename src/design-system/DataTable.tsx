import { useId } from 'react'
import { InfoButton, makeStyles, tokens } from '@fluentui/react-components'

const useStyles = makeStyles({
  container: {
    minWidth: 0,
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground1,
  },
  caption: {
    textAlign: 'start',
    fontWeight: tokens.fontWeightSemibold,
    paddingBlock: tokens.spacingVerticalM,
  },
  header: {
    backgroundColor: tokens.colorNeutralBackground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  cell: {
    textAlign: 'start',
    whiteSpace: 'nowrap',
    paddingBlock: tokens.spacingVerticalS,
    paddingInline: tokens.spacingHorizontalM,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  help: {
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  },
})

export type DataTableProps = {
  caption: string
  columns: readonly string[]
  rows: readonly { id: string; cells: readonly string[]; help?: string }[]
}

export function DataTable({ caption, columns, rows }: DataTableProps) {
  const styles = useStyles()
  const captionId = useId()

  for (const row of rows) {
    if (row.cells.length !== columns.length) {
      throw new Error(
        `DataTable row "${row.id}" has ${row.cells.length} cells; expected ${columns.length}.`,
      )
    }
  }

  return (
    <div
      className={styles.container}
      role="region"
      aria-labelledby={captionId}
      tabIndex={0}
    >
      <table className={styles.table}>
        <caption className={styles.caption} id={captionId}>
          {caption}
        </caption>
        <thead className={styles.header}>
          <tr>
            {columns.map((column, index) => (
              <th className={styles.cell} scope="col" key={index}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell, index) => (
                <td className={styles.cell} key={index}>
                  {cell}
                  {index === 0 && row.help && (
                    <InfoButton
                      aria-label={`About ${cell}`}
                      inline={false}
                      info={{ children: row.help, className: styles.help }}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
