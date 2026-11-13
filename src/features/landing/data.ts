/**
 * The content of the front page.
 *
 * Keeping the copy in one file means the page components only ever deal with
 * layout, and the words can be reviewed without reading any JSX.
 */

export interface DemoScenario {
  id: string
  name: string
  rows: string
  fileType: string
  question: string
  calcStep: string
  execTime: string
  summary: string
  chartData: { label: string; value: number; formatted: string }[]
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'customers',
    name: 'Customer Retention & Churn',
    rows: '1,248,500 rows',
    fileType: 'Customer_Activity.xlsx',
    question:
      'Show me accounts paying over $5,000 whose usage dropped by more than 35% this month',
    calcStep:
      'Filtering accounts with revenue >= $5,000 and activity decline > 35% across all customer cohorts...',
    execTime: '0.04s',
    summary:
      'Found 14 high-value accounts at immediate risk representing $142,800 in revenue. Most are concentrated in Q3 due to recent software updates.',
    chartData: [
      { label: 'Q3 Accounts', value: 85, formatted: '$64,200 at risk' },
      { label: 'Q2 Accounts', value: 52, formatted: '$38,500 at risk' },
      { label: 'Q4 Accounts', value: 34, formatted: '$24,100 at risk' },
      { label: 'Q1 Accounts', value: 22, formatted: '$16,000 at risk' },
    ],
  },
  {
    id: 'healthcare',
    name: 'Medical Research Trials',
    rows: '684,200 rows',
    fileType: 'Patient_Outcomes.csv',
    question:
      'Compare patient recovery rates between Treatment Group A, Group B, and Control',
    calcStep:
      'Calculating average recovery scores, standard deviations, and completion rates by group at Day 28...',
    execTime: '0.02s',
    summary:
      'Treatment Group B showed a 4.8x higher improvement rate compared to the control group with 94.2% positive response.',
    chartData: [
      { label: 'Treatment B', value: 92, formatted: '94.2% Positive' },
      { label: 'Treatment A', value: 65, formatted: '68.5% Positive' },
      { label: 'Standard Care', value: 38, formatted: '41.0% Positive' },
      { label: 'Control Group', value: 15, formatted: '18.2% Positive' },
    ],
  },
  {
    id: 'finance',
    name: 'Quarterly Sales & Expenses',
    rows: '4,520,000 rows',
    fileType: 'Annual_Transactions.csv',
    question:
      'Which product categories generated the highest profit margins after accounting for shipping delays?',
    calcStep:
      'Aggregating net margin across 4.5 million line items grouped by product category and fulfillment speed...',
    execTime: '0.06s',
    summary:
      'Enterprise Hardware delivered 42.6% net margin despite shipping delays. Consumer Accessories suffered the highest margin erosion.',
    chartData: [
      { label: 'Enterprise Hardware', value: 94, formatted: '42.6% Margin' },
      { label: 'Cloud Services', value: 71, formatted: '34.8% Margin' },
      { label: 'Office Supplies', value: 45, formatted: '22.1% Margin' },
      { label: 'Consumer Goods', value: 28, formatted: '14.4% Margin' },
    ],
  },
]

export interface FaqItem {
  q: string
  a: string
}

export const FAQS: FaqItem[] = [
  {
    q: 'How does Lumina Tabula analyze my files without uploading them?',
    a: 'Lumina Tabula performs all calculations directly inside your web browser. When you open a file, your computer does all the work locally. Your files are never transmitted across the internet, never saved to any database, and never stored on any server.',
  },
  {
    q: 'Can anyone see, save, or steal my confidential business data?',
    a: 'No. We have zero access to your data. Everything runs privately on your device. Only table column headers are read to understand your questions, while all confidential numbers and customer records stay exclusively on your computer.',
  },
  {
    q: 'What types of files can I analyze?',
    a: 'You can open Excel spreadsheets (.xlsx), CSV files, TSV files, and large data files with millions of rows. Simply drag and drop your file into Lumina Tabula and begin immediately.',
  },
  {
    q: 'Do I need to install software or know complicated formulas?',
    a: 'No. Lumina Tabula works immediately in your standard web browser (Chrome, Safari, Edge, Firefox). You do not need to install plugins or write complex formulas. Just type questions in plain English.',
  },
  {
    q: 'Can I work offline without an internet connection?',
    a: 'Yes. Because data processing happens entirely on your machine, you can open and analyze your spreadsheets even when offline or on an airplane.',
  },
  {
    q: 'How do I share my reports and findings with colleagues?',
    a: 'You can export clean PDF summary reports, high-resolution charts, and filtered spreadsheets with a single click to share with executives and team members.',
  },
]

export interface FeatureItem {
  icon: 'database' | 'file' | 'chart' | 'check' | 'lock' | 'shield'
  title: string
  description: string
  large?: boolean
}

export const FEATURES: FeatureItem[] = [
  {
    icon: 'database',
    title: 'Handles Millions of Rows Instantly',
    description:
      'Open massive spreadsheets that crash standard spreadsheet software. Filter, group, and summarize millions of records in milliseconds with zero lag or freezing.',
    large: true,
  },
  {
    icon: 'file',
    title: 'Drag & Drop Any Spreadsheet',
    description:
      'Simply drop in your Excel (.xlsx) and CSV files. Dates, amounts, and categories are automatically recognized so you can start analyzing immediately.',
  },
  {
    icon: 'chart',
    title: 'Automatic Charts & Graphs',
    description:
      'View distributions, monthly trends, and comparisons instantly. Charts are created automatically based on what you ask.',
  },
  {
    icon: 'check',
    title: 'Executive Summary Reports',
    description:
      'Turn hours of manual spreadsheet work into a clean, executive summary you can export to PDF and email to your team.',
  },
  {
    icon: 'lock',
    title: 'Works Completely Offline',
    description:
      'Analyze your sensitive business files anywhere—even on an airplane with no internet connection. Everything happens right on your laptop.',
  },
  {
    icon: 'shield',
    title: 'Zero Tracking or Data Retention',
    description:
      'We never store your spreadsheets, record your numbers, or track your queries. Your business confidential numbers stay yours.',
  },
]
