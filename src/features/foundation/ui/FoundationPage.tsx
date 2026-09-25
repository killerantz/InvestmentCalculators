import {
  Button,
  CheckboxField,
  ComparisonChart,
  DataTable,
  Grid,
  Heading,
  Icon,
  Panel,
  Row,
  Stack,
  StatusBadge,
  Text,
  Tabs,
  YearNavigator,
  TextField,
  ScheduleTimeline,
  type IconName,
} from '@ui'

const iconExamples = [
  { name: 'calculator', label: 'Calculators' },
  { name: 'theme', label: 'Theming' },
  { name: 'components', label: 'Components' },
  { name: 'boundaries', label: 'Boundaries' },
] satisfies { name: IconName; label: string }[]

const previewSamples = [
  { period: 0, a: 10, b: 10 },
  { period: 1, a: 12, b: 15 },
  { period: 2, a: 16, b: 14 },
]
const previewSeries = [
  {
    id: 'first',
    label: 'Series A',
    points: previewSamples.map(({ period, a }) => ({ x: period, y: a })),
  },
  {
    id: 'second',
    label: 'Series B',
    points: previewSamples.map(({ period, b }) => ({ x: period, y: b })),
  },
]
const previewRows = previewSamples.map(({ period, a, b }) => ({
  id: String(period),
  cells: [String(period), String(a), String(b)],
}))
const iconOptions = [
  { value: 'regular', label: 'Regular icons' },
  { value: 'filled', label: 'Filled icons' },
]

export function FoundationPage({
  filledIcons,
  onToggleIcons,
  onSetFilledIcons,
  previewYear,
  onPreviewYearChange,
  previewActive,
  previewText,
  onPreviewTextChange,
}: {
  filledIcons: boolean
  onToggleIcons: () => void
  onSetFilledIcons: (filled: boolean) => void
  previewYear: number
  onPreviewYearChange: (year: number) => void
  previewActive: boolean
  previewText: string
  onPreviewTextChange: (value: string) => void
}) {
  return (
    <Stack>
      <Row>
        <StatusBadge>Foundation / 01</StatusBadge>
      </Row>
      <Heading level={1}>A considered foundation.</Heading>
      <Text muted>
        Build once, theme everywhere. A shared UI language for investment tools,
        with clear boundaries between presentation and financial logic.
      </Text>
      <Grid>
        <Panel title="One theme, every surface" icon="theme">
          <Text>
            Color, typography, spacing, and shape flow through tokens. Switch
            appearance above to see the same components adapt.
          </Text>
          <Text muted>
            System, light, and dark. No feature-level style overrides.
          </Text>
        </Panel>
        <Panel title="Components, not copies" icon="components">
          <Text>
            Pages compose a small, curated component API. Shared patterns grow
            here instead of becoming one-off styles in every feature.
          </Text>
          <Row>
            <Button
              appearance="primary"
              onClick={onToggleIcons}
              aria-pressed={filledIcons}
            >
              Filled icon preview
            </Button>
            <Button disabled>Disabled control example</Button>
          </Row>
        </Panel>
        <Panel title="Icons that belong together" icon="calculator">
          <Text>
            Fluent System Icons use SVGs, not font registration. Named imports
            keep the catalog available without shipping every icon.
          </Text>
          {iconExamples.map(({ name, label }) => (
            <Row key={name}>
              <Icon name={name} filled={filledIcons} />
              <Text>{label}</Text>
            </Row>
          ))}
        </Panel>
        <Panel title="Clear responsibility" icon="boundaries">
          <Text emphasis>
            App coordinates. Views compose. Domain calculates.
          </Text>
          <Text>
            Financial rules live in pure TypeScript modules. Feature models
            prepare data and actions; view components render them.
          </Text>
          <Text muted>
            The scenario worksheets use the shared headless engine. This UI
            preview contains no financial rules.
          </Text>
        </Panel>
      </Grid>
      <Panel title="Schedule and text patterns" icon="components">
        <Heading level={3}>Labeled text entry</Heading>
        <TextField
          label="Preview label"
          value={previewText}
          onChange={onPreviewTextChange}
          hint="Text remains a draft; the calling model owns validation."
        />
        <Grid>
          <TextField
            label="Field without a caption"
            value={previewText}
            onChange={onPreviewTextChange}
          />
          <TextField
            label="Field with a caption"
            help="Click or tap this information button for an explanation. You can also reach it with Tab, open it with Enter, and close it with Escape."
            value={previewText}
            onChange={onPreviewTextChange}
            hint="Captions can wrap and increase the row height without stretching neighboring labels or inputs."
          />
        </Grid>
        <ScheduleTimeline
          label="Illustrative duration timeline"
          total={24}
          items={[
            {
              id: 'first',
              label: 'First stage',
              start: 0,
              end: 6,
              detail: 'Months 0 to 6',
            },
            {
              id: 'second',
              label: 'Second stage',
              start: 6,
              end: 24,
              detail: 'Months 6 to 24',
            },
          ]}
        />
      </Panel>
      <Panel title="Shared comparison patterns" icon="components">
        <Text muted>
          Selection groups, optional details, exact navigation, and charts share
          the same theme. These series are illustrative units, not financial
          calculations.
        </Text>
        <Tabs
          label="Icon variant preview"
          value={filledIcons ? 'filled' : 'regular'}
          options={iconOptions}
          onChange={(value) => onSetFilledIcons(value === 'filled')}
        >
          <CheckboxField
            label="Use filled icon examples"
            checked={filledIcons}
            onChange={onSetFilledIcons}
          />
        </Tabs>
        <YearNavigator
          value={previewYear}
          max={12}
          onChange={onPreviewYearChange}
        />
        {previewActive && (
          <ComparisonChart
            title="Synthetic component preview"
            xLabel="Example period"
            yLabel="Example units"
            series={previewSeries}
            formatValue={String}
            markers={[
              {
                id: 'start',
                x: 0,
                label: 'First stage',
                detail: 'Starts at period 0.',
              },
              {
                id: 'next',
                x: 1,
                label: 'Second stage',
                detail: 'Starts at period 1.',
              },
            ]}
          />
        )}
        <DataTable
          caption="Synthetic chart data"
          columns={['Example period', 'Series A', 'Series B']}
          rows={previewRows}
        />
      </Panel>
    </Stack>
  )
}
