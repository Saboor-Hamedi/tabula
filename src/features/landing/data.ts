/**
 * The content of the front page.
 *
 * Plain, everyday language for business users — zero developer jargon.
 */

export interface DemoScenario {
  id: string
  name: string
  category: string
  rows: string
  fileType: string
  question: string
  calcStep: string
  execTime: string
  summary: string
  kpis: { label: string; value: string; tone?: 'accent' | 'neutral' | 'warn' }[]
  steps: string[]
  chartData: { label: string; value: number; formatted: string }[]
  tableColumns: string[]
  tableRows: string[][]
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'customers',
    name: 'Customer Retention & Churn',
    category: 'Revenue Ops',
    rows: '1,248,500 rows',
    fileType: 'Customer_Activity.xlsx',
    question:
      'Show me accounts paying over $5,000 whose usage dropped by more than 35% this month',
    calcStep:
      'Scanned 1.24M activity rows directly on your device, matched billing tiers, and ranked accounts by monthly revenue at risk.',
    execTime: '0.04s',
    summary:
      'Found 14 high-value accounts at immediate risk representing $142,800 in monthly revenue. Most are concentrated in Q3 cohorts following recent workflow changes.',
    kpis: [
      { label: 'Revenue at Risk', value: '$142,800', tone: 'warn' },
      { label: 'Flagged Accounts', value: '14', tone: 'accent' },
      { label: 'Data Uploaded', value: '0 bytes', tone: 'neutral' },
    ],
    steps: [
      'Opened Customer_Activity.xlsx (1,248,500 rows) directly in browser memory.',
      'Filtered to active accounts paying $5,000 or more per month.',
      'Identified accounts with a usage drop greater than 35% compared to last month.',
      'Grouped results by customer cohort and ranked by total revenue at risk.',
    ],
    chartData: [
      { label: 'Q3 Cohort', value: 88, formatted: '$64,200 at risk' },
      { label: 'Q2 Cohort', value: 54, formatted: '$38,500 at risk' },
      { label: 'Q4 Cohort', value: 35, formatted: '$24,100 at risk' },
      { label: 'Q1 Cohort', value: 23, formatted: '$16,000 at risk' },
    ],
    tableColumns: ['Cohort', 'Accounts', 'Usage Change', 'Revenue at Risk'],
    tableRows: [
      ['Q3 2026', '6', '-48.2%', '$64,200'],
      ['Q2 2026', '4', '-41.7%', '$38,500'],
      ['Q4 2025', '2', '-39.1%', '$24,100'],
      ['Q1 2026', '2', '-36.4%', '$16,000'],
    ],
  },
  {
    id: 'healthcare',
    name: 'Medical Research Trials',
    category: 'Clinical Data',
    rows: '684,200 rows',
    fileType: 'Patient_Outcomes.csv',
    question:
      'Compare patient recovery rates between Treatment Group A, Group B, and Control at Day 28',
    calcStep:
      'Calculated recovery percentages, average improvement scores, and completion rates strictly inside browser memory.',
    execTime: '0.02s',
    summary:
      'Treatment Group B showed a 4.8x higher improvement rate compared to the control group with 94.2% positive response and 98.1% trial completion.',
    kpis: [
      { label: 'Top Response', value: '94.2%', tone: 'accent' },
      { label: 'Lift vs Control', value: '4.8×', tone: 'accent' },
      { label: 'Records Shared', value: 'Zero', tone: 'neutral' },
    ],
    steps: [
      'Loaded Patient_Outcomes.csv (684,200 patient records) locally with zero upload.',
      'Separated records by trial arm: Treatment B, Treatment A, Standard Care, and Control.',
      'Computed Day 28 recovery rates and average improvement scores for each group.',
      'Ranked treatment arms from highest to lowest positive response rate.',
    ],
    chartData: [
      { label: 'Treatment B', value: 94, formatted: '94.2% Positive' },
      { label: 'Treatment A', value: 68, formatted: '68.5% Positive' },
      { label: 'Standard Care', value: 41, formatted: '41.0% Positive' },
      { label: 'Control Group', value: 18, formatted: '18.2% Positive' },
    ],
    tableColumns: ['Trial Arm', 'Patients', 'Recovery Rate', 'Avg Score'],
    tableRows: [
      ['Treatment B', '171,400', '94.2%', '8.91'],
      ['Treatment A', '170,950', '68.5%', '6.74'],
      ['Standard Care', '171,100', '41.0%', '4.52'],
      ['Control Group', '170,750', '18.2%', '2.38'],
    ],
  },
  {
    id: 'finance',
    name: 'Quarterly Sales & Margins',
    category: 'Finance',
    rows: '4,520,000 rows',
    fileType: 'Annual_Transactions.csv',
    question:
      'Which product categories generated the highest profit margins after accounting for shipping delays?',
    calcStep:
      'Summarized net profit margins across 4.52M line items grouped by category, delivery speed, and refund adjustments.',
    execTime: '0.06s',
    summary:
      'Enterprise Hardware delivered 42.6% net margin despite carrier delays. Consumer Goods suffered the highest margin erosion from rush replacements.',
    kpis: [
      { label: 'Rows Analyzed', value: '4.52M', tone: 'accent' },
      { label: 'Top Net Margin', value: '42.6%', tone: 'accent' },
      { label: 'Answer Speed', value: '0.06s', tone: 'neutral' },
    ],
    steps: [
      'Scanned Annual_Transactions.csv (4,520,000 transactions) directly on your laptop.',
      'Matched each order with shipping delay days and refund adjustments.',
      'Calculated net profit margin percentage for every product category.',
      'Sorted categories from highest to lowest profitability.',
    ],
    chartData: [
      { label: 'Enterprise Hardware', value: 94, formatted: '42.6% Margin' },
      { label: 'Cloud Services', value: 76, formatted: '34.8% Margin' },
      { label: 'Office Supplies', value: 48, formatted: '22.1% Margin' },
      { label: 'Consumer Goods', value: 31, formatted: '14.4% Margin' },
    ],
    tableColumns: ['Category', 'Revenue', 'Avg Delay', 'Net Margin'],
    tableRows: [
      ['Enterprise Hardware', '$18.4M', '1.8 days', '42.6%'],
      ['Cloud Services', '$12.9M', '0.0 days', '34.8%'],
      ['Office Supplies', '$6.2M', '2.4 days', '22.1%'],
      ['Consumer Goods', '$9.1M', '4.1 days', '14.4%'],
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
    a: 'Lumina Tabula performs all calculations directly inside your web browser. When you open an Excel or CSV file, your own computer handles every filter, calculation, and chart locally. Your raw records are never transmitted over the internet or stored on any server.',
  },
  {
    q: 'Can anyone see, save, or steal my confidential business data?',
    a: 'No. We have zero access to your spreadsheet numbers. Only lightweight column names are used to understand your questions, while every confidential record stays exclusively on your computer.',
  },
  {
    q: 'What types of files can I analyze?',
    a: 'You can open multi-sheet Excel workbooks (.xlsx), CSV files, and TSV files — including massive spreadsheets with millions of rows. Simply drag and drop your file and start asking questions immediately.',
  },
  {
    q: 'Do I need to install software or know complicated formulas?',
    a: 'No. Lumina Tabula works right inside Chrome, Safari, Edge, or Firefox with zero installation. Just type your question in plain English and get clear answers, tables, and charts.',
  },
  {
    q: 'Can I work offline without an internet connection?',
    a: 'Yes. Because data processing happens directly on your device, you can open and analyze your spreadsheets even when offline or on a flight.',
  },
  {
    q: 'How do I share my reports and findings with colleagues?',
    a: 'Export clean PDF executive reports, high-resolution charts, Word documents, or filtered spreadsheets with a single click — or publish curated insights directly from your workspace.',
  },
]

export interface FeatureItem {
  id: 'speed' | 'files' | 'charts' | 'reports' | 'offline' | 'privacy'
  icon: 'database' | 'file' | 'chart' | 'check' | 'lock' | 'shield'
  eyebrow: string
  title: string
  description: string
  large?: boolean
}

export const FEATURES: FeatureItem[] = [
  {
    id: 'speed',
    icon: 'database',
    eyebrow: 'Instant Speed',
    title: 'Handles Millions of Rows Instantly',
    description:
      'Open massive spreadsheets that freeze standard spreadsheet apps. Filter, group, and summarize millions of records in a fraction of a second right in your browser.',
    large: true,
  },
  {
    id: 'files',
    icon: 'file',
    eyebrow: 'Zero Setup',
    title: 'Drag & Drop Any Workbook',
    description:
      'Drop in multi-sheet Excel (.xlsx), CSV, or TSV files. Dates, amounts, and categories are recognized automatically.',
  },
  {
    id: 'charts',
    icon: 'chart',
    eyebrow: 'Visual Clarity',
    title: 'Automatic Charts & Graphs',
    description:
      'Turn plain-English questions into clean bar charts, trends, and breakdowns with zero manual formatting.',
  },
  {
    id: 'reports',
    icon: 'check',
    eyebrow: 'One-Click Export',
    title: 'Executive Summary Reports',
    description:
      'Package your findings, tables, and charts into polished PDF or Word briefs ready to share with leadership.',
  },
  {
    id: 'offline',
    icon: 'lock',
    eyebrow: 'Offline Ready',
    title: 'Works Anywhere, Even Offline',
    description:
      'Keep exploring sensitive files on flights or restricted networks. Your own computer does all the work.',
  },
  {
    id: 'privacy',
    icon: 'shield',
    eyebrow: 'Zero Retention',
    title: 'Zero Tracking or Cloud Storage',
    description:
      'We never store your spreadsheets, record your numbers, or train on your files. Close the tab and local memory clears.',
  },
]
