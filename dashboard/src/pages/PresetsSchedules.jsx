import React, { useState, useEffect } from 'react';
import {
  BookmarkCheck,
  Calendar,
  Play,
  Trash2,
  Plus,
  Clock,
  CheckCircle2,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { api } from '../api';

export default function PresetsSchedules({ onRunPreset }) {
  const [presets, setPresets] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Schedule modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 9 * * 1'); // Monday 9am
  const [scheduleCountry, setScheduleCountry] = useState('UAE');
  const [scheduleCity, setScheduleCity] = useState('Dubai');
  const [scheduleLeadType, setScheduleLeadType] = useState('rug_retailer');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [presetsRes, schedulesRes] = await Promise.all([
        api.getPresets().catch(() => ({ presets: [] })),
        api.getSchedules().catch(() => ({ schedules: [] }))
      ]);
      setPresets(presetsRes.presets || []);
      setSchedules(schedulesRes.schedules || []);
    } catch (err) {
      console.error('Failed to load presets/schedules', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePreset(id) {
    if (!window.confirm('Delete this search preset?')) return;
    try {
      await api.deletePreset(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(`Failed to delete preset: ${err.message}`);
    }
  }

  async function handleToggleSchedule(id) {
    try {
      const res = await api.toggleSchedule(id);
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: res.enabled } : s))
      );
    } catch (err) {
      alert(`Failed to toggle schedule: ${err.message}`);
    }
  }

  async function handleDeleteSchedule(id) {
    if (!window.confirm('Delete this schedule?')) return;
    try {
      await api.deleteSchedule(id);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(`Failed to delete schedule: ${err.message}`);
    }
  }

  async function handleCreateSchedule(e) {
    e.preventDefault();
    try {
      const res = await api.createSchedule({
        name: scheduleName.trim(),
        cronExpression: cronExpression.trim(),
        country: scheduleCountry,
        city: scheduleCity,
        leadTypes: [scheduleLeadType]
      });
      setSchedules((prev) => [res.schedule, ...prev]);
      setShowScheduleModal(false);
      setScheduleName('');
      alert('Schedule created successfully!');
    } catch (err) {
      alert(`Failed to create schedule: ${err.message}`);
    }
  }

  return (
    <div className="page-content">
      {/* Saved Search Presets */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <BookmarkCheck size={18} color="var(--gold-primary)" /> Saved Search Filter Presets
          </h2>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Preset Name</th>
                <th>Target Market</th>
                <th>Category</th>
                <th>Min Score</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {presets.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    No search presets saved yet. Save frequent queries from the Search & Scrape tab.
                  </td>
                </tr>
              ) : (
                presets.map((preset) => (
                  <tr key={preset.id}>
                    <td style={{ fontWeight: 600, color: '#FFF' }}>{preset.name}</td>
                    <td>{preset.city || 'All Cities'}, {preset.country}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {preset.leadTypes?.join(', ')?.replace(/_/g, ' ') || 'Any'}
                    </td>
                    <td>{preset.minScore > 0 ? `≥ ${preset.minScore}` : 'None'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recurring Schedules */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Calendar size={18} color="var(--gold-primary)" /> Automated Scraper Schedules
          </h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowScheduleModal(true)}>
            <Plus size={14} /> New Schedule
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Schedule Name</th>
                <th>Frequency (Cron)</th>
                <th>Target Market</th>
                <th>Category</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    No automated recurring schedules active. Create one to run periodic scrapes.
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td style={{ fontWeight: 600, color: '#FFF' }}>{schedule.name}</td>
                    <td>
                      <code style={{ background: 'var(--bg-app)', padding: '3px 6px', borderRadius: '4px', fontSize: '12px' }}>
                        {schedule.cronExpression}
                      </code>
                    </td>
                    <td>{schedule.city}, {schedule.country}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {schedule.leadTypes?.join(', ')?.replace(/_/g, ' ')}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleSchedule(schedule.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {schedule.enabled ? (
                          <span className="badge badge-score-high">Active</span>
                        ) : (
                          <span className="badge badge-score-low">Paused</span>
                        )}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Schedule Modal */}
      {showScheduleModal && (
        <div className="drawer-backdrop" onClick={() => setShowScheduleModal(false)}>
          <div className="card" style={{ width: '480px', margin: 'auto', background: 'var(--bg-sidebar)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '16px', color: '#FFF', marginBottom: '16px' }}>Configure Recurring Scraper Schedule</h3>
            <form onSubmit={handleCreateSchedule}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Schedule Name</label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Weekly Dubai Retailer Scrape"
                    value={scheduleName}
                    onChange={(e) => setScheduleName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Cron Pattern (UTC)</label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="0 9 * * 1 (Weekly on Monday 9am)"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Country</label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%' }}
                      value={scheduleCountry}
                      onChange={(e) => setScheduleCountry(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>City</label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%' }}
                      value={scheduleCity}
                      onChange={(e) => setScheduleCity(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Lead Category</label>
                  <select
                    className="select"
                    style={{ width: '100%' }}
                    value={scheduleLeadType}
                    onChange={(e) => setScheduleLeadType(e.target.value)}
                  >
                    <option value="rug_retailer">Rug / Carpet Retailer</option>
                    <option value="interior_designer">Interior Designer</option>
                    <option value="architect">Architect Firm</option>
                    <option value="hospitality">Hospitality Buyer</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
