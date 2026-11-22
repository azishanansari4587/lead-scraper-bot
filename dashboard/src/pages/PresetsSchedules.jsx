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
import {
  Button,
  Field,
  Select,
  Card,
  Modal,
  Badge,
  EmptyState,
  ConfirmDialog,
  useToast
} from '../components/ui';

export default function PresetsSchedules({ onRunPreset }) {
  const toast = useToast();

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
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  // Confirm delete dialogs
  const [deletePresetId, setDeletePresetId] = useState(null);
  const [deleteScheduleId, setDeleteScheduleId] = useState(null);

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
      toast.error('Failed to load presets or schedules');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePreset() {
    if (!deletePresetId) return;
    try {
      await api.deletePreset(deletePresetId);
      setPresets((prev) => prev.filter((p) => p.id !== deletePresetId));
      toast.success('Search preset deleted successfully.');
    } catch (err) {
      toast.error(`Failed to delete preset: ${err.message}`);
    } finally {
      setDeletePresetId(null);
    }
  }

  async function handleToggleSchedule(id) {
    try {
      const res = await api.toggleSchedule(id);
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: res.enabled } : s))
      );
      toast.success(`Schedule is now ${res.enabled ? 'Active' : 'Paused'}.`);
    } catch (err) {
      toast.error(`Failed to toggle schedule: ${err.message}`);
    }
  }

  async function handleDeleteSchedule() {
    if (!deleteScheduleId) return;
    try {
      await api.deleteSchedule(deleteScheduleId);
      setSchedules((prev) => prev.filter((s) => s.id !== deleteScheduleId));
      toast.success('Schedule deleted.');
    } catch (err) {
      toast.error(`Failed to delete schedule: ${err.message}`);
    } finally {
      setDeleteScheduleId(null);
    }
  }

  async function handleCreateSchedule(e) {
    e.preventDefault();
    if (!scheduleName.trim()) {
      toast.warning('Please enter a schedule name.');
      return;
    }

    setCreatingSchedule(true);
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
      toast.success('Automated schedule created successfully.');
    } catch (err) {
      toast.error(`Failed to create schedule: ${err.message}`);
    } finally {
      setCreatingSchedule(false);
    }
  }

  return (
    <div className="page-content">
      {/* Saved Search Presets */}
      <Card
        title="Saved Search Filter Presets"
        icon={BookmarkCheck}
        subtitle="Reusable search criteria for instant 1-click execution or recurring campaigns."
      >
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
                  <td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      title="No search presets saved yet"
                      description="Save frequent queries from the Search & Scrape tab for 1-click re-use."
                    />
                  </td>
                </tr>
              ) : (
                presets.map((preset) => (
                  <tr key={preset.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{preset.name}</td>
                    <td>{preset.city || 'All Cities'}, {preset.country}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {preset.leadTypes?.join(', ')?.replace(/_/g, ' ') || 'Any'}
                    </td>
                    <td className="tabular-nums">{preset.minScore > 0 ? `≥ ${preset.minScore}` : 'None'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Play}
                          onClick={onRunPreset}
                          aria-label={`Run preset ${preset.name}`}
                        >
                          Run
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => setDeletePresetId(preset.id)}
                          aria-label={`Delete preset ${preset.name}`}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recurring Schedules */}
      <Card
        title="Automated Scraper Schedules"
        icon={Calendar}
        subtitle="Cron-based background scraping jobs that discover and enrich new buyers automatically."
        action={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setShowScheduleModal(true)}
          >
            New Schedule
          </Button>
        }
      >
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Schedule Name</th>
                <th>Frequency (Cron)</th>
                <th>Target Scope</th>
                <th>Status</th>
                <th>Last Run</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <EmptyState
                      title="No automated schedules active"
                      description="Create a recurring job to scrape new leads weekly or monthly."
                    />
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{schedule.name}</td>
                    <td>
                      <code>{schedule.cronExpression}</code>
                    </td>
                    <td>{schedule.city}, {schedule.country}</td>
                    <td>
                      <Badge variant={schedule.enabled ? 'success' : 'danger'}>
                        {schedule.enabled ? 'Active' : 'Paused'}
                      </Badge>
                    </td>
                    <td className="tabular-nums" style={{ color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>
                      {schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <Button
                          variant={schedule.enabled ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => handleToggleSchedule(schedule.id)}
                        >
                          {schedule.enabled ? 'Pause' : 'Activate'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => setDeleteScheduleId(schedule.id)}
                          aria-label={`Delete schedule ${schedule.name}`}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Create Automated Scraping Schedule"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={creatingSchedule}
              onClick={handleCreateSchedule}
            >
              Save Schedule
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Schedule Name" required id="schedule-name">
            <input
              id="schedule-name"
              className="input"
              placeholder="e.g. Weekly Dubai Retailers Scrape"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              required
            />
          </Field>

          <Field
            label="Cron Frequency Expression"
            hint="Format: minute hour day-of-month month day-of-week (e.g. '0 9 * * 1' = Every Monday 9am)"
            required
            id="schedule-cron"
          >
            <input
              id="schedule-cron"
              className="input"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              required
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Target Country" id="schedule-country">
              <input
                id="schedule-country"
                className="input"
                value={scheduleCountry}
                onChange={(e) => setScheduleCountry(e.target.value)}
              />
            </Field>

            <Field label="Target City" id="schedule-city">
              <input
                id="schedule-city"
                className="input"
                value={scheduleCity}
                onChange={(e) => setScheduleCity(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Target Buyer Category" id="schedule-category">
            <Select
              id="schedule-category"
              value={scheduleLeadType}
              onChange={(e) => setScheduleLeadType(e.target.value)}
            >
              <option value="rug_retailer">Rug Retailers</option>
              <option value="rug_wholesaler">Rug Wholesalers</option>
              <option value="interior_designer">Interior Designers</option>
              <option value="interior_contractor">Fit-out Contractors</option>
              <option value="architect">Architects</option>
            </Select>
          </Field>
        </form>
      </Modal>

      {/* Confirm Delete Preset Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletePresetId)}
        onClose={() => setDeletePresetId(null)}
        onConfirm={handleDeletePreset}
        title="Delete Search Preset"
        message="Are you sure you want to delete this search preset?"
        confirmText="Delete Preset"
      />

      {/* Confirm Delete Schedule Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteScheduleId)}
        onClose={() => setDeleteScheduleId(null)}
        onConfirm={handleDeleteSchedule}
        title="Delete Automated Schedule"
        message="Are you sure you want to delete this automated schedule? Recurring scraping jobs will stop immediately."
        confirmText="Delete Schedule"
      />
    </div>
  );
}
