/**
 * The catalogue of tracked actions, in a module both client and server can
 * import - `analytics.ts` itself is server-only because it talks to Mongo.
 */
export const ACTIONS = {
  pageView: 'page_view',
  clickDownloadLabels: 'click_download_labels',
  clickDownloadCalibration: 'click_download_calibration',
  labelsGenerated: 'labels_generated',
  fileDownloaded: 'file_downloaded',
  calibrationDownloaded: 'calibration_downloaded',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];
