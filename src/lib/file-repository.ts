import { pool } from './postgres';

export interface FileRecord {
  id: string;
  filename: string;
  content_type: string;
  metadata: Record<string, unknown>;
  data: Buffer;
}

export const fileRepository = {
  async saveFile(file: Omit<FileRecord, 'id'>): Promise<string> {
    const insertResult = await pool.query(
      'INSERT INTO files (filename, content_type, metadata, data) VALUES ($1, $2, $3, $4) RETURNING id',
      [file.filename, file.content_type, file.metadata, file.data]
    );

    return insertResult.rows[0].id;
  },

  async getFileById(id: string): Promise<FileRecord | null> {
    const result = await pool.query(
      'SELECT id, filename, content_type, metadata, data FROM files WHERE id = $1',
      [id]
    );

    return result.rows[0] as FileRecord || null;
  }
};
