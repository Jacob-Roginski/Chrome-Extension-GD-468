const TermsLensScanner = (() => {
  const CONCERN_RULES = [
    { title: 'Data sharing and tracking', severity: 'Review', pattern: /(?:sell|share|disclos|advertis|third[- ]party|tracking|analytics|personal information).{0,160}(?:data|information|partner|service)/i, detail: 'The agreement appears to allow data disclosure, targeted advertising, analytics, or third-party processing.', check: 'Check which data is shared, who receives it, the opt-out process, and how long it is retained.' },
    { title: 'Automatic renewal or billing', severity: 'High attention', pattern: /(?:automatic(?:ally)? renew|recurring billing|subscription|free trial).{0,160}(?:charge|payment|cancel|fee|renew)/i, detail: 'The agreement appears to describe recurring charges, trial conversion, or renewal terms.', check: 'Check the renewal date, price changes, cancellation deadline, and whether refunds are available.' },
    { title: 'Arbitration and class-action waiver', severity: 'High attention', pattern: /(?:arbitration|class action|jury trial|dispute resolution).{0,180}(?:waive|waiver|require|agree|claim|dispute)/i, detail: 'The agreement may require private dispute resolution or limit participation in a class action.', check: 'Check the opt-out deadline, arbitration location and costs, and which claims are covered.' },
    { title: 'Broad liability limits', severity: 'High attention', pattern: /(?:limitation of liability|not liable|as is|no warranty|indemnif).{0,180}(?:damage|loss|claim|warranty|defend|reimburse)/i, detail: 'The agreement appears to limit company responsibility or shift claims and defense costs to you.', check: 'Check damage caps, excluded losses, warranty disclaimers, and any indemnity obligations.' },
    { title: 'Unilateral changes', severity: 'Review', pattern: /(?:modify|change these terms|updated terms|at any time).{0,180}(?:notice|effective|agree|accept|post)/i, detail: 'The company may be able to change the agreement without negotiating each change with you.', check: 'Check how notice is delivered, when changes take effect, and whether continued use counts as acceptance.' },
    { title: 'Suspension or termination', severity: 'Review', pattern: /(?:terminate|suspend|disable|close your account).{0,180}(?:without notice|any time|content|access|refund)/i, detail: 'The company may be able to suspend access or terminate the account, potentially without advance notice.', check: 'Check what happens to your data, paid balance, subscriptions, and content after termination.' },
    { title: 'Governing law and venue', severity: 'Review', pattern: /(?:governing law|jurisdiction|venue|laws of the (?:state|country)).{0,140}(?:court|dispute|claim|law)/i, detail: 'The agreement names a law or location that may control how disputes are handled.', check: 'Check whether the required court or location is practical for you and whether another clause changes this rule.' }
  ];

  function analyze(text) {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const concerns = CONCERN_RULES.flatMap((rule) => {
      const match = rule.pattern.exec(normalizedText);
      if (!match) return [];
      const start = Math.max(0, normalizedText.lastIndexOf('.', match.index) + 1);
      const end = normalizedText.indexOf('.', match.index + match[0].length);
      return [{
        title: rule.title,
        severity: rule.severity,
        detail: rule.detail,
        check: rule.check,
        evidence: normalizedText.slice(start, end === -1 ? Math.min(normalizedText.length, start + 240) : Math.min(end + 1, start + 240)).trim()
      }];
    });
    return { concerns, concernCount: concerns.length, analyzedCharacters: text.length };
  }

  return { analyze };
})();
