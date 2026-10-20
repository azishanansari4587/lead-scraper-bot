/**
 * Scheduler Engine for Knotiq Rugs Lead Scraper
 * Uses node-cron to execute scheduled scraper runs with concurrency locks,
 * database synchronization, and automated notification alerts.
 */

const cron = require('node-cron');
const Schedule = require('../../models/Schedule');
const scraperManager = require('../../scrapers/ScraperManager');
const notifier = require('../notifications/notifier');
const logger = require('../../config/logger');

class SchedulerEngine {
  constructor() {
    this.cronTasks = new Map(); // scheduleId -> cronTask
    this.activeRunLocks = new Set(); // Set of currently executing schedule IDs
    this.isStarted = false;
  }

  /**
   * Initializes and starts the scheduler engine
   */
  async start() {
    if (this.isStarted) return;
    this.isStarted = true;
    logger.info('Starting Background Scheduler Engine...');
    await this.reloadSchedules();
  }

  /**
   * Stops all active cron tasks
   */
  stop() {
    logger.info('Stopping Background Scheduler Engine...');
    for (const [id, task] of this.cronTasks.entries()) {
      task.stop();
      if (typeof task.destroy === 'function') task.destroy();
    }
    this.cronTasks.clear();
    this.activeRunLocks.clear();
    this.isStarted = false;
  }

  /**
   * Reloads and re-synchronizes cron jobs from the database
   */
  async reloadSchedules() {
    try {
      // Clear existing tasks
      for (const [id, task] of this.cronTasks.entries()) {
        task.stop();
        if (typeof task.destroy === 'function') task.destroy();
      }
      this.cronTasks.clear();

      // Query all enabled schedules
      const schedules = await Schedule.findAll({ where: { enabled: true } });
      logger.info({ count: schedules.length }, 'Syncing active recurring scraper schedules');

      for (const schedule of schedules) {
        this.registerCronJob(schedule);
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to reload schedules from database');
    }
  }

  /**
   * Registers a single cron job for a Schedule instance
   * @param {Schedule} schedule
   */
  registerCronJob(schedule) {
    if (!cron.validate(schedule.cronExpression)) {
      logger.warn({ id: schedule.id, cron: schedule.cronExpression }, 'Invalid cron pattern. Skipping schedule registration.');
      return;
    }

    const task = cron.schedule(schedule.cronExpression, async () => {
      await this.executeSchedule(schedule);
    });

    this.cronTasks.set(schedule.id, task);
    logger.debug({ id: schedule.id, name: schedule.name, cron: schedule.cronExpression }, 'Registered cron schedule task');
  }

  /**
   * Executes a scheduled scraper run with run locks and notification alerts
   * @param {Schedule} schedule
   */
  async executeSchedule(schedule) {
    // 1. Run Lock Check
    if (this.activeRunLocks.has(schedule.id)) {
      logger.warn({ id: schedule.id, name: schedule.name }, 'Schedule run lock active. Skipping overlapping run.');
      return;
    }

    this.activeRunLocks.add(schedule.id);
    logger.info({ id: schedule.id, name: schedule.name }, 'Executing scheduled scraper run...');

    try {
      const leadTypes = Array.isArray(schedule.leadTypes) ? schedule.leadTypes : ['rug_retailer'];
      const leadType = leadTypes[0] || 'rug_retailer';

      const result = await scraperManager.runScraper({
        userId: schedule.userId,
        platform: 'overpass',
        country: schedule.country,
        state: schedule.state,
        city: schedule.city,
        leadType,
        enrichWebsites: true
      });

      // Update schedule record
      await schedule.update({
        lastRunAt: new Date(),
        lastStatus: result.status || 'completed'
      });

      // Dispatch Telegram / Email notification
      await notifier.notifyScraperRunCompleted({
        city: schedule.city,
        country: schedule.country,
        leadType,
        platform: 'overpass',
        foundCount: result.foundCount,
        newCount: result.newCount,
        duplicateCount: result.duplicateCount,
        durationMs: result.durationMs
      });

      logger.info({ id: schedule.id, newCount: result.newCount }, 'Scheduled run finished and notifications sent');
      return result;
    } catch (err) {
      logger.error({ id: schedule.id, err: err.message }, 'Scheduled run encountered an error');
      await schedule.update({
        lastRunAt: new Date(),
        lastStatus: 'failed'
      }).catch(() => {});
      throw err;
    } finally {
      this.activeRunLocks.delete(schedule.id);
    }
  }

  /**
   * Manually triggers a schedule immediately
   * @param {number} scheduleId
   */
  async triggerScheduleNow(scheduleId) {
    const schedule = await Schedule.findByPk(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }
    return this.executeSchedule(schedule);
  }
}

module.exports = new SchedulerEngine();
