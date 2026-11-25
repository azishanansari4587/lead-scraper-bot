import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  TrendingUp,
  AlertCircle,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Moon,
  Zap,
  Check,
  X,
  RotateCcw
} from 'lucide-react';
import { api } from '../api';
import { Button, Card, Badge, useToast } from '../components/ui';

export default function RoutineReview() {
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState([]);

  const loadWeeklyReport = async (includeAi = false) => {
    try {
      if (includeAi) setGeneratingAi(true);
      else setLoading(true);

      const res = await api.getWeeklyRoutineAnalytics(includeAi);
      setReport(res.report || null);
      if (res.aiSummary?.available) {
        setAiSummary(res.aiSummary);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load weekly routine report');
    } finally {
      setLoading(false);
      setGeneratingAi(false);
    }
  };

  useEffect(() => {
    loadWeeklyReport(false);
  }, []);

  const handleAcceptSuggestion = async (suggestion) => {
    try {
      await api.acceptRoutineSuggestion({
        suggestionId: suggestion.id,
        targetTemplateId: suggestion.targetTemplateId,
        modifications: suggestion.modifications
      });
      toast.success('Suggestion accepted! Template updated.');
      setDismissedSuggestions((prev) => [...prev, suggestion.id]);
    } catch (err) {
      toast.error(err.message || 'Failed to apply suggestion');
    }
  };

  const handleDismissSuggestion = (id) => {
    setDismissedSuggestions((prev) => [...prev, id]);
    toast.info('Suggestion dismissed');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button variant="ghost" onClick={() => navigate('/routine')} style={{ padding: '8px' }}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Award size={28} color="var(--gold-primary)" /> Weekly Routine Review & Analytics
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              Trace analytics, completion scores, miss patterns and suggestions for Knotiq Rugs founder routine.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="outline"
            onClick={() => loadWeeklyReport(true)}
            disabled={generatingAi}
          >
            <Sparkles size={16} color="var(--gold-primary)" />
            {generatingAi ? 'Analyzing with Gemini...' : 'Generate AI Weekly Summary'}
          </Button>
          <Button variant="ghost" onClick={() => loadWeeklyReport(false)}>
            <RotateCcw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {loading && (
        <Card style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Clock size={32} style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 12px', color: 'var(--gold-primary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Compiling weekly routine analytics...</p>
        </Card>
      )}

      {!loading && report && (
        <>
          {/* Low Sample Size Notice if < 5 days tracked */}
          {report.isLowSampleSize && (
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <AlertCircle size={20} color="#3B82F6" />
              <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                <strong>&lt; 5 Days Tracked (Low Sample Size):</strong> Analytics and completion patterns will become more statistically reliable as you log more routine days this week.
              </div>
            </div>
          )}

          {/* Top Score Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* Average Adherence Score */}
            <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gold-primary)',
                  fontWeight: 800,
                  fontSize: '22px'
                }}
              >
                {report.averageDailyScore || 0}
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Weekly Routine Score
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {report.averageDailyScore || 0}/100 Average
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {report.totalDaysTracked || 0} active days tracked
                </div>
              </div>
            </Card>

            {/* Must-Do Completion Rate */}
            <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--emerald-accent)',
                  fontWeight: 800,
                  fontSize: '20px'
                }}
              >
                {report.mustDoCompletionRate || 0}%
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Must-Do MIT Rate
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {report.completedMustDos || 0} / {report.totalMustDos || 0} Done
                </div>
                <div style={{ fontSize: '11px', color: 'var(--emerald-accent)', marginTop: '2px' }}>
                  Escalation safeguarded
                </div>
              </div>
            </Card>

            {/* Sleep & Rest Adherence */}
            <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6366F1'
                }}
              >
                <Moon size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Rest & Sleep Adherence
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {report.sleepAdherenceRate || 0}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Protected blocks tracked separately
                </div>
              </div>
            </Card>

            {/* On-Time Starts */}
            <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3B82F6'
                }}
              >
                <Clock size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  On-Time Start Precision
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {report.onTimeStartRate || 0}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  &plusmn;10m tolerance window
                </div>
              </div>
            </Card>
          </div>

          {/* Explainable Formula Card */}
          <Card
            style={{
              padding: '16px 20px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-color)',
              fontSize: '13px'
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--gold-primary)', marginBottom: '4px' }}>
              How the Daily Routine Score (0-100) is Computed:
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              When Must-Do blocks exist: <strong>50% Must-Do completion + 30% Overall block completion + 20% On-Time Starts</strong> (&plusmn;10m tolerance; partial check-ins receive 0.5 credit).
              If no Must-Do blocks are scheduled: <strong>60% Overall completion + 40% On-Time Starts</strong>.
              Weekly rest days and protected sleep/rest blocks are excluded from performance scores to preserve health guardrails.
            </p>
          </Card>

          {/* AI Narrative Analysis if available */}
          {aiSummary?.narrative && (
            <Card
              style={{
                border: '1px solid rgba(245, 158, 11, 0.4)',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(5, 7, 15, 0.8) 100%)',
                padding: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={20} color="var(--gold-primary)" />
                <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--gold-primary)' }}>
                  Gemini Founder Routine Insights
                </span>
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-line'
                }}
              >
                {aiSummary.narrative}
              </div>
            </Card>
          )}

          {/* Two-Column Analytics Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            {/* Category Adherence Breakdown */}
            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                Adherence by Routine Category
              </div>

              {(!report.categoryAdherence || Object.keys(report.categoryAdherence).length === 0) ? (
                <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>No category data yet.</div>
              ) : (
                Object.entries(report.categoryAdherence).map(([cat, stat]) => {
                  const pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
                  return (
                    <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {cat.replace('_', ' ')}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {stat.completed}/{stat.total} ({pct}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'var(--surface-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: pct >= 80 ? 'var(--emerald-accent)' : pct >= 50 ? 'var(--gold-primary)' : 'var(--danger)',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </Card>

            {/* Time-of-Day Miss Clusters & Weekdays */}
            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                Miss Patterns & Weekday Rhythm
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Morning Misses</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {report.timeOfDayMisses?.morning || 0}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>06:00 - 12:00</div>
                </div>

                <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Afternoon Misses</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {report.timeOfDayMisses?.afternoon || 0}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>12:00 - 17:00</div>
                </div>

                <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Evening Misses</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {report.timeOfDayMisses?.evening || 0}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>17:00 - 23:00</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>
                  Best Performing Day: <strong style={{ color: 'var(--emerald-accent)' }}>{report.bestWeekday || 'N/A'}</strong>
                </div>
                <div>
                  Most Challenging Day: <strong style={{ color: 'var(--danger)' }}>{report.worstWeekday || 'N/A'}</strong>
                </div>
                {report.mostCarriedTasks?.length > 0 && (
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Most Carried Tasks:</span>
                    <ul style={{ paddingLeft: '18px', marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {report.mostCarriedTasks.map((t, idx) => (
                        <li key={idx}>
                          <strong>{t.title}</strong> (carried {t.carryCount} times)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Rule-Based Routine Suggestions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
              Actionable Routine Suggestions
            </div>

            {(!report.suggestions || report.suggestions.filter((s) => !dismissedSuggestions.includes(s.id)).length === 0) ? (
              <Card style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                No active suggestions for this period. Your routine adherence is aligned!
              </Card>
            ) : (
              report.suggestions
                .filter((s) => !dismissedSuggestions.includes(s.id))
                .map((s) => (
                  <Card
                    key={s.id}
                    style={{
                      borderLeft: '4px solid var(--gold-primary)',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {s.description}
                      </div>
                      {s.rationale && (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', fontStyle: 'italic' }}>
                          Evidence: {s.rationale}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button
                        variant="primary"
                        onClick={() => handleAcceptSuggestion(s)}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        <Check size={14} /> Accept & Apply
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleDismissSuggestion(s.id)}
                        style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--text-tertiary)' }}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </Card>
                ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
