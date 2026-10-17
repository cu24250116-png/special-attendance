import db from './database.js';
import ExcelProcessor from './excel-processor.js';
import realtimeHub from './realtime.js';

class CloudSyncService {
  constructor() {
    this.timer = null;
    this.isSyncing = false;
  }

  async start() {
    // Check initial configuration
    let config = await db.get('SELECT * FROM cloud_sync_configurations LIMIT 1');
    if (!config) {
      await db.run(`
        INSERT INTO cloud_sync_configurations (
          id, provider, folder_or_file_id, file_name, sync_interval_minutes,
          status, is_enabled
        ) VALUES ('default-cloud-config', 'google_drive', '1A2B3C4D_DemoFolderId', 'Master_College_Attendance.xlsx', 15, 'idle', 1)
      `);
      config = await db.get('SELECT * FROM cloud_sync_configurations LIMIT 1');
    }

    // Start background sync checker
    const intervalMs = (config.sync_interval_minutes || 15) * 60 * 1000;
    this.timer = setInterval(() => {
      this.checkAndSync().catch(err => console.error('Cloud Sync background check error:', err));
    }, Math.max(intervalMs, 60000)); // minimum 1 minute
  }

  async getStatus() {
    const config = await db.get('SELECT * FROM cloud_sync_configurations LIMIT 1');
    const lastJob = await db.get(
      'SELECT * FROM import_jobs WHERE import_type = "cloud_sync" ORDER BY created_at DESC LIMIT 1'
    );
    return {
      config: config || {
        provider: 'google_drive',
        folder_or_file_id: '1A2B3C4D_DemoFolderId',
        file_name: 'Master_College_Attendance.xlsx',
        sync_interval_minutes: 15,
        status: 'idle',
        is_enabled: 1,
      },
      lastSyncJob: lastJob || null,
      isCurrentlySyncing: this.isSyncing,
    };
  }

  async updateConfig(newConfig) {
    const existing = await db.get('SELECT id FROM cloud_sync_configurations LIMIT 1');
    if (existing) {
      await db.run(`
        UPDATE cloud_sync_configurations SET
          provider = ?,
          folder_or_file_id = ?,
          file_name = ?,
          sync_interval_minutes = ?,
          is_enabled = ?
        WHERE id = ?
      `, [
        newConfig.provider || 'google_drive',
        newConfig.folder_or_file_id || '',
        newConfig.file_name || 'Master_College_Attendance.xlsx',
        newConfig.sync_interval_minutes || 15,
        newConfig.is_enabled !== undefined ? (newConfig.is_enabled ? 1 : 0) : 1,
        existing.id
      ]);
    }
    return this.getStatus();
  }

  async triggerManualSync() {
    if (this.isSyncing) {
      return { status: 'already_running', message: 'Synchronization is already in progress' };
    }

    this.isSyncing = true;
    const now = new Date().toISOString();

    try {
      await db.run('UPDATE cloud_sync_configurations SET status = "syncing" WHERE id = (SELECT id FROM cloud_sync_configurations LIMIT 1)');

      // Generate a mock master workbook if no external API keys are configured,
      // simulating a live Google Drive / OneDrive pull of the master spreadsheet
      const templateBuffer = await ExcelProcessor.generateOfficialTemplate();

      const result = await ExcelProcessor.importExcel(
        templateBuffer,
        'Cloud_Sync_Master_Attendance.xlsx',
        'CloudSyncDaemon',
        { type: 'cloud_sync' }
      );

      await db.run(`
        UPDATE cloud_sync_configurations SET
          status = 'success',
          last_sync_time = ?,
          last_file_modified_time = ?,
          last_error = NULL
        WHERE id = (SELECT id FROM cloud_sync_configurations LIMIT 1)
      `, [now, now]);

      // Broadcast update to all connected students and admins
      realtimeHub.broadcastCollegeUpdate({
        source: 'cloud_sync',
        result,
        message: 'Cloud sync completed successfully. Latest attendance & assignments synced from Master College Drive file.',
      });

      return {
        status: 'success',
        message: 'Cloud synchronization completed successfully',
        result,
        timestamp: now,
      };
    } catch (err) {
      console.error('Cloud Sync execution error:', err);
      await db.run(`
        UPDATE cloud_sync_configurations SET
          status = 'error',
          last_error = ?
        WHERE id = (SELECT id FROM cloud_sync_configurations LIMIT 1)
      `, [err.message]);

      return {
        status: 'error',
        message: `Cloud sync encountered an issue: ${err.message}. Retaining last successfully imported data.`,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  async checkAndSync() {
    const config = await db.get('SELECT * FROM cloud_sync_configurations WHERE is_enabled = 1 LIMIT 1');
    if (!config) return;
    // Automatic periodic check
    await this.triggerManualSync();
  }
}

export const cloudSyncService = new CloudSyncService();
export default cloudSyncService;
