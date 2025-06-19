import axios, { AxiosInstance } from 'axios';

export interface MisskeyConfig {
  host: string;
  token: string;
  timeout?: number;
}

export interface MisskeyNote {
  text: string;
  visibility?: 'public' | 'home' | 'followers' | 'specified';
  localOnly?: boolean;
  cw?: string; // Content Warning
  viaMobile?: boolean;
  poll?: {
    choices: string[];
    multiple?: boolean;
    expiresAt?: number;
  };
  fileIds?: string[];
  replyId?: string;
  renoteId?: string;
  channelId?: string;
}

export interface MisskeyNoteResponse {
  id: string;
  createdAt: string;
  userId: string;
  user: {
    id: string;
    name: string;
    username: string;
    host: string | null;
  };
  text: string;
  cw: string | null;
  visibility: string;
  localOnly: boolean;
  renoteCount: number;
  repliesCount: number;
  reactions: Record<string, number>;
  uri: string;
  url: string;
}

export class MisskeyClient {
  private api: AxiosInstance;
  private config: MisskeyConfig;

  constructor(config: MisskeyConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: `https://${config.host}/api`,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a new note (post)
   */
  async createNote(note: MisskeyNote): Promise<MisskeyNoteResponse> {
    try {
      const response = await this.api.post('/notes/create', {
        ...note,
        i: this.config.token,
      });

      return response.data.createdNote;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Misskey API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<any> {
    try {
      const response = await this.api.post('/meta', {
        i: this.config.token,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Misskey API error: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw error;
    }
  }

  /**
   * Test connection and authentication
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.api.post('/i', {
        i: this.config.token,
      });

      return response.status === 200 && response.data.id;
    } catch (error) {
      console.error('Misskey connection test failed:', error);
      return false;
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(): Promise<any> {
    try {
      const response = await this.api.post('/i', {
        i: this.config.token,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Misskey API error: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw error;
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<void> {
    try {
      await this.api.post('/notes/delete', {
        i: this.config.token,
        noteId: noteId,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Misskey API error: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw error;
    }
  }

  /**
   * Create a note with retry logic
   */
  async createNoteWithRetry(note: MisskeyNote, maxRetries: number = 3): Promise<MisskeyNoteResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.createNote(note);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Note creation attempt ${attempt}/${maxRetries} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to create note after retries');
  }

  /**
   * Create note with rate limiting awareness
   */
  async createNoteRateLimited(note: MisskeyNote): Promise<MisskeyNoteResponse> {
    // Simple rate limiting - wait a bit between posts
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.createNote(note);
  }

  /**
   * Batch create multiple notes with delays
   */
  async createNoteBatch(notes: MisskeyNote[], delayMs: number = 2000): Promise<MisskeyNoteResponse[]> {
    const results: MisskeyNoteResponse[] = [];

    for (let i = 0; i < notes.length; i++) {
      try {
        const result = await this.createNote(notes[i]);
        results.push(result);
        
        // Add delay between posts (except for the last one)
        if (i < notes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(`Failed to create note ${i + 1}/${notes.length}:`, error);
        throw error;
      }
    }

    return results;
  }
}