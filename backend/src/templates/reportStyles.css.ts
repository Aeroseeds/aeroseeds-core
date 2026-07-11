export const reportStyles = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #1a1a1a;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
  }

  .report-title {
    font-size: 22px;
    font-weight: 700;
    color: #0f5c3a;
    margin: 0 0 4px;
  }

  .report-subtitle {
    font-size: 12px;
    color: #6e6e69;
    margin: 0 0 24px;
  }

  .report-section {
    margin-bottom: 24px;
  }

  .report-section-title {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #0f5c3a;
    margin: 0 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #dcdcd6;
    page-break-after: avoid;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px 32px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .field-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #8a8a84;
  }

  .field-value {
    font-size: 13px;
    color: #1a1a1a;
  }

  .stat-row {
    display: flex;
    gap: 32px;
    flex-wrap: wrap;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 700;
    color: #0f5c3a;
  }

  .stat-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #8a8a84;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #8a8a84;
    padding: 6px 8px;
    border-bottom: 1px solid #dcdcd6;
  }

  td {
    font-size: 12px;
    color: #1a1a1a;
    padding: 7px 8px;
    border-bottom: 1px solid #ececea;
    vertical-align: top;
  }

  tr:last-child td {
    border-bottom: none;
  }

  .pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .pill-success {
    background: #e3f6ec;
    color: #0f5c3a;
  }

  .pill-uncertain {
    background: #fbf1da;
    color: #8a6a1c;
  }

  .pill-rejected {
    background: #fbe6e6;
    color: #a12a2a;
  }

  .pill-processing {
    background: #fbf1da;
    color: #8a6a1c;
  }

  .pill-done {
    background: #e3f6ec;
    color: #0f5c3a;
  }

  .pill-failed {
    background: #fbe6e6;
    color: #a12a2a;
  }

  .muted {
    color: #8a8a84;
  }

  .empty-note {
    font-size: 12px;
    color: #8a8a84;
    padding: 8px 0;
  }

  .finding-card {
    padding-bottom: 14px;
    margin-bottom: 14px;
    border-bottom: 1px solid #ececea;
    page-break-inside: avoid;
  }

  .finding-card:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .finding-card-uncertain .finding-name,
  .finding-card-rejected .finding-name {
    color: #6e6e69;
  }

  .finding-card-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
  }

  .finding-name {
    font-size: 13.5px;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0;
  }

  .finding-coverage {
    font-size: 10.5px;
    color: #8a8a84;
    white-space: nowrap;
    margin: 0;
  }

  .finding-prose {
    font-size: 12px;
    line-height: 1.6;
    color: #333;
    margin: 0 0 4px;
  }

  .finding-block {
    margin-top: 10px;
  }

  .finding-block-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #0f5c3a;
    margin: 0 0 4px;
  }

  .rec-list {
    margin: 0;
    padding-left: 16px;
  }

  .rec-item {
    font-size: 12px;
    line-height: 1.6;
    color: #333;
    margin-bottom: 3px;
  }

  .rec-link {
    color: #0f5c3a;
    text-decoration: none;
    font-weight: 700;
    font-size: 10.5px;
  }

  .timeline {
    display: flex;
    flex-direction: column;
  }

  .timeline-row {
    display: flex;
    gap: 16px;
    padding: 8px 0;
    border-bottom: 1px solid #ececea;
    align-items: center;
  }

  .timeline-row:last-child {
    border-bottom: none;
  }

  .timeline-date {
    flex: 0 0 150px;
    font-size: 11px;
    color: #8a8a84;
  }

  .timeline-body {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .timeline-summary {
    font-size: 12px;
    color: #1a1a1a;
  }
`;
