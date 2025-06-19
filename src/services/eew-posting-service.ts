import { EEWMessage, EEWData } from '../types/eew';
import { EEWParser } from '../parser/eew-parser';
import { EEWFormatter } from '../formatter/eew-formatter';
import { MisskeyClient, MisskeyConfig, MisskeyNote } from '../misskey/misskey-client';

export interface PostingConfig {
  misskey: MisskeyConfig;
  posting: {
    enabled: boolean;
    minSeverity: number; // Minimum severity level to post
    onlyWarnings: boolean; // Only post warnings, not forecasts
    includeCancellations: boolean; // Include cancellation messages
    visibility: 'public' | 'home' | 'followers' | 'specified';
    localOnly: boolean;
    useContentWarning: boolean;
    contentWarningText: string;
    customTemplate?: string; // Custom template for posts
    rateLimitMs: number; // Minimum delay between posts
  };
  filters: {
    minMagnitude?: number; // Minimum magnitude to post
    maxDepth?: number; // Maximum depth to post (shallow earthquakes only)
    allowedRegions?: string[]; // Only post for these regions (codes)
    blockedRegions?: string[]; // Never post for these regions (codes)
  };
}

export interface PostingState {
  lastPostTime: number;
  lastPostedEEW: EEWData | null;
  postCount: number;
  rateLimitQueue: EEWMessage[];
}

export class EEWPostingService {
  private client: MisskeyClient;
  private config: PostingConfig;
  private state: PostingState;

  constructor(config: PostingConfig) {
    this.config = config;
    this.client = new MisskeyClient(config.misskey);
    this.state = {
      lastPostTime: 0,
      lastPostedEEW: null,
      postCount: 0,
      rateLimitQueue: []
    };
  }

  /**
   * Process and potentially post an EEW message
   */
  async processEEW(message: EEWMessage): Promise<boolean> {
    if (!this.config.posting.enabled) {
      console.log('Posting disabled, skipping EEW');
      return false;
    }

    // Check if we should post this EEW
    if (!this.shouldPost(message)) {
      console.log('EEW filtered out, not posting');
      return false;
    }

    // Check rate limiting
    const now = Date.now();
    const timeSinceLastPost = now - this.state.lastPostTime;
    
    if (timeSinceLastPost < this.config.posting.rateLimitMs) {
      console.log('Rate limited, queueing EEW');
      this.state.rateLimitQueue.push(message);
      return false;
    }

    return this.postEEW(message);
  }

  /**
   * Post an EEW message to Misskey
   */
  async postEEW(message: EEWMessage): Promise<boolean> {
    try {
      const note = this.createNoteFromEEW(message);
      const result = await this.client.createNoteWithRetry(note);
      
      this.state.lastPostTime = Date.now();
      this.state.lastPostedEEW = message.data;
      this.state.postCount++;

      console.log(`Posted EEW to Misskey: ${result.id}`);
      console.log(`Post count: ${this.state.postCount}`);

      // Process any queued messages
      await this.processQueue();

      return true;
    } catch (error) {
      console.error('Failed to post EEW to Misskey:', error);
      return false;
    }
  }

  /**
   * Create a Misskey note from EEW data
   */
  private createNoteFromEEW(message: EEWMessage): MisskeyNote {
    const text = this.config.posting.customTemplate
      ? EEWFormatter.formatCustom(message, this.config.posting.customTemplate)
      : EEWFormatter.formatForMisskey(message);

    const note: MisskeyNote = {
      text: text,
      visibility: this.config.posting.visibility,
      localOnly: this.config.posting.localOnly,
    };

    // Add content warning if enabled
    if (this.config.posting.useContentWarning) {
      note.cw = this.config.posting.contentWarningText || '緊急地震速報';
    }

    return note;
  }

  /**
   * Check if an EEW should be posted
   */
  private shouldPost(message: EEWMessage): boolean {
    const data = message.data;
    const keyInfo = EEWParser.extractKeyInfo(data);

    // Check cancellation filter
    if (data.isCanceled && !this.config.posting.includeCancellations) {
      return false;
    }

    // Check warning-only filter
    if (this.config.posting.onlyWarnings && !data.isWarning && !data.isCanceled) {
      return false;
    }

    // Check severity threshold
    const severity = EEWParser.getSeverityLevel(data);
    if (severity < this.config.posting.minSeverity) {
      return false;
    }

    // Check earthquake-specific filters
    if (keyInfo.earthquake) {
      // Magnitude filter
      if (this.config.filters.minMagnitude && 
          keyInfo.earthquake.magnitude < this.config.filters.minMagnitude) {
        return false;
      }

      // Depth filter
      if (this.config.filters.maxDepth && 
          keyInfo.earthquake.depth > this.config.filters.maxDepth) {
        return false;
      }

      // Region filters
      const affectedRegions = keyInfo.affectedAreas.regions.map(r => r.code);
      
      if (this.config.filters.allowedRegions) {
        const hasAllowedRegion = affectedRegions.some(code => 
          this.config.filters.allowedRegions!.includes(code)
        );
        if (!hasAllowedRegion) return false;
      }

      if (this.config.filters.blockedRegions) {
        const hasBlockedRegion = affectedRegions.some(code => 
          this.config.filters.blockedRegions!.includes(code)
        );
        if (hasBlockedRegion) return false;
      }
    }

    // Check if this is a significant update
    if (this.state.lastPostedEEW) {
      return EEWParser.isSignificantUpdate(data, this.state.lastPostedEEW);
    }

    return true;
  }

  /**
   * Process queued messages
   */
  private async processQueue(): Promise<void> {
    if (this.state.rateLimitQueue.length === 0) return;

    const message = this.state.rateLimitQueue.shift()!;
    
    // Check if enough time has passed
    const now = Date.now();
    const timeSinceLastPost = now - this.state.lastPostTime;
    
    if (timeSinceLastPost >= this.config.posting.rateLimitMs) {
      await this.postEEW(message);
    } else {
      // Put it back in the queue
      this.state.rateLimitQueue.unshift(message);
    }
  }

  /**
   * Test the Misskey connection
   */
  async testConnection(): Promise<boolean> {
    return this.client.testConnection();
  }

  /**
   * Get posting statistics
   */
  getStats(): PostingState & { queueLength: number } {
    return {
      ...this.state,
      queueLength: this.state.rateLimitQueue.length
    };
  }

  /**
   * Clear the queue and reset state
   */
  reset(): void {
    this.state = {
      lastPostTime: 0,
      lastPostedEEW: null,
      postCount: 0,
      rateLimitQueue: []
    };
  }

  /**
   * Post a test message
   */
  async postTest(): Promise<boolean> {
    try {
      const note: MisskeyNote = {
        text: '🧪 EEW4Reso テスト投稿\n\n緊急地震速報の投稿機能をテストしています。\n\n⏰ ' + new Date().toLocaleString('ja-JP'),
        visibility: this.config.posting.visibility,
        localOnly: this.config.posting.localOnly,
      };

      const result = await this.client.createNote(note);
      console.log(`Test post successful: ${result.id}`);
      return true;
    } catch (error) {
      console.error('Test post failed:', error);
      return false;
    }
  }

  /**
   * Create a posting service with default config
   */
  static createDefault(misskeyHost: string, misskeyToken: string): EEWPostingService {
    const config: PostingConfig = {
      misskey: {
        host: misskeyHost,
        token: misskeyToken,
        timeout: 30000
      },
      posting: {
        enabled: true,
        minSeverity: 30, // Roughly intensity 3+ or magnitude 3+
        onlyWarnings: false,
        includeCancellations: true,
        visibility: 'public',
        localOnly: false,
        useContentWarning: false,
        contentWarningText: '緊急地震速報',
        rateLimitMs: 2000 // 2 seconds between posts
      },
      filters: {
        minMagnitude: 3.0,
        maxDepth: 700 // Very deep earthquakes are usually not felt
      }
    };

    return new EEWPostingService(config);
  }

  /**
   * Create a posting service for warnings only
   */
  static createWarningsOnly(misskeyHost: string, misskeyToken: string): EEWPostingService {
    const config: PostingConfig = {
      misskey: {
        host: misskeyHost,
        token: misskeyToken,
        timeout: 30000
      },
      posting: {
        enabled: true,
        minSeverity: 50, // Roughly intensity 5+ or magnitude 5+
        onlyWarnings: true,
        includeCancellations: true,
        visibility: 'public',
        localOnly: false,
        useContentWarning: true,
        contentWarningText: '緊急地震速報（警報）',
        rateLimitMs: 1000
      },
      filters: {
        minMagnitude: 4.5
      }
    };

    return new EEWPostingService(config);
  }
}