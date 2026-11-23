
import { useState, useEffect, useMemo } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";


const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "analyze", label: "Threat Analysis", icon: "⌕" },
  { id: "analytics", label: "Threat Analytics", icon: "▥" },
  { id: "history", label: "Analysis History", icon: "◷" },
  { id: "performance", label: "Model Performance", icon: "◎" },
  { id: "about", label: "About Project", icon: "ⓘ" },
];


const SAMPLE_TEXT =
  "Multiple files on an employee workstation were encrypted and a ransom note demanded cryptocurrency payment.";

function StatusBadge({ connected }) {
  return (
    <span className={`api-status ${connected ? "connected" : "disconnected"}`}>
      <span className={`status-dot ${connected ? "" : "offline"}`} />
      {connected ? "API Connected" : "API Disconnected"}
    </span>
  );
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="panel-heading">
      <div>
        <span className="section-kicker">{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p className="muted-text">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ icon, label, value, description, accent = "blue" }) {
  return (
    <article className={`stat-card stat-${accent}`}>
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <small className="stat-description">{description}</small>
    </article>
  );
}

function ProgressBar({ value }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        className="progress-fill"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◈</div>
      <h3>{title}</h3>
      <p className="muted-text">{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}


function AnalyticsPage({ history, csvResult, csvBatchHistory, onAnalyze, onOpenHistory }) {
  const [selectedBatchId, setSelectedBatchId] = useState("all");
  const visibleBatches = useMemo(() => (
    selectedBatchId === "all"
      ? csvBatchHistory
      : csvBatchHistory.filter((batch) => batch.id === selectedBatchId)
  ), [csvBatchHistory, selectedBatchId]);
  const historicalCategories = useMemo(() => {
    const totals = {};
    visibleBatches.forEach((batch) => {
      Object.entries(batch.categoryCounts || {}).forEach(([category, count]) => {
        totals[category] = (totals[category] || 0) + Number(count || 0);
      });
    });
    return Object.entries(totals)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [visibleBatches]);
  const maxHistoricalCategory = Math.max(1, ...historicalCategories.map((item) => item.count));
  const exportHistoricalAnalytics = () => {
    const headers = ["Batch", "Analyzed At", "Total Records", "Processed", "Skipped", "Average Model Score (%)", "Top Category", "Category Distribution"];
    const rows = visibleBatches.map((batch) => [
      batch.filename,
      new Date(batch.timestamp).toISOString(),
      batch.total,
      batch.processed,
      batch.skipped,
      batch.averageScore == null ? "" : Number(batch.averageScore).toFixed(2),
      batch.topCategory || "",
      Object.entries(batch.categoryCounts || {}).map(([name, count]) => `${name}: ${count}`).join("; "),
    ]);
    const escapeCsv = (value) => {
      const text = String(value ?? "");
      const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ThreatLens_Historical_Analytics.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const categories = useMemo(() => {
    const counts = {};

    history.forEach((item) => {
      const name = item.predictedClass || "Unknown";
      counts[name] = (counts[name] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [history]);

  const activity = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = history.filter((item) => {
        const time = new Date(item.timestamp || item.id);
        return time >= date && time < nextDate;
      }).length;

      return {
        label: date.toLocaleDateString("en", { weekday: "short" }),
        count,
      };
    });
  }, [history]);

  const maximum = Math.max(1, ...categories.map((item) => item.count));
  const maxActivity = Math.max(1, ...activity.map((item) => item.count));

  // Insights from the most recently processed CSV batch.
  const csvInsights = useMemo(() => {
    const records = (csvResult?.results || []).filter((item) =>
      !String(item.status || "").toLowerCase().includes("skip")
    );
    const categoryCounts = records.reduce((counts, item) => {
      const category = item.predicted_class || "Unclassified";
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {});
    const distribution = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const scored = records
      .map((item) => Number(item.model_score_percent))
      .filter((score) => Number.isFinite(score));
    const averageScore = scored.length
      ? scored.reduce((sum, score) => sum + score, 0) / scored.length
      : null;
    const scoreBands = {
      high: scored.filter((score) => score >= 70).length,
      medium: scored.filter((score) => score >= 40 && score < 70).length,
      low: scored.filter((score) => score < 40).length,
    };
    return {
      total: Number(csvResult?.total_records ?? records.length),
      processed: records.length,
      skipped: Number(csvResult?.skipped_records ?? 0),
      distribution,
      topCategory: distribution[0] || null,
      averageScore,
      scoreBands,
    };
  }, [csvResult]);
  const csvCategoryMaximum = Math.max(1, ...csvInsights.distribution.map((item) => item.count));

  const average = history.length
    ? history.reduce((sum, item) => sum + Number(item.score || 0), 0) / history.length
    : 0;

  return (
    <>
      <div className="analytics-intro">
        <div>
          <span className="section-kicker">OPERATIONAL INTELLIGENCE</span>
          <h2>Threat Analytics</h2>
          <p className="muted-text">
            Insights from your completed threat classification analyses.
          </p>
        </div>

        <button className="primary-button" onClick={onAnalyze}>
          + New Analysis
        </button>
      </div>

      <div className="stats-grid">
        <StatCard
          icon="⌁"
          label="Total Predictions"
          value={history.length}
          description="Current browser session"
          accent="blue"
        />

        <StatCard
          icon="▦"
          label="Categories Observed"
          value={categories.length}
          description="Distinct predicted labels"
          accent="cyan"
        />

        <StatCard
          icon="◎"
          label="Average Model Score"
          value={history.length ? `${average.toFixed(1)}%` : "—"}
          description="Average across predictions"
          accent="green"
        />

        <StatCard
          icon="◷"
          label="Recent Activity"
          value={history.length ? "Active" : "Waiting"}
          description="Prediction activity"
          accent="purple"
        />
      </div>

      {csvResult && (
        <section className="csv-insights-section">
          <div className="csv-insights-heading">
            <div>
              <span className="section-kicker">BULK ANALYSIS INSIGHTS</span>
              <h3>Latest CSV Intelligence Summary</h3>
              <p className="muted-text">
                {csvResult.filename || "Latest uploaded CSV"} · Score bands are descriptive model-score ranges, not threat severity.
              </p>
            </div>
            <span className="csv-results-count">{csvInsights.processed} analyzed</span>
          </div>

          <div className="csv-insights-stats">
            <article className="csv-insight-card"><span>Total Records</span><strong>{csvInsights.total}</strong></article>
            <article className="csv-insight-card"><span>Processed</span><strong>{csvInsights.processed}</strong></article>
            <article className="csv-insight-card"><span>Skipped</span><strong>{csvInsights.skipped}</strong></article>
            <article className="csv-insight-card"><span>Average Model Score</span><strong>{csvInsights.averageScore === null ? "—" : `${csvInsights.averageScore.toFixed(1)}%`}</strong></article>
            <article className="csv-insight-card"><span>Most Frequent Category</span><strong className="csv-insight-category">{csvInsights.topCategory ? `${csvInsights.topCategory.name} (${csvInsights.topCategory.count})` : "—"}</strong></article>
          </div>

          <div className="csv-insights-detail-grid">
            <div className="csv-insight-subpanel">
              <h4>Threat Category Distribution</h4>
              {csvInsights.distribution.length ? csvInsights.distribution.map((item) => (
                <div className="csv-insight-bar-row" key={item.name}>
                  <div><span>{item.name}</span><strong>{item.count}</strong></div>
                  <div className="analytics-track"><div className="analytics-fill" style={{ width: `${(item.count / csvCategoryMaximum) * 100}%` }} /></div>
                </div>
              )) : <p className="muted-text">No processed records available.</p>}
            </div>
            <div className="csv-insight-subpanel">
              <h4>Model Score Bands</h4>
              <p className="muted-text">Based on available per-record model scores.</p>
              <div className="csv-score-band-list">
                <div><span className="score-band-dot band-high" /><span>High (70–100%)</span><strong>{csvInsights.scoreBands.high}</strong></div>
                <div><span className="score-band-dot band-medium" /><span>Medium (40–69.9%)</span><strong>{csvInsights.scoreBands.medium}</strong></div>
                <div><span className="score-band-dot band-low" /><span>Low (below 40%)</span><strong>{csvInsights.scoreBands.low}</strong></div>
              </div>
              <p className="csv-insight-disclaimer">These ranges describe model scores only. They do not indicate confirmed risk or calibrated confidence.</p>
            </div>
          </div>
        </section>
      )}

      <section className="panel csv-history-panel">
        <div className="csv-history-heading">
          <div>
            <span className="section-kicker">BATCH HISTORY</span>
            <h3>Historical CSV Analytics</h3>
            <p className="muted-text">Compare completed CSV analysis batches saved in this browser.</p>
          </div>
          <span className="csv-results-count">{csvBatchHistory.length} batches</span>
        </div>
        {csvBatchHistory.length === 0 ? (
          <EmptyState title="No CSV batches saved yet" description="Analyze a CSV file to start building your historical analytics." action={<button className="secondary-button" onClick={onAnalyze}>Analyze a CSV →</button>} />
        ) : (
          <>
            <div className="csv-history-table-wrap">
              <table className="csv-history-table">
                <thead><tr><th>Batch / File</th><th>Date analyzed</th><th>Total</th><th>Processed</th><th>Skipped</th><th>Average score</th><th>Top category</th></tr></thead>
                <tbody>
                  {csvBatchHistory.slice(0, 10).map((batch) => (
                    <tr key={batch.id}>
                      <td><strong>{batch.filename}</strong></td>
                      <td>{new Date(batch.timestamp).toLocaleString()}</td>
                      <td>{batch.total}</td><td>{batch.processed}</td><td>{batch.skipped}</td>
                      <td>{batch.averageScore === null ? "—" : `${batch.averageScore.toFixed(1)}%`}</td>
                      <td><span className="csv-history-category">{batch.topCategory || "—"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvBatchHistory.length > 10 && <p className="muted-text csv-history-note">Showing the 10 most recent batches of {csvBatchHistory.length} saved.</p>}
            <div className="csv-history-footer"><span className="muted-text">History is stored locally in this browser.</span><button className="text-button" onClick={() => { if (window.confirm("Clear all saved CSV batch history? This cannot be undone.")) { localStorage.removeItem("threatlens_csv_batch_history"); window.location.reload(); } }}>Clear batch history</button></div>
          </>
        )}
      </section>

      <section className="panel csv-comparison-panel">
        <div className="csv-history-heading">
          <div>
            <span className="section-kicker">CROSS-BATCH COMPARISON</span>
            <h3>Historical Intelligence Comparison</h3>
            <p className="muted-text">Compare model-score averages and predicted category counts across saved CSV batches.</p>
          </div>
          <div className="csv-comparison-actions">
            <select className="csv-batch-select" value={selectedBatchId} onChange={(event) => setSelectedBatchId(event.target.value)} aria-label="Filter historical analytics by batch">
              <option value="all">All batches</option>
              {csvBatchHistory.map((batch) => <option key={batch.id} value={batch.id}>{batch.filename}</option>)}
            </select>
            <button className="secondary-button" onClick={exportHistoricalAnalytics} disabled={!visibleBatches.length}>↓ Export comparison</button>
          </div>
        </div>
        {visibleBatches.length === 0 ? (
          <p className="muted-text">Analyze CSV files to compare historical batches.</p>
        ) : (
          <>
            <div className="csv-comparison-grid">
              <div className="csv-insight-subpanel">
                <h4>Average Model Score by Batch</h4>
                {visibleBatches.slice(0, 8).map((batch) => (
                  <div className="csv-insight-bar-row" key={batch.id}>
                    <div><span title={batch.filename}>{batch.filename}</span><strong>{batch.averageScore == null ? "—" : `${batch.averageScore.toFixed(1)}%`}</strong></div>
                    <div className="analytics-track"><div className="analytics-fill" style={{ width: `${Math.max(0, Math.min(100, batch.averageScore || 0))}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="csv-insight-subpanel">
                <h4>Category Counts Across Batches</h4>
                {historicalCategories.length ? historicalCategories.slice(0, 10).map((item) => (
                  <div className="csv-insight-bar-row" key={item.name}>
                    <div><span>{item.name}</span><strong>{item.count}</strong></div>
                    <div className="analytics-track"><div className="analytics-fill" style={{ width: `${(item.count / maxHistoricalCategory) * 100}%` }} /></div>
                  </div>
                )) : <p className="muted-text">Category breakdown is unavailable for older saved batches. New batches will include it.</p>}
              </div>
            </div>
            <div className="csv-batch-compare-table-wrap">
              <table className="csv-history-table">
                <thead><tr><th>Batch</th><th>Records processed</th><th>Average score</th><th>Top category</th></tr></thead>
                <tbody>{visibleBatches.slice(0, 8).map((batch) => <tr key={batch.id}><td><strong>{batch.filename}</strong></td><td>{batch.processed}</td><td>{batch.averageScore == null ? "—" : `${batch.averageScore.toFixed(1)}%`}</td><td><span className="csv-history-category">{batch.topCategory || "—"}</span></td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="analytics-grid">
        <section className="panel analytics-panel">
          <SectionHeading
            eyebrow="CLASSIFICATION INSIGHTS"
            title="Category Distribution"
            description="Number of predictions for each category."
          />

          {categories.length === 0 ? (
            <EmptyState
              title="No prediction data"
              description="Complete a threat analysis to populate this chart."
              action={
                <button className="secondary-button" onClick={onAnalyze}>
                  Start Analysis →
                </button>
              }
            />
          ) : (
            <div className="analytics-bars">
              {categories.map((item) => (
                <div className="analytics-bar-row" key={item.name}>
                  <div className="analytics-bar-label">
                    <span>{item.name}</span>
                    <strong>{item.count}</strong>
                  </div>

                  <div className="analytics-track">
                    <div
                      className="analytics-fill"
                      style={{
                        width: `${(item.count / maximum) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel analytics-panel">
          <SectionHeading
            eyebrow="ACTIVITY MONITOR"
            title="Last 7 Days"
            description="Daily prediction count."
          />

          {history.length === 0 ? (
            <EmptyState
              title="No activity recorded"
              description="Your prediction activity will appear here."
            />
          ) : (
            <div className="timeline-chart">
              {activity.map((day) => (
                <div className="timeline-column" key={day.label}>
                  <strong>{day.count}</strong>

                  <div className="timeline-track">
                    <div
                      className="timeline-fill"
                      style={{
                        height: `${(day.count / maxActivity) * 100}%`,
                      }}
                    />
                  </div>

                  <small>{day.label}</small>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel recent-panel">
        <SectionHeading
          eyebrow="LATEST CLASSIFICATIONS"
          title="Recent Prediction Activity"
          description="Your latest model predictions."
          action={
            <button className="text-button" onClick={onOpenHistory}>
              View History →
            </button>
          }
        />

        {history.length === 0 ? (
          <EmptyState
            title="No recent predictions"
            description="Run your first analysis to see activity here."
          />
        ) : (
          history.slice(0, 5).map((item) => (
            <button
              className="history-item"
              key={item.id}
              onClick={() => onOpenHistory(item)}
            >
              <span className="history-symbol">◈</span>

              <span className="history-description">
                <strong>{item.predictedClass}</strong>
                <small>{item.date} · {item.input.slice(0, 100)}</small>
              </span>

              <span className="history-score">
                {Number(item.score || 0).toFixed(1)}%
              </span>
            </button>
          ))
        )}
      </section>

      <div className="info-note">
        Analytics reflect predictions recorded in this browser session.
        They are not live network telemetry or confirmed security incidents.
      </div>
    </>
  );
}


function App() {
  const [activePage, setActivePage] = useState("overview");
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(() => {
    try {
      const savedHistory = localStorage.getItem("threatlens_analysis_history");
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (error) {
      console.error("Could not load saved history:", error);
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [csvResult, setCsvResult] = useState(null);
  const [csvBatchHistory, setCsvBatchHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("threatlens_csv_batch_history");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Could not load CSV batch history:", error);
      return [];
    }
  });
  const [csvLoading, setCsvLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("threatlens_csv_batch_history", JSON.stringify(csvBatchHistory));
    } catch (error) {
      console.error("Could not save CSV batch history:", error);
    }
  }, [csvBatchHistory]);

  // Save analysis history in browser storage
  useEffect(() => {
    try {
      localStorage.setItem(
        "threatlens_analysis_history",
        JSON.stringify(history)
      );
    } catch (error) {
      console.error("Could not save analysis history:", error);
    }
  }, [history]);

  // Backend health monitoring
  useEffect(() => {
    let mounted = true;

    const checkAPI = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) throw new Error("Backend unavailable");

        const data = await response.json();

        if (mounted) {
          setApiConnected(data.model_loaded === true);
        }
      } catch {
        if (mounted) setApiConnected(false);
      }
    };

    checkAPI();

    const interval = setInterval(checkAPI, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);


  // Run prediction using the existing FastAPI endpoint
  const analyzeThreat = async () => {
    if (!text.trim()) {
      setError("Please enter threat intelligence text before analyzing.");
      return;
    }

    if (!apiConnected) {
      setError("Backend is disconnected. Please start your FastAPI server.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.error || !data?.predicted_class) {
        throw new Error(
          data?.detail || data?.error || "Prediction could not be completed."
        );
      }

      setResult(data);

      const newRecord = {
        id: Date.now(),
        input_text: text.trim(),
        inputText: text.trim(),
        input: text.trim(),
        text: text.trim(),
        predictedClass: data.predicted_class,
        score: Number(data.model_score_percent) || 0,
        date: new Date().toLocaleString(),
        result: data,
      };

      setHistory((previous) => [newRecord, ...previous]);
    } catch (err) {
      setError(err.message || "Unable to connect to the backend.");
    } finally {
      setLoading(false);
    }
  };


  const downloadPDFReport = () => {
    if (!result) {
      setError("Please analyze threat intelligence before downloading a report.");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;

    const score = Number(result.model_score_percent) || 0;
    const submittedText = result.input_text || text;

    // Header
    doc.setFillColor(7, 17, 34);
    doc.rect(0, 0, pageWidth, 42, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("THREATLENS", margin, 19);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("CYBER THREAT INTELLIGENCE REPORT", margin, 28);

    doc.setTextColor(0, 190, 255);
    doc.text(`REPORT ID: TL-${Date.now()}`, margin, 36);

    let y = 55;

    // Report information
    doc.setTextColor(25, 40, 60);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Threat Analysis Summary", margin, y);

    y += 12;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);

    y += 15;

    // Prediction result
    doc.setFillColor(235, 245, 255);
    doc.roundedRect(margin, y, contentWidth, 34, 3, 3, "F");

    doc.setTextColor(20, 70, 130);
    doc.setFontSize(9);
    doc.text("PREDICTED CTI ENTITY CLASS", margin + 6, y + 10);

    doc.setFontSize(17);
    doc.setFont("helvetica", "bold");
    doc.text(String(result.predicted_class || "Unknown"), margin + 6, y + 22);

    doc.setFontSize(10);
    doc.text(`Model score: ${score}%`, pageWidth - margin - 6, y + 22, {
      align: "right",
    });

    y += 46;

    // Submitted intelligence
    doc.setTextColor(25, 40, 60);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Submitted Threat Intelligence", margin, y);

    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const inputLines = doc.splitTextToSize(
      String(submittedText || "Not available"),
      contentWidth
    );

    const inputHeight = inputLines.length * 5 + 8;

    if (y + inputHeight > 260) {
      doc.addPage();
      y = 25;
    }

    doc.setDrawColor(210, 220, 235);
    doc.roundedRect(margin, y, contentWidth, inputHeight, 2, 2, "S");
    doc.text(inputLines, margin + 5, y + 7);

    y += inputHeight + 15;

    // Top predictions
    if (Array.isArray(result.top_predictions)) {
      if (y > 245) {
        doc.addPage();
        y = 25;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Top Predicted Categories", margin, y);
      y += 9;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      result.top_predictions.slice(0, 3).forEach((item, index) => {
        const label =
          typeof item === "string"
            ? item
            : item.label || item.category || item.class || "Unknown";

        const value =
          typeof item === "object"
            ? item.score ?? item.probability ?? item.percentage ?? ""
            : "";

        doc.text(
          `${index + 1}. ${label}${value !== "" ? ` - ${value}%` : ""}`,
          margin + 3,
          y
        );
        y += 8;
      });
    }

    // Disclaimer
    if (y > 255) {
      doc.addPage();
      y = 25;
    }

    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(100, 110, 125);
    doc.text(
      "Disclaimer: This report presents an ML-based classification using dataset-defined categories. It is not a confirmed security verdict. Model scores are not necessarily calibrated probabilities. Verify findings with additional security evidence and analyst review.",
      margin,
      y,
      { maxWidth: contentWidth }
    );

    // Footer
    const pageCount = doc.internal.getNumberOfPages();

    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(130, 140, 155);
      doc.text(
        `ThreatLens | Academic CTI Classification Project | Page ${page} of ${pageCount}`,
        pageWidth / 2,
        287,
        { align: "center" }
      );
    }

    doc.save(`ThreatLens_Report_${Date.now()}.pdf`);
  };


  const clearAnalysis = () => {
    setText("");
    setResult(null);
    setError("");
  };

  const exportHistoryCSV = () => {
    if (history.length === 0) {
      setError("No analysis history available to export.");
      return;
    }

    const headers = [
      "ID",
      "Date",
      "Predicted Category",
      "Model Score (%)",
      "Submitted Text",
    ];

    const escapeCSV = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = history.map((record) => [
      record.id,
      record.date,
      record.predictedClass,
      record.score,
      record.input_text || record.inputText || record.text || "",
    ]);

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `ThreatLens_Analysis_History_${Date.now()}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    setError("");
  };


  const exportCSVResults = () => {
    const records = csvResult?.results || [];

    if (records.length === 0) {
      setError("There are no CSV prediction results to export.");
      return;
    }

    const headers = [
      "Row",
      "Original Text",
      "Predicted Category",
      "Model Score (%)",
      "Status",
    ];

    // Quote CSV cells and neutralize spreadsheet formula prefixes.
    const escapeCSVCell = (value) => {
      let cell = String(value ?? "");
      if (/^[\s\u0000-\u001f]*[=+@-]/.test(cell)) {
        cell = `'${cell}`;
      }
      return `"${cell.replace(/"/g, '""')}"`;
    };

    const rows = records.map((item, index) => [
      item.row ?? index + 1,
      item.text ?? item.input_text ?? item.original_text ?? item.input ?? item.description ?? "",
      item.predicted_class ?? "Unclassified",
      item.model_score_percent ?? "",
      item.status ?? "Processed",
    ]);

    const csvContent = [
      headers.map(escapeCSVCell).join(","),
      ...rows.map((row) => row.map(escapeCSVCell).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const baseName = (csvResult.filename || "ThreatLens").replace(/\.csv$/i, "");
    link.href = url;
    link.download = `${baseName}_ThreatLens_Results.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setError("");
  };


  const analyzeCSV = async () => {
    if (!csvFile) {
      setError("Please select a CSV file first.");
      return;
    }

    setCsvLoading(true);
    setCsvResult(null);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", csvFile);

      const response = await fetch(`${API_BASE_URL}/predict-csv`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "CSV analysis failed.");
      }

      setCsvResult(data);
      const validRecords = (data.results || []).filter((item) =>
        !String(item.status || "").toLowerCase().includes("skip")
      );
      const scoreValues = validRecords
        .map((item) => Number(item.model_score_percent))
        .filter((score) => Number.isFinite(score));
      const categoryCounts = validRecords.reduce((counts, item) => {
        const category = item.predicted_class || "Unclassified";
        counts[category] = (counts[category] || 0) + 1;
        return counts;
      }, {});
      const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const batch = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        filename: data.filename || csvFile.name,
        timestamp: new Date().toISOString(),
        total: Number(data.total_records ?? (data.results || []).length),
        processed: validRecords.length,
        skipped: Number(data.skipped_records ?? 0),
        averageScore: scoreValues.length ? scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length : null,
        topCategory,
        categoryCounts,
      };
      setCsvBatchHistory((previous) => [batch, ...previous].slice(0, 100));
    } catch (err) {
      setError(err.message || "Unable to process CSV file.");
    } finally {
      setCsvLoading(false);
    }
  };



  const useSample = () => {
    setText(SAMPLE_TEXT);
    setResult(null);
    setError("");
  };

  const openHistoryItem = (item) => {
    setText(item.input_text || item.inputText || item.input || item.text || "");
    setResult(item.result || null);
    setError("");
    setActivePage("analyze");
    setMobileMenuOpen(false);
  };

  const deleteHistoryItem = (id) => {
    setHistory((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  const changePage = (page) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();

    if (!query) return history;

    return history.filter(
      (item) =>
        item.predictedClass.toLowerCase().includes(query) ||
        item.input.toLowerCase().includes(query)
    );
  }, [history, historySearch]);

  const pageTitles = {
    overview: "Dashboard Overview",
    analyze: "Threat Intelligence Analysis",
    analytics: "Threat Analytics",
    history: "Analysis History",
    performance: "Model Performance",
    about: "About ThreatLens",
  };

  // OVERVIEW PAGE
  const renderOverview = () => (
    <>
      <section className="welcome-banner">
        <div className="welcome-content">
          <span className="section-kicker">
            SECURITY INTELLIGENCE WORKSPACE
          </span>
          <h2>Welcome to ThreatLens</h2>
          <p>
            Analyze and classify cyber threat intelligence using
            Natural Language Processing and Machine Learning.
          </p>
          <button
            className="primary-button"
            onClick={() => changePage("analyze")}
          >
            Start Threat Analysis <span>→</span>
          </button>
        </div>

        <div className="banner-shield" aria-hidden="true">
          ⬡
        </div>
      </section>

      <div className="stats-grid">
        <StatCard
          icon="◈"
          label="Dataset Samples"
          value="9,938"
          description="Prepared labeled records"
          accent="blue"
        />

        <StatCard
          icon="▦"
          label="Entity Categories"
          value="22"
          description="Dataset classification labels"
          accent="cyan"
        />

        <StatCard
          icon="◎"
          label="Test Accuracy"
          value="88.33%"
          description="Previously evaluated test split"
          accent="green"
        />

        <StatCard
          icon="⌁"
          label="Session Analyses"
          value={history.length}
          description="Predictions in this session"
          accent="purple"
        />
      </div>

      <div className="overview-grid">
        <section className="panel">
          <SectionHeading
            eyebrow="MODEL CONFIGURATION"
            title="Machine Learning Engine"
            description="Configuration of the trained classification model."
          />

          <div className="detail-row">
            <span>Algorithm</span>
            <strong>Random Forest</strong>
          </div>
          <div className="detail-row">
            <span>Feature Extraction</span>
            <strong>TF-IDF</strong>
          </div>
          <div className="detail-row">
            <span>Maximum Features</span>
            <strong>10,000</strong>
          </div>
          <div className="detail-row">
            <span>Estimators</span>
            <strong>300</strong>
          </div>
          <div className="detail-row">
            <span>Classification</span>
            <strong>Multi-class</strong>
          </div>
          <div className="detail-row">
            <span>Backend Framework</span>
            <strong>FastAPI</strong>
          </div>
        </section>

        <section className="panel">
          <SectionHeading
            eyebrow="PLATFORM STATUS"
            title="System Health"
            description="Current application connectivity."
          />

          <div className="health-row">
            <span>Frontend Application</span>
            <span className="health-online">● Running</span>
          </div>

          <div className="health-row">
            <span>FastAPI Backend</span>
            <span className={apiConnected ? "health-online" : "health-offline"}>
              ● {apiConnected ? "Connected" : "Disconnected"}
            </span>
          </div>

          <div className="health-row">
            <span>ML Model</span>
            <span className={apiConnected ? "health-online" : "health-offline"}>
              ● {apiConnected ? "Loaded" : "Unavailable"}
            </span>
          </div>

          <div className="health-row">
            <span>Prediction Service</span>
            <span className={apiConnected ? "health-online" : "health-offline"}>
              ● {apiConnected ? "Available" : "Unavailable"}
            </span>
          </div>

          <button
            className="secondary-button"
            onClick={() => changePage("performance")}
          >
            Explore Model Performance →
          </button>
        </section>
      </div>

      <section className="panel recent-panel">
        <SectionHeading
          eyebrow="LATEST ACTIVITY"
          title="Recent Analyses"
          description="Your latest prediction activity in this session."
          action={
            <button
              className="text-button"
              onClick={() => changePage("history")}
            >
              View all →
            </button>
          }
        />

        {history.length === 0 ? (
          <div className="empty-state compact-empty">
            <div className="empty-icon">◷</div>
            <h3>No activity yet</h3>
            <p>Your completed threat analyses will appear here.</p>
          </div>
        ) : (
          history.slice(0, 4).map((item) => (
            <button
              className="history-item"
              key={item.id}
              onClick={() => openHistoryItem(item)}
            >
              <span className="history-symbol">◈</span>
              <span className="history-description">
                <strong>{item.predictedClass}</strong>
                <small>{item.input.slice(0, 100)}</small>
              </span>
              <span className="history-score">{item.score}%</span>
            </button>
          ))
        )}
      </section>
    </>
  );

  const isCsvError = Boolean(
    error &&
    (/\bcsv\b/i.test(error) ||
      /records are allowed/i.test(error) ||
      /valid text records/i.test(error) ||
      (csvFile && /failed to fetch|networkerror|load failed/i.test(error)))
  );

  // THREAT ANALYSIS PAGE
  const renderAnalysis = () => (
    <>
      <div className="csv-workspace">
        <section className="panel csv-analysis-panel">
          <div className="csv-upload-heading">
            <div>
              <span className="section-kicker">BULK THREAT ANALYSIS</span>
              <h3>Analyze CSV File</h3>
              <p>Upload a CSV file to classify multiple threat intelligence records.</p>
            </div>
            <span className="csv-icon" aria-hidden="true">📊</span>
          </div>

          <label className="csv-file-label" htmlFor="csv-upload">
            <span>📁 Choose CSV File</span>
            <input
              id="csv-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setCsvFile(event.target.files?.[0] || null);
                setCsvResult(null);
                setError("");
              }}
            />
          </label>

          {csvFile && (
            <div className="csv-selected-file">
              <span>📄 {csvFile.name}</span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setCsvFile(null);
                  setCsvResult(null);
                  const input = document.getElementById("csv-upload");
                  if (input) input.value = "";
                }}
              >
                Remove
              </button>
            </div>
          )}

          <button
            type="button"
            className="primary-button csv-analyze-button"
            onClick={analyzeCSV}
            disabled={!csvFile || csvLoading || !apiConnected}
          >
            {csvLoading ? "Analyzing CSV..." : "📊 Analyze CSV File"}
          </button>

          {!apiConnected && (
            <p className="csv-api-note">Connect the backend to enable CSV analysis.</p>
          )}

          {csvLoading && (
            <div className="csv-loading" role="status">
              <span className="csv-loading-dot" aria-hidden="true" />
              Classifying uploaded records...
            </div>
          )}

          {isCsvError && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
        </section>

        <section className="panel csv-summary-panel" aria-live="polite">
          <div className="csv-summary-heading">
            <div>
              <span className="section-kicker">PROCESSING OVERVIEW</span>
              <h3>{csvResult ? "CSV Analysis Summary" : "Ready for Analysis"}</h3>
            </div>
            <span className="csv-summary-indicator" aria-hidden="true">
              {csvLoading ? "…" : csvResult ? "✓" : "↗"}
            </span>
          </div>

          {csvResult && !csvLoading ? (
            <>
              <div className="csv-summary-grid">
                <div>
                  <span>Total Records</span>
                  <strong>{csvResult.total_records}</strong>
                </div>
                <div>
                  <span>Processed</span>
                  <strong>{csvResult.processed_records}</strong>
                </div>
                <div>
                  <span>Skipped</span>
                  <strong>{csvResult.skipped_records}</strong>
                </div>
              </div>
              <p className="csv-filename">
                <span>Uploaded file</span>
                <strong>{csvResult.filename}</strong>
              </p>
            </>
          ) : (
            <div className="csv-summary-empty">
              <span className="csv-summary-empty-icon">▤</span>
              <p>Your CSV processing statistics will appear here after analysis.</p>
              <small>CSV format · Required column: <strong>text</strong> · Up to 1,000 records</small>
            </div>
          )}
        </section>
      </div>

      {csvResult && !csvLoading && csvResult.results?.length > 0 && (
        <section className="panel csv-results-panel">
          <div className="csv-results-heading">
            <div>
              <span className="section-kicker">CLASSIFICATION OUTPUT</span>
              <h3>CSV Prediction Results</h3>
              <p>Individual predictions generated for each valid record.</p>
            </div>
            <div className="csv-results-actions">
              <span className="csv-results-count">{csvResult.results.length} rows</span>
              <button
                type="button"
                className="csv-export-button"
                onClick={exportCSVResults}
                aria-label="Download CSV prediction results"
              >
                <span aria-hidden="true">↓</span> Export Results
              </button>
            </div>
          </div>
          <div className="csv-table-wrapper">
            <table className="csv-results-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Predicted Category</th>
                  <th>Model Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {csvResult.results.map((item, index) => {
                  const skipped = String(item.status || "")
                    .toLowerCase()
                    .includes("skip");
                  const category = item.predicted_class || "Unclassified";
                  const categoryTone = skipped
                    ? "neutral"
                    : ["blue", "purple", "cyan", "orange", "green"][
                        [...category].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5
                      ];
                  const score = Number(item.model_score_percent);
                  const hasScore = item.model_score_percent != null && Number.isFinite(score);
                  const safeScore = hasScore ? Math.max(0, Math.min(100, score)) : 0;

                  return (
                    <tr key={item.row || index}>
                      <td><span className="csv-row-number">{item.row || index + 1}</span></td>
                      <td>
                        <span className={`csv-category-badge tone-${categoryTone}`}>
                          <span className="csv-category-dot" />
                          {category}
                        </span>
                      </td>
                      <td>
                        {hasScore ? (
                          <div className="csv-score-cell">
                            <strong>{safeScore.toFixed(1)}%</strong>
                            <span className="csv-score-track">
                              <span style={{ width: `${safeScore}%` }} />
                            </span>
                          </div>
                        ) : <span className="csv-score-unavailable">—</span>}
                      </td>
                      <td>
                        <span
                          className={`csv-status ${skipped ? "is-skipped" : "is-complete"}`}
                        >
                          <span className="csv-status-dot" />
                          {item.status || (skipped ? "Skipped" : "Processed")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

    <div className="analysis-layout">
      <section className="panel analysis-input">
        <SectionHeading
          eyebrow="INTELLIGENCE INPUT"
          title="Analyze Threat Data"
          description="Submit cyber threat intelligence text to your trained model."
          action={<span className="mini-icon">⌕</span>}
        />

        <label htmlFor="threatText">Threat intelligence text</label>

        <textarea
          id="threatText"
          value={text}
          maxLength={10000}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
          placeholder="Paste suspicious emails, malware reports, network activity, threat descriptions or other cyber intelligence..."
        />

        <div className="input-footer">
          <span>{text.length.toLocaleString()} / 10,000 characters</span>
          <button className="text-button" onClick={clearAnalysis}>
            Clear input
          </button>
        </div>

        <button
          className="primary-button analyze-button"
          onClick={analyzeThreat}
          disabled={loading || !apiConnected}
        >
          {loading ? "Analyzing intelligence..." : "⌕  Analyze Threat"}
        </button>

        {error && !isCsvError && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <div className="sample-box">
          <strong>TRY A SAMPLE</strong>
          <p>{SAMPLE_TEXT}</p>
          <button className="text-button" onClick={useSample}>
            Load sample intelligence →
          </button>
        </div>
      </section>

      <section className="panel analysis-results">
        <SectionHeading
          eyebrow="MACHINE LEARNING OUTPUT"
          title="Classification Results"
          description="Output returned by the Random Forest classifier."
          action={<span className="result-indicator">MODEL OUTPUT</span>}
        />

        {!result ? (
          <div className="empty-state">
            <div className="empty-icon">⌕</div>
            <h3>Awaiting intelligence</h3>
            <p>
              Submit threat intelligence to see the predicted CTI
              category and model scores.
            </p>
          </div>
        ) : (
          <>
            <div className="prediction-card">
              <span className="section-kicker">
                PREDICTED CTI ENTITY CLASS
              </span>

              <h2>{result.predicted_class}</h2>

              <div className="score-line">
                <span>Highest model score</span>
                <strong>{result.model_score_percent}%</strong>
              </div>

              <ProgressBar value={result.model_score_percent} />
            </div>

            <div className="info-note">
              This is a classification based on the categories in
              the training dataset. It is not a confirmed security
              verdict. Model scores are not necessarily calibrated
              probabilities.
            </div>

            {result.warning && (
              <div className="warning">
                ⚠ {result.warning}
              </div>
            )}

            <h3 className="subheading">Top predicted categories</h3>

            {(result.top_predictions || []).map((item, index) => {
              const score = Math.min(
                100,
                Math.max(0, Number(item.model_score_percent) || 0)
              );

              return (
                <div
                  className="prediction-row"
                  key={`${item.class}-${index}`}
                >
                  <div className="prediction-row-top">
                    <span className="prediction-label">
                      <span className="rank-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {item.class}
                    </span>
                    <strong>{score}%</strong>
                  </div>
                  <ProgressBar value={score} />
                </div>
              );
            })}

            <h3 className="subheading">Submitted intelligence</h3>
            <div className="input-preview">
              {result.input_text || text}
            </div>
            <div className="pdf-download-wrapper">
              <button
                className="secondary-button"
                onClick={downloadPDFReport}
                disabled={!result}
              >
                ↓ Download PDF Report
              </button>
            </div>
          </>
        )}
      </section>
    </div>
    </>
  );

  // ANALYSIS HISTORY PAGE
  const renderHistory = () => (
    <section className="panel">
      <SectionHeading
        eyebrow="SESSION RECORDS"
        title="Analysis History"
        description={`${history.length} prediction(s) recorded in this browser session.`}
        action={
          <div className="history-actions">
            <button
              className="text-button"
              disabled={history.length === 0}
              onClick={exportHistoryCSV}
            >
              ↓ Export CSV
            </button>

            <button
              className="text-button"
              disabled={history.length === 0}
              onClick={() => {
                setHistory([]);
                setHistorySearch("");
              }}
            >
              Clear history
            </button>
          </div>
        }
      />

      {history.length > 0 && (
        <input
          className="history-search"
          type="search"
          placeholder="Search by predicted category or submitted text..."
          value={historySearch}
          onChange={(event) => setHistorySearch(event.target.value)}
        />
      )}

      {filteredHistory.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◷</div>
          <h3>{history.length ? "No matching results" : "No analysis history"}</h3>
          <p>
            {history.length
              ? "Try another search term."
              : "Completed predictions will appear here during this session."}
          </p>
          {history.length === 0 && (
            <button
              className="primary-button"
              onClick={() => changePage("analyze")}
            >
              Start your first analysis →
            </button>
          )}
        </div>
      ) : (

        <div className="history-list">
          {filteredHistory.map((item) => (
            <div className="history-item" key={item.id}>
              <button
                className="history-open-button"
                onClick={() => openHistoryItem(item)}
              >
                <span className="history-symbol">◇</span>

                <span className="history-description">
                  <strong>{item.predictedClass}</strong>
                  <small>
                    {item.date} · {(item.input_text || item.inputText || item.input || item.text || "").slice(0, 120)}
                  </small>
                </span>

                <span className="history-score">{item.score}%</span>
              </button>

              <button
                className="history-delete-button"
                onClick={() => deleteHistoryItem(item.id)}
                title="Delete this record"
                aria-label="Delete this record"
              >
                🗑
              </button>
            </div>
          ))}
        </div>

      )}

      <p className="muted-text">
        Note: History is stored in React session state and will reset
        when the page is refreshed.
      </p>
    </section>
  );

  // MODEL PERFORMANCE PAGE
  const renderPerformance = () => (
    <>
      <div className="performance-intro">
        <span className="section-kicker">MODEL EVALUATION</span>
        <h2>Random Forest Performance</h2>
        <p>
          Previously evaluated results from the held-out test dataset.
        </p>
      </div>

      <div className="stats-grid">
        <StatCard
          icon="◎"
          label="Test Accuracy"
          value="88.33%"
          description="Held-out test dataset"
          accent="green"
        />
        <StatCard
          icon="◈"
          label="Macro F1 Score"
          value="0.80"
          description="Reported evaluation result"
          accent="blue"
        />
        <StatCard
          icon="▦"
          label="Weighted F1 Score"
          value="0.88"
          description="Reported evaluation result"
          accent="cyan"
        />
        <StatCard
          icon="▤"
          label="Test Samples"
          value="1,988"
          description="20% test split"
          accent="purple"
        />
      </div>

      <div className="overview-grid">
        <section className="panel">
          <SectionHeading
            eyebrow="CLASSIFIER CONFIGURATION"
            title="Random Forest"
            description="Final trained machine learning classifier."
          />

          <div className="detail-row">
            <span>Number of estimators</span>
            <strong>300</strong>
          </div>
          <div className="detail-row">
            <span>Random state</span>
            <strong>42</strong>
          </div>
          <div className="detail-row">
            <span>Class weights</span>
            <strong>Balanced</strong>
          </div>
          <div className="detail-row">
            <span>Parallel processing</span>
            <strong>Enabled</strong>
          </div>
        </section>

        <section className="panel">
          <SectionHeading
            eyebrow="TEXT PROCESSING"
            title="TF-IDF Vectorization"
            description="Text feature extraction configuration."
          />

          <div className="detail-row">
            <span>Maximum features</span>
            <strong>10,000</strong>
          </div>
          <div className="detail-row">
            <span>N-gram range</span>
            <strong>1–2</strong>
          </div>
          <div className="detail-row">
            <span>Stop words</span>
            <strong>English</strong>
          </div>
          <div className="detail-row">
            <span>Classification labels</span>
            <strong>22</strong>
          </div>
        </section>
      </div>

      <div className="info-note">
        Accuracy and F1 scores are historical evaluation results from
        the held-out test split. They are not live measurements and
        do not guarantee real-world detection performance.
      </div>
    </>
  );

  // ABOUT PAGE
  const renderAbout = () => (
    <>
      <section className="panel about-panel">
        <span className="section-kicker">PROJECT OVERVIEW</span>
        <h2>
          Cyber Threat Intelligence Classification Using NLP and
          Machine Learning
        </h2>

        <p className="muted-text">
          ThreatLens is an academic cybersecurity project that applies
          Natural Language Processing and Machine Learning to classify
          cyber threat intelligence text into dataset-defined categories.
          It combines TF-IDF feature extraction with a trained Random
          Forest classifier.
        </p>

        <h3>Technologies Used</h3>

        <div className="technology-list">
          {[
            "Python",
            "Scikit-learn",
            "TF-IDF",
            "Random Forest",
            "FastAPI",
            "React",
            "Vite",
            "JavaScript",
          ].map((item) => (
            <span className="technology-tag" key={item}>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="PROCESS PIPELINE"
          title="How ThreatLens Works"
          description="The main workflow used to classify submitted intelligence."
        />

        <div className="workflow">
          <div>
            <span>01</span>
            <h3>Text Input</h3>
            <p>Submit threat intelligence text.</p>
          </div>
          <div>
            <span>02</span>
            <h3>TF-IDF</h3>
            <p>Convert text into numerical features.</p>
          </div>
          <div>
            <span>03</span>
            <h3>Random Forest</h3>
            <p>Classify the extracted features.</p>
          </div>
          <div>
            <span>04</span>
            <h3>Prediction</h3>
            <p>Display the predicted category and scores.</p>
          </div>
        </div>
      </section>

      <div className="info-note">
        ThreatLens is an academic CTI text-classification application.
        It is not a complete SOC monitoring, malware detection, or
        incident-response platform. Predictions should be validated
        by a cybersecurity analyst.
      </div>
    </>
  );

  const renderActivePage = () => {
    switch (activePage) {
      case "analyze":
        return renderAnalysis();
      case "analytics":
        return (
          <AnalyticsPage
            history={history}
            csvResult={csvResult}
            csvBatchHistory={csvBatchHistory}
            onAnalyze={() => changePage("analyze")}
            onOpenHistory={(item) => {
              if (item) {
                openHistoryItem(item);
              } else {
                changePage("history");
              }
            }}
          />
        );
      case "history":
        return renderHistory();
      case "performance":
        return renderPerformance();
      case "about":
        return renderAbout();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="app-shell">
      {/* MOBILE MENU OVERLAY */}
      {mobileMenuOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-logo">T</div>
          <div className="brand-copy">
            <strong>THREATLENS</strong>
            <small>INTELLIGENCE PLATFORM</small>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <div className="nav-heading">WORKSPACE</div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? "active" : ""
                }`}
              onClick={() => changePage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {activePage === item.id && (
                <span className="nav-active-indicator" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span
              className={`status-dot ${apiConnected ? "" : "offline"
                }`}
            />
            <div>
              <strong>
                {apiConnected ? "System Online" : "System Offline"}
              </strong>
              <small>ML service connection</small>
            </div>
          </div>

          <div className="sidebar-version">
            <span>THREATLENS</span>
            <span>VERSION 2.0</span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              ☰
            </button>

            <div>
              <span className="breadcrumb">
                THREATLENS <span>/</span> WORKSPACE
              </span>
              <h1>{pageTitles[activePage]}</h1>
            </div>
          </div>

          <div className="topbar-right">
            <StatusBadge connected={apiConnected} />
            <div className="profile-avatar">T</div>
          </div>
        </header>

        <main className="page-content">
          {renderActivePage()}
        </main>

        <footer className="app-footer">
          <div>
            <strong>THREATLENS</strong>
            <span> · CYBER THREAT INTELLIGENCE CLASSIFICATION</span>
          </div>
          <span>POWERED BY NLP & MACHINE LEARNING</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
