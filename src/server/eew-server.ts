import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import * as dotenv from 'dotenv';
import { EEWParser } from '../parser/eew-parser';
import { EEWPostingService } from '../services/eew-posting-service';
import { EEWMessage } from '../types/eew';
import { JSTDate } from '../utils/timezone';
import { hasStandardEEWData } from '../utils/type-guards';

// Load environment variables
dotenv.config();

export class EEWServer {
  private app: Application;
  private postingService: EEWPostingService | null = null;
  private stats = {
    totalReceived: 0,
    totalProcessed: 0,
    totalPosted: 0,
    errors: 0,
    startTime: Date.now()
  };

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.initializePostingService();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // Logging middleware
    this.app.use(morgan('combined'));

    // JSON parsing middleware
    this.app.use(express.json({ limit: '10mb' }));

    // Error handling middleware
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Server error:', err);
      this.stats.errors++;
      res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        uptime: Date.now() - this.stats.startTime,
        stats: this.stats,
        posting: {
          enabled: this.postingService !== null,
          connected: this.postingService ? 'unknown' : false
        }
      });
    });

    // Main EEW receiving endpoint
    this.app.post('/receive', this.handleEEWReceive.bind(this));

    // Stats endpoint
    this.app.get('/stats', (req: Request, res: Response) => {
      const uptimeMs = Date.now() - this.stats.startTime;
      const uptimeMinutes = Math.floor(uptimeMs / 60000);
      
      res.json({
        ...this.stats,
        uptime: {
          ms: uptimeMs,
          minutes: uptimeMinutes,
          formatted: this.formatUptime(uptimeMs)
        },
        posting: this.postingService ? this.postingService.getStats() : null
      });
    });

    // Test posting endpoint
    this.app.post('/test', async (req: Request, res: Response) => {
      if (!this.postingService) {
        res.status(503).json({ error: 'Posting service not available' });
        return;
      }

      try {
        const success = await this.postingService.postTest();
        res.json({ success, message: success ? 'Test post successful' : 'Test post failed' });
      } catch (error) {
        console.error('Test post error:', error);
        res.status(500).json({ error: 'Test post failed', details: error instanceof Error ? error.message : String(error) });
      }
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });
  }

  private async handleEEWReceive(req: Request, res: Response): Promise<void> {
    try {
      this.stats.totalReceived++;

      // Validate request body
      if (!req.body) {
        res.status(400).json({ error: 'Request body is required' });
        return;
      }

      // Handle both single JSON object and newline-separated JSON
      let messages: EEWMessage[] = [];

      if (typeof req.body === 'string') {
        // Handle newline-separated JSON string
        messages = EEWParser.parseString(req.body);
      } else if (Array.isArray(req.body)) {
        // Handle array of JSON objects
        for (const item of req.body) {
          const jsonString = typeof item === 'string' ? item : JSON.stringify(item);
          const message = EEWParser.parseLine(jsonString);
          if (message) messages.push(message);
        }
      } else {
        // Handle single JSON object
        const jsonString = JSON.stringify(req.body);
        const message = EEWParser.parseLine(jsonString);
        if (message) messages.push(message);
      }

      if (messages.length === 0) {
        res.status(400).json({ error: 'No valid EEW messages found' });
        return;
      }

      this.stats.totalProcessed += messages.length;

      // Process messages
      const results = [];
      for (const message of messages) {
        try {
          const posted = this.postingService ? await this.postingService.processEEW(message) : false;
          if (posted) this.stats.totalPosted++;

          results.push({
            timestamp: message.timestamp,
            type: hasStandardEEWData(message) 
              ? (message.data.isCanceled ? 'cancel' : (message.data.isWarning ? 'warning' : 'forecast'))
              : 'unknown',
            posted,
            summary: this.createMessageSummary(message)
          });

          console.log(`EEW processed: ${results[results.length - 1].summary} (posted: ${posted})`);
        } catch (error) {
          console.error('Error processing EEW message:', error);
          this.stats.errors++;
          results.push({
            timestamp: message.timestamp,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      res.json({
        success: true,
        processed: messages.length,
        results
      });

    } catch (error) {
      console.error('Error handling EEW receive:', error);
      this.stats.errors++;
      res.status(500).json({ 
        error: 'Failed to process EEW data',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private createMessageSummary(message: EEWMessage): string {
    // Handle string data (EEWBot format)
    if (!hasStandardEEWData(message)) {
      return '📡 EEW情報 (EEWBot形式)';
    }
    
    const data = message.data;
    
    if (data.isCanceled) {
      return '🚫 EEW取り消し';
    }

    const keyInfo = EEWParser.extractKeyInfo(data);
    
    if (!keyInfo.earthquake) {
      return '📡 EEW情報';
    }

    const type = data.isWarning ? '🚨警報' : '📊予報';
    const epicenter = keyInfo.earthquake.epicenter.name;
    const magnitude = `M${keyInfo.earthquake.magnitude}`;
    const intensity = keyInfo.maxIntensity 
      ? EEWParser.formatIntensity(keyInfo.maxIntensity.from, keyInfo.maxIntensity.to)
      : '';

    return `${type} ${epicenter} ${magnitude} ${intensity}`.trim();
  }

  private initializePostingService(): void {
    const misskeyHost = process.env.MISSKEY_HOST;
    const misskeyToken = process.env.MISSKEY_TOKEN;

    if (misskeyHost && misskeyToken) {
      try {
        const postingEnabled = process.env.POSTING_ENABLED !== 'false';
        
        if (postingEnabled) {
          if (process.env.POSTING_ONLY_WARNINGS === 'true') {
            this.postingService = EEWPostingService.createWarningsOnly(misskeyHost, misskeyToken);
            console.log('✅ Misskey posting service initialized (warnings only)');
          } else {
            this.postingService = EEWPostingService.createDefault(misskeyHost, misskeyToken);
            console.log('✅ Misskey posting service initialized (default)');
          }

          // Test connection
          this.postingService.testConnection().then(connected => {
            if (connected) {
              console.log('✅ Misskey connection test successful');
            } else {
              console.warn('⚠️ Misskey connection test failed');
            }
          });
        } else {
          console.log('📴 Misskey posting disabled by configuration');
        }
      } catch (error) {
        console.error('❌ Failed to initialize Misskey posting service:', error);
      }
    } else {
      console.log('📴 Misskey posting not configured (missing MISSKEY_HOST or MISSKEY_TOKEN)');
    }
  }

  private formatUptime(ms: number): string {
    return JSTDate.formatUptime(ms);
  }

  public start(port: number = 3338): void {
    this.app.listen(port, () => {
      console.log(`🚀 EEW Server running on port ${port}`);
      console.log(`📡 Receiving endpoint: POST http://localhost:${port}/receive`);
      console.log(`💊 Health check: GET http://localhost:${port}/health`);
      console.log(`📊 Statistics: GET http://localhost:${port}/stats`);
      console.log(`🧪 Test posting: POST http://localhost:${port}/test`);
    });
  }

  public getApp(): Application {
    return this.app;
  }

  public getStats() {
    return { ...this.stats };
  }
}